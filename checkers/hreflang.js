function runHreflangChecker(p) {
  var issues = [];

  // BCP 47 lang code: 2–3 letters, optionally -script/region/variant subtags
  var validLangRe = /^([a-zA-Z]{2,3})(-[a-zA-Z0-9]{2,8})*$|^x-default$/i;

  // Check <html lang> — always, regardless of hreflang presence
  var htmlLang = (document.documentElement.getAttribute('lang') || '').trim();
  if (!htmlLang) {
    issues.push({ type: 'html_lang_missing', message: 'Missing lang attribute in the <html> tag', severity: 'warning' });
  } else if (!validLangRe.test(htmlLang)) {
    issues.push({ type: 'html_lang_invalid', message: 'Invalid lang attribute in the <html> tag: "' + htmlLang + '"', severity: 'warning' });
  }

  var hreflangLinks = Array.prototype.slice.call(document.querySelectorAll('link[hreflang]'));
  if (hreflangLinks.length === 0) {
    return { id: 'hreflang', name: 'Hreflang', issues: issues };
  }

  // ── First pass: collect counts and hrefs ──────────────────────────────────
  var hasXDefault = false;
  var missingHref = 0;
  var seenLangs = {};   // lowercase lang → occurrence count
  var allHrefs = [];    // all non-empty hrefs (for self-reference check)

  hreflangLinks.forEach(function(link) {
    var lang = (link.getAttribute('hreflang') || '').trim();
    var href = (link.getAttribute('href') || '').trim();

    if (!href) { missingHref++; return; }

    allHrefs.push(href);

    if (lang === 'x-default') { hasXDefault = true; return; }

    var langLower = lang.toLowerCase();
    seenLangs[langLower] = (seenLangs[langLower] || 0) + 1;
  });

  var uniqueLangs = Object.keys(seenLangs);
  var langCount = uniqueLangs.length;

  // Info: summary with per-language count
  issues.push({
    type: 'hreflang_list',
    message: 'Hreflang tags (' + hreflangLinks.length + ') — ' +
      langCount + (langCount === 1 ? ' language' : ' languages') +
      (hasXDefault ? ' + x-default' : ''),
    severity: 'info',
    detail: hreflangLinks.map(function(link) {
      var href = (link.getAttribute('href') || '').trim();
      return '[' + (link.getAttribute('hreflang') || '?') + ']  ' + (href || '(no href)');
    }).join('\n')
  });

  // ── Set-level checks ──────────────────────────────────────────────────────

  if (missingHref > 0) {
    issues.push({ type: 'hreflang_missing_href', message: 'hreflang tags without href attribute (' + missingHref + ')', severity: 'warning' });
  }

  // Single language variant — hreflang is meaningless without at least 2
  if (langCount === 1 && !hasXDefault) {
    issues.push({ type: 'hreflang_single_lang', message: 'Only one hreflang language found — at least 2 variants required for hreflang to be meaningful', severity: 'notice' });
  }

  if (!hasXDefault) {
    issues.push({ type: 'hreflang_missing_x_default', message: 'Missing hreflang="x-default" (recommended for multilingual sites)', severity: 'notice' });
  }

  // Duplicate lang codes — report once per duplicated value
  uniqueLangs.forEach(function(lang) {
    if (seenLangs[lang] > 1) {
      issues.push({
        type: 'hreflang_duplicate_lang',
        message: 'Duplicate hreflang language code: "' + lang + '" appears ' + seenLangs[lang] + ' times',
        severity: 'warning'
      });
    }
  });

  // Self-reference: current page URL must appear in the hreflang set
  function normalizeHref(url) {
    return url.toLowerCase().split('#')[0].replace(/\/$/, '');
  }
  var currentNorm = normalizeHref(window.location.href);
  var hasSelfRef = allHrefs.some(function(href) {
    return normalizeHref(href) === currentNorm;
  });
  if (!hasSelfRef) {
    issues.push({
      type: 'hreflang_no_self_reference',
      message: 'Current page URL is not listed in the hreflang set — Google requires each page to reference itself',
      severity: 'warning',
      detail: 'Current URL: ' + window.location.href
    });
  }

  // <html lang> must correspond to one of the declared hreflang languages
  if (htmlLang && validLangRe.test(htmlLang) && uniqueLangs.length > 0) {
    var htmlLangBase = htmlLang.toLowerCase().split('-')[0];
    var htmlLangMatched = uniqueLangs.some(function(l) {
      return l === htmlLang.toLowerCase() || l.split('-')[0] === htmlLangBase;
    });
    if (!htmlLangMatched) {
      issues.push({
        type: 'hreflang_html_lang_mismatch',
        message: '<html lang="' + htmlLang + '"> does not match any language in the hreflang set',
        severity: 'notice',
        detail: 'Hreflang languages: ' + uniqueLangs.join(', ')
      });
    }
  }

  // ── Per-tag checks ────────────────────────────────────────────────────────

  hreflangLinks.forEach(function(link) {
    var lang = (link.getAttribute('hreflang') || '').trim();
    var href = (link.getAttribute('href') || '').trim();

    if (!href) return; // already reported in missing href count

    // Absolute URL required (applies to all tags including x-default)
    if (!/^https?:\/\//i.test(href)) {
      issues.push({
        type: 'hreflang_relative_url',
        message: 'hreflang href must be an absolute URL' + (lang ? ' [' + lang + ']' : ''),
        severity: 'warning',
        detail: href
      });
    }

    if (lang === 'x-default') return;

    // Invalid lang code
    if (!validLangRe.test(lang)) {
      issues.push({
        type: 'hreflang_invalid_lang',
        message: 'Invalid language code in hreflang: "' + lang + '"',
        severity: 'warning',
        detail: href.length > 80 ? href.substring(0, 80) + '…' : href
      });
    }
  });

  return { id: 'hreflang', name: 'Hreflang', issues: issues };
}
