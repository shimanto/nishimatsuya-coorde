// ユニクロ: セール中(期間限定価格/値下げ)のキッズTシャツを取得し、サンプル1点を選定して
// public/uniqlo.json を生成する。
import fs from 'fs';

const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/json', 'Referer': 'https://www.uniqlo.com/jp/ja/', 'Accept-Language': 'ja-JP',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API = 'https://www.uniqlo.com/jp/api/commerce/v5/ja';

async function search(q) {
  const u = `${API}/products?q=${encodeURIComponent(q)}&offset=0&limit=80&imageRatio=3x4&httpFailure=true`;
  const r = await fetch(u, { headers: H });
  return ((await r.json()).result || {}).items || [];
}
async function l2detail(pid) {
  const u = `${API}/products/${pid}/price-groups/00/l2s?withPrices=true&withStocks=true&httpFailure=true`;
  const r = await fetch(u, { headers: H });
  return (await r.json()).result || {};
}
const productUrl = (pid) => `https://www.uniqlo.com/jp/ja/products/${pid}`;
// 検索itemの実画像URLを使う(構築しない)。repColor優先、なければ先頭。
function imageFromItem(item, repColor) {
  const main = (item.images && item.images.main) || {};
  const entry = main[repColor] || main[Object.keys(main)[0]];
  return entry ? entry.image : '';
}

function analyze(pid, item, d) {
  const l2s = d.l2s || [], prices = d.prices || {}, stocks = d.stocks || {};
  let saleFlag = null;
  const colorMap = new Map(); // colorDisplayCode -> {code, inStock:Set, name}
  const sizeState = {};       // sizeDisplay -> 'in' | 'out'
  let baseMin = Infinity, promoMin = Infinity;
  for (const x of l2s) {
    const st = stocks[x.l2Id], pr = prices[x.l2Id];
    const inStock = st && st.statusCode === 'IN_STOCK' && (st.quantity == null || st.quantity > 0);
    const pf = (x.flags && x.flags.priceFlags || []).find((f) => /limitedOffer|discount/.test(f.code));
    if (pf && !saleFlag) saleFlag = { code: pf.code, name: pf.name };
    if (pr && pr.base) baseMin = Math.min(baseMin, pr.base.value);
    if (pr && pr.promo) promoMin = Math.min(promoMin, pr.promo.value);
    const size = x.size.displayCode;
    if (inStock) sizeState[size] = 'in';
    else if (!(size in sizeState)) sizeState[size] = 'out';
    const cc = x.color.displayCode;
    if (!colorMap.has(cc)) colorMap.set(cc, { code: cc, inStock: new Set() });
    if (inStock) colorMap.get(cc).inStock.add(size);
  }
  const inStockSizes = Object.entries(sizeState).filter(([, s]) => s === 'in').map(([s]) => parseInt(s, 10)).sort((a, b) => a - b);
  const colors = [...colorMap.values()].map((c) => ({ code: c.code, inStockSizes: [...c.inStock].map(Number).sort((a, b) => a - b) }));
  return { saleFlag, sizeState, inStockSizes, colors, baseMin, promoMin };
}

async function main() {
  const raw = [...await search('キッズ Tシャツ'), ...await search('ベビー Tシャツ')];
  const seen = new Set();
  const cands = raw.filter((it) => it.productId && !seen.has(it.productId) && seen.add(it.productId));
  console.log('候補:', cands.length);

  const sale = [];
  for (const it of cands.slice(0, 60)) {
    try {
      const d = await l2detail(it.productId); await sleep(70);
      const a = analyze(it.productId, it, d);
      if (a.saleFlag && a.inStockSizes.length > 0) sale.push({ it, a });
    } catch {}
  }
  console.log('セール×在庫あり候補:', sale.length);

  // エアリズム(AIRism)は除外
  const eligible = sale.filter(({ it }) => !/エアリズム|AIRism|airism/i.test(it.name));
  console.log('エアリズム除外後:', eligible.length);

  // 選定: 価格が最安→在庫サイズが多い→GIRLS以外を優先→名前
  eligible.sort((x, y) =>
    (x.a.promoMin - y.a.promoMin) ||
    (y.a.inStockSizes.length - x.a.inStockSizes.length) ||
    ((x.it.name.startsWith('GIRLS') ? 1 : 0) - (y.it.name.startsWith('GIRLS') ? 1 : 0)) ||
    x.it.name.localeCompare(y.it.name, 'ja'));

  const pick = eligible[0];
  if (!pick) { console.log('セール品が見つかりませんでした'); return; }
  const { it, a } = pick;
  const repColor = (a.colors.find((c) => c.inStockSizes.length) || a.colors[0] || { code: it.representativeColorDisplayCode || '00' }).code;

  const sku = {
    brand: 'UNIQLO',
    productId: it.productId,
    name: it.name,
    genderName: it.genderName || '',
    url: productUrl(it.productId),
    image: imageFromItem(it, repColor),
    price: a.promoMin,
    saleLabel: a.saleFlag ? a.saleFlag.name : 'セール',
    displaySizes: Object.keys(a.sizeState).map(Number).sort((p, q) => p - q),
    sizeState: a.sizeState,
    inStockSizes: a.inStockSizes,
    colorCount: a.colors.length,
  };

  fs.writeFileSync('public/uniqlo.json', JSON.stringify({
    fetchedAt: new Date().toISOString(),
    note: 'ユニクロのセール(期間限定価格/値下げ)キッズTシャツから自動選定したサンプル1点',
    saleCandidates: sale.length,
    sample: sku,
  }, null, 2));
  console.log('選定:', sku.name, '| ¥' + sku.price, '|', sku.saleLabel, '| 在庫サイズ', sku.inStockSizes.join('/'), '|', sku.colorCount + '色');
  console.log('saved public/uniqlo.json');
}
main().catch((e) => { console.error(e); process.exit(1); });
