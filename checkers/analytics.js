function runAnalyticsChecker(p) {
  var issues = [];

  var scripts = Array.prototype.slice.call(document.querySelectorAll('script'));
  var jsScripts = scripts.filter(function(s) {
    var t = (s.getAttribute('type') || '').toLowerCase();
    return !t || t === 'text/javascript' || t === 'module' || t === 'application/javascript';
  });
  var inlineTexts = jsScripts
    .filter(function(s) { return !s.src; })
    .map(function(s) { return s.textContent || ''; })
    .join('\n');
  var scriptSrcs = jsScripts
    .filter(function(s) { return !!s.src; })
    .map(function(s) { return s.src.toLowerCase(); });

  var noscripts = Array.prototype.slice.call(document.querySelectorAll('noscript'));
  var noscriptText = noscripts.map(function(n) { return n.textContent || n.innerHTML || ''; }).join('\n').toLowerCase();

  // --- Detection flags ---
  var hasGA4 = /\bG-[A-Z0-9]{4,12}\b/.test(inlineTexts) ||
    scriptSrcs.some(function(s) { return s.indexOf('gtag/js') !== -1; });
  // Split GTM detection: script vs noscript (to check noscript fallback separately)
  var hasGTMScript = /\bGTM-[A-Z0-9]{4,8}\b/.test(inlineTexts) ||
    scriptSrcs.some(function(s) { return s.indexOf('gtm.js') !== -1; });
  var hasGTMNoscript = noscriptText.indexOf('googletagmanager.com/ns.html') !== -1;
  var hasGTM = hasGTMScript || hasGTMNoscript;
  var hasUA  = /\bUA-\d{4,10}-\d{1,5}\b/.test(inlineTexts) ||
    scriptSrcs.some(function(s) { return s.indexOf('analytics.js') !== -1; });
  var hasConsentMode = inlineTexts.indexOf("gtag('consent'") !== -1 ||
    inlineTexts.indexOf('gtag("consent"') !== -1;
  var hasFB = inlineTexts.indexOf('fbq(') !== -1 ||
    scriptSrcs.some(function(s) { return s.indexOf('connect.facebook.net') !== -1; });
  var ecomDomSignals = !!document.querySelector('[data-product-id], [class*="add-to-cart"], [class*="woocommerce"], [class*="shopify-section"]');
  var ecomInlineSignals = ['add_to_cart', 'addToCart', 'add-to-cart', 'woocommerce', 'shopify', 'magento'];
  var isEcom = ecomDomSignals || ecomInlineSignals.some(function(sig) { return inlineTexts.indexOf(sig) !== -1; });
  var gscMeta  = document.querySelector('meta[name="google-site-verification"]');
  var bingMeta = document.querySelector('meta[name="msvalidate.01"]');

  // --- Issues ---

  if (!hasGA4 && !hasGTM && !hasUA) {
    issues.push({ type: 'analytics_missing', message: 'Google Analytics (GA4) or Google Tag Manager not found', severity: 'notice' });
  }

  // UA deprecated since July 2023
  if (hasUA && !hasGA4) {
    issues.push({ type: 'ua_deprecated', message: 'Universal Analytics (UA) was discontinued by Google in July 2023 — migrate to GA4', severity: 'warning' });
  }

  // Duplicate GA4 IDs — check within each source separately to avoid false positives
  // (standard setup: same ID in script src AND inline config is expected, not a duplicate)
  var ga4InlineIds = (inlineTexts.match(/\bG-[A-Z0-9]{4,12}\b/g) || []).map(function(id) { return id.toUpperCase(); });
  var ga4SrcIds = [];
  scriptSrcs.forEach(function(s) {
    var m = s.match(/gtag\/js\?id=(g-[a-z0-9]{4,12})/i);
    if (m) ga4SrcIds.push(m[1].toUpperCase());
  });
  var ga4Dupes = [];
  [ga4SrcIds, ga4InlineIds].forEach(function(list) {
    var seen = {};
    list.forEach(function(id) {
      if (seen[id]) { if (ga4Dupes.indexOf(id) === -1) ga4Dupes.push(id); }
      else seen[id] = true;
    });
  });
  if (ga4Dupes.length > 0) {
    issues.push({ type: 'analytics_duplicate', message: 'Duplicate Google Analytics installation', severity: 'warning', detail: 'Duplicate ID: ' + ga4Dupes.join(', ') });
  }

  // Duplicate GTM container IDs
  var gtmInlineIds = (inlineTexts.match(/\bGTM-[A-Z0-9]{4,8}\b/g) || []).map(function(id) { return id.toUpperCase(); });
  var gtmSrcIds = [];
  scriptSrcs.forEach(function(s) {
    var m = s.match(/gtm\.js\?id=(gtm-[a-z0-9]{4,8})/i);
    if (m) gtmSrcIds.push(m[1].toUpperCase());
  });
  var gtmDupes = [];
  [gtmSrcIds, gtmInlineIds].forEach(function(list) {
    var seen = {};
    list.forEach(function(id) {
      if (seen[id]) { if (gtmDupes.indexOf(id) === -1) gtmDupes.push(id); }
      else seen[id] = true;
    });
  });
  if (gtmDupes.length > 0) {
    issues.push({ type: 'gtm_duplicate', message: 'Duplicate GTM container detected', severity: 'warning', detail: 'Duplicate ID: ' + gtmDupes.join(', ') });
  }

  // GA loaded without async in <head> — report once only
  var head = document.querySelector('head');
  if (head) {
    var syncFound = false;
    Array.prototype.slice.call(head.querySelectorAll('script[src]')).forEach(function(s) {
      if (syncFound) return;
      var src = (s.getAttribute('src') || '').toLowerCase();
      if ((src.indexOf('gtag/js') !== -1 || src.indexOf('analytics.js') !== -1) &&
          !s.hasAttribute('async') && !s.hasAttribute('defer')) {
        syncFound = true;
        issues.push({ type: 'analytics_sync_load', message: 'GA script loaded without async in <head>', severity: 'notice' });
      }
    });
  }

  // GTM script present but <noscript> fallback in <body> is missing
  if (hasGTMScript && !hasGTMNoscript) {
    issues.push({ type: 'gtm_no_noscript', message: 'GTM <script> detected but <noscript> fallback missing in <body>', severity: 'notice' });
  }

  // Google Consent Mode v2 — required for direct GA4 in EU (if via GTM, configured inside container)
  if (hasGA4 && !hasGTM && !hasConsentMode) {
    issues.push({ type: 'ga4_no_consent_mode', message: 'GA4 without Consent Mode v2 — required for EU/GDPR compliance (gtag consent default)', severity: 'warning' });
  }

  // Google Optimize — discontinued September 2023
  var hasGOptimize = scriptSrcs.some(function(s) { return s.indexOf('googleoptimize.com') !== -1 || s.indexOf('/optimize.js') !== -1; }) ||
    inlineTexts.indexOf('googleoptimize.com') !== -1;
  if (hasGOptimize) {
    issues.push({ type: 'google_optimize_deprecated', message: 'Google Optimize detected — discontinued September 2023, migrate to alternative A/B tools', severity: 'warning' });
  }

  // Facebook Pixel — warn only for ecommerce pages
  if (!hasFB && isEcom) {
    issues.push({ type: 'fb_pixel_missing', message: 'Ecommerce page without Facebook Pixel', severity: 'notice' });
  }

  // Ecommerce dataLayer
  if (isEcom && inlineTexts.indexOf('"ecommerce"') === -1 && inlineTexts.indexOf("'ecommerce'") === -1) {
    issues.push({ type: 'ecommerce_no_datalayer', message: 'Ecommerce page without dataLayer.push({ecommerce: ...})', severity: 'notice' });
  }

  if (!gscMeta) {
    issues.push({ type: 'gsc_not_verified', message: 'Google Search Console meta tag (google-site-verification) not found', severity: 'notice' });
  }
  if (!bingMeta) {
    issues.push({ type: 'bing_not_verified', message: 'Bing Webmaster Tools meta tag (msvalidate.01) not found', severity: 'notice' });
  }

  // --- Info: detected tools ---
  var _detected = [];
  if (hasGA4)          _detected.push('Google Analytics 4');
  if (hasGTM)          _detected.push('Google Tag Manager');
  if (hasUA)           _detected.push('Universal Analytics (deprecated)');
  if (hasFB)           _detected.push('Facebook Pixel');
  if (gscMeta)         _detected.push('Google Search Console');
  if (bingMeta)        _detected.push('Bing Webmaster Tools');
  if (hasConsentMode)  _detected.push('GA4 Consent Mode v2');

  // Cookie Consent Managers (CMP)
  var cmps = [
    { name: 'OneTrust',      srcs: ['onetrust.com', 'optanon.js'],            inline: ['OptanonWrapper', 'OneTrust.init'] },
    { name: 'Cookiebot',     srcs: ['cookiebot.com'],                          inline: ['CookieConsent', 'Cookiebot.'] },
    { name: 'CookieYes',     srcs: ['cookieyes.com'],                          inline: ['getCkyConsent', 'ckyBanner'] },
    { name: 'Usercentrics',  srcs: ['usercentrics.eu', 'usercentrics.com'],    inline: ['UC_UI', 'usercentrics.init'] },
    { name: 'TrustArc',      srcs: ['trustarc.com', 'consent.truste.com'],     inline: ['truste.cma'] },
    { name: 'Osano',         srcs: ['osano.com'],                              inline: ['Osano.cm'] },
    { name: 'iubenda',       srcs: ['iubenda.com'],                            inline: ['_iub.csConfiguration'] },
    { name: 'Termly',        srcs: ['termly.io'],                              inline: ['displayPreferenceModal', 'TERMLY_'] },
  ];
  var hasCMP = false;
  cmps.forEach(function(cmp) {
    var found = cmp.srcs.some(function(frag) { return scriptSrcs.some(function(s) { return s.indexOf(frag) !== -1; }); }) ||
                cmp.inline.some(function(sig) { return inlineTexts.indexOf(sig) !== -1; });
    if (found) { hasCMP = true; _detected.push(cmp.name); }
  });
  if (!hasCMP && (hasGA4 || hasGTM)) {
    issues.push({ type: 'cmp_missing', message: 'No Cookie Consent Manager detected — required for GDPR compliance with analytics', severity: 'notice' });
  }

  var extraTools = [
    // Heatmap / session recording
    { name: 'Hotjar',              srcs: ['hotjar.com'],                          inline: ['hjSetting', 'hj('] },
    { name: 'Microsoft Clarity',   srcs: ['clarity.ms'],                          inline: ['clarity('] },
    { name: 'Crazy Egg',           srcs: ['crazyegg.com'],                        inline: ['CE2'] },
    { name: 'Lucky Orange',        srcs: ['luckyorange.com'],                     inline: ['__lo_cs_added', 'window.__lt'] },
    { name: 'FullStory',           srcs: ['fullstory.com', 'rs.fullstory.com'],   inline: ['_fs_script', 'FS.identify'] },
    { name: 'Mouseflow',           srcs: ['mouseflow.com'],                       inline: ['_mfq.push'] },
    { name: 'Smartlook',           srcs: ['smartlook.com'],                       inline: ['smartlook('] },
    { name: 'Inspectlet',          srcs: ['inspectlet.com'],                      inline: ['__insp_push', '__inspld'] },
    { name: 'LogRocket',           srcs: ['logrocket.com', 'cdn.lr-ingest.io'],   inline: ['LogRocket.init'] },
    // Analytics platforms
    { name: 'Adobe Analytics',     srcs: ['omtrdc.net', 'appmeasurement.js'],     inline: ['s_code', 'AppMeasurement', 's.t()'] },
    { name: 'Matomo',              srcs: ['matomo.js', 'piwik.js', 'mtm.js'],     inline: ['_paq.push'] },
    { name: 'Yandex Metrika',      srcs: ['mc.yandex.ru', 'metrika'],             inline: ['ym('] },
    { name: 'Plausible',           srcs: ['plausible.io'],                        inline: ['plausible('] },
    { name: 'Fathom',              srcs: ['cdn.usefathom.com', 'fathom.js'],      inline: ['fathom.trackGoal'] },
    { name: 'Heap',                srcs: ['heapanalytics.com', 'heap.io'],        inline: ['heap.load'] },
    { name: 'Mixpanel',            srcs: ['mixpanel.com', 'cdn.mxpnl.com'],      inline: ['mixpanel.init', 'mixpanel.track'] },
    { name: 'Amplitude',           srcs: ['cdn.amplitude.com'],                   inline: ['amplitude.init', 'amplitude.getInstance'] },
    { name: 'Segment',             srcs: ['cdn.segment.com', 'cdn.segment.io'],   inline: ['analytics.load('] },
    { name: 'Woopra',              srcs: ['woopra.com'],                          inline: ['woopra.track'] },
    // Ad pixels
    { name: 'TikTok Pixel',        srcs: ['analytics.tiktok.com'],               inline: ['ttq.load', 'ttq.track'] },
    { name: 'Twitter/X Pixel',     srcs: ['static.ads-twitter.com'],             inline: ['twq('] },
    { name: 'LinkedIn Insight',    srcs: ['snap.licdn.com'],                      inline: ['_linkedin_partner_id', 'lintrk('] },
    { name: 'Pinterest Tag',       srcs: ['ct.pinterest.com'],                    inline: ['pintrk('] },
    { name: 'Snapchat Pixel',      srcs: ['tr.snapchat.com'],                     inline: ['snaptr('] },
    { name: 'Microsoft Bing UET',  srcs: ['bat.bing.com'],                        inline: ['window.uetq'] },
    // A/B testing
    { name: 'Optimizely',          srcs: ['optimizely.com', 'cdn.optimizely.com'], inline: ['window.optimizely'] },
    { name: 'VWO',                 srcs: ['vwo.com', 'd5phz18u4wuww.cloudfront.net'], inline: ['vwoCode', '_vwo_code'] },
    { name: 'AB Tasty',            srcs: ['abtasty.com'],                         inline: ['ABTasty'] },
  ];

  extraTools.forEach(function(tool) {
    var found = tool.srcs.some(function(frag) { return scriptSrcs.some(function(s) { return s.indexOf(frag) !== -1; }); }) ||
                tool.inline.some(function(sig) { return inlineTexts.indexOf(sig) !== -1; });
    if (found) _detected.push(tool.name);
  });

  issues.push({
    type: 'analytics_detected',
    message: 'Detected analytics tools',
    severity: 'info',
    detail: _detected.length > 0 ? _detected.join('\n') : 'No tools detected'
  });

  return { id: 'analytics', name: 'Analytics', issues: issues };
}
