"use client";

import React from "react";
import { ChevronRight, Folder, FolderOpen, FileText, FileCode, Image as ImageIcon, File } from "lucide-react";
import type { TreeNode } from "@/hooks/useWorker";
import { cn } from "@/lib/utils";

function iconFor(name: string) {
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(name)) return ImageIcon;
  if (/\.(js|jsx|ts|tsx|json|css|scss|html?|xml|py|sh|sql|ya?ml|toml)$/i.test(name)) return FileCode;
  if (/\.(md|markdown|txt|log|csv)$/i.test(name)) return FileText;
  return File;
}

function Node({
  node,
  depth,
  activePath,
  onOpenFile,
}: {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  onOpenFile: (path: string) => void;
}) {
  const [open, setOpen] = React.useState(depth < 1);
  const pad = { paddingLeft: 8 + depth * 12 };

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          style={pad}
          className="w-full flex items-center gap-1.5 py-2 sm:py-1.5 pr-2 rounded-md text-sm text-foreground/90 hover:bg-panel-2 active:bg-panel-2 transition-colors"
        >
          <ChevronRight
            className={cn("w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
          />
          {open ? (
            <FolderOpen className="w-4 h-4 shrink-0 text-primary/80" />
          ) : (
            <Folder className="w-4 h-4 shrink-0 text-primary/80" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && (
          <div>
            {node.children.map((c) => (
              <Node key={c.path} node={c} depth={depth + 1} activePath={activePath} onOpenFile={onOpenFile} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const Icon = iconFor(node.name);
  const active = activePath === node.path;
  return (
    <button
      onClick={() => onOpenFile(node.path)}
      style={pad}
      className={cn(
        "w-full flex items-center gap-1.5 py-2 sm:py-1.5 pr-2 rounded-md text-sm transition-colors",
        active ? "bg-primary/15 text-primary" : "text-foreground/80 hover:bg-panel-2 active:bg-panel-2"
      )}
    >
      <span className="w-3.5 shrink-0" />
      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileExplorer({
  tree,
  loading,
  activePath,
  onOpenFile,
  onRefresh,
}: {
  tree: TreeNode[];
  loading: boolean;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="h-full flex flex-col w-full">
      <div className="flex items-center justify-between px-3 h-11 shrink-0 border-b border-border">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Arquivos</span>
        <button
          onClick={onRefresh}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          title="Atualizar"
        >
          atualizar
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-1.5">
        {loading ? (
          <div className="text-xs text-muted-foreground px-2 py-3">carregando...</div>
        ) : tree.length === 0 ? (
          <div className="text-xs text-muted-foreground px-2 py-3">Nenhum arquivo ainda.</div>
        ) : (
          tree.map((n) => (
            <Node key={n.path} node={n} depth={0} activePath={activePath} onOpenFile={onOpenFile} />
          ))
        )}
      </div>
    </div>
  );
}
