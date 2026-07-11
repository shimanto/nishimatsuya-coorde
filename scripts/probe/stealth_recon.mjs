import { chromium } from 'playwright';

const url = process.argv[2];
// 実Chrome優先（Akamai回避率が高い）。無ければバンドルchromiumへフォールバック。
let browser;
const launchOpts = {
  args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-features=IsolateOrigins,site-per-process'],
};
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); console.log('using channel: chrome'); }
catch { browser = await chromium.launch(launchOpts); console.log('using bundled chromium'); }

const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'ja-JP', timezoneId: 'Asia/Tokyo', viewport: { width: 1366, height: 900 },
  extraHTTPHeaders: { 'Accept-Language': 'ja-JP,ja;q=0.9' },
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ja'] });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  window.chrome = { runtime: {} };
});
const page = await ctx.newPage();
const apis = [];
page.on('response', (res) => {
  const u = res.url(); const ct = res.headers()['content-type'] || '';
  if (ct.includes('json') && /product|category|listing|resultpage|plp|special|search/i.test(u) &&
      !/analytics|gtm|tag|beacon|consent|criteo|adobe/i.test(u)) {
    apis.push({ status: res.status(), url: u });
  }
});
let st = '?';
try { const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); st = r ? r.status() : 'no'; }
catch (e) { st = 'err:' + e.message.split('\n')[0]; }
await page.waitForTimeout(8000);
const title = await page.title().catch(() => '');
const prod = await page.evaluate(() => {
  const sels = ['[class*="product-item"]', '[class*="product-card"]', '[class*="ProductItem"]', 'li[class*="product"]', '[class*="hm-product-item"]', '[class*="media-content"]'];
  let m = 0; for (const s of sels) m = Math.max(m, document.querySelectorAll(s).length); return m;
});
console.log('goto:', st, '| title:', title.slice(0, 50));
console.log('product elements:', prod);
console.log('product JSON calls:', apis.length);
[...new Map(apis.map(a => [a.url.split('?')[0], a])).values()].slice(0, 12).forEach(a => console.log('  ', a.status, a.url.slice(0, 120)));
await browser.close();
