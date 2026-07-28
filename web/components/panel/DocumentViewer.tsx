"use client";

import React from "react";
import { X, Copy, Check } from "lucide-react";
import type { FileContent } from "@/hooks/useWorker";
import { mdToHtml } from "@/lib/markdown";

export function DocumentViewer({
  file,
  loading,
  onClose,
}: {
  file: FileContent | null;
  loading: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    if (file && file.kind === "text") {
      navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="h-full flex flex-col min-w-0">
      <div className="flex items-center justify-between px-3 h-11 shrink-0 border-b border-border gap-2">
        <span className="text-sm truncate text-foreground/90">
          {file ? file.name : loading ? "abrindo..." : "documento"}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {file && file.kind === "text" && (
            <button
              onClick={copy}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-panel-2 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "copiado" : "copiar"}
            </button>
          )}
          <button
            onClick={onClose}
            className="grid place-items-center w-7 h-7 rounded-md text-muted-foreground hover:bg-panel-2 hover:text-foreground transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && <div className="p-6 text-sm text-muted-foreground">carregando arquivo...</div>}

        {!loading && file && file.kind === "text" && isMarkdown(file.name) && (
          <div className="max-w-3xl mx-auto p-6">
            <div className="md text-[15px]" dangerouslySetInnerHTML={{ __html: mdToHtml(file.content) }} />
          </div>
        )}

        {!loading && file && file.kind === "text" && !isMarkdown(file.name) && (
          <pre className="p-4 text-[13px] leading-relaxed font-mono whitespace-pre overflow-x-auto">
            <code>{file.content}</code>
          </pre>
        )}

        {!loading && file && file.kind === "image" && (
          <div className="p-6 grid place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={file.dataUrl} alt={file.name} className="max-w-full max-h-[80vh] rounded-lg border border-border" />
          </div>
        )}

        {!loading && file && (file.kind === "binary" || file.kind === "error") && (
          <div className="p-6 text-sm text-muted-foreground">{file.error}</div>
        )}
      </div>
    </div>
  );
}

function isMarkdown(name: string) {
  return /\.(md|markdown)$/i.test(name);
}
