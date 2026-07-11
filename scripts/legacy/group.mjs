// 実在庫(products.verified.json)から「デザイン×カラー」をSKUとして生成。
// 同デザイン・同色をベビー〜キッズで束ね、その色のサイズ充足度を表示する。
// 例: スミクロ（袖レイヤード風半袖Tシャツ）
import fs from 'fs';

const DISPLAY_SIZES = [70, 80, 90, 95, 100, 110, 120, 130, 140, 150];
const BABY = [80, 90, 95];
const KIDS = [100, 110, 120, 130];
const CORE = [80, 90, 95, 100, 110, 120, 130];
const IMG_BASE = 'https://www.24028-net.jp/client_info/N24028/itemimage/';
const colorImg = (hinban, code) => `${IMG_BASE}${hinban}/${hinban.slice(2)}-${code}.jpg`;

const src = fs.existsSync('products.verified.json') ? 'products.verified.json' : 'products.json';
const data = JSON.parse(fs.readFileSync(src, 'utf8'));
const products = data.products;
const indexUpdate = data.indexUpdate, verifiedAt = data.verifiedAt || null;
console.log('source:', src, '/ products:', products.length);

const byTitle = new Map();
for (const p of products) {
  if (!byTitle.has(p.title)) byTitle.set(p.title, []);
  byTitle.get(p.title).push(p);
}
function genderOf(list) {
  const s = new Set(list.map((p) => p.gender));
  if (s.has('unisex') || (s.has('boys') && s.has('girls'))) return 'unisex';
  return [...s][0];
}
const inAny = (cms, sizes) => sizes.some((c) => cms.includes(c));

const skus = [];
for (const [title, list] of byTitle) {
  const gender = genderOf(list);
  const brand = (list.find((p) => p.brand) || {}).brand || '';

  // カラー名 -> このデザイン内でそのカラーを持つ {product, variant} の集合
  const colorMap = new Map();
  for (const p of list) {
    for (const cv of (p.colorVariants || [])) {
      if (!colorMap.has(cv.color)) colorMap.set(cv.color, []);
      colorMap.get(cv.color).push({ p, cv });
    }
  }

  for (const [color, entries] of colorMap) {
    // サイズ別状態 (この色について)
    const sizeMap = {};
    for (const cm of DISPLAY_SIZES) {
      // この色でcmを展開している品番
      const owners = entries.filter((e) => cm in e.cv.sizes);
      if (owners.length === 0) { sizeMap[cm] = { state: 'none' }; continue; }
      const live = owners.find((e) => e.cv.sizes[cm] > 0);
      if (!live) { sizeMap[cm] = { state: 'out' }; continue; }
      const qty = live.cv.sizes[cm];
      sizeMap[cm] = { state: 'in', url: live.p.url, front: live.p.front.code, qty, lowStock: qty <= 3 };
    }

    const inStockSizes = DISPLAY_SIZES.filter((cm) => sizeMap[cm].state === 'in');
    if (inStockSizes.length === 0) continue;                 // 全サイズ売切の色は除外
    const spans = inAny(inStockSizes, BABY) && inAny(inStockSizes, KIDS); // ベビー&キッズ両方に在庫(お揃い成立)

    const gaps = CORE.filter((cm) => sizeMap[cm].state === 'out');
    const isFull = CORE.every((cm) => sizeMap[cm].state === 'in');

    // 画像: キッズ→ベビー優先でこの色を持つ品番から
    const imgEntry =
      entries.find((e) => e.p.front.code === 'KIDS' && e.cv.inStockSizes.length) ||
      entries.find((e) => e.p.front.code === 'BABY' && e.cv.inStockSizes.length) ||
      entries.find((e) => e.cv.inStockSizes.length) || entries[0];
    const image = colorImg(imgEntry.p.hinban, imgEntry.cv.code);

    const prices = entries.filter((e) => e.cv.inStockSizes.length).map((e) => e.p.price).filter(Boolean);

    skus.push({
      title, color,
      name: `${color}（${title}）`,
      gender, brand,
      image,
      fallbackImage: imgEntry.p.image,            // 色別画像が無い場合の代替
      priceMin: Math.min(...prices), priceMax: Math.max(...prices),
      inStockSizes, gaps, hasGap: gaps.length > 0, isFull, spans,
      sizeMap,
      products: entries.map((e) => ({
        hinban: e.p.hinban, front: e.p.front.code, url: e.p.url,
        inStockSizes: e.cv.inStockSizes,
      })),
    });
  }
}

const genderRank = { boys: 0, unisex: 1, girls: 2 };
skus.sort((a, b) =>
  (b.isFull - a.isFull) ||                              // ① 全在庫(80〜130フル)を最上位
  (b.spans - a.spans) ||                                // ② ベビー〜キッズで揃う色を優先
  (genderRank[a.gender] - genderRank[b.gender]) ||      // ③ 男の子→兼用→女の子
  (b.inStockSizes.length - a.inStockSizes.length) ||    // ④ 在庫サイズが多い順
  a.title.localeCompare(b.title, 'ja') || a.color.localeCompare(b.color, 'ja')
);

const out = {
  generatedAt: new Date().toISOString(),
  indexUpdate, verifiedAt,
  displaySizes: DISPLAY_SIZES,
  unit: 'color',
  totalDesigns: new Set(skus.map((s) => s.title)).size,
  totalSkus: skus.length,
  fullCount: skus.filter((s) => s.isFull).length,
  spansCount: skus.filter((s) => s.spans).length,
  gapCount: skus.filter((s) => !s.isFull).length,
  designs: skus,   // 互換のためキー名は designs（中身は色SKU）
};
// 安全弁: 抽出0件のときは既存data.jsonを空で上書きしない(上流の取得失敗対策)
if (skus.length === 0) {
  console.error('色SKUが0件のため data.json を上書きしません(上流データ異常の可能性)。');
  process.exit(1);
}
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/data.json', JSON.stringify(out, null, 2));

const gc = {};
skus.forEach((s) => (gc[s.gender] = (gc[s.gender] || 0) + 1));
console.log(`色SKU: ${skus.length} (デザイン ${out.totalDesigns} / 全在庫 ${out.fullCount} / 一部欠け ${out.gapCount})`);
console.log('性別:', JSON.stringify(gc));
skus.slice(0, 12).forEach((s) =>
  console.log(`[${s.gender}]${s.isFull ? '✅' : '⚠️'} ${s.name} | 在庫 ${s.inStockSizes.join('/')}${s.gaps.length ? ' | 売切:' + s.gaps.join('/') : ''}`)
);
