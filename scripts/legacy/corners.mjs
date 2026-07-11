// 西松屋・ユニクロ以外の小売（H&M / ZARA / ヒラキ / GAP）のキッズ・セール/激安Tシャツを
// 直接fetchで取得し、各「コーナー」のサンプルを public/corners.json に出力する。
import fs from 'fs';
import crypto from 'crypto';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Accept-Language': 'ja-JP,ja;q=0.9' };
const HJ = { ...H, 'Accept': 'application/json' };
const HH = { ...H, 'Accept': 'text/html' };
const TAKE = 6;
const yen = (n) => (n == null ? null : Number(n));
const genderFromText = (s) => {
  const boys = /男の子|ボーイ|BOY/i.test(s), girls = /女の子|ガール|GIRL/i.test(s);
  if (boys && !girls) return 'boys'; if (girls && !boys) return 'girls'; return 'unisex';
};

// ---------- H&M ----------
async function fetchHM() {
  const url = 'https://www2.hm.com/ja_jp/kids/sale/2-8-years/view-all.html';
  const t = await (await fetch(url, { headers: HH })).text();
  const m = t.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no __NEXT_DATA__');
  const j = JSON.parse(m[1]);
  let hits = null;
  (function walk(o, d) { if (hits || d > 8 || !o || typeof o !== 'object') return; for (const k of Object.keys(o)) { const v = o[k]; if (Array.isArray(v) && v.length && v[0] && (v[0].prices && v[0].articleCode)) { hits = v; return; } walk(v, d + 1); } })(j.props.pageProps, 0);
  if (!hits) throw new Error('no product hits');
  const items = [];
  for (const it of hits) {
    if (!/Tシャツ|シャツ|トップ|T-/i.test(it.title + (it.category || ''))) continue;
    const red = (it.prices || []).find((p) => p.priceType === 'redPrice');
    const white = (it.prices || []).find((p) => p.priceType === 'whitePrice');
    if (!red || !white || red.price >= white.price) continue; // 値下げのみ
    const img = it.imageProductSrc || (it.galleryImages && it.galleryImages[0]);
    items.push({
      name: it.title, price: yen(red.price), oldPrice: yen(white.price),
      saleLabel: it.discountPercentage ? `${it.discountPercentage} OFF` : 'SALE',
      image: img && (img.startsWith('http') ? img : 'https:' + img),
      url: 'https://www2.hm.com' + it.pdpUrl,
      sizes: (it.sizes || []).map((s) => s.name || s).join('・').slice(0, 60),
      gender: genderFromText(it.title),
    });
  }
  items.sort((a, b) => a.price - b.price);
  return items.slice(0, TAKE);
}

// ---------- ZARA ----------
function zaraImg(c) {
  // トップレベルxmediaは空のことが多い。detail.colors[].xmedia を使う。
  let x = (c.xmedia || [])[0];
  if (!x) { const col = ((c.detail || {}).colors || [])[0] || {}; x = (col.xmedia || [])[0]; }
  if (!x || !x.path || !x.name) return '';
  return `https://static.zara.net${x.path}/w/563/${x.name}.jpg?ts=${x.timestamp || ''}`;
}
async function fetchZARA() {
  const cats = (await (await fetch('https://www.zara.com/jp/ja/categories?ajax=true', { headers: HJ })).json()).categories;
  const ids = [];
  (function walk(a) { for (const c of a || []) { if (/I2024-NINOS-(NINO|NINA)-CAMISETAS-VER_TODO/.test(c.key || '')) ids.push(c.id); walk(c.subcategories); } })(cats);
  const prods = [];
  for (const id of ids.slice(0, 2)) {
    const j = await (await fetch(`https://www.zara.com/jp/ja/category/${id}/products?ajax=true`, { headers: HJ })).json();
    for (const g of j.productGroups || []) for (const el of g.elements || []) for (const c of el.commercialComponents || []) prods.push(c);
  }
  const seen = new Set();
  const items = [];
  for (const p of prods) {
    if (!p.oldPrice || !p.price || p.price >= p.oldPrice) continue;
    if (seen.has(p.name)) continue; seen.add(p.name);
    const img = zaraImg(p);
    if (!img) continue;
    const sizes = (((p.detail || {}).colors || [])[0] || {}).sizes || [];
    items.push({
      name: p.name, price: yen(p.price), oldPrice: yen(p.oldPrice),
      saleLabel: 'SPECIAL PRICE',
      image: img,
      url: p.seo ? `https://www.zara.com/jp/ja/${p.seo.keyword}-p${p.seo.seoProductId}.html` : '',
      sizes: sizes.map((s) => s.name).join('・').slice(0, 60),
      gender: genderFromText(p.sectionName || p.familyName || ''),
    });
  }
  items.sort((a, b) => a.price - b.price);
  return items.slice(0, TAKE);
}

