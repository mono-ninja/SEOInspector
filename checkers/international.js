function runInternationalChecker(p) {
  var issues = [];
  var params = p || {};

  var htmlLang = (document.documentElement.getAttribute('lang') || '').trim();
  var hreflangLinks = Array.prototype.slice.call(document.querySelectorAll('link[hreflang]'));
  var allAnchors = Array.prototype.slice.call(document.querySelectorAll('a[href]'));

  // ── Language switcher detection ───────────────────────────────────────────
  var langSwitcherFound = false;
  var langSwitcherLinks = [];

  var langSwitcherPatterns = [
    /[\/-](en|uk|ua|ru|de|fr|es|it|pl|tr|ar|zh|ja|ko)(\/|$)/i,
    /\?lang=/i,
    /lang(?:uage)?-switch/i,
    /i18n|locale/i,
  ];
  var langTexts = ['en', 'uk', 'ua', 'ru', 'de', 'fr', 'es', 'english', 'українська', 'русский', 'deutsch', 'français', 'español'];

  allAnchors.forEach(function(a) {
    var href = (a.getAttribute('href') || '').toLowerCase();
    var text = (a.textContent || '').toLowerCase().trim();
    var className = (a.className || '').toLowerCase();

    var isLangLink = langSwitcherPatterns.some(function(re) { return re.test(href); }) ||
                     langTexts.some(function(t) { return text === t; }) ||
                     className.indexOf('lang') !== -1 ||
                     className.indexOf('locale') !== -1;

    if (isLangLink) {
      langSwitcherFound = true;
      langSwitcherLinks.push({ href: href, text: text });
    }
  });

  // <select> language switcher
  Array.prototype.slice.call(document.querySelectorAll('select')).forEach(function(sel) {
    var meta = (
      (sel.getAttribute('name') || '') + ' ' +
      (sel.getAttribute('id') || '') + ' ' +
      (sel.className || '')
    ).toLowerCase();
    if (meta.indexOf('lang') !== -1 || meta.indexOf('locale') !== -1 || meta.indexOf('language') !== -1) {
      langSwitcherFound = true;
      langSwitcherLinks.push({ href: '', text: '<select> ' + (sel.id || sel.getAttribute('name') || '?') });
    }
  });

  // ── Currency detection ────────────────────────────────────────────────────
  var bodyText = document.body ? (document.body.textContent || '').substring(0, 20000) : '';
  var currencyPatterns = [/[$€£₴¥₿₽₩]/, /\b(USD|EUR|GBP|UAH|JPY|INR|CNY|RUB|KRW)\b/i];
  var currencyMatches = [];
  currencyPatterns.forEach(function(re) {
    var m = bodyText.match(re);
    if (m) currencyMatches.push(m[0]);
  });
  var currencyFound = currencyMatches.length > 0;

  // ── Phone detection ───────────────────────────────────────────────────────
  var hasPhone = !!document.querySelector('a[href^="tel:"], [itemprop="telephone"], .phone, #phone, [class*="phone"], [id*="phone"]');
  // Require structure: country(1-4) + area(3-4) + number(3-4) = min 7 digits
  var phoneInText = /\+?\d{1,4}[\s\-]?\(?\d{3,4}\)?[\s\-]?\d{3,4}/.test(bodyText);

  // ── Address detection ─────────────────────────────────────────────────────
  var hasAddress = !!document.querySelector('address, [itemprop="address"], .address, #address, [class*="address"]');

  // ── Units detection ───────────────────────────────────────────────────────
  var unitPatterns = [
    /\bkg\b|\bг\b|\bgrams?\b|\bpounds?\b|\blbs?\b/i,
    /°C|°F|\bcelsius\b|\bfahrenheit\b/i,
    /\bmm\b|\bcm\b|\binches?\b|\bft\b|\bfeet\b/i,
  ];
  var unitsFound = [];
  unitPatterns.forEach(function(re) {
    var m = bodyText.match(re);
    if (m) unitsFound.push(m[0]);
  });

  // ── hreflang in <body> ────────────────────────────────────────────────────
  var hreflangInBody = document.body
    ? Array.prototype.slice.call(document.body.querySelectorAll('link[hreflang]'))
    : [];

  // ── Overview ──────────────────────────────────────────────────────────────
  issues.push({
    type: 'international_overview',
    message: 'International SEO — overview',
    severity: 'info',
    detail: [
      'Page language (html lang)  ' + (htmlLang || 'not set'),
      'Hreflang tags              ' + hreflangLinks.length,
      'Language switcher          ' + (langSwitcherFound ? 'found (' + langSwitcherLinks.length + ' links)' : 'not found'),
      'Currency signals           ' + (currencyFound ? currencyMatches.slice(0, 3).join(', ') : 'none'),
      'Phone number               ' + (hasPhone || phoneInText ? 'found' : 'not found'),
      'Physical address           ' + (hasAddress ? 'found' : 'not found'),
      'Measurement units          ' + (unitsFound.length > 0 ? unitsFound.join(', ') : 'none'),
    ].join('\n')
  });

  // ── Checks ────────────────────────────────────────────────────────────────

  if (hreflangInBody.length > 0) {
    issues.push({
      type: 'hreflang_in_body',
      message: 'hreflang tags found in <body> — they must be in <head> (' + hreflangInBody.length + ')',
      severity: 'warning',
      detail: 'Google requires hreflang link tags to be placed in <head>, not <body>.'
    });
  }

  if (langSwitcherFound && hreflangLinks.length === 0) {
    issues.push({
      type: 'switcher_no_hreflang',
      message: 'Language switcher found but no hreflang tags present',
      severity: 'notice',
      detail: 'Add hreflang tags to help search engines serve the correct language version for each locale.'
    });
  }

  if (hreflangLinks.length > 0 && !langSwitcherFound) {
    issues.push({
      type: 'no_lang_switcher',
      message: 'Hreflang tags present but no visible language switcher found',
      severity: 'notice',
      detail: 'Users should be able to switch languages. Add visible links or a <select> to alternate language versions.'
    });
  }

  if (currencyFound && !htmlLang) {
    issues.push({
      type: 'currency_no_lang',
      message: 'Currency detected on page but html lang is not set',
      severity: 'notice',
      detail: 'Setting the correct language helps search engines show prices in the right context.'
    });
  }

  if (unitsFound.length > 1) {
    var hasMetric = unitsFound.some(function(u) { return /\bkg\b|\bг\b|°C|\bmm\b|\bcm\b/i.test(u); });
    var hasImperial = unitsFound.some(function(u) { return /\bpounds?\b|\blbs?\b|°F|\binches?\b|\bft\b|\bfeet\b/i.test(u); });
    if (hasMetric && hasImperial) {
      issues.push({
        type: 'mixed_units',
        message: 'Mixed measurement units found: ' + unitsFound.join(', '),
        severity: 'notice',
        detail: 'Consistent units improve international UX. Consider showing units based on user locale.'
      });
    }
  }

  if (!hasPhone && !phoneInText && !hasAddress) {
    issues.push({
      type: 'no_contact_signals',
      message: 'No phone number or physical address found',
      severity: 'notice',
      detail: 'Contact information is important for local SEO and E-E-A-T trust signals.'
    });
  }

  return { id: 'international', name: 'International SEO', issues: issues };
}
