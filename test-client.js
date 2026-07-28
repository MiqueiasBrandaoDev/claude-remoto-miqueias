// Simula o navegador: conecta no server, manda um prompt, imprime o streaming.
import WebSocket from './server/node_modules/ws/index.js';

const url = process.env.SERVER_URL || 'ws://localhost:8787';
const prompt = process.argv[2] || 'responda apenas com a palavra: funcionou';
const client = process.argv[3] || 'default';
const ws = new WebSocket(url);
let got = '';

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'register', role: 'client' }));
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === 'status') {
    console.log('[status] worker online:', msg.workerOnline);
    if (msg.workerOnline) {
      console.log('[client] cliente:', client, '| prompt:', JSON.stringify(prompt));
      ws.send(JSON.stringify({ type: 'run', jobId: 'test1', prompt, client }));
    } else {
      console.log('[client] worker offline, abortando.');
      process.exit(1);
    }
  }
  if (msg.type === 'chunk') { process.stdout.write(msg.text); got += msg.text; }
  if (msg.type === 'done') {
    console.log('\n---');
    console.log('[done] sessao:', msg.sessionId, '| custo:', msg.costUsd, '| ms:', msg.durationMs);
    console.log('[resultado recebido no cliente]:', JSON.stringify(got.trim()));
    process.exit(0);
  }
  if (msg.type === 'job-error') { console.error('\n[erro]', msg.message); process.exit(1); }
});

ws.on('error', (e) => { console.error('[client] erro:', e.message); process.exit(1); });
setTimeout(() => { console.error('[client] timeout'); process.exit(1); }, 90000);
