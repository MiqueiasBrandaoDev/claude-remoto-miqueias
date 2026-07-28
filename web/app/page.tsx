"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Header } from "@/components/panel/Header";
import { FileExplorer } from "@/components/panel/FileExplorer";
import { DocumentViewer } from "@/components/panel/DocumentViewer";
import { ChatPanel } from "@/components/panel/ChatPanel";
import { Panel, PanelGroup } from "react-resizable-panels";
import { Unplug } from "lucide-react";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { useWorker, type ChatMessage, type TreeNode, type HistorySession, type FileContent, type SlashCommand } from "@/hooks/useWorker";
import { cn } from "@/lib/utils";

const EASE = [0.4, 0, 0.2, 1] as const;

// Usuario unico (a maquina e do dono). Mantido como id para o protocolo do worker.
const CLIENT = "miqueias";

function useIsMobile() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

export default function Page() {
  const { online, run, listHistory, loadHistory, fsTree, fsRead, listCommands, setModel } = useWorker();
  const isMobile = useIsMobile();

  const client = CLIENT;
  const [explorerOpen, setExplorerOpen] = React.useState(false);

  const [tree, setTree] = React.useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = React.useState(false);

  const [activeFilePath, setActiveFilePath] = React.useState<string | null>(null);
  const [fileContent, setFileContent] = React.useState<FileContent | null>(null);
  const [fileLoading, setFileLoading] = React.useState(false);

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = React.useState(false);
  const [activeSession, setActiveSession] = React.useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historySessions, setHistorySessions] = React.useState<HistorySession[] | null>(null);
  const [commands, setCommands] = React.useState<SlashCommand[]>([]);
  const [modelName, setModelName] = React.useState("sonnet");
  const [sessionCost, setSessionCost] = React.useState(0);

  // carrega os slash commands disponiveis (built-in + da equipe) + modelo atual
  React.useEffect(() => {
    if (!online) return;
    listCommands(client).then(({ commands, model }) => {
      setCommands(commands);
      setModelName(model);
    });
  }, [online, client, listCommands]);

  // memoria de tamanho dos paineis (persistencia por navegador)
  const lastExp = React.useRef(20);
  const lastDoc = React.useRef(46);
  React.useEffect(() => {
    const e = Number(localStorage.getItem("camozzi:panel-exp"));
    const d = Number(localStorage.getItem("camozzi:panel-doc"));
    if (e > 1) lastExp.current = e;
    if (d > 1) lastDoc.current = d;
  }, []);

  // salva a conversa ativa (pra restaurar no reload)
  React.useEffect(() => {
    if (activeSession) localStorage.setItem("camozzi:lastSession:" + client, activeSession);
  }, [activeSession, client]);

  // restaura a conversa ativa quando o worker fica online
  const restoredRef = React.useRef(false);
  React.useEffect(() => {
    if (!online || restoredRef.current) return;
    restoredRef.current = true;
    const saved = localStorage.getItem("camozzi:lastSession:" + client);
    if (!saved) return;
    loadHistory(client, saved).then((msgs) => {
      if (msgs.length) {
        setMessages(msgs);
        setActiveSession(saved);
      }
    });
  }, [online, client, loadHistory]);

  const loadTree = React.useCallback(
    (c: string) => {
      setTreeLoading(true);
      fsTree(c).then((t) => {
        setTree(t);
        setTreeLoading(false);
      });
    },
    [fsTree]
  );

  const toggleExplorer = () => {
    setExplorerOpen((v) => {
      const nv = !v;
      if (nv && tree.length === 0) loadTree(client);
      return nv;
    });
  };

  const openFile = (path: string) => {
    setActiveFilePath(path);
    setFileLoading(true);
    setFileContent(null);
    if (isMobile) setExplorerOpen(false); // no celular, some o explorer e mostra o doc
    fsRead(client, path).then((fc) => {
      setFileContent(fc);
      setFileLoading(false);
    });
  };
  const closeFile = () => {
    setActiveFilePath(null);
    setFileContent(null);
  };

  const newChat = () => {
    setMessages([]);
    setActiveSession(null);
    localStorage.removeItem("camozzi:lastSession:" + client);
  };

  // adiciona um par pergunta/resposta local (pra comandos que respondem na hora)
  const localReply = (userText: string, botText: string) => {
    setMessages((prev) => [...prev, { role: "user", text: userText }, { role: "assistant", text: botText }]);
  };

  // roda de fato no Claude. displayText controla o que aparece na bolha do usuario.
  const runClaude = (prompt: string, displayText?: string) => {
    setMessages((prev) => [...prev, { role: "user", text: displayText ?? prompt }, { role: "assistant", text: "" }]);
    setStreaming(true);
    run(prompt, {
      client,
      resume: activeSession,
      onChunk: (t) =>
        setMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") copy[copy.length - 1] = { role: "assistant", text: last.text + t };
          return copy;
        }),
      onActivity: (a) =>
        setMessages((prev) => {
          const copy = prev.slice();
          copy.splice(Math.max(0, copy.length - 1), 0, { role: "activity", ...a });
          return copy;
        }),
      onDone: ({ sessionId, costUsd }) => {
        setStreaming(false);
        setActiveSession((s) => s || sessionId || null);
        if (costUsd) setSessionCost((c) => c + costUsd);
        if (explorerOpen) loadTree(client);
        if (activeFilePath) openFile(activeFilePath);
      },
      onError: (msg) => {
        setMessages((prev) => {
          const c = prev.slice();
          c[c.length - 1] = { role: "assistant", text: "Erro: " + msg };
          return c;
        });
        setStreaming(false);
      },
    });
  };

  const MODEL_LABELS: Record<string, string> = { haiku: "rápido", sonnet: "padrão", opus: "avançado" };
  const parseModelArg = (a: string): string | null => {
    const s = a.toLowerCase().trim();
    if (["haiku", "rapido", "rápido"].includes(s)) return "haiku";
    if (["sonnet", "padrao", "padrão", "normal"].includes(s)) return "sonnet";
    if (["opus", "avancado", "avançado", "melhor", "top"].includes(s)) return "opus";
    return null;
  };

  const submit = (text: string) => {
    const t = text.trim();

    // ---- roteador de slash commands: cada um faz uma acao NATIVA no painel ----
    if (t === "/clear") { newChat(); return; }
    if (t === "/resume") { openHistory(); return; }
    if (t === "/memory") { openFile("CLAUDE.md"); if (!isMobile && !explorerOpen) setExplorerOpen(true); return; }
    if (t === "/help") {
      const team = commands.filter((c) => c.custom);
      localReply(
        text,
        "**Comandos disponíveis**\n\n" +
          "- `/clear` limpa a conversa\n- `/resume` abre o histórico\n" +
          "- `/model` ver ou trocar o modelo\n- `/cost` custo da sessão\n- `/memory` abre o contexto do projeto\n" +
          "- `/agents` os comandos da equipe\n- `/review` revisa os arquivos\n- `/init` cria o contexto do projeto\n" +
          (team.length ? "\n**Da equipe**\n" + team.map((c) => `- \`${c.name}\` ${c.description}`).join("\n") : "") +
          "\n\nOu é só pedir em português, sem comando."
      );
      return;
    }
    if (t === "/agents") {
      const team = commands.filter((c) => c.custom);
      localReply(
        text,
        team.length
          ? "**Comandos da equipe (skills)**\n\n" + team.map((c) => `- \`${c.name}\` ${c.description}`).join("\n")
          : "Nenhum comando da equipe ainda. Eles ficam em `workspace/.claude/commands`."
      );
      return;
    }
    if (t === "/cost") {
      localReply(text, `Custo desta sessão até agora: **$${sessionCost.toFixed(4)}**.`);
      return;
    }
    if (t === "/model" || t.startsWith("/model ")) {
      const arg = t.slice(6).trim();
      if (!arg) {
        localReply(text, `Modelo atual: **${MODEL_LABELS[modelName] || modelName}**.\n\nPra trocar: \`/model rápido\`, \`/model padrão\` ou \`/model avançado\`.`);
        return;
      }
      const m = parseModelArg(arg);
      if (!m) { localReply(text, "Modelo inválido. Use `rápido`, `padrão` ou `avançado`."); return; }
      setModel(client, m).then((r) => { if (r.ok) setModelName(m); });
      localReply(text, `Pronto, agora estou no modo **${MODEL_LABELS[m]}**.`);
      return;
    }
    if (t === "/review") { runClaude("Revise os arquivos do workspace e aponte melhorias, erros e inconsistências.", "/review"); return; }
    if (t === "/init") { runClaude("Analise o workspace e crie ou atualize o CLAUDE.md com o contexto do projeto.", "/init"); return; }

    // texto normal e comandos da equipe (custom) vao pro Claude
    runClaude(text);
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    setHistorySessions(null);
    const s = await listHistory(client);
    setHistorySessions(s);
  };
  const pickSession = async (id: string) => {
    setHistoryOpen(false);
    const msgs = await loadHistory(client, id);
    setMessages(msgs);
    setActiveSession(id);
  };

  return (
    <div className="h-full flex flex-col">
      <Header
        explorerOpen={explorerOpen}
        onToggleExplorer={toggleExplorer}
        online={online}
        onOpenHistory={openHistory}
        onNewChat={newChat}
      />

      <div className="flex-1 overflow-hidden relative">
        {/* Estado OFFLINE: a maquina que roda o assistente nao esta conectada */}
        <AnimatePresence>
          {!online && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[70] bg-background/95 backdrop-blur-sm flex items-center justify-center"
            >
              <div className="text-center max-w-sm px-6">
                <div className="mx-auto w-14 h-14 rounded-full bg-panel-2 border border-border grid place-items-center mb-4">
                  <Unplug className="w-7 h-7 text-primary/80" />
                </div>
                <h2 className="text-lg font-semibold mb-2">Máquina não disponível</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  O painel precisa da máquina que roda o assistente estar ligada e conectada.
                  Assim que ela voltar, o painel reconecta sozinho.
                </p>
                <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-primary/70 animate-pulse" />
                  tentando reconectar...
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---------- DESKTOP: paineis redimensionaveis lado a lado ---------- */}
        {!isMobile ? (
          <PanelGroup direction="horizontal" className="h-full">
            {explorerOpen && (
              <>
                <Panel
                  id="explorer"
                  order={1}
                  minSize={14}
                  maxSize={36}
                  defaultSize={lastExp.current}
                  onResize={(s) => {
                    if (s > 1) {
                      lastExp.current = s;
                      localStorage.setItem("camozzi:panel-exp", String(s));
                    }
                  }}
                  className="bg-panel/30 border-r border-border overflow-hidden"
                >
                  <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="h-full"
                  >
                    <FileExplorer
                      tree={tree}
                      loading={treeLoading}
                      activePath={activeFilePath}
                      onOpenFile={openFile}
                      onRefresh={() => loadTree(client)}
                    />
                  </motion.div>
                </Panel>
                <ResizeHandle />
              </>
            )}

            {activeFilePath && (
              <>
                <Panel
                  id="document"
                  order={2}
                  minSize={22}
                  defaultSize={lastDoc.current}
                  onResize={(s) => {
                    if (s > 1) {
                      lastDoc.current = s;
                      localStorage.setItem("camozzi:panel-doc", String(s));
                    }
                  }}
                  className="bg-panel/20 border-r border-border overflow-hidden"
                >
                  <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="h-full"
                  >
                    <DocumentViewer file={fileContent} loading={fileLoading} onClose={closeFile} />
                  </motion.div>
                </Panel>
                <ResizeHandle />
              </>
            )}

            <Panel id="chat" order={3} minSize={24}>
              <ChatPanel messages={messages} streaming={streaming} online={online} onSubmit={submit} onOpenFile={openFile} commands={commands} />
            </Panel>
          </PanelGroup>
        ) : (
          /* ---------- MOBILE: chat sempre inteiro; explorer/doc viram overlay ---------- */
          <div className="h-full">
            <ChatPanel messages={messages} streaming={streaming} online={online} onSubmit={submit} onOpenFile={openFile} commands={commands} />

            {/* explorer como gaveta pela esquerda */}
            <AnimatePresence>
              {explorerOpen && (
                <>
                  <motion.div
                    className="absolute inset-0 bg-black/40 z-40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setExplorerOpen(false)}
                  />
                  <motion.div
                    className="absolute top-0 left-0 h-full w-[86%] max-w-xs bg-panel border-r border-border z-50"
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={{ duration: 0.28, ease: EASE }}
                  >
                    <FileExplorer
                      tree={tree}
                      loading={treeLoading}
                      activePath={activeFilePath}
                      onOpenFile={openFile}
                      onRefresh={() => loadTree(client)}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* documento em tela cheia */}
            <AnimatePresence>
              {activeFilePath && (
                <motion.div
                  className="absolute inset-0 z-[55] bg-background"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.24, ease: EASE }}
                >
                  <DocumentViewer file={fileContent} loading={fileLoading} onClose={closeFile} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* drawer de historico (desktop e mobile) */}
        <AnimatePresence>
          {historyOpen && (
            <>
              <motion.div
                className="absolute inset-0 bg-black/40 z-[58]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setHistoryOpen(false)}
              />
              <motion.div
                className="absolute top-0 right-0 h-full w-[86%] max-w-[340px] bg-panel border-l border-border z-[59] flex flex-col"
                initial={{ x: 360 }}
                animate={{ x: 0 }}
                exit={{ x: 360 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <div className="px-4 h-14 flex items-center justify-between border-b border-border shrink-0">
                  <span className="text-sm font-semibold">Conversas</span>
                  <button onClick={() => setHistoryOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
                    fechar
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {historySessions === null ? (
                    <div className="text-xs text-muted-foreground p-3">carregando...</div>
                  ) : historySessions.length === 0 ? (
                    <div className="text-xs text-muted-foreground p-3">Nenhuma conversa ainda.</div>
                  ) : (
                    historySessions.map((s) => (
                      <button
                        key={s.sessionId}
                        onClick={() => pickSession(s.sessionId)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg mb-1 border border-transparent hover:bg-panel-2 hover:border-border transition-colors",
                          s.sessionId === activeSession && "border-primary bg-primary/5"
                        )}
                      >
                        <div className="text-[13.5px] truncate">{s.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {fmtDate(s.updatedAt)} · {s.turns} msg
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
