import { chromium } from 'playwright';

const url = process.argv[2] || 'https://www.24028-net.jp/category/K_TSHIRT/';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  locale: 'ja-JP',
});
const page = await ctx.newPage();

const apiCalls = [];
page.on('response', async (res) => {
  const u = res.url();
  const ct = res.headers()['content-type'] || '';
  if (ct.includes('json') || /api|item|product|search|list|goods/i.test(u)) {
    apiCalls.push({ url: u, status: res.status(), ct });
  }
});

console.log('Navigating to', url);
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('goto warn:', e.message));
await page.waitForTimeout(3000);

console.log('\n=== TITLE ===');
console.log(await page.title());

console.log('\n=== JSON / API-ish responses ===');
for (const c of apiCalls) console.log(c.status, c.ct.split(';')[0], c.url.slice(0, 160));

// Try to find product item DOM
console.log('\n=== Candidate product links ===');
const links = await page.$$eval('a', as => as
  .map(a => ({ href: a.getAttribute('href'), txt: (a.textContent||'').trim().slice(0,30) }))
  .filter(x => x.href && /\.html/.test(x.href) && /\d{6,}/.test(x.href))
  .slice(0, 25)
);
for (const l of links) console.log(l.href, '|', l.txt);

console.log('\n=== Possible item container classes ===');
const classes = await page.$$eval('[class]', els => {
  const m = {};
  els.forEach(e => e.className && typeof e.className === 'string' && e.className.split(/\s+/).forEach(c => {
    if (/item|product|goods|list|card|prd/i.test(c)) m[c] = (m[c]||0)+1;
  }));
  return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,30);
});
console.log(classes.map(c=>c.join(':')).join('\n'));

await browser.close();
