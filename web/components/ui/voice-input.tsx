"use client";

import React from "react";
import { Mic } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

interface VoiceInputProps {
  onStart?: () => void;
  onStop?: () => void;
  // recebe o texto transcrito ao vivo (final + parcial) enquanto a pessoa fala
  onTranscript?: (text: string) => void;
  className?: string;
}

export function VoiceInput({ className, onStart, onStop, onTranscript }: VoiceInputProps) {
  const [listening, setListening] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [supported, setSupported] = React.useState(true);

  const recRef = React.useRef<any>(null);
  const finalRef = React.useRef("");
  const shouldListenRef = React.useRef(false); // intencao do usuario (so ele desliga)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // callbacks guardados em ref: assim o reconhecimento NAO e recriado a cada
  // render (era o bug: atualizar o input re-renderizava e matava o microfone).
  const onTranscriptRef = React.useRef(onTranscript);
  const onStartRef = React.useRef(onStart);
  const onStopRef = React.useRef(onStop);
  onTranscriptRef.current = onTranscript;
  onStartRef.current = onStart;
  onStopRef.current = onStop;

  // cria o SpeechRecognition UMA unica vez.
  React.useEffect(() => {
    const SR =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalRef.current += res[0].transcript;
        else interim += res[0].transcript;
      }
      onTranscriptRef.current?.((finalRef.current + interim).trim());
    };

    // Chrome encerra sozinho apos uma pausa. Enquanto o usuario NAO clicou pra
    // parar, reiniciamos automaticamente (com pequeno atraso pra nao dar
    // InvalidStateError). So para de verdade no clique manual.
    rec.onend = () => {
      if (!shouldListenRef.current) return;
      setTimeout(() => {
        if (!shouldListenRef.current) return;
        try {
          rec.start();
        } catch {
          setTimeout(() => {
            if (shouldListenRef.current) {
              try {
                rec.start();
              } catch {}
            }
          }, 350);
        }
      }, 200);
    };

    rec.onerror = (e: any) => {
      // no-speech / aborted sao transitorios: o onend reinicia.
      // so paramos em erros fatais de permissao/dispositivo.
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed" || e?.error === "audio-capture") {
        shouldListenRef.current = false;
        setListening(false);
      }
    };

    recRef.current = rec;
    return () => {
      shouldListenRef.current = false;
      try {
        rec.stop();
      } catch {}
    };
  }, []); // <- UMA vez, nunca recriado por re-render

  const start = () => {
    if (!recRef.current) return;
    shouldListenRef.current = true;
    finalRef.current = "";
    setListening(true);
    setTime(0);
    onStartRef.current?.();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    try {
      recRef.current.start();
    } catch {}
  };

  const stop = () => {
    shouldListenRef.current = false; // <- so aqui o reconhecimento para de verdade
    setListening(false);
    onStopRef.current?.();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      recRef.current?.stop();
    } catch {}
  };

  const toggle = () => (listening ? stop() : start());

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!supported) return null;

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <motion.div
        className={cn(
          "flex p-2 border items-center justify-center rounded-full cursor-pointer transition-colors",
          listening ? "border-primary bg-primary/10" : "border-border hover:bg-panel-2"
        )}
        layout
        transition={{ layout: { duration: 0.4 } }}
        onClick={toggle}
        title={listening ? "Parar (clique pra encerrar)" : "Falar"}
      >
        <div className="h-5 w-5 items-center justify-center flex text-muted-foreground">
          {listening ? (
            <motion.div
              className="w-3.5 h-3.5 bg-primary rounded-sm"
              animate={{ rotate: [0, 180, 360] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </div>
        <AnimatePresence mode="wait">
          {listening && (
            <motion.div
              initial={{ opacity: 0, width: 0, marginLeft: 0 }}
              animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
              exit={{ opacity: 0, width: 0, marginLeft: 0 }}
              transition={{ duration: 0.4 }}
              className="overflow-hidden flex gap-2 items-center justify-center"
            >
              <div className="flex gap-0.5 items-center justify-center">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-0.5 bg-primary rounded-full"
                    initial={{ height: 2 }}
                    animate={{ height: [2, 3 + Math.random() * 10, 3 + Math.random() * 5, 2] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.05, ease: "easeInOut" }}
                  />
                ))}
              </div>
              <div className="text-xs text-muted-foreground w-10 text-center tabular-nums">{formatTime(time)}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
