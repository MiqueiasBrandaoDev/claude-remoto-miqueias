// ============================================================================
// PAINEL IA - WORKER LOCAL (chat transparente)
// ----------------------------------------------------------------------------
// UM usuario (o dono da maquina), UMA assinatura Anthropic.
//  - Auth: token da assinatura via CLAUDE_CODE_OAUTH_TOKEN (.env) ou a credencial
//    local ja logada. Sem copiar credencial -> sem "sessao expirou".
//  - Workspace: a pasta configurada em WORKSPACE_DIR.
//  - Historico: o MESMO do Claude Code / extensao do VS Code para essa pasta,
//    lido de ~/.claude/projects/<pasta-encodada>. Nada isolado, nada duplicado.
//
// 100% TRANSPARENTE: sem guardrails, sem mascarar slash/modelo. O que o usuario
// manda e o que a IA responde vao crus. Mostra TODA atividade da IA (criar/ler/
// editar arquivo, bash, busca) via cartoes de atividade.
//
// Rodar:  node worker.js   (le .env com CLAUDE_CODE_OAUTH_TOKEN opcional)
// ============================================================================

import { spawn, execSync } from 'node:child_process';
import { mkdirSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import os from 'node:os';
import WebSocket from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carrega variaveis de .env (token da conta etc) antes de tudo.
function loadEnv() {
  const files = [join(__dirname, '..', '.env'), join(__dirname, '.env')];
  for (const f of files) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  }
}
loadEnv();

function resolveClaudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'which claude';
    const out = execSync(cmd, { encoding: 'utf8' }).split(/\r?\n/).find(Boolean);
    if (out) return out.trim();
  } catch {}
  return 'claude';
}
const CLAUDE_BIN = resolveClaudeBin();

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:8787';
const WORKER_TOKEN = process.env.WORKER_TOKEN || 'troque-esse-token';
const MODEL = process.env.MODEL || 'sonnet';
const OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN || '';

const WORKSPACE = process.env.WORKSPACE_DIR || join(__dirname, 'empresa', 'workspace');
// Config do Claude Code: o MESMO do VS Code/CLI (~/.claude), pra o historico e as
// conversas serem exatamente os dessa pasta. Nada de config isolado por usuario.
const CLAUDE_HOME = process.env.CLAUDE_CONFIG_DIR || join(os.homedir(), '.claude');
const MODEL_FILE = join(__dirname, 'model.txt');
const VALID_MODELS = ['haiku', 'sonnet', 'opus'];

// Instrucao extra pro painel: impede o modelo de "vazar" sintaxe de ferramenta
// como texto (ex.: Agent({...}) / Task({...})), que renderiza horrivel no chat.
const PANEL_SYSTEM =
  'Voce e o assistente deste painel, conversando em portugues. Responda sempre ' +
  'em linguagem natural e direta. NUNCA escreva chamadas de ferramenta como ' +
  'texto (por exemplo Agent({...}), Task({...}) ou qualquer sintaxe de funcao): ' +
  'use a ferramenta de verdade quando existir, ou, se ela nao estiver disponivel ' +
  'aqui, apenas explique em uma frase o que voce faria. Nunca exponha sintaxe ' +
  'interna de ferramentas pro usuario.';

mkdirSync(WORKSPACE, { recursive: true });
console.log('[worker] claude bin:', CLAUDE_BIN);
console.log('[worker] workspace:', WORKSPACE);
console.log('[worker] config (~/.claude):', CLAUDE_HOME);
console.log('[worker] auth:', OAUTH_TOKEN ? 'token da assinatura (env) OK' : 'credencial local ja logada');

let ws;
let reconnectTimer = null;
let heartbeat = null;

// Keepalive: mantem a ponte viva mesmo em tarefas longas sem output (senao o
// proxy derruba a conexao ociosa e a resposta se perde).
function startHeartbeat() {
  stopHeartbeat();
  heartbeat = setInterval(() => send({ type: 'ping' }), 25000);
}
function stopHeartbeat() {
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
}

