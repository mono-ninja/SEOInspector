function runFontLoadingChecker(p) {
  var issues = [];

  // ── Google Fonts via <link rel="stylesheet"> ──────────────────────────────
  var gfLinks = Array.prototype.filter.call(
    document.querySelectorAll('link[href*="fonts.googleapis.com"]'),
    function(l) { return (l.getAttribute('rel') || '').toLowerCase().indexOf('stylesheet') !== -1; }
  );

  // ── Preconnect / dns-prefetch hints (googleapis AND gstatic) ─────────────
  var allHints = Array.prototype.slice.call(
    document.querySelectorAll('link[rel="preconnect"], link[rel="dns-prefetch"]')
  );
  var hasGfApiHint = allHints.some(function(l) {
    return (l.getAttribute('href') || '').indexOf('fonts.googleapis.com') !== -1;
  });
  var gfStaticHints = allHints.filter(function(l) {
    return (l.getAttribute('href') || '').indexOf('fonts.gstatic.com') !== -1;
  });
  var hasGfStaticHint = gfStaticHints.length > 0;
  // fonts.gstatic.com serves font files via CORS — preconnect needs crossorigin
  var gfStaticNoCrossorigin = gfStaticHints.filter(function(l) { return !l.hasAttribute('crossorigin'); });

  // ── Google Fonts via @import in <style> blocks ────────────────────────────
  var hasGfImport = false;
  var importFamilies = [];
  Array.prototype.forEach.call(document.querySelectorAll('style'), function(s) {
    var text = s.textContent || '';
    if (text.indexOf('fonts.googleapis.com') === -1) return;
    hasGfImport = true;
    var m = text.match(/family=([^&"')]+)/g);
    if (m) m.forEach(function(f) {
      var name = f.replace('family=', '').split(':')[0].replace(/\+/g, ' ').trim();
      if (name && importFamilies.indexOf(name) === -1) importFamilies.push(name);
    });
  });

  // ── @font-face rules (same-origin only; cross-origin blocked by CORS) ─────
  var fontFaceWithoutDisplay = [];
  var selfHostedFontCount = 0;
  var hasAccessibleSheets = false;
  try {
    Array.prototype.forEach.call(document.styleSheets, function(sheet) {
      try {
        var rules = sheet.cssRules || [];
        hasAccessibleSheets = true;
        Array.prototype.forEach.call(rules, function(rule) {
          if (rule.type !== CSSRule.FONT_FACE_RULE) return;
          var src = rule.style.getPropertyValue('src') || '';
          var isGf = src.indexOf('fonts.gstatic.com') !== -1 || src.indexOf('fonts.googleapis.com') !== -1;
          if (!isGf) selfHostedFontCount++;
          if (!rule.style.getPropertyValue('font-display')) {
            var family = rule.style.getPropertyValue('font-family') || '';
            fontFaceWithoutDisplay.push(family || src.substring(0, 50));
          }
        });
      } catch(e) {} // cross-origin sheet — skip
    });
  } catch(e) {}

  // ── Font preload hints ─────────────────────────────────────────────────────
  var preloadedFontsCount = document.querySelectorAll('link[rel="preload"][as="font"]').length;

  // ── Google Fonts families (from <link> + @import) ─────────────────────────
  var gfFamilies = [];
  gfLinks.forEach(function(l) {
    var m = (l.getAttribute('href') || '').match(/family=([^&]+)/g);
    if (m) m.forEach(function(f) {
      var name = f.replace('family=', '').split(':')[0].replace(/\+/g, ' ');
      if (gfFamilies.indexOf(name) === -1) gfFamilies.push(name);
    });
  });
  importFamilies.forEach(function(f) {
    if (gfFamilies.indexOf(f) === -1) gfFamilies.push(f);
  });

  // ── Overview ─────────────────────────────────────────────────────────────
  issues.push({
    type: 'font_overview',
    message: 'Font loading — overview',
    severity: 'info',
    detail: [
      'Google Fonts <link>            ' + (gfLinks.length || '—'),
      'Google Fonts @import           ' + (hasGfImport ? '✗ present' : '—'),
      'Google Fonts families          ' + (gfFamilies.length ? gfFamilies.join(', ') : '—'),
      'Preconnect fonts.googleapis    ' + (hasGfApiHint  ? '✓' : '—'),
      'Preconnect fonts.gstatic       ' + (!hasGfStaticHint ? '—' : gfStaticNoCrossorigin.length ? '✗ missing crossorigin' : '✓'),
      'Self-hosted @font-face         ' + (selfHostedFontCount || '—'),
      '<link rel="preload" as="font"  ' + (preloadedFontsCount || '—'),
      '@font-face without display     ' + (fontFaceWithoutDisplay.length || '—'),
    ].join('\n')
  });

  // ── Checks ────────────────────────────────────────────────────────────────

  // Google Fonts without display=swap in URL
  var gfWithoutSwap = gfLinks.filter(function(l) {
    return (l.getAttribute('href') || '').indexOf('display=swap') === -1;
  });
  if (gfWithoutSwap.length > 0) {
    issues.push({
      type: 'gf_no_display_swap',
      message: 'Google Fonts without &display=swap — text invisible during loading (FOIT)',
      severity: 'warning',
      detail: gfWithoutSwap.map(function(l) {
        var h = l.getAttribute('href') || '';
        return h.length > 80 ? h.substring(0, 80) + '…' : h;
      }).join('\n')
    });
  }

  // Google Fonts via @import
  if (hasGfImport) {
    issues.push({
      type: 'gf_import',
      message: 'Google Fonts loaded via @import in <style> — blocks rendering, use <link rel="stylesheet"> instead',
      severity: 'warning'
    });
  }

  // Google Fonts without any preconnect hints
  if (gfLinks.length > 0 && !hasGfApiHint && !hasGfStaticHint) {
    issues.push({
      type: 'gf_no_preconnect',
      message: 'Google Fonts loaded without preconnect hints — add preconnect to reduce connection latency',
      severity: 'notice',
      detail: '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    });
  }

  // fonts.gstatic.com preconnect without crossorigin — CORS requests can't reuse the connection
  if (gfStaticNoCrossorigin.length > 0) {
    issues.push({
      type: 'gf_preconnect_no_crossorigin',
      message: 'Preconnect to fonts.gstatic.com missing crossorigin — CORS font requests cannot reuse this connection',
      severity: 'warning',
      detail: 'Fix: <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    });
  }

  // @font-face without font-display
  if (fontFaceWithoutDisplay.length > 0) {
    issues.push({
      type: 'font_face_no_display',
      message: '@font-face without font-display (' + fontFaceWithoutDisplay.length + ') — FOIT risk during font loading',
      severity: 'notice',
      detail: fontFaceWithoutDisplay.slice(0, 5).join('\n') +
        (fontFaceWithoutDisplay.length > 5 ? '\n… and ' + (fontFaceWithoutDisplay.length - 5) + ' more' : '')
    });
  }

  // Self-hosted fonts without preload
  if (selfHostedFontCount > 0 && preloadedFontsCount === 0) {
    issues.push({
      type: 'font_no_preload',
      message: 'Self-hosted fonts without <link rel="preload" as="font"> — browser discovers fonts late, causing layout shifts',
      severity: 'notice',
      detail: 'Preload the most critical weight:\n<link rel="preload" as="font" href="/fonts/name.woff2" type="font/woff2" crossorigin>'
    });
  }

  // Too many Google Fonts families
  if (gfFamilies.length > 3) {
    issues.push({
      type: 'too_many_gf_families',
      message: 'Too many Google Fonts families (' + gfFamilies.length + ') — each adds HTTP requests and render-blocking time',
      severity: 'notice',
      detail: gfFamilies.join(', ')
    });
  }

  // Multiple separate Google Fonts <link> requests
  if (gfLinks.length > 1) {
    issues.push({
      type: 'gf_multiple_requests',
      message: 'Multiple separate Google Fonts requests (' + gfLinks.length + ') — combine into a single URL to reduce RTT',
      severity: 'notice'
    });
  }

  // Dynamic GF (preconnect hint, no <link>) — only if we can read sheets and found @font-face without display
  if (gfLinks.length === 0 && (hasGfApiHint || hasGfStaticHint) && hasAccessibleSheets && fontFaceWithoutDisplay.length > 0) {
    issues.push({
      type: 'gf_preconnect_swap_missing',
      message: 'Google Fonts (dynamically loaded) — @font-face rules found without font-display: swap',
      severity: 'warning'
    });
  }

  return { id: 'font_loading', name: 'Fonts', issues: issues };
}
