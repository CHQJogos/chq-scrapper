/**
 * Extração dos dados de um pedido específico do painel admin do chq.com.br.
 *
 * Seletores/fontes confirmados a partir do HTML real de páginas de pedido
 * (uma "Retirada na loja" e uma com envio "Sedex"):
 *   - Endereço/CPF/nome: variável JS global `enderecoOriginal` (presente em
 *     pedidos com envio — mais confiável que ler o DOM)
 *   - Forma de pagamento: .payment-label b
 *   - Forma de envio: texto dentro do box "Forma de Envio"
 *   - Valores (itens/desconto/frete/total): tabela .table-summary
 *   - Nome do cliente (fallback): .user-name a.pedido-cinza
 *   - Verificação de sessão: .minha-conta
 *
 * Pedidos do tipo "Retirada na loja" não têm `enderecoOriginal` nem CPF —
 * nesse caso os campos de endereço ficam null, o que é esperado.
 */

const { chromium } = require('playwright');
const { SESSION_PATH } = require('./session');

const BASE_URL = process.env.CHQ_BASE_URL || 'https://www.chq.com.br';

async function extrairPedido(cod) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: SESSION_PATH });
  const page = await context.newPage();

  try {
    const url = `${BASE_URL}/?view=ecom/admin/compra&cod=${cod}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });

    const logado = await page.locator('.minha-conta').count();
    if (logado === 0) {
      throw new Error('Sessão parece inválida (elemento ".minha-conta" não encontrado)');
    }

    const dados = await page.evaluate(() => {
      function textoDoBox(titulo) {
        const divs = Array.from(document.querySelectorAll('.title-box-page'));
        const div = divs.find((d) => d.textContent.trim() === titulo);
        if (!div) return null;
        const container = div.parentElement?.querySelector('.container');
        if (!container) return null;
        const b = container.querySelector('p b, b');
        return (b ? b.innerText : container.innerText)?.trim() || null;
      }

      const valores = {};
      document.querySelectorAll('.table-summary tr').forEach((tr) => {
        const tds = tr.querySelectorAll('td');
        if (tds.length === 2) {
          valores[tds[0].innerText.trim()] = tds[1].innerText.trim();
        }
      });

      // Endereço/CPF: prioriza a variável global `enderecoOriginal` (pedidos
      // com envio). Se não existir (ex: retirada na loja), fica tudo null.
      const end = typeof enderecoOriginal !== 'undefined' ? enderecoOriginal : null;

      return {
        nome_contato: end?.nome || document.querySelector('.user-name a.pedido-cinza')?.innerText?.trim() || null,
        data: document.querySelector('.panel-order--number .order-datetime')?.innerText?.trim() || null,
        forma_pagamento: textoDoBox('Forma de Pagamento'),
        metodo_envio: textoDoBox('Forma de Envio'),
        valor_itens_texto: valores['Valor dos Itens:'] || null,
        desconto_texto: valores['Desconto:'] || null,
        frete_texto: valores['Frete:'] || null,
        valor_total_texto: valores['Valor Total:'] || null,
        cpf_cnpj: end?.CPF || null,
        cep: end?.cep || null,
        municipio: end?.cidade || null,
        uf: end?.estado || null,
        endereco: end?.endereco || null,
        endereco_nro: end?.numero || null,
        complemento: end?.complemento || null,
        bairro: end?.bairro || null,
      };
    });

    const paraNumero = (txt) => {
      if (!txt) return 0;
      const match = txt.match(/([\d.,]+)/);
      if (!match) return 0;
      return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
    };

    return {
      numero_pedido: String(cod),
      nome_contato: dados.nome_contato,
      data: dados.data ? dados.data.split(' ')[0] : null,
      forma_pagamento: dados.forma_pagamento,
      metodo_envio: dados.metodo_envio,
      valor_itens: paraNumero(dados.valor_itens_texto),
      desconto_pedido: paraNumero(dados.desconto_texto),
      frete: paraNumero(dados.frete_texto),
      valor_total: paraNumero(dados.valor_total_texto),
      cpf_cnpj: dados.cpf_cnpj,
      cep: dados.cep,
      municipio: dados.municipio,
      uf: dados.uf,
      endereco: dados.endereco,
      endereco_nro: dados.endereco_nro,
      complemento: dados.complemento,
      bairro: dados.bairro,
    };
  } finally {
    await browser.close();
  }
}

module.exports = { extrairPedido };


