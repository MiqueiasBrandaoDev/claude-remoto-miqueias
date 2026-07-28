# Painel IA (nome provisorio)

Prova de conceito da arquitetura: **painel roda na VPS, o Claude Code roda na sua maquina local** usando a sua assinatura ja logada no CLI. O processamento nunca gasta token cobrado por API; usa o seu plano Pro/Max.

## Arquitetura

```
NAVEGADOR (cliente)  <--HTTPS-->  SERVER (VPS)  <--WebSocket reverso-->  WORKER (sua maquina)
                                  serve a UI,                            roda `claude -p`,
                                  faz a ponte                            usa a assinatura logada
```

O **worker** e quem inicia a conexao de saida para a VPS. Por isso sua maquina nao precisa de IP fixo nem porta aberta. Se a conexao cair, ele reconecta sozinho.

## Como rodar o teste local (tudo na mesma maquina)

Abra **dois terminais**.

### Terminal 1 - servidor (simula a VPS)
```bash
cd server
npm install
npm start
```
Sobe em http://localhost:8787

### Terminal 2 - worker (a sua maquina, com o Claude logado)
```bash
cd worker
npm install
npm start
```

Depois abra http://localhost:8787 no navegador, digite um prompt e clique RODAR.
O texto deve aparecer em streaming, gerado pelo Claude da sua maquina.

## Como vira producao (VPS de verdade)

1. Sobe a pasta `server/` numa VPS (Easypanel/Docker/Node direto).
2. No worker, aponta para a VPS:
   ```bash
   set SERVER_URL=ws://SEU_IP_OU_DOMINIO:8787
   set WORKER_TOKEN=um-token-forte
   npm start
   ```
   (mesmo token nos dois lados)
3. So isso. A UI continua igual; muda apenas o endereco que o worker liga.

## Autenticacao do Claude

O worker roda `claude -p` **sem** `ANTHROPIC_API_KEY` e **sem** `--bare`, entao ele usa
a sessao de assinatura logada no CLI local (`claude` / OAuth Pro/Max). O worker ainda
remove `ANTHROPIC_API_KEY` do ambiente do processo filho por seguranca, garantindo que
nao caia acidentalmente na cobranca por token.

## Variaveis de ambiente

| Var | Onde | Default | Para que |
|-----|------|---------|----------|
| `PORT` | server | 8787 | porta HTTP/WS |
| `WORKER_TOKEN` | server + worker | troque-esse-token | worker se autentica na VPS |
| `SERVER_URL` | worker | ws://localhost:8787 | endereco da VPS |
| `WORK_DIR` | worker | ./sandbox | pasta base onde o Claude opera |

## Estado atual

- [x] Ponte WebSocket reversa VPS <-> worker local
- [x] Execucao headless do Claude usando a assinatura logada
- [x] Streaming token-a-token de volta pro navegador
- [x] Reconexao automatica do worker
- [ ] Uma pasta por cliente (multi-tenant)
- [ ] File explorer + abas (Financeiro/Instagram/Site)
- [ ] Autenticacao de clientes (login/senha)
- [ ] Upload dos arquivos gerados para a VPS
