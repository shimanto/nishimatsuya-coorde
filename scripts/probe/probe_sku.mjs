import { chromium } from 'playwright';
const hinban = process.argv[2] || '200412435';
const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'ja-JP' });
await page.goto(`https://www.24028-net.jp/item/${hinban}.html`, { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(3500);

const r = await page.evaluate(() => {
  // 1) 全カートボタン(在庫あり) と is_soldout(在庫なし) を property付きで
  const variants = [];
  document.querySelectorAll('input[onclick*="putItemToCart"], .is_soldout, [class*="soldout"]').forEach(el => {
    const oc = el.getAttribute('onclick') || '';
    const m = oc.match(/"(\d{6,})",\s*"([0-9\-]+)"/); // item, property
    const cls = typeof el.className === 'string' ? el.className : '';
    variants.push({
      soldout: /soldout/i.test(cls),
      prop: m ? m[2] : (el.getAttribute('data-property') || ''),
      val: el.value || el.innerText || '',
      cls: cls.slice(0, 40),
    });
  });

  // 2) サイズ選択肢 / カラー選択肢 (code -> label)
  const opts = (sel) => [...document.querySelectorAll(sel)].map(o => ({
    code: o.value || o.getAttribute('data-value') || o.getAttribute('data-code') || '',
    label: (o.innerText || o.getAttribute('alt') || o.title || '').replace(/\s+/g,' ').trim(),
    cls: (typeof o.className==='string'?o.className:'').slice(0,30),
  })).filter(x => x.label);
  const sizeOpts = opts('[class*="item_size"] *,[class*="size-select"] *,select[name*="size"] option,[class*="js-size"] *');
  const colorOpts = opts('[class*="item_color"] *,[class*="color-select"] *,select[name*="color"] option,[class*="js-color"] *');

  // 3) inline scriptに sku/stock らしきJSONがあるか
  let skuHint = '';
  for (const s of document.querySelectorAll('script')) {
    const t = s.textContent || '';
    if (/stock|zaiko|sku|property.*size|variation/i.test(t) && t.length < 50000) {
      const mm = t.match(/.{0,40}(stock|zaiko|sku|property)[^;]{0,120}/i);
      if (mm) { skuHint = mm[0].replace(/\s+/g,' ').slice(0,200); break; }
    }
  }
  return { variants, sizeOpts: sizeOpts.slice(0,20), colorOpts: colorOpts.slice(0,20), skuHint };
});

console.log('=== variants (cart buttons / soldout) ===');
r.variants.forEach(v => console.log(`[${v.soldout?'SOLD':'  ok'}] prop=${v.prop} cls=${v.cls} val=${v.val.slice(0,20)}`));
console.log('\n=== size options ===');
r.sizeOpts.forEach(o => console.log(o.code, '|', o.label, '|', o.cls));
console.log('\n=== color options ===');
r.colorOpts.forEach(o => console.log(o.code, '|', o.label, '|', o.cls));
console.log('\nskuHint:', r.skuHint);
await browser.close();
