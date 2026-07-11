// 各品番の在庫確認ページ(item_itemproperty_zaiko_sub.html)から実在庫を取得し、
// サイズ別の真の在庫(>0のカラーが1つ以上か)で products を上書きする。
import fs from 'fs';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Referer': 'https://www.24028-net.jp/',
  'Accept-Language': 'ja-JP',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 在庫テーブルの各行: <td>80, スミクロ</td><td>40-1</td><td class="number"> 45 </td>
const ROW_RE = /<td>\s*([^,<]+?)\s*,\s*([^<]+?)\s*<\/td>\s*<td>\s*([0-9\-]+)\s*<\/td>\s*<td class="number">\s*([0-9]+)\s*<\/td>/g;

async function fetchStock(hinban) {
  const url = `https://www.24028-net.jp/item_itemproperty_zaiko_sub.html?item_cd=${hinban}`;
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const html = await res.text();
      // 在庫数テーブルを含むか確認
      if (!/在庫数/.test(html)) return { ok: false, reason: 'no_table', sizeStock: {} };
      const sizeStock = {};   // cm -> [{color, qty}]
      const colorMap = {};    // colorName -> { code, sizes: {cm: qty} }
      let m;
      ROW_RE.lastIndex = 0;
      while ((m = ROW_RE.exec(html)) !== null) {
        const sizeLabel = m[1].trim();         // "80" など
        const color = m[2].trim();
        const code = m[3].trim();              // "40-1" (size-color)
        const colorCode = code.split('-')[1] || '';
        const qty = parseInt(m[4], 10);
        const cm = parseFloat(sizeLabel);
        if (!Number.isFinite(cm)) continue;     // 新生児等は除外
        (sizeStock[cm] = sizeStock[cm] || []).push({ color, qty });
        const cv = colorMap[color] || (colorMap[color] = { code: colorCode, sizes: {} });
        if (!cv.code) cv.code = colorCode;
        cv.sizes[cm] = qty;
      }
      return { ok: true, sizeStock, colorMap };
    } catch (e) {
      if (a === 2) return { ok: false, reason: e.message, sizeStock: {} };
      await sleep(1200);
    }
  }
}

async function pool(items, size, worker) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: size }, run));
  return results;
}

// API段階のサイズで「ベビー(80/90/95)とキッズ(100-130)の両方に展開がある」デザインを候補化。
// (実在庫検証は在庫を減らす方向のみなので、この候補集合は最終結果の上位集合になり安全)
const BABY = [80, 90, 95];
const KIDS = [100, 110, 120, 130];
function candidateTitles(products) {
  const byTitle = new Map();
  for (const p of products) {
    if (!byTitle.has(p.title)) byTitle.set(p.title, []);
    byTitle.get(p.title).push(p);
  }
  const titles = new Set();
  for (const [title, list] of byTitle) {
    const cms = new Set(list.flatMap((p) => p.sizeCms));
    if (BABY.some((c) => cms.has(c)) && KIDS.some((c) => cms.has(c))) titles.add(title);
  }
  return titles;
}

async function main() {
  const { products, indexUpdate } = JSON.parse(fs.readFileSync('products.json', 'utf8'));
  const titles = candidateTitles(products);
  const targets = products.filter((p) => titles.has(p.title));
  console.log(`検証対象: ${targets.length}品番 (候補${titles.size}デザイン)`);

  let done = 0;
  const verified = await pool(targets, 6, async (p) => {
    const r = await fetchStock(p.hinban);
    await sleep(120);
    done++;
    if (done % 15 === 0) console.log(`  ...${done}/${targets.length}`);
    const sizeStock = r.sizeStock;
    // サイズ別: 在庫>0のカラー
    const inStockSizes = [];
    const sizeColors = {};
    for (const [cm, arr] of Object.entries(sizeStock)) {
      const live = arr.filter((x) => x.qty > 0);
      if (live.length) {
        inStockSizes.push(parseFloat(cm));
        sizeColors[cm] = live.map((x) => ({ color: x.color, qty: x.qty }));
      }
    }
    inStockSizes.sort((a, b) => a - b);
    // 色別: code(画像用) と サイズ別在庫
    const colorVariants = Object.entries(r.colorMap || {}).map(([color, v]) => ({
      color, code: v.code,
      sizes: v.sizes,                        // cm -> qty (0含む)
      inStockSizes: Object.entries(v.sizes).filter(([, q]) => q > 0).map(([cm]) => parseFloat(cm)).sort((a, b) => a - b),
    }));
    return {
      ...p,
      apiSizeCms: p.sizeCms,
      sizeCms: inStockSizes,                 // ← 実在庫で上書き
      sizeColors,                            // cm -> [{color, qty}]
      colorVariants,                         // [{color, code, sizes:{cm:qty}, inStockSizes}]
      colors: [...new Set(Object.values(sizeColors).flat().map((x) => x.color))],
      stockChecked: r.ok,
    };
  });

  // 変化レポート
  let changed = 0;
  for (const v of verified) {
    const before = v.apiSizeCms.join('/');
    const after = v.sizeCms.join('/');
    if (before !== after) { changed++; console.log(`  [変化] ${v.hinban} ${v.title} (${v.front.code}): ${before} → ${after || '(在庫なし)'}`); }
  }
  console.log(`在庫検証完了: ${verified.length}品番中 ${changed}品番でサイズ在庫に変化`);

  // 安全弁: 在庫API取得が大量失敗(>50%)した場合は空データで上書きしない(一時的ブロック対策)
  const okCount = verified.filter((v) => v.stockChecked).length;
  if (verified.length && okCount / verified.length < 0.5) {
    throw new Error(`在庫取得の成功率が低すぎます (${okCount}/${verified.length})。一時的なブロックの可能性があるため中断します(既存データは保持)。`);
  }

  fs.writeFileSync('products.verified.json', JSON.stringify({
    verifiedAt: new Date().toISOString(), indexUpdate, products: verified,
  }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
