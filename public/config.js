// ===== サイト設定 (収益化・計測はここに ID を入れるだけで有効化) =====
// オープンソースリポジトリにはプレースホルダのまま置く。
// 実際の ID/URL は各サービスの管理画面で取得して書き換える (docs/MONETIZE.md 参照)。
window.SITE_CONFIG = {
  siteUrl: 'https://nishimatsuya-coorde.pages.dev/',
  siteName: '西松屋 きょうだいお揃いコーデ＆¥1,000以下パンツ・スパッツ',

  // --- アフィリエイト (空なら通常の検索リンクとして動作) ---
  affiliate: {
    // 楽天アフィリエイトID (例: '1a2b3c4d.5e6f7g8h') → 楽天市場「西松屋チェーン楽天市場店」検索リンクに付与
    rakutenAffiliateId: '',
    // Amazonアソシエイト トラッキングID (例: 'yourtag-22')
    amazonTag: '',
  },

  // --- 応援・購読 (URL を入れると「応援する」ブロックが表示される) ---
  support: {
    // Stripe Payment Link (月額サポートを作れば実質サブスク)
    stripeSubscribeUrl: '',
    // OFUSE / Buy Me a Coffee など投げ銭
    tipUrl: '',
    // LINE公式アカウント友だち追加URL (毎朝の更新通知の配信基盤に)
    lineOfficialUrl: '',
  },

  // --- アクセス計測 ---
  analytics: {
    // Cloudflare Web Analytics のトークン (ダッシュボード > Analytics > Web Analytics)
    cloudflareBeaconToken: '',
    // Google Analytics 4 の測定ID (例: 'G-XXXXXXXXXX')
    ga4MeasurementId: '',
  },
};
