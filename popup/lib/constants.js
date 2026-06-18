// ─── Shared Constants ──────────────────────────────────────────────────────────

var CHECKER_TABS = [
  { id: 'seo',            label: 'SEO' },
  { id: 'headings',       label: 'Headings' },
  { id: 'images',         label: 'Images' },
  { id: 'opengraph',      label: 'OG' },
  { id: 'schema',         label: 'Schema' },
  { id: 'links',          label: 'Links' },
  { id: 'accessibility',  label: 'A11y' },
  { id: 'vitals',         label: 'Vitals' },
  { id: 'analytics',      label: 'Analytics' },
  { id: 'gdpr',           label: 'GDPR' },
  { id: 'semantics',      label: 'Semantics' },
  { id: 'favicon',        label: 'Favicon' },
  { id: 'hreflang',       label: 'Hreflang' },
  { id: 'mobile',         label: 'Mobile' },
  { id: 'localization',   label: 'i18n' },
  { id: 'external_links', label: 'Ext.Links' },
  { id: 'serp',           label: 'SERP' },
  { id: 'nlp',            label: 'NLP' },
  { id: 'ai_visibility',  label: 'AI/E-E-A-T' },
  { id: 'schema_suggest', label: 'Schema+' },
  { id: 'robots',         label: 'Robots' },
  { id: 'sitemap',        label: 'Sitemap' },
  { id: 'js_seo',         label: 'JS SEO' },
  { id: 'security',       label: 'Security' },
  { id: 'ip_info',        label: 'IP / DNS' },
  { id: 'pagination',     label: 'Pagination' },
  { id: 'urlparams',      label: 'URL Params' },
  { id: 'third_party',    label: '3rd Party' },
  { id: 'resource_hints', label: 'Hints' },
  { id: 'media',          label: 'Media' },
  { id: 'storage',        label: 'Storage' },
  { id: 'headers',        label: 'Headers' },
  { id: 'techstack',      label: 'Tech Stack' },
  { id: 'broken_links',   label: 'Broken' },
  { id: 'pwa',             label: 'PWA' },
  { id: 'font_loading',    label: 'Fonts' },
  { id: 'css_audit',       label: 'CSS' },
  { id: 'twitter_cards',   label: 'Twitter/X' },
  { id: 'content_quality', label: 'Content' },
  { id: 'htmlval',         label: 'HTML Val.' },
  { id: 'internal_links',  label: 'Int.Links' },
  { id: 'eeat',            label: 'E-E-A-T' },
  { id: 'toc',             label: 'TOC' },
  { id: 'canonical',       label: 'Canonical' },
  { id: 'link_juice',      label: 'Link Equity' },
  { id: 'international',   label: 'International' },
];

var SPECIAL_PANELS = [
  'broken_links', 'storage', 'headers', 'audit_history',
  'og_preview', 'serp_preview', 'redirect_chain', 'security_files',
];

// Checkers that appear in CHECKERS but have no physical checkers/<id>.js file.
var CHECKERS_NO_FILE = ['broken_links'];

var CHECKERS = [
  'seo', 'headings', 'images', 'opengraph',
  'schema', 'links', 'accessibility', 'vitals',
  'analytics', 'gdpr', 'semantics', 'favicon', 'hreflang', 'mobile',
  'localization', 'external_links', 'serp', 'nlp',
  'ai_visibility', 'schema_suggest', 'robots', 'sitemap', 'js_seo', 'security', 'ip_info', 'third_party',
  'resource_hints', 'media', 'storage', 'headers',
  'techstack', 'broken_links',
  'pagination', 'urlparams', 'pwa', 'font_loading', 'css_audit', 'twitter_cards', 'content_quality', 'htmlval',
  'internal_links', 'eeat',
  'toc', 'canonical', 'link_juice', 'international'
];

var PANEL_CONTAINER_IDS = [
  'results', 'storage-panel', 'headers-panel', 'broken-links-panel', 'audit-history-panel',
  'og-preview-panel', 'serp-preview-panel', 'redirect-chain-panel', 'security-files-panel',
  'sitemap-panel',
];
