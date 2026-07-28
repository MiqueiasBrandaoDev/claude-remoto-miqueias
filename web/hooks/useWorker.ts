"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TreeNode = {
  type: "dir" | "file";
  name: string;
  path: string;
  size?: number;
  children?: TreeNode[];
};

export type HistorySession = {
  sessionId: string;
  title: string;
  updatedAt: string | null;
  turns: number;
};

export type Activity = { tool: string; action: string; path?: string | null; label?: string | null };

export type SlashCommand = { name: string; description: string; custom?: boolean };

export type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  | ({ role: "activity" } & Activity);

export type FileContent =
  | { kind: "text"; name: string; ext: string; content: string; path: string }
  | { kind: "image"; name: string; dataUrl: string; path: string }
  | { kind: "binary" | "error"; name?: string; path: string; error: string };

type RunHandlers = {
  onChunk?: (text: string) => void;
  onActivity?: (a: Activity) => void;
  onDone?: (info: { sessionId?: string; costUsd?: number; durationMs?: number }) => void;
  onError?: (message: string) => void;
};

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== "undefined" ? `ws://${window.location.hostname}:8787` : "ws://localhost:8787");

export function useWorker() {
  const [online, setOnline] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const runHandlers = useRef<Map<string, RunHandlers>>(new Map());
  const pending = useRef<Map<string, (msg: any) => void>>(new Map());

  useEffect(() => {
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => ws.send(JSON.stringify({ type: "register", role: "client" }));
      ws.onclose = () => {
        setOnline(false);
        if (!closed) reconnectTimer = setTimeout(connect, 1500);
      };
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "status") {
          setOnline(!!msg.workerOnline);
          return;
        }
        // respostas one-shot (fs / history)
        if (pending.current.has(msg.jobId)) {
          pending.current.get(msg.jobId)!(msg);
          pending.current.delete(msg.jobId);
          return;
        }
        // streaming de run
        const h = runHandlers.current.get(msg.jobId);
        if (!h) return;
        if (msg.type === "chunk") h.onChunk?.(msg.text);
        if (msg.type === "activity") h.onActivity?.({ tool: msg.tool, action: msg.action, path: msg.path, label: msg.label });
        if (msg.type === "done") {
          h.onDone?.({ sessionId: msg.sessionId, costUsd: msg.costUsd, durationMs: msg.durationMs });
          runHandlers.current.delete(msg.jobId);
        }
        if (msg.type === "job-error") {
          h.onError?.(msg.message);
          runHandlers.current.delete(msg.jobId);
        }
      };
    }
    connect();
    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const send = (obj: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  const run = useCallback(
    (prompt: string, opts: { client: string; resume?: string | null } & RunHandlers) => {
      const jobId = "job_" + Date.now() + "_" + Math.floor(performance.now());
      runHandlers.current.set(jobId, opts);
      send({ type: "run", jobId, prompt, client: opts.client, resume: opts.resume || undefined });
      return jobId;
    },
    []
  );

  const request = useCallback((type: string, params: Record<string, any>): Promise<any> => {
    return new Promise((resolve) => {
      const jobId = type + "_" + Date.now() + "_" + Math.floor(performance.now());
      pending.current.set(jobId, resolve);
      send({ type, jobId, ...params });
    });
  }, []);

  const listHistory = useCallback(
    (client: string): Promise<HistorySession[]> =>
      request("history-list", { client }).then((m) => m.sessions || []),
    [request]
  );
  const loadHistory = useCallback(
    (client: string, sessionId: string): Promise<ChatMessage[]> =>
      request("history-load", { client, sessionId }).then((m) => m.messages || []),
    [request]
  );
  const fsTree = useCallback(
    (client: string): Promise<TreeNode[]> => request("fs-tree", { client }).then((m) => m.tree || []),
    [request]
  );
  const fsRead = useCallback(
    (client: string, path: string): Promise<FileContent> =>
      request("fs-read", { client, path }).then((m) => m as FileContent),
    [request]
  );
  const listCommands = useCallback(
    (client: string): Promise<{ commands: SlashCommand[]; model: string }> =>
      request("list-commands", { client }).then((m) => ({ commands: m.commands || [], model: m.model || "sonnet" })),
    [request]
  );
  const setModel = useCallback(
    (client: string, model: string): Promise<{ ok: boolean; model?: string; error?: string }> =>
      request("set-model", { client, model }).then((m) => ({ ok: m.ok, model: m.model, error: m.error })),
    [request]
  );

  return { online, run, listHistory, loadHistory, fsTree, fsRead, listCommands, setModel };
}
