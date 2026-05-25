function runGdprChecker(p) {
  var issues = [];

  // ── Script collection ─────────────────────────────────────────────────────
  var scripts = Array.prototype.slice.call(document.querySelectorAll('script'));
  var jsScripts = scripts.filter(function(s) {
    var t = (s.getAttribute('type') || '').toLowerCase();
    return !t || t === 'text/javascript' || t === 'module' || t === 'application/javascript';
  });
  var inlineTexts = jsScripts.filter(function(s) { return !s.src; })
    .map(function(s) { return s.textContent || ''; }).join('\n');
  var scriptSrcs = jsScripts.filter(function(s) { return !!s.src; })
    .map(function(s) { return s.src.toLowerCase(); });

  var allAnchors = Array.prototype.slice.call(document.querySelectorAll('a[href]'));

  // ── 1. Privacy policy link ────────────────────────────────────────────────

  var privacyKeywords = [
    '/privacy', '/datenschutz', '/конфіденційність', '/privacidad',
    '/cookie-policy', '/cookies-policy', '/legal', '/datapolicy',
    '/data-policy', '/terms-of-service', '/terms-and-conditions'
  ];
  var privacyTexts = [
    'privacy policy', 'privacy notice', 'cookie policy',
    'конфіденційність', 'політика конфіденційності', 'datenschutz'
  ];
  var hasPrivacy = allAnchors.some(function(a) {
    var href = (a.getAttribute('href') || '').toLowerCase();
    var text = (a.textContent || '').toLowerCase().trim();
    return privacyKeywords.some(function(k) { return href.indexOf(k) !== -1; }) ||
      privacyTexts.some(function(t) { return text.indexOf(t) !== -1; });
  });

  // ── 2. CMP detection ─────────────────────────────────────────────────────

  var cmpScriptFrags = [
    'consent.cookiebot.com', 'onetrust.com', 'cookieyes.com', 'trustarc.com',
    'usercentrics.eu', 'cookie-script.com', 'termly.io', 'didomi.io',
    'iubenda.com', 'quantcast.mgr.consensu.org', 'cookieinformation.com', 'axeptio.eu'
  ];
  var cmpDomSels = [
    '#CybotCookiebotDialog', '#onetrust-banner-sdk', '.cc-window', '#cookie-notice',
    '.cookie-notice', '#cookie-banner', '.cookie-banner', '#cookie-consent',
    '.cookie-consent', '[data-cookieconsent]', '[data-cc]'
  ];
  var cmpInlineSigs = ['CookieConsent', 'Cookiebot', 'UC_UI', '__cmp(', '__tcfapi(', 'gtag_enable_tcf_support'];

  var hasCMP = cmpScriptFrags.some(function(f) { return scriptSrcs.some(function(s) { return s.indexOf(f) !== -1; }); });
  if (!hasCMP) hasCMP = cmpDomSels.some(function(sel) { try { return !!document.querySelector(sel); } catch(e) { return false; } });
  if (!hasCMP) hasCMP = cmpInlineSigs.some(function(sig) { return inlineTexts.indexOf(sig) !== -1; });

  // ── 3. Tracking scripts ───────────────────────────────────────────────────

  var trackingScripts = Array.prototype.slice.call(document.querySelectorAll([
    'script[src*="gtag/js"]',
    'script[src*="gtm.js"]',
    'script[src*="connect.facebook.net"]',
    'script[src*="hotjar.com"]',
    'script[src*="clarity.ms"]',
    'script[src*="analytics.tiktok.com"]',
    'script[src*="snap.licdn.com"]'
  ].join(', ')));
  var hasAnalytics = trackingScripts.length > 0 || inlineTexts.indexOf('fbq(') !== -1;
  var hasConsentMode = /gtag\s*\(\s*['"]consent['"]\s*,\s*['"]default['"]/.test(inlineTexts);

  // ── 4. 3rd-party tracking iframes ────────────────────────────────────────

  var trackingIframeDomains = [
    'youtube.com', 'youtu.be', 'facebook.com', 'twitter.com', 'x.com',
    'instagram.com', 'maps.google.com', 'google.com/maps', 'doubleclick.net',
    'tiktok.com', 'linkedin.com', 'pinterest.com'
  ];
  var ungatedIframes = Array.prototype.filter.call(
    document.querySelectorAll('iframe[src]'),
    function(f) {
      var src = (f.getAttribute('src') || '').toLowerCase();
      return trackingIframeDomains.some(function(d) { return src.indexOf(d) !== -1; });
    }
  );

  // ── Banner visibility ─────────────────────────────────────────────────────
  // Use getBoundingClientRect — offsetParent is null for position:fixed elements
  // (common for cookie banners), so it cannot be used as a visibility check.
  function isBannerVisible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    try {
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      var rect = el.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    } catch(e) { return false; }
  }

  var bannerEl = null;
  var bannerSels = [
    '#CybotCookiebotDialog', '#onetrust-banner-sdk', '.cc-window',
    '#cookie-banner', '.cookie-banner', '#cookie-consent', '.cookie-consent',
    '[id*="cookie"][role="dialog"]', '[class*="cookie"][role="dialog"]',
    '[aria-label*="cookie"]', '[aria-label*="consent"]'
  ];
  for (var i = 0; i < bannerSels.length; i++) {
    try {
      var candidate = document.querySelector(bannerSels[i]);
      if (isBannerVisible(candidate)) { bannerEl = candidate; break; }
    } catch(e) {}
  }

  // ── Overview ──────────────────────────────────────────────────────────────
  issues.push({
    type: 'gdpr_overview',
    message: 'GDPR / Consent — overview',
    severity: 'info',
    detail: [
      'Privacy policy link     ' + (hasPrivacy    ? '✓' : '—'),
      'CMP detected            ' + (hasCMP        ? '✓' : '—'),
      'Consent Mode v2         ' + (hasConsentMode ? '✓' : '—'),
      'Tracking scripts        ' + (trackingScripts.length || '—'),
      '3rd-party iframes       ' + (ungatedIframes.length  || '—'),
      'Banner visible          ' + (bannerEl      ? '✓' : '—'),
    ].join('\n')
  });

  // ── Checks ────────────────────────────────────────────────────────────────

  if (!hasPrivacy) {
    issues.push({
      type: 'missing_privacy_policy',
      message: 'Missing Privacy Policy link',
      severity: 'warning',
      detail: 'GDPR (Art. 13) requires providing a link to the privacy policy.'
    });
  }

  if (!hasCMP) {
    issues.push({
      type: 'no_cmp',
      message: 'No Cookie Consent (CMP) solution detected',
      severity: 'warning',
      detail: 'GDPR requires explicit consent before setting non-functional cookies.'
    });
  }

  // Tracking scripts loaded without consent guard
  if (hasAnalytics && hasCMP && !hasConsentMode) {
    var unguarded = trackingScripts.filter(function(s) {
      var type = (s.getAttribute('type') || '').toLowerCase();
      return type !== 'text/plain' &&
        !s.hasAttribute('data-cookieconsent') &&
        !s.hasAttribute('data-ckyes') &&
        !s.hasAttribute('data-category') &&
        !s.hasAttribute('data-type') &&
        !s.hasAttribute('data-consent') &&
        !s.hasAttribute('data-cmp-vendor');
    });
    if (unguarded.length > 0) {
      issues.push({
        type: 'tracking_before_consent',
        message: 'Tracking scripts loaded without consent check (' + unguarded.length + ')',
        severity: 'warning',
        detail: 'CMP detected, but scripts are not blocked via type="text/plain" or Consent Mode. Data may be collected before consent.'
      });
    }
  }

  // Google Consent Mode v2
  if (hasAnalytics && !hasConsentMode) {
    issues.push({
      type: 'no_consent_mode_v2',
      message: 'Google Consent Mode v2 not configured',
      severity: 'notice',
      detail: 'Since March 2024 Google requires Consent Mode v2 for GA4 and Google Ads to work in the EU (DMA).'
    });
  }

  // 3rd-party iframes without CMP
  if (ungatedIframes.length > 0 && !hasCMP) {
    issues.push({
      type: 'third_party_iframes',
      message: '3rd-party iframes (social/tracking) loaded without CMP (' + ungatedIframes.length + ')',
      severity: 'warning',
      detail: ungatedIframes.slice(0, 3).map(function(f) {
        var src = f.getAttribute('src') || '';
        return src.length > 80 ? src.substring(0, 80) + '...' : src;
      }).join('\n') + (ungatedIframes.length > 3 ? '\n... and ' + (ungatedIframes.length - 3) + ' more' : '')
    });
  }

  // Visible banner checks
  if (bannerEl) {
    // Pre-ticked non-necessary checkboxes (CJEU C-673/17 Planet49)
    var checkboxes = Array.prototype.slice.call(bannerEl.querySelectorAll('input[type="checkbox"]'));
    var preticked = checkboxes.filter(function(cb) {
      if (!cb.checked || cb.disabled || cb.readOnly) return false;
      var label = [(cb.id || ''), (cb.name || ''), (cb.className || ''), (cb.value || '')].join(' ').toLowerCase();
      return label.indexOf('necessary') === -1 && label.indexOf('required') === -1 &&
             label.indexOf('essential') === -1 && label.indexOf('strict') === -1;
    });
    if (preticked.length > 0) {
      issues.push({
        type: 'consent_preticked',
        message: 'CMP has pre-ticked checkboxes (' + preticked.length + ' non-required)',
        severity: 'warning',
        detail: 'GDPR requires explicit opt-in. Pre-ticked checkboxes are a violation (CJEU C-673/17, Planet49).'
      });
    }

    // No "Reject All" button — EU regulators require equal prominence
    var bannerText = (bannerEl.textContent || '').toLowerCase();
    var rejectKeywords = [
      'reject all', 'decline all', 'refuse all', 'deny all',
      'відмовитись', 'відмовити', 'відхилити все',
      'ablehnen', 'tout refuser', 'rechazar todo', 'opt out'
    ];
    var hasRejectAll = rejectKeywords.some(function(k) { return bannerText.indexOf(k) !== -1; });
    if (!hasRejectAll) {
      issues.push({
        type: 'consent_no_reject',
        message: 'CMP does not have a "Reject All" option',
        severity: 'warning',
        detail: 'EU regulators (CNIL, ICO) require the ability to decline tracking in one click, with equal prominence to "Accept All".'
      });
    }
  }

  return { id: 'gdpr', name: 'GDPR / Consent', issues: issues };
}
