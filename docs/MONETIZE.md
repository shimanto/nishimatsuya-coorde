# 収益化・アクセス増加 運用ガイド

すべて `public/config.js` に ID/URL を記入するだけで有効化されます。コードの変更は不要。
記入後 `npm run deploy:pages` で反映。

## 1. アフィリエイト（即効性: ★★★）

サイト内の全商品カードに「楽天で探す」「Amazonで探す」ボタンが付いています。
IDを設定すると自動でアフィリエイトリンク化されます（未設定時は通常の検索リンク）。

| 項目 | 手順 |
|---|---|
| 楽天アフィリエイト | https://affiliate.rakuten.co.jp/ に楽天IDでログイン → 管理画面の「アフィリエイトID」(例 `1a2b3c4d.5e6f7g8h`) を `affiliate.rakutenAffiliateId` に記入。西松屋は「西松屋チェーン楽天市場店」が公式出店しており、同名商品の成約が狙える。料率2〜4%。 |
| Amazonアソシエイト | https://affiliate.amazon.co.jp/ で申請 → トラッキングID (例 `yourtag-22`) を `affiliate.amazonTag` に記入。※180日以内に3件の成約が必要。 |
| もしもアフィリエイト(代替) | 楽天/Amazon両方を一括管理したい場合。リンク形式が異なるため、その場合は `index.html` の `rakutenLink()`/`amazonLink()` を「どこでもリンク」形式に差し替える。 |

## 2. サブスク/応援（継続収益: ★★）

URLを設定すると全タブ下部に「応援ブロック」が自動表示されます。

| 項目 | 手順 |
|---|---|
| Stripe Payment Link | Stripeダッシュボード → Payment Links → 「継続」で月額300〜500円のサポータープランを作成 → URLを `support.stripeSubscribeUrl` に。特典例: LINE通知の優先配信、リクエスト受付。 |
| OFUSE / Buy Me a Coffee | アカウント作成してプロフィールURLを `support.tipUrl` に。 |
| LINE公式アカウント | https://entry.line.biz/ で無料開設 → 友だち追加URLを `support.lineOfficialUrl` に。**毎朝の更新通知を配信するリスト資産になる**(月200通まで無料)。将来は限定セール速報を有料プラン特典化も可。 |

## 3. アクセス増加（自動化済みの仕組み）

- **RSS (`/api/feed.xml`)**: 毎朝8時に新着・値下げが自動配信される。
  - IFTTT / Zapier / Buffer に食わせれば **Xへの毎朝自動ポスト** が無料で組める
    (IFTTT: RSS Feed → New feed item → Post a tweet)。プロンプト時間ゼロで集客が回る。
- **シェアボタン**: ヘッダーの𝕏/LINEシェア(ママ層はLINE共有率が高い)。
- **OGP画像**: `npm run verify` が `public/og.png` を自動生成(¥1,000以下タブのスクショ)。

## 4. SEO（実装済み）

- タブごとに実URL (`/` `/cheap` `/brands`) + canonical + title/description 切替
- JSON-LD 構造化データ (WebSite + ItemList/Product with Offer) → 商品リッチリザルト対応
- `sitemap.xml` / `robots.txt` / RSS autodiscovery
- 毎日更新 = クロール頻度向上。狙うクエリ例:
  「西松屋 1000円以下 パンツ」「西松屋 お揃い きょうだい」「西松屋 レギンス 安い」
- やること: Google Search Console にプロパティ登録 → `sitemap.xml` を送信（初回のみ手動）

## 5. 計測

| 項目 | 手順 |
|---|---|
| Cloudflare Web Analytics (推奨・無料・クッキーレス) | ダッシュボード → Analytics & Logs → Web Analytics → サイト追加 → トークンを `analytics.cloudflareBeaconToken` に。 |
| GA4 | 測定ID (`G-XXXX`) を `analytics.ga4MeasurementId` に。 |

## 収益の目安（参考）

- 楽天料率 2〜4% × 客単価¥3,000前後 → 100クリック/日・CVR2%で月1万円前後から
- 立ち上がりはSEO流入が細いため、RSS→X自動投稿とLINE友だちの蓄積が先行指標
