import { chromium } from 'playwright';
import fs from 'fs';

const url = process.argv[2] || 'https://www.24028-net.jp/category/K_TSHIRT/';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  locale: 'ja-JP',
});
const page = await ctx.newPage();

const captures = [];
page.on('response', async (res) => {
  const u = res.url();
  if (u.includes('snva.jp') && (u.includes('fmt=json') || u.includes('json_grouping'))) {
    try {
      const body = await res.text();
      captures.push({ url: u, body });
    } catch {}
  }
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('warn', e.message));
await page.waitForTimeout(4000);

console.log('captured', captures.length, 'naviplus json responses');
captures.forEach((c, i) => {
  console.log(`\n===== [${i}] URL =====`);
  console.log(decodeURIComponent(c.url));
  fs.writeFileSync(`naviplus_${i}.json`, c.body);
  // print top-level keys
  try {
    const j = JSON.parse(c.body);
    console.log('top keys:', Object.keys(j));
    console.log('body length:', c.body.length);
  } catch (e) {
    console.log('non-json, len', c.body.length, c.body.slice(0,200));
  }
});

await browser.close();