function connect() {
  console.log('[worker] conectando em', SERVER_URL);
  ws = new WebSocket(SERVER_URL);
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'register', role: 'worker', token: WORKER_TOKEN, host: os.hostname() }));
    startHeartbeat();
  });
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === 'registered') console.log('[worker] registrado. pronto.');
    if (msg.type === 'error') console.error('[worker] erro do servidor:', msg.message);
    if (msg.type === 'run') runJob(msg);
    if (msg.type === 'history-list') listHistory(msg);
    if (msg.type === 'history-load') loadHistory(msg);
    if (msg.type === 'fs-tree') fsTree(msg);
    if (msg.type === 'fs-read') fsRead(msg);
    if (msg.type === 'list-commands') listCommands(msg);
    if (msg.type === 'set-model') setModel(msg);
  });
  ws.on('close', () => { console.log('[worker] caiu, reconectando...'); stopHeartbeat(); scheduleReconnect(); });
  ws.on('error', (err) => console.error('[worker] socket:', err.message));
}
function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 1500);
}
function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// Modelo preferido (setado via /model). Persistido em model.txt (unico).
// ---------------------------------------------------------------------------
function loadModel() {
  try {
    const saved = readFileSync(MODEL_FILE, 'utf8').trim();
    if (VALID_MODELS.includes(saved)) return saved;
  } catch {}
  return MODEL;
}
function setModel({ jobId, model }) {
  const m = String(model || '').toLowerCase();
  if (!VALID_MODELS.includes(m)) { send({ type: 'set-model', jobId, ok: false, error: 'modelo invalido' }); return; }
  try { writeFileSync(MODEL_FILE, m); } catch {}
  console.log(`[set-model] -> ${m}`);
  send({ type: 'set-model', jobId, ok: true, model: m });
}

// ---------------------------------------------------------------------------
// Atividade da IA (transparencia): traduz um tool_use em cartao pro usuario.
// ---------------------------------------------------------------------------
function relTo(workspace, p) {
  if (!p) return p;
  const norm = String(p).replace(/\\/g, '/');
  const wsn = workspace.replace(/\\/g, '/').replace(/\/+$/, '');
  if (norm === wsn) return '';
  if (norm.startsWith(wsn + '/')) return norm.slice(wsn.length + 1);
  return norm;
}
function sanitizeCmd(workspace, cmd) {
  let c = String(cmd || '');
  const wsB = workspace.replace(/\//g, '\\');
  const wsF = workspace.replace(/\\/g, '/');
  c = c.split(wsB + '\\').join('').split(wsB).join('').split(wsF + '/').join('').split(wsF).join('');
  return c.replace(/\s+/g, ' ').trim().slice(0, 120);
}
function buildActivity(block, workspace) {
  const name = block.name;
  const i = block.input || {};
  if (name === 'Write') return { tool: name, action: 'criou', path: relTo(workspace, i.file_path), label: null };
  if (name === 'Edit' || name === 'MultiEdit') return { tool: name, action: 'editou', path: relTo(workspace, i.file_path), label: null };
  if (name === 'NotebookEdit') return { tool: name, action: 'editou', path: relTo(workspace, i.notebook_path), label: null };
  if (name === 'Read') return { tool: name, action: 'leu', path: relTo(workspace, i.file_path), label: null };
  if (name === 'Bash') return { tool: name, action: 'executou', path: null, label: sanitizeCmd(workspace, i.command) };
  if (name === 'Glob') return { tool: name, action: 'buscou', path: null, label: i.pattern || null };
  if (name === 'Grep') return { tool: name, action: 'buscou', path: null, label: i.pattern || null };
  if (name === 'WebFetch') return { tool: name, action: 'acessou', path: null, label: i.url || null };
  if (name === 'WebSearch') return { tool: name, action: 'pesquisou', path: null, label: i.query || null };
  return null;
}

function runJob({ jobId, prompt, permissionMode, resume }) {
  const model = loadModel();

  // prompt vai CRU (sem mascarar), por STDIN (evita problema de escaping).
  const args = [
    '-p',
    '--model', model,
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--permission-mode', permissionMode || 'acceptEdits',
    '--append-system-prompt', PANEL_SYSTEM,
  ];
  if (resume) args.push('--resume', resume);

  console.log(`[job ${jobId}] modelo=${model}${resume ? ' resume=' + resume : ''}`);
  const started = Date.now();

  // usa o ~/.claude padrao (mesmo do VS Code) -> conversas caem no historico da pasta.
  const childEnv = { ...process.env, CLAUDE_CONFIG_DIR: CLAUDE_HOME };
  if (OAUTH_TOKEN) childEnv.CLAUDE_CODE_OAUTH_TOKEN = OAUTH_TOKEN;
  delete childEnv.ANTHROPIC_API_KEY;

  const child = spawn(CLAUDE_BIN, args, { cwd: WORKSPACE, env: childEnv, shell: process.platform === 'win32' && !/\.(exe|cmd|bat)$/i.test(CLAUDE_BIN) });
  child.stdin.write(prompt);
  child.stdin.end();

  let buffer = '';
  let sessionId = null;
  let costUsd = null;
  let sawAnyText = false;

  child.stdout.on('data', (data) => {
    buffer += data.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) handleLine(line);
    }
  });

  function handleLine(line) {
    let evt;
    try { evt = JSON.parse(line); } catch { return; }
    if (evt.type === 'system' && evt.subtype === 'init') { sessionId = evt.session_id || sessionId; return; }
    if (evt.type === 'stream_event' && evt.event?.delta?.type === 'text_delta') {
      sawAnyText = true;
      send({ type: 'chunk', jobId, text: evt.event.delta.text });
      return;
    }
    if (evt.type === 'assistant' && Array.isArray(evt.message?.content)) {
      for (const block of evt.message.content) {
        if (block?.type === 'tool_use') {
          const a = buildActivity(block, WORKSPACE);
          if (a) send({ type: 'activity', jobId, ...a });
        }
      }
      return;
    }
    if (evt.type === 'result') {
      sessionId = evt.session_id || sessionId;
      costUsd = typeof evt.total_cost_usd === 'number' ? evt.total_cost_usd : costUsd;
      if (!sawAnyText && evt.result) send({ type: 'chunk', jobId, text: evt.result });
    }
  }

  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });
  child.on('error', (err) => send({ type: 'job-error', jobId, message: 'nao consegui iniciar o claude: ' + err.message }));
  child.on('close', (code) => {
    if (buffer.trim()) handleLine(buffer.trim());
    if (code !== 0 && !sawAnyText) {
      send({ type: 'job-error', jobId, message: `claude saiu ${code}. ${stderr.slice(0, 300)}` });
      return;
    }
    const durationMs = Date.now() - started;
    console.log(`[job ${jobId}] ok em ${durationMs}ms`);
    send({ type: 'done', jobId, sessionId, costUsd, durationMs });
  });
}

