# kyoudai-coorde｜きょうだいお揃いコーデ & ¥1,000以下ボトムス

西松屋オンラインストアの**在庫データ**から、

- 👕 **きょうだいお揃いTシャツ** — 同じデザイン × 80〜140cm でベビー〜キッズが揃うTシャツ
- 👖 **税込¥1,000以下のパンツ・スパッツ** — 安い順・サイズ/性別絞り込み付き
- 🛍 **他ブランドセール** — ユニクロ / H&M / ZARA / ヒラキ のキッズセールを自動巡回

を毎朝8時(JST)に **Cloudflare cron で全自動更新** して公開する静的サイト。

🌐 公開URL: https://kyoudai-coorde.pages.dev （/cheap = ¥1,000以下タブ直リンク）

## アーキテクチャ

```
┌──────────────────────┐   毎朝 23:00-23:55 UTC (8時台 JST)
│ cron Worker           │   NaviPlus検索API等を巡回し
│ (worker/index.mjs)    │──→ data.json / cheap.json / uniqlo.json
└─────────┬────────────┘    / corners.json / feed.xml を生成
          │ KV put
┌─────────▼────────────┐
│ Workers KV (COORDE_KV)│  last-good 保持 (失敗日は前日データ温存)
└─────────┬────────────┘
          │ KV get
┌─────────▼────────────┐
│ Cloudflare Pages      │  /api/*.json → KV (無ければ静的フォールバック)
│ + Pages Functions     │  /api/img    → 画像プロキシ (許可ホストのみ)
│ (functions/, public/) │  / /cheap /brands → タブUI (index.html)
└──────────────────────┘
```

- **PC不要**: 更新はすべて Cloudflare 上で完結（旧: Windowsタスクスケジューラ → 廃止）
- **無料プラン対応**: cron はステップ分割 + fetch予算管理で 50 subrequests/invocation に収まる
- **データソースは検索APIのみ**: 商品サイト本体への直接アクセスは行わない
  （在庫確認ページは 2026-07-08 からWAFで403のため廃止。在庫はAPIの在庫ありファセット単位）

## ディレクトリ

| パス | 役割 |
|---|---|
| `src/pipeline.mjs` | 共有パイプライン（Node / Worker 両対応、fetch注入式） |
| `worker/` | cron Worker（ステートマシン、KV書込、手動tick API） |
| `functions/api/` | Pages Functions（KV配信・静的フォールバック・画像プロキシ） |
| `public/` | サイト本体（タブUI）・SEO静的ファイル・生成データ |
| `scripts/build-local.mjs` | ローカルでのデータ生成（初期投入・障害時の手動復旧用） |
| `scripts/verify.mjs` | Playwright によるレンダリング検証 + OGP画像生成 |
| `scripts/legacy/` | 旧構成（zaiko_subスクレイパー等）の参考保管 |

## セットアップ / デプロイ

```bash
npm install
npx wrangler login

# データ生成 → 表示検証
npm run build
npm run verify

# デプロイ (Pages + cron Worker)
npm run deploy

# cron Worker の手動トリガー用トークン (任意の乱数を設定)
npx wrangler secret put ADMIN_TOKEN -c worker/wrangler.toml
```

初回は `wrangler kv namespace create COORDE_KV` で KV を作成し、
`wrangler.toml` / `worker/wrangler.toml` の `id` を差し替えてください。

### cron の手動実行（テスト用）

```bash
# 1ステップずつ進める (無料プラン相当の予算で)
curl -X POST "https://kyoudai-coorde-cron.<subdomain>.workers.dev/tick?token=<ADMIN_TOKEN>"
# 実行状況
curl "https://kyoudai-coorde-cron.<subdomain>.workers.dev/status"
```

## 収益化・計測

`public/config.js` に ID を設定するだけで有効化されます（詳細: `docs/MONETIZE.md`）:
楽天アフィリエイト / Amazonアソシエイト / Stripe Payment Link(月額サポート) /
OFUSE等の投げ銭 / LINE公式アカウント / Cloudflare Web Analytics / GA4。

## 注意事項

- 本プロジェクトは**非公式**の個人プロジェクトです。西松屋・各ブランドとは無関係です。
- 価格・在庫は取得時点のものです。購入前に必ず各商品ページでご確認ください。
- データ・画像の権利は各社に帰属します。画像は再配布せずリンク/プロキシ表示のみ。
- 取得は1日1回・リクエスト間隔付きで、対象サイトへ負荷をかけない設計です。
- リポジトリにAPIキー等の秘密情報は含まれません（ADMIN_TOKEN は wrangler secret で管理）。

## ライセンス

MIT（コードのみ。取得データ・画像は対象外）
