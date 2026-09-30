const express = require('express');
const fs = require('fs');
const path = require('path');
const PQueue = require('p-queue').default;
const { ensureLoggedIn, isSessaoValida, SESSION_PATH } = require('./session');
const { extrairPedido } = require('./scraper');

const PORT = process.env.PORT || 3000;
const TOKEN_INTERNO = process.env.TOKEN_INTERNO || '';
const RATE_LIMIT_MS = Number(process.env.RATE_LIMIT_MS || 7000);

const app = express();
app.use(express.json());

const fila = new PQueue({ concurrency: 1, interval: RATE_LIMIT_MS, intervalCap: 1 });

function checarToken(req, res, next) {
  if (!TOKEN_INTERNO) return next();
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

app.get('/debug-screenshot', checarToken, (req, res) => {
  const screenshotPath = path.join(path.dirname(SESSION_PATH), 'debug-login.png');
  if (!fs.existsSync(screenshotPath)) {
    return res.status(404).json({ erro: 'Nenhum screenshot de debug disponível ainda.' });
  }
  res.sendFile(screenshotPath);
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