// ---------- ヒラキ ----------
async function fetchHiraki() {
  const url = 'https://www.hiraki.co.jp/ec/proList/searchProduct?categoryCd=110E0x02000'; // Tシャツ特集(キッズ・ジュニア)
  const t = await (await fetch(url, { headers: HH })).text();
  const items = [];
  const re = /<a href="\/ec\/pro\/disp\/1\/(\d+)"([^>]*)>/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const id = m[1], attrs = m[2];
    const get = (k) => { const mm = attrs.match(new RegExp(k + '="([^"]*)"')); return mm ? mm[1] : ''; };
    // data-taxprice=税抜, data-notaxprice=税込(=税抜×1.1)。税込を表示。
    const price = Math.max(parseInt(get('data-taxprice') || '0', 10), parseInt(get('data-notaxprice') || '0', 10));
    if (!price || price < 50) continue;                 // ¥1等のダミーを除外
    const med = get('data-med');
    const stock = get('data-stockmark');
    if (/在庫なし|×/.test(stock)) continue;
    // 商品名: 直後の img alt（lozad画像のalt。アンカー開始から約700字後）
    const after = t.slice(m.index, m.index + 1000);
    const alt = (after.match(/alt="([^"]{4,60})"/) || [])[1] || '';
    const cleanName = alt.replace(/\[[^\]]*\]/g, '').replace(/【[^】]*】/g, '').trim();
    if (!cleanName) continue;                           // 名前が取れないタイルは除外
    items.push({
      name: cleanName,
      price, oldPrice: null,
      saleLabel: /true/i.test(get('data-iconPriceDown')) ? '値下げ' : '激安プライス',
      image: med ? 'https://www.hiraki.co.jp' + med : '',
      url: 'https://www.hiraki.co.jp/ec/pro/disp/1/' + id,
      sizes: (alt.match(/【([^】]+)】/) || [])[1] || '',
      gender: genderFromText(alt),
    });
  }
  const seen = new Set();
  const uniq = items.filter((x) => !seen.has(x.url) && seen.add(x.url));
  uniq.sort((a, b) => a.price - b.price);
  return uniq.slice(0, TAKE);
}

// ---------- GAP（価格はクライアント描画のため、セール商品の名前/画像/リンクのみ） ----------
async function fetchGAP() {
  const url = 'https://www.gap.co.jp/browse/category.do?cid=1058733'; // ボーイズ セール
  const t = await (await fetch(url, { headers: HH })).text();
  const items = [];
  const seen = new Set();
  const re = /<img[^>]+alt="([^"]{4,60})"[^>]+src="(https:\/\/www\.gap\.co\.jp\/on\/demandware[^"]+)"/g;
  let m;
  while ((m = re.exec(t)) !== null && items.length < TAKE) {
    const name = m[1].trim();
    if (!/T|シャツ|ロゴ|プリント|グラフィック|トップ/i.test(name)) continue;
    if (/30%OFF|40%OFF|公式/.test(name)) continue;
    if (seen.has(name)) continue; seen.add(name);
    items.push({ name, price: null, oldPrice: null, saleLabel: 'SALE', image: m[2], url: 'https://www.gap.co.jp/gap/boys/sale-1058733', sizes: '', gender: 'boys' });
  }
  return items;
}

const RETAILERS = [
  { brand: 'H&M', accent: '#e50010', note: 'キッズ(2〜8歳)セールより値下げTシャツ', fn: fetchHM },
  { brand: 'ZARA', accent: '#000000', note: 'キッズ Tシャツ スペシャルプライス', fn: fetchZARA },
  { brand: 'ヒラキ', accent: '#e6322e', note: '激安キッズTシャツ（100〜160cm中心）', fn: fetchHiraki },
  { brand: 'GAP', accent: '#1a3d7c', note: 'ボーイズ セール（価格は商品ページでご確認ください）', fn: fetchGAP },
];

// 画像のローカル取り込み（H&M等は外部CDNがブラウザ<img>を弾くため、ビルド時に自己ホスト化）
const IMG_DIR = 'public/cimg';
async function localizeImage(url) {
  if (!url) return '';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://www.google.com/', 'Accept': 'image/*,*/*' } });
    if (!res.ok) return url;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) return url;
    const ext = (res.headers.get('content-type') || '').includes('png') ? 'png' : 'jpg';
    const name = crypto.createHash('md5').update(url).digest('hex').slice(0, 16) + '.' + ext;
    fs.writeFileSync(`${IMG_DIR}/${name}`, buf);
    return `cimg/${name}`;
  } catch { return url; }
}

const corners = [];
fs.mkdirSync(IMG_DIR, { recursive: true });
for (const r of RETAILERS) {
  try {
    const items = await r.fn();
    for (const it of items) it.image = await localizeImage(it.image); // 画像を自己ホスト化
    console.log(`${r.brand}: ${items.length}件`);
    if (items.length) corners.push({ brand: r.brand, accent: r.accent, note: r.note, items });
  } catch (e) {
    console.log(`${r.brand}: 取得失敗 (${e.message})`);
  }
}
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/corners.json', JSON.stringify({ generatedAt: new Date().toISOString(), corners }, null, 2));
console.log('saved public/corners.json:', corners.map((c) => c.brand + '(' + c.items.length + ')').join(', '));
