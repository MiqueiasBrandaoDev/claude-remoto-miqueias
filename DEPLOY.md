# Deploy do Painel IA Camozzi

Três peças:

| Peça | Onde roda | Função |
|------|-----------|--------|
| **server** | VPS (público) | Ponte WebSocket entre o navegador e a máquina local |
| **web** | VPS ou Vercel | O painel (Next.js) que as pessoas acessam |
| **worker** | Máquina local (esta) | Roda o Claude Code de verdade, na pasta `WORKSPACE_DIR` |

A máquina local (worker) **liga pra VPS** (WebSocket reverso), então não precisa de IP fixo nem porta aberta aqui. Se a máquina estiver desligada/offline, o painel mostra "Máquina não disponível" e reconecta sozinho quando ela voltar.

## 1. Server (ponte) na VPS

Precisa de um domínio com **TLS e WebSocket** (ex: `ponte-painel.camozzi...`). No Easypanel:
- App a partir da pasta `server/` (Dockerfile incluso) ou do repositório.
- Porta interna **8787**.
- Env: `WORKER_TOKEN=<um-segredo-forte>` (o mesmo dos dois lados).
- Habilitar WebSocket no proxy (Easypanel/Traefik já suporta em https).

Fica acessível em `wss://ponte-painel.SEU-DOMINIO`.

## 2. Web (painel)

Env de build: `NEXT_PUBLIC_WS_URL=wss://ponte-painel.SEU-DOMINIO`

- **Vercel (recomendado):** conecta o repo, seta a env, deploy. `output: standalone` já está ligado.
- **VPS (Docker):** usar `web/Dockerfile`, passar `--build-arg NEXT_PUBLIC_WS_URL=wss://...`.

## 3. Worker (esta máquina)

No `.env` da raiz:
```
SERVER_URL=wss://ponte-painel.SEU-DOMINIO
WORKER_TOKEN=<mesmo-segredo-do-server>
WORKSPACE_DIR=D:/documentos/PROJETOS_AIOS/squad-tecnologia
CLAUDE_CODE_OAUTH_TOKEN=<token de 1 ano; ou deixe vazio p/ usar a credencial local>
```
Rodar: `cd worker && node worker.js` (deixar sempre ligado enquanto quiser usar o painel).

## Auth
- **Produção estável:** `claude setup-token` (logado na conta certa) → cola em `CLAUDE_CODE_OAUTH_TOKEN`. Dura ~1 ano, não expira no meio.
- **Sem token:** o worker usa a credencial logada em `worker/usuarios/<user>/.claude` (pra isso hoje copiamos a credencial local).
