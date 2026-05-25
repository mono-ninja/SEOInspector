function runSeoChecker(p) {
  var issues = [];
  var params = p || {};
  var titleMin = params.title_min || 10;
  var titleMax = params.title_max || 60;
  var descMin  = params.desc_min  || 50;
  var descMax  = params.desc_max  || 160;
  var minWords = params.min_words || 300;

  // ── Informational summary ────────────────────────────────────────────────────
  var titleVal = (document.title || '').trim();
  var descEl = document.querySelector('meta[name="description"]');
  var descVal = descEl ? (descEl.getAttribute('content') || '').trim() : '';
  var canonEl = document.querySelector('link[rel="canonical"]');
  var canonVal = canonEl ? (canonEl.getAttribute('href') || '').trim() : '';

  issues.push({
    type: 'info_title',
    message: 'Title: ' + (titleVal ? '«' + titleVal + '»' : '—'),
    severity: 'info',
    detail: titleVal ? titleVal.length + ' chars' : ''
  });
  issues.push({
    type: 'info_description',
    message: 'Description: ' + (descVal ? '«' + descVal + '»' : '—'),
    severity: 'info',
    detail: descVal ? descVal.length + ' chars' : ''
  });
  issues.push({
    type: 'info_canonical',
    message: 'Canonical: ' + (canonVal || '—'),
    severity: 'info'
  });

  // Title checks
  var titleEls = document.head ? document.head.querySelectorAll('title') : [];
  if (titleEls.length > 1) {
    issues.push({ type: 'multiple_titles', message: 'Found ' + titleEls.length + ' <title> tags on the page', severity: 'critical', detail: 'Only one <title> is allowed. Browsers and crawlers use only the first one.' });
  }

  var title = titleVal;
  if (!title) {
    issues.push({ type: 'missing_title', message: 'Missing <title> tag', severity: 'critical' });
  } else if (title.length < titleMin) {
    issues.push({ type: 'short_title', message: '<title> tag is too short (less than ' + titleMin + ' chars)', severity: 'warning', detail: 'Current length: ' + title.length + ' chars. Value: "' + title + '"' });
  } else if (title.length > titleMax) {
    issues.push({ type: 'long_title', message: '<title> tag is too long (more than ' + titleMax + ' chars)', severity: 'notice', detail: 'Current length: ' + title.length + ' chars. Recommended up to ' + titleMax + '.' });
  }

  // Title / H1 alignment
  var h1El = document.querySelector('h1');
  if (h1El && title) {
    var h1Text = (h1El.textContent || h1El.innerText || '').trim().toLowerCase();
    var titleLower = title.toLowerCase();
    var titleWords = titleLower.split(/\W+/).filter(function(w) { return w.length >= 4; });
    var h1Words = h1Text.split(/\W+/).filter(function(w) { return w.length >= 4; });
    var commonWords = titleWords.filter(function(w) { return h1Words.indexOf(w) !== -1; });
    if (titleWords.length > 0 && h1Words.length > 0 && commonWords.length === 0) {
      issues.push({ type: 'title_h1_mismatch', message: 'Title and H1 have no words in common', severity: 'notice', detail: 'Title: "' + title + '"\nH1: "' + (h1El.textContent || '').trim() + '"' });
    }
  }

  // Meta description checks
  var metaDesc = descEl;
  if (!metaDesc) {
    issues.push({ type: 'missing_description', message: 'Missing meta <description> tag', severity: 'warning' });
  } else {
    var descContent = metaDesc.getAttribute('content') || '';
    if (descContent.trim() === '') {
      issues.push({ type: 'empty_description', message: 'Meta description is empty', severity: 'warning' });
    } else if (descContent.trim().length < descMin) {
      issues.push({ type: 'short_description', message: 'Meta description is too short (less than ' + descMin + ' chars)', severity: 'notice', detail: 'Current length: ' + descContent.trim().length + ' chars.' });
    } else if (descContent.trim().length > descMax) {
      issues.push({ type: 'long_description', message: 'Meta description is too long (more than ' + descMax + ' chars)', severity: 'notice', detail: 'Current length: ' + descContent.trim().length + ' chars. Recommended up to ' + descMax + '.' });
    }

    // Title equals description
    if (title && metaDesc && title.trim() === descContent.trim()) {
      issues.push({ type: 'title_equals_description', message: 'Page title matches meta description', severity: 'notice' });
    }
  }

  // Multiple meta descriptions
  var descEls = document.querySelectorAll('meta[name="description"]');
  if (descEls.length > 1) {
    issues.push({ type: 'multiple_descriptions', message: 'Found ' + descEls.length + ' meta description tags', severity: 'warning', detail: 'Only one meta description tag is allowed.' });
  }

  // Canonical checks
  var canonicals = document.querySelectorAll('link[rel="canonical"]');
  var canonicalHref = '';
  if (canonicals.length === 0) {
    issues.push({ type: 'missing_canonical', message: 'Missing canonical tag', severity: 'notice' });
  } else if (canonicals.length > 1) {
    issues.push({ type: 'multiple_canonicals', message: 'Multiple canonical tags found (' + canonicals.length + ')', severity: 'critical' });
  } else {
    canonicalHref = (canonicals[0].getAttribute('href') || '').trim();
    if (!canonicalHref) {
      issues.push({ type: 'empty_canonical', message: 'Canonical tag has an empty href', severity: 'critical' });
    } else {
      // Relative canonical
      if (canonicalHref.indexOf('http://') !== 0 && canonicalHref.indexOf('https://') !== 0) {
        issues.push({ type: 'relative_canonical', message: 'Canonical is a relative URL', severity: 'warning', detail: 'Canonical: ' + canonicalHref + '\nIt is recommended to always use an absolute URL.' });
      } else {
        var currentUrl = window.location.href.split('#')[0];
        var canonicalUrl = canonicalHref.split('#')[0];
        if (currentUrl.replace(/\/$/, '') === canonicalUrl.replace(/\/$/, '')) {
          issues.push({ type: 'self_canonical', message: 'Self-canonical: canonical points to the current page', severity: 'info', detail: canonicalHref });
        } else {
          issues.push({ type: 'cross_canonical', message: 'Canonical вказує на інший URL', severity: 'warning', detail: 'Canonical: ' + canonicalHref + '\nПоточний: ' + window.location.href });
        }
      }
    }
  }

  // Meta robots checks
  var metaRobots = document.querySelector('meta[name="robots"]');
  if (metaRobots) {
    var robotsContent = (metaRobots.getAttribute('content') || '').toLowerCase();
    if (robotsContent.indexOf('noindex') !== -1 || /\bnone\b/.test(robotsContent)) {
      issues.push({ type: 'noindex', message: 'Page is blocked from indexing (noindex)', severity: 'critical', detail: 'Meta robots content: "' + robotsContent + '"' });
    }
    if (robotsContent.indexOf('nofollow') !== -1 || /\bnone\b/.test(robotsContent)) {
      issues.push({ type: 'nofollow', message: 'Links are blocked from following (nofollow)', severity: 'notice', detail: 'Meta robots content: "' + robotsContent + '"' });
    }
  }

  // Googlebot-specific noindex
  var googlebotMeta = document.querySelector('meta[name="googlebot"]');
  if (googlebotMeta) {
    var googlebotContent = (googlebotMeta.getAttribute('content') || '').toLowerCase();
    if (googlebotContent.indexOf('noindex') !== -1 || /\bnone\b/.test(googlebotContent)) {
      issues.push({ type: 'googlebot_noindex', message: 'Google blocked from indexing via meta[name="googlebot"]', severity: 'critical', detail: 'content="' + googlebotContent + '"' });
    }
    if (googlebotContent.indexOf('nofollow') !== -1 || /\bnone\b/.test(googlebotContent)) {
      issues.push({ type: 'googlebot_nofollow', message: 'Google blocked from following links via meta[name="googlebot"]', severity: 'notice', detail: 'content="' + googlebotContent + '"' });
    }
  }

  // Meta charset check
  var charset = document.querySelector('meta[charset]') || document.querySelector('meta[http-equiv="Content-Type"]');
  if (!charset) {
    issues.push({ type: 'missing_charset', message: 'Missing charset meta tag', severity: 'notice' });
  }

  // Meta viewport check
  var viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    issues.push({ type: 'missing_viewport', message: 'Missing viewport meta tag (poor mobile support)', severity: 'warning' });
  }

  // Word count check
  var bodyText = document.body ? document.body.innerText : '';
  var words = bodyText.trim().split(/\s+/).filter(function(w) { return w.length > 0; });
  if (words.length < minWords) {
    issues.push({ type: 'thin_content', message: 'Low text content (fewer than ' + minWords + ' words)', severity: 'notice', detail: 'Words found: ' + words.length });
  }

  // Canonical → homepage check
  if (canonicalHref) {
    try {
      var canonParsed = new URL(canonicalHref);
      if ((canonParsed.pathname === '/' || canonParsed.pathname === '') && canonParsed.search === '') {
        var curPath = window.location.pathname;
        if (curPath !== '/' && curPath !== '') {
          issues.push({ type: 'canonical_to_homepage', message: 'Canonical вказує на головну сторінку з внутрішньої', severity: 'warning', detail: 'Canonical: ' + canonicalHref });
        }
      }
    } catch(e) {}
  }

  // Canonical protocol mismatch
  if (canonicalHref) {
    var pageProto = window.location.protocol;
    var canonProto = canonicalHref.indexOf('https:') === 0 ? 'https:' : (canonicalHref.indexOf('http:') === 0 ? 'http:' : null);
    if (canonProto && canonProto !== pageProto) {
      issues.push({ type: 'canonical_protocol_mismatch', message: 'Canonical protocol (' + canonProto + '//…) does not match page protocol (' + pageProto + '//…)', severity: 'warning', detail: 'Canonical: ' + canonicalHref });
    }
  }

  // Schema + noindex conflict
  var _noindexMeta = document.querySelector('meta[name="robots"]');
  var _noindexContent = _noindexMeta ? (_noindexMeta.getAttribute('content') || '').toLowerCase() : '';
  if (_noindexContent.indexOf('noindex') !== -1) {
    var _hasSchema = !!document.querySelector('script[type="application/ld+json"]') ||
                    !!document.querySelector('[itemscope]');
    if (_hasSchema) {
      issues.push({ type: 'schema_noindex_conflict', message: 'Page has noindex and structured data simultaneously — Google will not index the schema', severity: 'warning' });
    }
  }

  // ── URL structure checks ──────────────────────────────────────────────────────
  var pathname = window.location.pathname;
  var _search = window.location.search;

  // Cyrillic in URL pathname check
  if (/[а-яёіїєґА-ЯЁІЇЄҐ]/.test(decodeURIComponent(pathname))) {
    issues.push({ type: 'cyrillic_url', message: 'URL contains Cyrillic characters', severity: 'notice', detail: 'Path: ' + pathname });
  }

  // Uppercase letters in pathname
  if (/[A-Z]/.test(pathname)) {
    issues.push({ type: 'url_uppercase', message: 'URL path contains uppercase letters', severity: 'notice', detail: 'Path: ' + pathname });
  }

  // Underscores instead of hyphens
  if (/_/.test(pathname)) {
    issues.push({ type: 'url_underscores', message: 'URL contains underscores (_) — hyphens (-) are recommended', severity: 'notice', detail: 'Path: ' + pathname });
  }

  // Spaces in pathname (%20 or +)
  if (/%20|\+/.test(pathname)) {
    issues.push({ type: 'url_spaces', message: 'URL contains spaces (%20 or +)', severity: 'notice', detail: 'Path: ' + pathname });
  }

  // URL length
  var _fullUrl = window.location.href;
  if (_fullUrl.length > 2048) {
    issues.push({ type: 'url_too_long', message: 'URL is too long (' + _fullUrl.length + ' chars, maximum 2048)', severity: 'notice' });
  }

  // Repetitive path segments
  var _segments = pathname.split('/').filter(function(s) { return s.length > 0; });
  var _segSeen = {};
  var _hasRepeat = false;
  _segments.forEach(function(s) {
    if (_segSeen[s]) { _hasRepeat = true; } else { _segSeen[s] = true; }
  });
  if (_hasRepeat) {
    issues.push({ type: 'url_repetitive_path', message: 'URL contains repetitive path segments', severity: 'notice', detail: 'Path: ' + pathname });
  }

  // Session IDs in query string
  if (/(?:sessionid|phpsessid|jsessionid|aspsessionid|sid)=/i.test(_search)) {
    issues.push({ type: 'url_session_id', message: 'URL contains a session ID — may cause duplicate content', severity: 'warning', detail: 'Params: ' + _search });
  }

  // Stop words in URL segments
  var _stopWords = { a:1, an:1, the:1, and:1, or:1, but:1, is:1, in:1, of:1, to:1, for:1, on:1, at:1, by:1 };
  var _stopFound = _segments.filter(function(s) { return _stopWords[s.toLowerCase()]; });
  if (_stopFound.length > 0) {
    issues.push({ type: 'url_stop_words', message: 'URL contains stop words: ' + _stopFound.join(', '), severity: 'notice', detail: 'Path: ' + pathname });
  }

  // Redirect chain detection via Performance Navigation API
  try {
    var navEntries = performance.getEntriesByType('navigation');
    if (navEntries && navEntries.length > 0) {
      var nav = navEntries[0];
      var redirectCount = nav.redirectCount || 0;
      if (redirectCount >= 2) {
        var redirectMs = Math.round(nav.redirectEnd - nav.redirectStart);
        issues.push({
          type: 'redirect_chain',
          message: 'Redirect chain: ' + redirectCount + ' redirects before the final page',
          severity: 'warning',
          detail: 'Redirect time: ' + redirectMs + ' ms. Each unnecessary redirect slows down loading and may reduce SEO value. Recommended to consolidate into a single 301.'
        });
      } else if (redirectCount === 1) {
        var rdMs = Math.round(nav.redirectEnd - nav.redirectStart);
        if (rdMs > 200) {
          issues.push({
            type: 'slow_redirect',
            message: 'Redirect takes ' + rdMs + ' ms — this is a noticeable slowdown',
            severity: 'notice',
            detail: 'Even a single redirect with significant delay negatively affects TTFB and LCP.'
          });
        }
      }
    }
  } catch(e) {}

  // Meta refresh redirect check
  var metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
  if (metaRefresh) {
    var refreshContent = metaRefresh.getAttribute('content') || '';
    var delayMatch = refreshContent.match(/^\d+/);
    var delay = delayMatch ? parseInt(delayMatch[0], 10) : 0;
    if (delay === 0 || /url=/i.test(refreshContent)) {
      issues.push({ type: 'meta_refresh_redirect', message: 'Redirect via <meta http-equiv="refresh"> — recommended to replace with 301', severity: 'warning', detail: 'content="' + refreshContent + '"' });
    }
  }

  // JavaScript redirect check (inline scripts only)
  var inlineScripts = Array.prototype.slice.call(document.querySelectorAll('script:not([src])'));
  var inlineJs = inlineScripts.map(function(s) { return s.textContent || ''; }).join('\n');
  if (/window\.location\s*(?:\.href\s*=|\.replace\s*\(|\.assign\s*\()/.test(inlineJs)) {
    issues.push({ type: 'js_redirect', message: 'Redirect via JavaScript (window.location) — recommended to replace with 301', severity: 'warning' });
  }

  return { id: 'seo', name: 'SEO', issues: issues };
}
