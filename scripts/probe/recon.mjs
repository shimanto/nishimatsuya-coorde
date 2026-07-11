// 小売サイトのキッズ・セールページにアクセスし、商品API/JSONコールと描画状況を調査する。
import { chromium } from 'playwright';

const url = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'ja-JP',
  viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();
const apis = [];
page.on('response', (res) => {
  const u = res.url();
  const ct = res.headers()['content-type'] || '';
  if ((ct.includes('json') || /\/api\/|products|catalog|search|category|plp|graphql/i.test(u)) &&
      !/google|facebook|adobe|analytics|gtm|criteo|tiktok|bing|yahoo|cookie|consent|tag|beacon|metric|sentry|optimizely|braze|tealium/i.test(u)) {
    apis.push({ status: res.status(), ct: ct.split(';')[0], url: u });
  }
});

let gotoStatus = '?';
try {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  gotoStatus = resp ? resp.status() : 'no-resp';
} catch (e) { gotoStatus = 'goto-err: ' + e.message.split('\n')[0]; }
await page.waitForTimeout(7000);

const title = await page.title().catch(() => '');
// 商品っぽい要素の検出
const productCount = await page.evaluate(() => {
  const sels = ['[class*="product-item"]','[class*="product-card"]','[data-productid]','[class*="ProductItem"]','article[class*="product"]','li[class*="product"]','[class*="hm-product"]'];
  let max = 0;
  for (const s of sels) max = Math.max(max, document.querySelectorAll(s).length);
  return max;
});
const blocked = /captcha|robot|access denied|forbidden|あなたはロボット|認証/i.test(await page.content().catch(() => ''));

console.log('URL:', url);
console.log('goto status:', gotoStatus, '| title:', title.slice(0, 60));
console.log('product-like elements:', productCount, '| blocked-page text:', blocked);
console.log('candidate API/JSON calls:', apis.length);
const uniq = [...new Map(apis.map(a => [a.url.split('?')[0], a])).values()];
uniq.slice(0, 18).forEach(a => console.log(`  ${a.status} ${a.ct} ${a.url.slice(0, 130)}`));

await browser.close();
