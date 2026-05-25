// ─── Pure Utility Functions ────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch(e) { return ''; }
}

function truncate(str, max) {
  str = String(str || '');
  return str.length > max ? str.substring(0, max - 1) + '…' : str;
}

function fmtNum(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('uk-UA');
}

function extractSeedKeyword(title) {
  if (!title) return '';
  var parts = title.split(/\s*[\|\-–—:]\s*/);
  return (parts[0] || '').trim();
}

function stripMd(str) {
  return String(str || '')
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
    .replace(/#+\s/g, '').replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\n+/g, ' ').trim();
}

function kdColor(kd) {
  if (kd == null) return '#9e9e9e';
  return kd >= 70 ? '#c62828' : kd >= 50 ? '#e65100' : kd >= 30 ? '#f57c00' : '#2e7d32';
}

var PROMO_WORDS = [
  'buy','купити','купить','дешево','cheap','deal','акція','sale','розпродаж',
  'discount','знижка','promo','промо','order','замовити','замовить','shop',
  'store','price','ціна','ціни','найкраща','best price','знижки'
];

function isAdvertisingTitle(title) {
  var t = title.toLowerCase();
  for (var i = 0; i < PROMO_WORDS.length; i++) {
    if (t.indexOf(PROMO_WORDS[i]) !== -1) return true;
  }
  return false;
}
