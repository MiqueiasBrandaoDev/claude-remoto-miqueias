"use client";

import { PanelLeft, History, Plus } from "lucide-react";
import { Robot } from "@/components/ui/robot";
import { cn } from "@/lib/utils";

export function Header({
  explorerOpen,
  onToggleExplorer,
  online,
  onOpenHistory,
  onNewChat,
}: {
  explorerOpen: boolean;
  onToggleExplorer: () => void;
  online: boolean;
  onOpenHistory: () => void;
  onNewChat: () => void;
}) {
  return (
    <header className="flex items-center justify-between px-2 sm:px-3 h-14 border-b border-border shrink-0 bg-panel/40 backdrop-blur">
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        <button
          onClick={onToggleExplorer}
          title={explorerOpen ? "Ocultar arquivos" : "Mostrar arquivos"}
          className={cn(
            "grid place-items-center w-10 h-10 rounded-lg transition-colors shrink-0",
            explorerOpen ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-panel-2 hover:text-foreground"
          )}
        >
          <PanelLeft className="w-[18px] h-[18px]" />
        </button>
        <div className="flex items-center gap-2 pl-0.5 sm:pl-1 min-w-0">
          <Robot className="w-7 h-7 shrink-0" />
          <div className="leading-tight min-w-0">
            <div className="text-sm font-semibold truncate">Claude</div>
            <div className="text-[11px] text-muted-foreground truncate">Assistente do seu workspace</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
        <span
          title={online ? "conectado" : "offline"}
          className={cn(
            "w-2 h-2 rounded-full mr-0.5 sm:mr-1 shrink-0",
            online ? "bg-emerald-400 shadow-[0_0_7px] shadow-emerald-400" : "bg-red-500/70"
          )}
        />
        <IconButton title="Historico" onClick={onOpenHistory}>
          <History className="w-[18px] h-[18px]" />
        </IconButton>
        <IconButton title="Nova conversa" onClick={onNewChat}>
          <Plus className="w-[18px] h-[18px]" />
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid place-items-center w-10 h-10 rounded-lg text-muted-foreground hover:bg-panel-2 hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}
