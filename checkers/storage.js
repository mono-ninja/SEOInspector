function runStorageChecker(p) {
  var issues = [];

  // ── Known cookie patterns ───────────────────────────────────────────────────
  var ANALYTICS_COOKIES = ['_ga', '_ga_', '_gid', '__utm', 'fb_', 'fr=', '_fbp', '_pin_unauth', '_hj', 'hotjar', 'tmr_', 'yandex', '_ym_', '_hjwid', '_mkto_trk', 'mo_', 'optimizely', '_li_', '_ketch', '_klana'];
  var CONSENT_COOKIES = ['consent', 'cookie_consent', 'cookieConsent', 'gdpr', 'gdpr_consent', '_ga_an', 'sp', 'userconsent', 'cookie_preference', 'cookiePolicy', 'accept_cookies', 'cookielaw', 'onetrust', 'cyberChef', 'didomi', '_tkr'];
  var TRACKING_COOKIES = ['_hjSession', '_hjIncluded', '_uet', '_s', 'sid', 'sess', 'sessionid', 'connect.sid', '__cfduid', 'cfid', 'amp', '_io', 'mixpanel'];

  // Known localStorage patterns
  var LS_ANALYTICS = ['_ga', '_gid', 'gtag', 'google_analytics', 'analytics', 'segment', 'mixpanel', 'hotjar', 'intercom'];
  var LS_CART = ['cart', 'basket', 'shopping_cart', 'woocommerce_cart', 'shopify_cart', 'cart_'];
  var LS_ABTEST = ['ab', 'split', 'variant', 'experiment', 'test_', 'optimizely', 'vwo'];
  var LS_PRIVACY = ['user_id', 'email', 'phone', 'name', 'token', 'auth', 'session', 'password', 'ssn', 'credit_card'];

  // ── Cookie analysis ─────────────────────────────────────────────────────────
  var cookieStr = document.cookie || '';
  var cookiePairs = [];
  var totalCookieBytes = 0;

  if (cookieStr) {
    cookieStr.split(';').forEach(function(pair) {
      pair = pair.trim();
      if (!pair) return;
      var eqIdx = pair.indexOf('=');
      var name = eqIdx > 0 ? pair.substring(0, eqIdx).trim() : pair;
      var value = eqIdx > 0 ? pair.substring(eqIdx + 1).trim() : '';
      var size = pair.length;
      totalCookieBytes += size;
      cookiePairs.push({ name: name, value: value, size: size });
    });
  }

  var cookieCount = cookiePairs.length;

  // Classify cookies
  var analyticsCookies = [];
  var consentCookies = [];
  var trackingCookies = [];
  var otherCookies = [];

  cookiePairs.forEach(function(c) {
    var nameLower = c.name.toLowerCase();
    var isAnalytics = ANALYTICS_COOKIES.some(function(p) { return nameLower.indexOf(p.toLowerCase()) !== -1; });
    var isConsent = CONSENT_COOKIES.some(function(p) { return nameLower.indexOf(p.toLowerCase()) !== -1; });
    var isTracking = TRACKING_COOKIES.some(function(p) { return nameLower.indexOf(p.toLowerCase()) !== -1; });

    if (isAnalytics) analyticsCookies.push(c.name);
    else if (isConsent) consentCookies.push(c.name);
    else if (isTracking) trackingCookies.push(c.name);
    else otherCookies.push(c.name);
  });

  // Cookie count warning
  if (cookieCount > 20) {
    issues.push({
      type: 'too_many_cookies',
      message: 'Too many cookies: ' + cookieCount + ' (recommended ≤ 20)',
      severity: cookieCount > 50 ? 'warning' : 'notice',
      detail: 'Each cookie is sent with every HTTP request, increasing page weight by ~' + totalCookieBytes + ' bytes per request.'
    });
  }

  // Cookie size warning (each request sends all cookies)
  if (totalCookieBytes > 4096) {
    issues.push({
      type: 'large_cookie_size',
      message: 'Total cookie size: ' + totalCookieBytes + ' bytes (recommended ≤ 4096)',
      severity: totalCookieBytes > 8192 ? 'warning' : 'notice',
      detail: 'Large cookies slow down every HTTP request. Each cookie adds overhead to all network requests.'
    });
  }

  // Analytics cookies
  if (analyticsCookies.length > 0) {
    issues.push({
      type: 'analytics_cookies',
      message: 'Analytics cookies detected (' + analyticsCookies.length + ')',
      severity: 'info',
      detail: analyticsCookies.join(', ')
    });
  }

  // Consent cookies
  if (consentCookies.length > 0) {
    issues.push({
      type: 'consent_cookies',
      message: 'Consent/GDPR cookies detected (' + consentCookies.length + ')',
      severity: 'info',
      detail: consentCookies.join(', ')
    });
  }

  // Tracking cookies
  if (trackingCookies.length > 0) {
    issues.push({
      type: 'tracking_cookies',
      message: 'Tracking/session cookies detected (' + trackingCookies.length + ')',
      severity: 'notice',
      detail: trackingCookies.join(', ')
    });
  }

  // ── localStorage analysis ───────────────────────────────────────────────────
  var lsKeys = [];
  var lsTotalBytes = 0;
  var lsOversized = [];
  var lsAnalyticsKeys = [];
  var lsCartKeys = [];
  var lsAbtestKeys = [];
  var lsPrivacyKeys = [];
  var lsJsonKeys = [];
  var lsHasData = false;

  try {
    for (var li = 0; li < localStorage.length; li++) {
      var lk = localStorage.key(li) || '';
      var lv = localStorage.getItem(lk) || '';
      lsHasData = true;

      // UTF-16 byte size (2 bytes per char for JS strings)
      var keyBytes = lk.length * 2;
      var valBytes = lv.length * 2;
      var entryBytes = keyBytes + valBytes;
      lsTotalBytes += entryBytes;

      lsKeys.push({ key: lk, size: entryBytes, valuePreview: lv.substring(0, 80) });

      // Oversized individual entries (> 100KB)
      if (entryBytes > 102400) {
        lsOversized.push({ key: lk, size: Math.round(entryBytes / 1024) });
      }

      // JSON serialization overhead detection
      var lkLower = lk.toLowerCase();
      if (lv.charAt(0) === '{' || lv.charAt(0) === '[') {
        lsJsonKeys.push(lk);
      }

      // Pattern matching
      if (LS_ANALYTICS.some(function(p) { return lkLower.indexOf(p) !== -1; })) lsAnalyticsKeys.push(lk);
      if (LS_CART.some(function(p) { return lkLower.indexOf(p) !== -1; })) lsCartKeys.push(lk);
      if (LS_ABTEST.some(function(p) { return lkLower.indexOf(p) !== -1; })) lsAbtestKeys.push(lk);
      if (LS_PRIVACY.some(function(p) { return lkLower.indexOf(p) !== -1; })) lsPrivacyKeys.push(lk);
    }
  } catch(e) {}

  // localStorage total size
  if (lsHasData && lsTotalBytes > 5 * 1024 * 1024) {
    issues.push({
      type: 'large_localstorage',
      message: 'localStorage uses ' + (lsTotalBytes / 1024 / 1024).toFixed(1) + ' MB (browser limit: ~5-10 MB)',
      severity: 'warning',
      detail: 'Large localStorage can slow down page load and cause quota errors.'
    });
  } else if (lsHasData && lsTotalBytes > 1 * 1024 * 1024) {
    issues.push({
      type: 'moderate_localstorage',
      message: 'localStorage uses ' + (lsTotalBytes / 1024).toFixed(0) + ' KB',
      severity: 'notice'
    });
  }

  // localStorage key count
  if (lsKeys.length > 50) {
    issues.push({
      type: 'too_many_localstorage_keys',
      message: 'Excessive localStorage keys: ' + lsKeys.length,
      severity: 'notice',
      detail: 'Many small keys are less efficient than fewer structured entries.'
    });
  }

  // Oversized localStorage entries
  if (lsOversized.length > 0) {
    issues.push({
      type: 'oversized_localstorage_entries',
      message: 'Oversized localStorage entries > 100 KB (' + lsOversized.length + ')',
      severity: 'notice',
      detail: lsOversized.map(function(e) { return e.key + ': ' + e.size + ' KB'; }).join('\n')
    });
  }

  // Analytics keys in localStorage
  if (lsAnalyticsKeys.length > 0) {
    issues.push({
      type: 'localstorage_analytics',
      message: 'Analytics data in localStorage (' + lsAnalyticsKeys.length + ' keys)',
      severity: 'info',
      detail: lsAnalyticsKeys.join(', ')
    });
  }

  // Cart keys in localStorage
  if (lsCartKeys.length > 0) {
    issues.push({
      type: 'localstorage_cart',
      message: 'Shopping cart data in localStorage (' + lsCartKeys.length + ' keys)',
      severity: 'info',
      detail: lsCartKeys.join(', ')
    });
  }

  // A/B test keys
  if (lsAbtestKeys.length > 0) {
    issues.push({
      type: 'localstorage_abtest',
      message: 'A/B testing data in localStorage (' + lsAbtestKeys.length + ' keys)',
      severity: 'info',
      detail: lsAbtestKeys.join(', ')
    });
  }

  // Privacy-sensitive keys in localStorage
  if (lsPrivacyKeys.length > 0) {
    issues.push({
      type: 'localstorage_privacy_sensitive',
      message: 'Potentially privacy-sensitive data in localStorage (' + lsPrivacyKeys.length + ' keys)',
      severity: 'warning',
      detail: 'localStorage is accessible via any script on the page (XSS risk). Avoid storing personal data.\nKeys: ' + lsPrivacyKeys.join(', ')
    });
  }

  // JSON serialization overhead
  if (lsJsonKeys.length > 0 && lsKeys.length > 0) {
    var jsonRatio = (lsJsonKeys.length / lsKeys.length * 100).toFixed(0);
    issues.push({
      type: 'localstorage_json_overhead',
      message: 'localStorage: ' + lsJsonKeys.length + '/' + lsKeys.length + ' keys (' + jsonRatio + '%) store JSON strings',
      severity: 'info',
      detail: 'JSON serialization adds ~33% overhead compared to binary formats. Consider IndexedDB for large structured data.'
    });
  }

  // ── sessionStorage analysis ─────────────────────────────────────────────────
  var ssKeys = [];
  var ssTotalBytes = 0;
  var ssHasData = false;

  try {
    for (var si = 0; si < sessionStorage.length; si++) {
      var sk = sessionStorage.key(si) || '';
      var sv = sessionStorage.getItem(sk) || '';
      ssHasData = true;

      var ssEntryBytes = (sk.length + sv.length) * 2;
      ssTotalBytes += ssEntryBytes;
      ssKeys.push({ key: sk, size: ssEntryBytes });
    }
  } catch(e) {}

  if (ssHasData && ssTotalBytes > 512 * 1024) {
    issues.push({
      type: 'large_sessionstorage',
      message: 'sessionStorage uses ' + (ssTotalBytes / 1024).toFixed(0) + ' KB',
      severity: 'notice',
      detail: 'Large sessionStorage can slow down tab operations.'
    });
  }

  if (ssKeys.length > 30) {
    issues.push({
      type: 'too_many_sessionstorage_keys',
      message: 'Many sessionStorage keys: ' + ssKeys.length,
      severity: 'notice'
    });
  }

  // ── IndexedDB check ─────────────────────────────────────────────────────────
  var hasIDBApi = !!indexedDB;
  var idbPromise = Promise.resolve([]);
  try {
    if (hasIDBApi && indexedDB.databases) {
      idbPromise = indexedDB.databases().catch(function() { return []; });
    }
  } catch(e) {}

  // ── Cache API check ─────────────────────────────────────────────────────────
  var hasCacheApi = 'caches' in window;
  var cachePromise = Promise.resolve([]);
  if (hasCacheApi) {
    try {
      cachePromise = caches.keys().catch(function() { return []; });
    } catch(e) {}
  }

  return Promise.all([idbPromise, cachePromise]).then(function(results) {
    var dbs = results[0];
    var cacheNames = results[1];
    var idbNames = [];
    dbs.forEach(function(db) { idbNames.push(db.name || '(unnamed)'); });

    if (cacheNames.length > 0) {
      issues.push({
        type: 'cache_api_active',
        message: 'Cache API active (' + cacheNames.length + ' cache' + (cacheNames.length > 1 ? 's' : '') + ')',
        severity: 'info',
        detail: 'Caches: ' + cacheNames.join(', ') + '\nUsed by Service Worker for offline support.'
      });
    }

    if (idbNames.length > 0) {
      issues.push({
        type: 'indexeddb_active',
        message: 'IndexedDB databases (' + idbNames.length + ')',
        severity: 'info',
        detail: 'Databases: ' + idbNames.join(', ')
      });
    }

    issues.unshift({
      type: 'storage_overview',
      message: 'Storage overview',
      severity: 'info',
      detail: [
        'Cookies           ' + cookieCount + ' (' + totalCookieBytes + ' bytes)',
        '  Analytics       ' + analyticsCookies.length,
        '  Consent/GDPR    ' + consentCookies.length,
        '  Tracking        ' + trackingCookies.length,
        '  Other           ' + otherCookies.length,
        'localStorage      ' + (lsHasData ? lsKeys.length + ' keys, ' + (lsTotalBytes / 1024).toFixed(0) + ' KB' : 'empty'),
        '  Analytics keys  ' + lsAnalyticsKeys.length,
        '  Cart keys       ' + lsCartKeys.length,
        '  A/B test keys   ' + lsAbtestKeys.length,
        '  Privacy risk    ' + lsPrivacyKeys.length,
        '  JSON overhead   ' + lsJsonKeys.length + ' of ' + lsKeys.length + ' keys',
        'sessionStorage    ' + (ssHasData ? ssKeys.length + ' keys, ' + (ssTotalBytes / 1024).toFixed(0) + ' KB' : 'empty'),
        'IndexedDB API     ' + (hasIDBApi ? 'available' + (idbNames.length ? ' (' + idbNames.length + ' db' + (idbNames.length > 1 ? 's' : '') + ')' : '') : 'not available'),
        'Cache API         ' + (hasCacheApi ? 'available' + (cacheNames.length ? ' (' + cacheNames.length + ' cache' + (cacheNames.length > 1 ? 's' : '') + ')' : '') : 'not available'),
      ].join('\n')
    });

    return { id: 'storage', name: 'Storage', issues: issues };
  });
}
