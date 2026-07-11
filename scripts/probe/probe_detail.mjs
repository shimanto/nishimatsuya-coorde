import { chromium } from 'playwright';

const hinban = process.argv[2] || '200412435';
const url = `https://www.24028-net.jp/item/${hinban}.html`;

const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'ja-JP' });
const stockApis = [];
page.on('response', async (res) => {
  const u = res.url();
  if (/stock|zaiko|good_item|cart|item_detail|sku/i.test(u)) {
    let body = '';
    try { body = await res.text(); } catch {}
    stockApis.push({ url: u, status: res.status(), len: body.length, head: body.slice(0, 400) });
  }
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('warn', e.message));
await page.waitForTimeout(3500);

console.log('TITLE:', await page.title());
console.log('\n=== stock-ish API calls ===');
for (const a of stockApis) console.log(a.status, a.len, a.url.slice(0, 90), '\n   ', a.head.replace(/\s+/g, ' ').slice(0, 200));

// サイズ/在庫らしき要素を探す
console.log('\n=== size/stock related text nodes ===');
const blocks = await page.evaluate(() => {
  const out = [];
  const sel = '[class*="size"],[class*="stock"],[class*="zaiko"],[class*="variation"],[class*="sku"],select,table';
  document.querySelectorAll(sel).forEach(el => {
    const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
    if (t && t.length < 400) out.push((el.tagName + '.' + (typeof el.className === 'string' ? el.className : '')).slice(0, 50) + ' => ' + t);
  });
  return [...new Set(out)].slice(0, 30);
});
blocks.forEach(b => console.log(b));

await browser.close();
