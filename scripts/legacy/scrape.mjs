// 西松屋オンライン NaviPlus 検索APIから「在庫ありTシャツ」を全件取得
import fs from 'fs';

const BASE = 'https://nishimatsuya-f-s.snva.jp/';
const PATH = 'ITEM-商品カテゴリ:ITEM_WEAR-ウェア:ITEM_TOPS-トップス:ITEM_TSHIRT-Tシャツ';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Referer': 'https://www.24028-net.jp/',
  'Accept-Language': 'ja-JP',
};
const IMG_BASE = 'https://www.24028-net.jp/client_info/N24028/itemimage/';
const ITEM_BASE = 'https://www.24028-net.jp';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildUrl(offset) {
  const qs = new URLSearchParams({
    fmt: 'json_grouping', glimit: '1', gsort: 'price', limit: '60',
    n9c: '在庫あり', o: String(offset), sort: 'number6,Reco_purchase', style: '0', path: PATH,
  });
  return BASE + '?' + qs.toString();
}

// path文字列(タブ区切り)から特定prefixの "CODE-表示名" を抽出
function extractByPrefix(pathStr, prefix) {
  const out = [];
  for (const seg of (pathStr || '').split('\t')) {
    // セグメントは ":" 階層。最後の要素を見る
    const leaf = seg.split(':').pop();
    if (leaf && leaf.startsWith(prefix)) out.push(leaf);
  }
  return out;
}

// SIZE-サイズ:S7-100cm → {code:'S7', label:'100cm', cm:100}
function parseSizes(pathStr) {
  const sizes = [];
  const re = /SIZE-サイズ:(S\d+)-([\d.]+)cm/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(pathStr || '')) !== null) {
    const code = m[1];
    if (seen.has(code)) continue;
    seen.add(code);
    sizes.push({ code, cm: parseFloat(m[2]) });
  }
  return sizes.sort((a, b) => a.cm - b.cm);
}

function parseGender(pathStr) {
  // TARGET-対象:BOYS-男の子 / GIRLS-女の子 / 共通(両方なし→ユニセックス扱い)
  const t = [];
  if (/TARGET-対象:BOYS-男の子/.test(pathStr)) t.push('boys');
  if (/TARGET-対象:GIRLS-女の子/.test(pathStr)) t.push('girls');
  if (t.length === 0) return 'unisex';
  if (t.length === 2) return 'unisex';
  return t[0];
}

function parseFrontCategory(pathStr) {
  // FRONT-フロントカテゴリ:BABY-ベビー服... / KIDS-... / SCHOOL-...
  const m = (pathStr || '').match(/FRONT-フロントカテゴリ:([A-Z_]+)-([^\t:]+)/);
  return m ? { code: m[1], label: m[2] } : { code: '', label: '' };
}

function parseBrand(pathStr) {
  const m = (pathStr || '').match(/BRAND-ブランド:[A-Z_]+-([^\t:]+)(?::([A-Z_]+)-([^\t:]+))?/);
  if (!m) return '';
  return m[3] ? m[3] : m[1];
}

async function fetchPage(offset) {
  const url = buildUrl(offset);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      return json.kotohaco;
    } catch (e) {
      console.log(`  retry offset=${offset} (${e.message})`);
      await sleep(1500);
    }
  }
  throw new Error('failed offset ' + offset);
}

async function main() {
  const first = await fetchPage(0);
  const info = first.result.info;
  const total = info.groupnum;
  const lastPage = info.last_page;
  const limit = 60;
  console.log(`hitnum=${info.hitnum} groups=${total} pages=${lastPage} index=${info.index_update_time}`);

  const allGroups = [...first.result.groups];
  for (let p = 1; p < lastPage; p++) {
    await sleep(800);
    const k = await fetchPage(p * limit);
    allGroups.push(...k.result.groups);
    console.log(`  page ${p + 1}/${lastPage} -> +${k.result.groups.length} (total ${allGroups.length})`);
  }

  const products = allGroups.map((g) => {
    const it = (g.items && g.items[0]) || {};
    const pathStr = it.path || '';
    const sizes = parseSizes(pathStr);
    // narrow7: "100cm 110cm ... 男 夏 半袖"
    const tags = (it.narrow7 || '').split('\t').filter(Boolean);
    // glimit=1だが items[0].path は全カラー・全在庫サイズを集約している。
    // COLOR-カラー:CODE-表示名 を全抽出（在庫ありカラー）。
    const colorSet = new Set();
    const colorRe = /COLOR-カラー:[^\t:]+-([^\t:]+)/g;
    let cm2;
    while ((cm2 = colorRe.exec(pathStr)) !== null) colorSet.add(cm2[1]);
    return {
      hinban: g.value,
      title: it.title || '',
      price: it.price || null,
      image: it.image ? IMG_BASE + it.image : '',
      url: it.url ? ITEM_BASE + it.url : '',
      sizes,
      sizeCms: sizes.map((s) => s.cm),
      gender: parseGender(pathStr),
      front: parseFrontCategory(pathStr),
      brand: parseBrand(pathStr),
      colors: [...colorSet],
      tags,
      variantCount: (g.items || []).length,
    };
  });

  fs.writeFileSync('products.json', JSON.stringify({
    fetchedAt: new Date().toISOString(),
    indexUpdate: info.index_update_time,
    totalItems: info.hitnum,
    totalGroups: products.length,
    products,
  }, null, 2));

  // 簡易サマリ
  const cmCount = {};
  const frontCount = {};
  const genderCount = {};
  for (const p of products) {
    p.sizeCms.forEach((c) => (cmCount[c] = (cmCount[c] || 0) + 1));
    frontCount[p.front.code] = (frontCount[p.front.code] || 0) + 1;
    genderCount[p.gender] = (genderCount[p.gender] || 0) + 1;
  }
  console.log('\nsaved products.json:', products.length, 'products');
  console.log('size cm distribution:', JSON.stringify(cmCount));
  console.log('front category:', JSON.stringify(frontCount));
  console.log('gender:', JSON.stringify(genderCount));
}

main().catch((e) => { console.error(e); process.exit(1); });