// ---------------------------------------------------------------------------
// HISTORICO: o MESMO do Claude Code / VS Code para ESTA pasta.
// O Claude Code guarda cada conversa em ~/.claude/projects/<pasta-encodada>/*.jsonl.
// A pasta e o caminho absoluto com todo caractere nao-alfanumerico virando "-".
// ---------------------------------------------------------------------------
function encodePath(p) {
  return p.replace(/[^a-zA-Z0-9]/g, '-');
}
function workspaceHistoryDir() {
  const projectsBase = join(CLAUDE_HOME, 'projects');
  if (!existsSync(projectsBase)) return null;
  const wantEnc = encodePath(resolve(WORKSPACE)).toLowerCase();
  let names = [];
  try { names = readdirSync(projectsBase, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return null; }
  // 1) casa pelo nome encodado (case-insensitive: Windows nao diferencia)
  const hit = names.find((n) => n.toLowerCase() === wantEnc);
  if (hit) return join(projectsBase, hit);
  // 2) fallback: casa pelo campo cwd salvo dentro dos JSONL
  const wantAbs = resolve(WORKSPACE).replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
  for (const n of names) {
    const dir = join(projectsBase, n);
    let files = [];
    try { files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')); } catch { continue; }
    if (!files.length) continue;
    try {
      const firstLine = readFileSync(join(dir, files[0]), 'utf8').split('\n').find((l) => l.trim());
      const o = firstLine ? JSON.parse(firstLine) : null;
      const cwd = (o?.cwd || '').replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
      if (cwd && cwd === wantAbs) return dir;
    } catch {}
  }
  return null;
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('');
  return '';
}
function readSessionMeta(file) {
  // customTitle = nome que o usuario renomeou (igual a aba do VS Code). Vence tudo.
  // aiTitle = titulo gerado pela IA. firstUser = primeira mensagem (ultimo recurso).
  let customTitle = null, aiTitle = null, firstUser = null, updatedAt = null, turns = 0, sidechain = false;
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (o.isSidechain === true) sidechain = true; // conversa de sub-agente: nao listar
      if (o.type === 'custom-title') { if (o.customTitle) customTitle = o.customTitle; } // rename manual (o mais recente vence)
      else if (o.type === 'ai-title') { if (o.aiTitle) aiTitle = o.aiTitle; }
      else if (o.type === 'summary') { if (o.summary && !aiTitle) aiTitle = o.summary; }
      else if (o.type === 'user' && o.message?.role === 'user') {
        const t = extractText(o.message.content).trim();
        // ignora wrappers internos e comandos crus na contagem/titulo
        const real = t && !t.startsWith('<') && !t.startsWith('Caveat:');
        if (real && !firstUser) firstUser = t;
        if (real) turns++;
      }
      if (o.timestamp) updatedAt = o.timestamp;
    }
  } catch {}
  const sessionId = file.split(/[\\/]/).pop().replace(/\.jsonl$/, '');
  const title = customTitle || aiTitle || (firstUser ? firstUser.slice(0, 60) : 'Conversa sem titulo');
  return {
    sessionId,
    title,
    custom: !!customTitle,
    updatedAt: updatedAt || null,
    turns,
    sidechain,
    mtime: statSync(file).mtimeMs,
  };
}
function listHistory({ jobId }) {
  const dir = workspaceHistoryDir();
  const sessions = [];
  if (dir) {
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.jsonl')) { try { sessions.push(readSessionMeta(join(dir, f))); } catch {} }
    }
  }
  const clean = sessions.filter((s) => s.turns > 0 && !s.sidechain).sort((a, b) => b.mtime - a.mtime);
  console.log(`[history-list] ${clean.length} conversas em ${dir || '(nenhuma pasta de historico)'}`);
  send({ type: 'history-list', jobId, sessions: clean });
}
function loadHistory({ jobId, sessionId }) {
  const dir = workspaceHistoryDir();
  const messages = [];
  const file = dir ? join(dir, sessionId + '.jsonl') : null;
  if (file && existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (o.type === 'user' && o.message?.role === 'user') {
        const text = extractText(o.message.content).trim();
        // pula wrappers internos do Claude Code (nao sao mensagens reais do usuario)
        if (text && !text.startsWith('<local-command-caveat>') && !text.startsWith('<command-') && !text.startsWith('Caveat:')) {
          messages.push({ role: 'user', text });
        }
        continue;
      }
      if (o.type === 'assistant' && Array.isArray(o.message?.content)) {
        for (const block of o.message.content) {
          if (block?.type === 'text' && block.text && block.text.trim()) {
            const tx = block.text.trim();
            if (tx === 'No response requested.' || tx.startsWith('<command-')) continue;
            // pula artefato de chamada de ferramenta vazada como texto (Agent({...}), Task({...}))
            if (/^(Agent|Task)\s*\(\s*\{/.test(tx)) continue;
            messages.push({ role: 'assistant', text: block.text });
          } else if (block?.type === 'tool_use') {
            const a = buildActivity(block, WORKSPACE);
            if (a) messages.push({ role: 'activity', ...a });
          }
        }
      }
    }
  }
  console.log(`[history-load] sessao=${sessionId} -> ${messages.length} itens`);
  send({ type: 'history-load', jobId, sessionId, messages });
}

// ---------------------------------------------------------------------------
// SLASH COMMANDS: built-in + comandos da equipe (workspace/.claude/commands e
// ~/.claude/commands globais). Alimenta o autocomplete do "/".
// ---------------------------------------------------------------------------
// So comandos que FUNCIONAM na interface do painel (cada um tem uma acao nativa).
const BUILTIN_COMMANDS = [
  { name: '/help', description: 'Mostra os comandos disponiveis' },
  { name: '/clear', description: 'Limpa a conversa' },
  { name: '/resume', description: 'Abre o historico de conversas' },
  { name: '/model', description: 'Ver ou trocar o modelo (rapido/padrao/avancado)' },
  { name: '/cost', description: 'Mostra o custo da sessao' },
  { name: '/memory', description: 'Abre o contexto do projeto (CLAUDE.md)' },
  { name: '/agents', description: 'Lista os comandos/skills da equipe' },
  { name: '/review', description: 'Revisa os arquivos do workspace' },
  { name: '/init', description: 'Cria/atualiza o contexto do projeto' },
];

function scanCommands(dir) {
  const out = [];
  const base = join(dir, 'commands');
  if (!existsSync(base)) return out;
  let entries = [];
  try { entries = readdirSync(base, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    const name = '/' + e.name.replace(/\.md$/i, '');
    let description = '';
    try {
      const c = readFileSync(join(base, e.name), 'utf8');
      const m = c.match(/^\s*description:\s*(.+)$/mi);
      description = m ? m[1].trim().replace(/^["']|["']$/g, '') : (c.split('\n').find((l) => l.trim() && !l.startsWith('---')) || '').slice(0, 70);
    } catch {}
    out.push({ name, description, custom: true });
  }
  return out;
}

function listCommands({ jobId }) {
  // comandos de projeto em workspace/.claude/commands; globais em ~/.claude/commands
  const custom = [...scanCommands(join(WORKSPACE, '.claude')), ...scanCommands(CLAUDE_HOME)];
  const map = new Map();
  for (const c of [...BUILTIN_COMMANDS, ...custom]) map.set(c.name, c);
  const commands = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  console.log(`[list-commands] ${commands.length} comandos (${custom.length} da equipe)`);
  send({ type: 'list-commands', jobId, commands, model: loadModel() });
}

// ---------------------------------------------------------------------------
// FILE EXPLORER: arvore e leitura do WORKSPACE. Confinado a ele.
// ---------------------------------------------------------------------------
const IGNORE = new Set(['node_modules', '.git', '.DS_Store', '.claude']);
function buildTree(dir, rel = '', depth = 0) {
  if (depth > 6) return [];
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const nodes = [];
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue;
    const relPath = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) nodes.push({ type: 'dir', name: e.name, path: relPath, children: buildTree(join(dir, e.name), relPath, depth + 1) });
    else { let size = 0; try { size = statSync(join(dir, e.name)).size; } catch {} nodes.push({ type: 'file', name: e.name, path: relPath, size }); }
  }
  nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
  return nodes;
}
function fsTree({ jobId }) {
  const tree = buildTree(WORKSPACE);
  console.log(`[fs-tree] ${tree.length} itens na raiz`);
  send({ type: 'fs-tree', jobId, tree });
}
function safeResolve(relPath) {
  const clean = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const abs = join(WORKSPACE, clean);
  const normWs = WORKSPACE.replace(/\\/g, '/').replace(/\/+$/, '');
  const normAbs = abs.replace(/\\/g, '/');
  if (normAbs !== normWs && !normAbs.startsWith(normWs + '/')) return null;
  return abs;
}
const TEXT_EXT = /\.(md|markdown|txt|json|js|jsx|ts|tsx|css|scss|html|htm|xml|yaml|yml|csv|py|sh|env|log|sql|toml|ini|conf)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i;
function fsRead({ jobId, path }) {
  const abs = safeResolve(path);
  if (!abs || !existsSync(abs)) { send({ type: 'fs-read', jobId, path, error: 'arquivo nao encontrado' }); return; }
  const name = abs.split(/[\\/]/).pop();
  try {
    if (IMAGE_EXT.test(name)) {
      const b64 = readFileSync(abs).toString('base64');
      const ext = name.split('.').pop().toLowerCase();
      const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : 'image/' + ext;
      send({ type: 'fs-read', jobId, path, name, kind: 'image', dataUrl: `data:${mime};base64,${b64}` });
    } else if (TEXT_EXT.test(name) || statSync(abs).size < 512 * 1024) {
      const content = readFileSync(abs, 'utf8');
      const ext = (name.split('.').pop() || '').toLowerCase();
      send({ type: 'fs-read', jobId, path, name, kind: 'text', ext, content });
    } else {
      send({ type: 'fs-read', jobId, path, name, kind: 'binary', error: 'arquivo binario nao suportado no preview' });
    }
  } catch (err) {
    send({ type: 'fs-read', jobId, path, error: err.message });
  }
}

connect();
