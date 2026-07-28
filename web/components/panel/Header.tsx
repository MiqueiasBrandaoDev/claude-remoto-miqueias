"use client";

import { PanelLeft, Settings, History, Plus } from "lucide-react";
import { Robot } from "@/components/ui/robot";
import { cn } from "@/lib/utils";

// Usuarios da Camozzi (edite conforme o time). Cada um tem historico proprio,
// todos compartilham o mesmo workspace da empresa e a mesma assinatura.
const CLIENTS = ["miqueias", "claudio"];

export function Header({
  explorerOpen,
  onToggleExplorer,
  client,
  onClientChange,
  online,
  onOpenHistory,
  onNewChat,
  onOpenSettings,
}: {
  explorerOpen: boolean;
  onToggleExplorer: () => void;
  client: string;
  onClientChange: (c: string) => void;
  online: boolean;
  onOpenHistory: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <header className="flex items-center justify-between px-3 h-14 border-b border-border shrink-0 bg-panel/40 backdrop-blur">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleExplorer}
          title={explorerOpen ? "Ocultar arquivos" : "Mostrar arquivos"}
          className={cn(
            "grid place-items-center w-9 h-9 rounded-lg transition-colors",
            explorerOpen ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-panel-2 hover:text-foreground"
          )}
        >
          <PanelLeft className="w-[18px] h-[18px]" />
        </button>
        <div className="flex items-center gap-2 pl-1">
          <Robot className="w-7 h-7" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Claude</div>
            <div className="text-[11px] text-muted-foreground">Assistente do seu workspace</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span
          title={online ? "conectado" : "offline"}
          className={cn(
            "w-2 h-2 rounded-full mr-1",
            online ? "bg-emerald-400 shadow-[0_0_7px] shadow-emerald-400" : "bg-red-500/70"
          )}
        />
        <select
          value={client}
          onChange={(e) => onClientChange(e.target.value)}
          title="usuário"
          className="bg-panel-2 border border-border rounded-lg px-2.5 py-1.5 text-xs mr-1 outline-none focus:border-primary cursor-pointer"
        >
          {CLIENTS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <IconButton title="Configuracoes" onClick={onOpenSettings}>
          <Settings className="w-[18px] h-[18px]" />
        </IconButton>
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
      className="grid place-items-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-panel-2 hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}
