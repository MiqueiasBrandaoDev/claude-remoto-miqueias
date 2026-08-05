// ============================================================================
// PAINEL IA - SERVIDOR (roda na VPS)
// ----------------------------------------------------------------------------
// Responsabilidades:
//   1. Servir a UI de teste (public/index.html) para o navegador do cliente.
//   2. Manter uma conexao WebSocket REVERSA com o worker local (a maquina do
//      Miqueias, onde o Claude Code esta logado). O worker sempre inicia a
//      conexao de saida, entao a VPS nunca precisa alcancar a maquina local.
//   3. Rotear jobs: navegador -> servidor -> worker -> claude -> de volta.
//
// O servidor NAO roda o Claude. Ele so distribui trabalho e devolve o stream.
// ============================================================================

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocketServer } from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;

// Token compartilhado simples para o worker se autenticar no servidor.
// Em producao isso vira algo mais forte; aqui e so pra ninguem plugar um
// worker aleatorio na sua VPS.
const WORKER_TOKEN = process.env.WORKER_TOKEN || 'troque-esse-token';
// token que o navegador (cliente logado) apresenta. Vazio = sem trava (dev).
const CLIENT_TOKEN = process.env.CLIENT_TOKEN || '';

// ---------------------------------------------------------------------------
// Estado em memoria (POC). Um worker por vez; clientes (navegadores) varios.
// ---------------------------------------------------------------------------
let workerSocket = null;          // conexao do worker local (a maquina)
const clients = new Set();        // navegadores conectados
const jobToClient = new Map();    // jobId -> socket do navegador que pediu

// ---------------------------------------------------------------------------
// HTTP: serve a pagina de teste.
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    try {
      const html = readFileSync(join(__dirname, 'public', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(500).end('index.html nao encontrado');
    }
    return;
  }
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, workerOnline: !!workerSocket }));
    return;
  }
  res.writeHead(404).end('nao encontrado');
});

// ---------------------------------------------------------------------------
// WebSocket: um unico servidor WS que atende worker e navegadores.
// A primeira mensagem de cada conexao ("register") diz quem e quem.
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server });

function send(sock, obj) {
  if (sock && sock.readyState === sock.OPEN) sock.send(JSON.stringify(obj));
}

function broadcastToClients(obj) {
  for (const c of clients) send(c, obj);
}

wss.on('connection', (sock) => {
  sock.role = null;

  sock.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    // --- Keepalive: mantem a conexao viva durante tarefas longas em silencio
    // (Claude pensando/pesquisando sem emitir nada). Sem isso, proxies derrubam
    // conexoes ociosas por timeout. Worker e navegador mandam ping a cada 25s.
    if (msg.type === 'ping') { send(sock, { type: 'pong' }); return; }

    // --- Handshake: define o papel da conexao ---
    if (msg.type === 'register') {
      if (msg.role === 'worker') {
        if (msg.token !== WORKER_TOKEN) {
          send(sock, { type: 'error', message: 'token invalido' });
          sock.close();
          return;
        }
        sock.role = 'worker';
        workerSocket = sock;
        console.log('[worker] conectado ->', msg.host || 'desconhecido');
        broadcastToClients({ type: 'status', workerOnline: true });
        send(sock, { type: 'registered' });
      } else {
        // cliente (navegador): se CLIENT_TOKEN estiver definido, exige que bata
        // (o token so e entregue pra quem passou pelo login). Sem CLIENT_TOKEN = dev.
        if (CLIENT_TOKEN && msg.token !== CLIENT_TOKEN) {
          send(sock, { type: 'error', message: 'nao autorizado' });
          sock.close();
          return;
        }
        sock.role = 'client';
        clients.add(sock);
        console.log('[client] navegador conectado. total:', clients.size);
        send(sock, { type: 'status', workerOnline: !!workerSocket });
      }
      return;
    }

    // --- Navegador pediu algo que precisa do worker (run / historico / fs) ---
    const CLIENT_REQUESTS = ['run', 'history-list', 'history-load', 'fs-tree', 'fs-read', 'list-commands', 'set-model'];
    if (sock.role === 'client' && CLIENT_REQUESTS.includes(msg.type)) {
      if (!workerSocket) {
        send(sock, { type: 'job-error', jobId: msg.jobId, message: 'worker local offline' });
        return;
      }
      jobToClient.set(msg.jobId, sock);
      if (msg.type === 'run') {
        console.log('[job]', msg.jobId, '| cliente:', msg.client, '|', JSON.stringify(msg.prompt).slice(0, 50));
        send(workerSocket, {
          type: 'run',
          jobId: msg.jobId,
          prompt: msg.prompt,
          client: msg.client || 'default',
          permissionMode: msg.permissionMode || 'acceptEdits',
          resume: msg.resume || null,
        });
      } else {
        // history / fs / list-commands / set-model: repassa parametros
        send(workerSocket, {
          type: msg.type,
          jobId: msg.jobId,
          client: msg.client || 'default',
          sessionId: msg.sessionId || null,
          path: msg.path || null,
          model: msg.model || null,
        });
      }
      return;
    }

    // --- Worker respondeu -> encaminha pro navegador que pediu ---
    if (sock.role === 'worker') {
      const client = jobToClient.get(msg.jobId);
      if (client) send(client, msg);
      if (['done', 'job-error', 'history-list', 'history-load', 'fs-tree', 'fs-read', 'list-commands', 'set-model'].includes(msg.type)) jobToClient.delete(msg.jobId);
      return;
    }
  });

  sock.on('close', () => {
    if (sock.role === 'worker') {
      workerSocket = null;
      console.log('[worker] desconectado');
      broadcastToClients({ type: 'status', workerOnline: false });
    } else if (sock.role === 'client') {
      clients.delete(sock);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n  Painel IA - servidor no ar`);
  console.log(`  UI:     http://localhost:${PORT}`);
  console.log(`  Worker: ws://localhost:${PORT}  (token: ${WORKER_TOKEN})`);
  console.log(`  Aguardando worker local conectar...\n`);
});
