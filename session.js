const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = process.env.SESSION_PATH || '/dados/session.json';
const LOGIN_URL = process.env.CHQ_LOGIN_URL || 'https://www.chq.com.br/?view=ecom/logar';
const BASE_URL = process.env.CHQ_BASE_URL || 'https://www.chq.com.br';
const CHQ_USER = process.env.CHQ_USER;
const CHQ_PASS = process.env.CHQ_PASS;

const SELETORES = {
  campoUsuario: 'input[name="lnick"]',
  campoSenha: '#senha_logar',
  botaoLogin: 'input[type="submit"][value="Efetuar login"]',
  elementoLogado: '.minha-conta',
};

async function login() {
  if (!CHQ_USER || !CHQ_PASS) {
    throw new Error('CHQ_USER e/ou CHQ_PASS não configurados nas variáveis de ambiente');
  }
  console.log('Fazendo login no painel do CHQ...');
  console.log(`URL de login configurada: ${LOGIN_URL}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  try {
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
    console.log(`Página carregada. URL final: ${page.url()} | título: ${await page.title()}`);

    const campoExiste = await page.locator(SELETORES.campoUsuario).count();
    if (campoExiste === 0) {
      const htmlTrecho = (await page.content()).slice(0, 1500);
      console.log('Campo de usuário não encontrado na página. Trecho do HTML recebido:');
      console.log(htmlTrecho);
      fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
      await page.screenshot({ path: path.join(path.dirname(SESSION_PATH), 'debug-login.png'), fullPage: true }).catch(() => {});
      throw new Error(
        `Campo "${SELETORES.campoUsuario}" não encontrado. A página carregada pode ser diferente da esperada (ver logs/trecho de HTML acima).`
      );
    }

    await page.fill(SELETORES.campoUsuario, CHQ_USER);
    await page.fill(SELETORES.campoSenha, CHQ_PASS);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {}),
      page.click(SELETORES.botaoLogin),
    ]);
    console.log(`Após submeter o login, caiu em: ${page.url()} | título: ${await page.title()}`);

    // O submit pode redirecionar pra home da loja em vez do painel admin.
    // Navega explicitamente pro painel pra checar se a sessão está autenticada.
    await page.goto(`${BASE_URL}/?view=ecom/admin/home`, { waitUntil: 'networkidle', timeout: 20000 });
    console.log(`Após navegar pro painel admin: ${page.url()} | título: ${await page.title()}`);

    const logado = await page.locator(SELETORES.elementoLogado).count();
    if (logado === 0) {
      const htmlTrecho = (await page.content()).slice(0, 3000);
      console.log('Elemento de "logado" não apareceu no painel admin. Trecho do HTML recebido:');
      console.log(htmlTrecho);
      fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
      await page.screenshot({ path: path.join(path.dirname(SESSION_PATH), 'debug-login.png'), fullPage: true }).catch(() => {});
      throw new Error('Login parece ter falhado: painel admin não mostrou o elemento de usuário logado (ver logs/trecho de HTML acima).');
    }

    fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
    await context.storageState({ path: SESSION_PATH });
    console.log('Login efetuado e sessão salva.');
  } finally {
    await browser.close();
  }
}

async function isSessaoValida() {
  if (!fs.existsSync(SESSION_PATH)) return false;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: SESSION_PATH });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/?view=ecom/admin/home`, { waitUntil: 'networkidle', timeout: 15000 });
    const logado = await page.locator(SELETORES.elementoLogado).count();
    return logado > 0;
  } catch {
    return false;
  } finally {
    await browser.close();
  }
}

async function ensureLoggedIn() {
  const valida = await isSessaoValida();
  if (!valida) { await login(); }
}

module.exports = { login, isSessaoValida, ensureLoggedIn, SESSION_PATH };
