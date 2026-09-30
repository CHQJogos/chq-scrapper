/**
 * Microserviço de extração de pedidos do painel admin do chq.com.br.
 *
 * Endpoints:
 *   GET  /health           -> verifica se o serviço e a sessão de login estão OK
 *   POST /extrair          -> body: { "cod": "12091134" } -> devolve os dados do pedido
 *
 * Variáveis de ambiente esperadas (configuradas no docker-compose ou no
 * Form Editor do Docker Manager da Hostinger):
 *   CHQ_USER            - usuário de login do painel admin
 *   CHQ_PASS            - senha de login do painel admin
 *   CHQ_LOGIN_URL        - URL da página de login do admin
 *   CHQ_BASE_URL          - URL base do site (ex: https://www.chq.com.br)
 *   TOKEN_INTERNO         - token simples pra proteger o endpoint (header Authorization)
 *   RATE_LIMIT_MS          - intervalo mínimo entre extrações, em ms (padrão 7000)
 *   PORT                 - porta do servidor (padrão 3000)
 */

const express = require('express');
const path = require('path');
const PQueue = require('p-queue').default;

const { ensureLoggedIn, isSessaoValida } = require('./session');
const { extrairPedido } = require('./scraper');

const PORT = process.env.PORT || 3000;
const TOKEN_INTERNO = process.env.TOKEN_INTERNO || '';
const RATE_LIMIT_MS = Number(process.env.RATE_LIMIT_MS || 7000);

const app = express();
app.use(express.json());

// Fila com concorrência 1 e intervalo mínimo entre execuções, pra não
// disparar a proteção anti-bot do painel.
const fila = new PQueue({ concurrency: 1, interval: RATE_LIMIT_MS, intervalCap: 1 });

function checarToken(req, res, next) {
  if (!TOKEN_INTERNO) return next(); // sem token configurado = sem checagem (só pra teste local)
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${TOKEN_INTERNO}`) {
    return res.status(401).json({ erro: 'Token inválido ou ausente' });
  }
  next();
}

app.get('/health', async (req, res) => {
  const sessaoOk = await isSessaoValida().catch(() => false);
  res.json({ status: 'ok', sessaoOk });
});

app.post('/extrair', checarToken, async (req, res) => {
  const { cod } = req.body || {};
  if (!cod) {
    return res.status(400).json({ erro: 'Informe o campo "cod" com o número do pedido' });
  }

  try {
    const resultado = await fila.add(async () => {
      await ensureLoggedIn();
      return extrairPedido(cod);
    });
    res.json({ ok: true, pedido: resultado });
  } catch (err) {
    console.error(`Erro ao extrair pedido ${cod}:`, err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`chq-scraper rodando na porta ${PORT}`);
});
