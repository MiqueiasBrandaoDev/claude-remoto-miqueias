"use client";

import React from "react";
import { Paperclip, ArrowUp, FilePlus2, FilePen, Terminal, Eye, Search, Globe } from "lucide-react";
import { Robot } from "@/components/ui/robot";
import { VoiceInput } from "@/components/ui/voice-input";
import type { ChatMessage, SlashCommand } from "@/hooks/useWorker";
import { mdToHtml } from "@/lib/markdown";
import { cn } from "@/lib/utils";

const PILLS = ["Resuma os arquivos desta pasta", "Organize meus arquivos por tipo", "Crie um documento de resumo"];

// Cartao de atividade (estilo VS Code): mostra arquivo criado/editado ou comando executado.
function ActivityCard({
  activity,
  onOpenFile,
}: {
  activity: Extract<ChatMessage, { role: "activity" }>;
  onOpenFile?: (path: string) => void;
}) {
  const { action, path, label } = activity;
  const ICONS: Record<string, typeof FilePlus2> = {
    criou: FilePlus2,
    editou: FilePen,
    leu: Eye,
    executou: Terminal,
    buscou: Search,
    pesquisou: Globe,
    acessou: Globe,
  };
  const Icon = ICONS[action] || FilePen;
  const clickable = !!path;
  return (
    <button
      onClick={() => path && clickable && onOpenFile?.(path)}
      disabled={!clickable}
      className={cn(
        "flex items-center gap-2 mb-3 w-full text-left text-sm border border-border rounded-lg px-3 py-2 bg-panel-2/40 transition-colors",
        clickable ? "hover:border-primary/50 hover:bg-panel-2 cursor-pointer" : "cursor-default"
      )}
    >
      <Icon className="w-4 h-4 shrink-0 text-primary/80" />
      {path ? (
        <span className="text-muted-foreground truncate">
          <span className="capitalize">{action}</span> <span className="text-foreground/90">{path}</span>
        </span>
      ) : (
        <span className="text-muted-foreground truncate">
          <span className="capitalize">{action}</span>{" "}
          <code className="text-foreground/90 font-mono text-[13px]">{label}</code>
        </span>
      )}
    </button>
  );
}

