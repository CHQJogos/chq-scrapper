/**
 * Gerenciamento da sessão de login do painel admin do chq.com.br.
 *
 * Guarda o storageState (cookies + localStorage) do Playwright em disco,
 * num volume persistente, pra não precisar logar de novo a cada extração.
 *
 * IMPORTANTE: os seletores abaixo (#usuario, #senha, etc.) são placeholders.
 * Você precisa ajustá-los conforme o HTML real da página de login do CHQ —
 * inspeciona a página (botão direito -> Inspecionar) nos campos de usuário,
 * senha e no botão de login, e troca os seletores CSS/IDs correspondentes.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = process.env.SESSION_PATH || '/dados/session.json';
const LOGIN_URL = process.env.CHQ_LOGIN_URL || 'https://www.chq.com.br/?view=ecom/logar';
const BASE_URL = process.env.CHQ_BASE_URL || 'https://www.chq.com.br';
const CHQ_USER = process.env.CHQ_USER;
const CHQ_PASS = process.env.CHQ_PASS;

// Seletores confirmados a partir do HTML real da página de login e de uma
// página do painel logado.
const SELETORES = {
  campoUsuario: 'input[name="lnick"]',
  campoSenha: '#senha_logar',
  botaoLogin: 'input[type="submit"][value="Efetuar login"]',
  elementoLogado: '.minha-conta',   // aparece em toda página do painel logado
};

async function login() {
  if (!CHQ_USER || !CHQ_PASS) {
    throw new Error('CHQ_USER e/ou CHQ_PASS não configurados nas variáveis de ambiente');
  }

  console.log('Fazendo login no painel do CHQ...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
  await page.fill(SELETORES.campoUsuario, CHQ_USER);
  await page.fill(SELETORES.campoSenha, CHQ_PASS);
  await page.click(SELETORES.botaoLogin);
  await page.waitForSelector(SELETORES.elementoLogado, { timeout: 20000 });

  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
  await context.storageState({ path: SESSION_PATH });

  await browser.close();
  console.log('Login efetuado e sessão salva.');
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
  if (!valida) {
    await login();
  }
}

module.exports = { login, isSessaoValida, ensureLoggedIn, SESSION_PATH };
