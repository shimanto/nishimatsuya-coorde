import { chromium } from 'playwright';

const hinban = process.argv[2] || '200412435';
const url = `https://www.24028-net.jp/item/${hinban}.html`;

const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'ja-JP' });
const jsons = [];
page.on('response', async (res) => {
  const u = res.url();
  const ct = res.headers()['content-type'] || '';
  if (u.includes('24028-net.jp') && (ct.includes('json') || u.includes('.html?') || u.includes('ajax'))) {
    let body = ''; try { body = await res.text(); } catch {}
    if (/在庫|stock|sku|zaiko|\bsize\b|color|cart|price|item/i.test(body) && body.length < 200000) {
      jsons.push({ url: u.slice(0, 110), len: body.length, head: body.replace(/\s+/g, ' ').slice(0, 300) });
    }
  }
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('warn', e.message));
await page.waitForTimeout(4000);

console.log('=== same-domain ajax/json with stock-ish content ===');
jsons.forEach(j => console.log(j.len, j.url, '\n  ', j.head, '\n'));

// 購入バリエーション領域: 「在庫なし」テキストと、サイズ・カラーの行を探す
console.log('=== variation / cart area ===');
const info = await page.evaluate(() => {
  const bodyText = document.body.innerText;
  const zaikoNashi = (bodyText.match(/在庫なし/g) || []).length;
  // 数量select(購入可能の指標)
  const selects = document.querySelectorAll('select');
  const qtySelects = [...selects].filter(s => /1|2|3/.test(s.innerText)).length;
  // variation系コンテナ候補のHTMLを少し
  const cands = [];
  document.querySelectorAll('[class*="variation"],[class*="order"],[class*="cart"],[class*="item_color"],[class*="item_size"],[class*="js-"]').forEach(el => {
    const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
    if (/cm|在庫|ホワイト|ブラック|カート|個/.test(t) && t.length < 300) cands.push((typeof el.className === 'string' ? el.className : '').slice(0, 40) + ' :: ' + t);
  });
  return { zaikoNashi, qtySelects, totalSelects: selects.length, cands: [...new Set(cands)].slice(0, 20) };
});
console.log('「在庫なし」出現:', info.zaikoNashi, '/ select数:', info.totalSelects);
info.cands.forEach(c => console.log(' >', c));

await browser.close();
