# chq-scraper

Microserviço que faz login no painel admin do chq.com.br, mantém a sessão
persistente, e extrai os dados de um pedido a partir do código dele.

## O que ainda precisa ser ajustado

Os seletores CSS em `session.js` (login) e `scraper.js` (extração) são
**placeholders** — o HTML real do painel do CHQ não foi inspecionado ainda.
Antes de rodar de verdade:

1. Loga no painel admin manualmente e inspeciona (botão direito → Inspecionar)
   os campos de usuário/senha na tela de login, e os campos de
   nome/CPF/endereço/pagamento/frete/valores na tela de um pedido.
2. Ajusta os seletores marcados com `TODO` em `session.js` e `scraper.js`.
3. Alternativa mais rápida: manda pro Claude o HTML de uma página de login e
   de uma página de pedido (Ctrl+U → copiar, ou "Salvar como" → HTML), que os
   seletores corretos são gerados a partir disso.

## Como subir no GitHub (sem terminal)

1. Cria um repositório novo no GitHub (pode ser privado)
2. Na página do repositório, "Add file" → "Upload files"
3. Arrasta todos os arquivos desta pasta (exceto `.env`, que não deve existir
   ainda nesse momento)
4. Commit

## Como implantar na Hostinger (Docker Manager)

1. hPanel → sua VPS → **Docker Manager** → **Projects** → novo projeto
2. Escolhe **"Compose from URL"** e cola o link do repositório GitHub
3. No **Form Editor**, preenche as variáveis de ambiente (mesmas do
   `.env.example`): `CHQ_USER`, `CHQ_PASS`, `TOKEN_INTERNO`, etc.
4. Antes de implantar, edita o `docker-compose.yml` (pelo YAML Editor do
   próprio Docker Manager) trocando `rede_do_n8n` pelo nome real da rede
   Docker do n8n — descubra com `docker network ls` no terminal integrado do
   Docker Manager
5. Implanta. Acompanha os logs pelo próprio painel pra confirmar que o login
   funcionou (deve aparecer "Login efetuado e sessão salva." no log)

## Testando

Dentro da rede Docker compartilhada (ex: de dentro do container do n8n):

```bash
curl -X POST http://chq-scraper:3000/extrair \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_INTERNO" \
  -d '{"cod": "12091134"}'
```

## Endpoints

- `GET /health` — retorna `{ status: "ok", sessaoOk: true|false }`
- `POST /extrair` — body `{ "cod": "12091134" }`, retorna os dados do pedido
