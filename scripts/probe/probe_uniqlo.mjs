import { chromium } from 'playwright';
const url = process.argv[2] || 'https://www.uniqlo.com/jp/ja/search?q=%E3%82%AD%E3%83%83%E3%82%BA%20T%E3%82%B7%E3%83%A3%E3%83%84';
const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'ja-JP', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36' });
const apis = [];
page.on('response', async (res) => {
  const u = res.url();
  if (/\/api\/commerce\/.*\/products(\?|$)/.test(u)) {
    let body = ''; try { body = await res.text(); } catch {}
    apis.push({ url: u, status: res.status(), len: body.length, body });
  }
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => console.log('warn', e.message));
await page.waitForTimeout(6000);
console.log('products API calls:', apis.length);
for (const a of apis.slice(0, 3)) {
  console.log('\nstatus', a.status, 'len', a.len);
  console.log(decodeURIComponent(a.url).slice(0, 260));
  try {
    const j = JSON.parse(a.body);
    const res = j.result || j;
    const items = res.items || res.products || [];
    console.log('items:', items.length, '| result keys:', Object.keys(res).slice(0, 12));
    if (items[0]) {
      const it = items[0];
      console.log('item0 keys:', Object.keys(it).slice(0, 25));
      console.log('sample:', JSON.stringify({ name: it.name, productId: it.productId, prices: it.prices, priceGroup: it.priceGroup, images: it.images && Object.keys(it.images) }).slice(0, 400));
    }
  } catch (e) { console.log('parse:', e.message, a.body.slice(0, 150)); }
}
await browser.close();