export function ChatPanel({
  messages,
  streaming,
  online,
  onSubmit,
  onOpenFile,
  commands = [],
}: {
  messages: ChatMessage[];
  streaming: boolean;
  online: boolean;
  onSubmit: (text: string) => void;
  onOpenFile?: (path: string) => void;
  commands?: SlashCommand[];
}) {
  const [input, setInput] = React.useState("");
  const [cmdIndex, setCmdIndex] = React.useState(0);
  const [cmdDismissed, setCmdDismissed] = React.useState(false);
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // autocomplete de slash: ao digitar "/" (sem espaco) mostra a janela de comandos
  const slashActive = input.startsWith("/") && !input.includes(" ") && !input.includes("\n");
  const filteredCmds = slashActive
    ? commands.filter((c) => c.name.toLowerCase().startsWith(input.toLowerCase()))
    : [];
  const cmdOpen = slashActive && filteredCmds.length > 0 && !cmdDismissed;

  const pickCommand = (cmd: SlashCommand) => {
    setInput(cmd.name + " ");
    setCmdDismissed(true);
    setCmdIndex(0);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  React.useEffect(() => {
    const s = scrollRef.current;
    if (s) s.scrollTop = s.scrollHeight;
  }, [messages, streaming]);

  const autoGrow = () => {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 160) + "px";
  };

  const submit = (text: string) => {
    const v = (text || "").trim();
    if (!v || !online || streaming) return;
    onSubmit(v);
    setInput("");
    requestAnimationFrame(autoGrow);
  };

  const empty = messages.length === 0;

  return (
    <div className="h-full flex flex-col min-w-0">
      {/* mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <Robot className="w-16 h-16 mb-4 drop-shadow-[0_0_18px_rgba(242,193,78,0.35)]" />
            <h2 className="text-xl font-semibold mb-2">Converse com o Claude</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-7 leading-relaxed">
              Ele le e edita os arquivos desta pasta. Peca pra resumir, organizar, corrigir ou criar algo, e arraste
              arquivos aqui pra subir.
            </p>
            <div className="flex flex-col gap-2.5 w-full max-w-sm">
              {PILLS.map((p) => (
                <button
                  key={p}
                  onClick={() => submit(p)}
                  className="border border-border rounded-full px-4 py-3 text-sm hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-5">
            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="flex justify-end mb-4">
                    <div className="bg-panel-2 border border-border rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%] whitespace-pre-wrap">
                      {m.text}
                    </div>
                  </div>
                );
              }
              if (m.role === "activity") {
                return <ActivityCard key={i} activity={m} onOpenFile={onOpenFile} />;
              }
              const isLast = i === messages.length - 1;
              return (
                <div key={i} className="flex gap-2.5 mb-5">
                  <Robot className="w-6 h-6 shrink-0 mt-0.5" />
                  <div
                    className={cn("md text-[15px] pt-0.5 flex-1 min-w-0", streaming && isLast && "cursor-blink")}
                    dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="px-4 pb-2 pt-1 shrink-0">
        <div className="max-w-3xl mx-auto relative">
          {/* janela de slash commands (autocomplete estilo VS Code) */}
          {cmdOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 max-h-72 overflow-y-auto bg-panel border border-border rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.55)] py-1.5 z-30">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Comandos</div>
              {filteredCmds.map((c, i) => (
                <button
                  key={c.name}
                  onMouseDown={(e) => { e.preventDefault(); pickCommand(c); }}
                  onMouseEnter={() => setCmdIndex(i)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                    i === cmdIndex ? "bg-panel-2" : "hover:bg-panel-2/60"
                  )}
                >
                  <span className="font-mono text-[13px] text-primary shrink-0">{c.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{c.description}</span>
                  {c.custom && <span className="ml-auto text-[10px] text-muted-foreground/70 shrink-0">equipe</span>}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 bg-panel border border-border rounded-[26px] px-2 pl-3.5 py-2 focus-within:border-primary/50 transition-colors">
            <button
              disabled
              title="Anexar (em breve)"
              className="grid place-items-center w-9 h-9 rounded-full text-muted-foreground/50 cursor-not-allowed"
            >
              <Paperclip className="w-[18px] h-[18px]" />
            </button>
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setCmdDismissed(false);
                setCmdIndex(0);
                autoGrow();
              }}
              onKeyDown={(e) => {
                if (cmdOpen) {
                  if (e.key === "ArrowDown") { e.preventDefault(); setCmdIndex((i) => (i + 1) % filteredCmds.length); return; }
                  if (e.key === "ArrowUp") { e.preventDefault(); setCmdIndex((i) => (i - 1 + filteredCmds.length) % filteredCmds.length); return; }
                  if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickCommand(filteredCmds[cmdIndex]); return; }
                  if (e.key === "Escape") { e.preventDefault(); setCmdDismissed(true); return; }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              placeholder="Peca algo ao Claude... (cole prints aqui)"
              className="flex-1 bg-transparent outline-none resize-none py-2 text-[15px] placeholder:text-muted-foreground max-h-40"
            />
            <VoiceInput onTranscript={(t) => setInput(t)} className="shrink-0" />
            <button
              onClick={() => submit(input)}
              disabled={!online || streaming || !input.trim()}
              title="Enviar"
              className="grid place-items-center w-9 h-9 rounded-full bg-primary text-primary-foreground hover:bg-[var(--accent-soft)] disabled:bg-panel-2 disabled:text-muted-foreground transition-colors shrink-0"
            >
              <ArrowUp className="w-[18px] h-[18px]" />
            </button>
          </div>
          <div className="text-center text-[11px] text-muted-foreground py-1.5">
            Anexe ou cole arquivos · Enter envia · Shift+Enter quebra linha
          </div>
        </div>
      </div>
    </div>
  );
}
