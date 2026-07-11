import { chromium } from 'playwright';
const hinban = process.argv[2] || '200412435';
const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'ja-JP' });
await page.goto(`https://www.24028-net.jp/item/${hinban}.html`, { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(3500);

// item-variation 領域の構造をダンプ
const dump = await page.evaluate(() => {
  const area = document.querySelector('[class*="item-variation"]') ||
               document.querySelector('[class*="variation"]');
  if (!area) return { found: false };
  // 各ボタン/セルを走査
  const btns = [...area.querySelectorAll('a,button,li,div,span')]
    .filter(el => /cm|在庫|ホワイト|ブラック|ベージュ|ブルー|ピンク|個|カート|sold/i.test((el.innerText||'')) || /soldout|variation-item|variation-btn|color|size/i.test(typeof el.className==='string'?el.className:''))
    .slice(0, 60)
    .map(el => ({
      tag: el.tagName,
      cls: (typeof el.className==='string'?el.className:'').slice(0,55),
      soldout: /soldout|is_soldout/i.test(typeof el.className==='string'?el.className:''),
      data: Object.fromEntries([...el.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])),
      txt: (el.innerText||'').replace(/\s+/g,' ').trim().slice(0,40),
    }));
  return { found: true, areaCls: area.className, html: area.outerHTML.slice(0, 1800), btns };
});
console.log('areaCls:', dump.areaCls);
console.log('\n=== buttons/cells ===');
(dump.btns||[]).forEach(b => console.log(`[${b.soldout?'SOLD':'  ok'}] ${b.tag}.${b.cls} ${JSON.stringify(b.data)} :: ${b.txt}`));
console.log('\n=== area HTML (head) ===');
console.log(dump.html);
await browser.close();
