function runPerformanceChecker(p) {
  var issues = [];
  var params = p || {};
  var ttfbWarning  = params.ttfb_warning  || 400;
  var ttfbCritical = params.ttfb_critical || 800;
  var dclWarning   = params.dcl_warning   || 3000;
  var loadWarning  = params.load_warning  || 5000;
  var maxScripts   = params.max_scripts   || 20;
  var maxDomNodes  = params.max_dom_nodes || 1500;

  // ── Navigation Timing ───────────────────────────────────────────────────────
  var navEntries = [];
  try { navEntries = performance.getEntriesByType('navigation'); } catch(e) {}

  if (navEntries.length > 0) {
    var nav = navEntries[0];
    var ttfb = nav.responseStart - nav.requestStart;
    var pageLoaded = nav.loadEventEnd > 0;
    var dclDone = nav.domContentLoadedEventEnd > 0;
    var dcl = dclDone ? nav.domContentLoadedEventEnd - nav.startTime : 0;
    var loadTime = pageLoaded ? nav.loadEventEnd - nav.startTime : 0;
    var redirectCount = nav.redirectCount || 0;
    var protocol = nav.nextHopProtocol || 'unknown';

    issues.push({
      type: 'perf_overview',
      message: 'Load timings',
      severity: 'info',
      detail: [
        'TTFB      ' + Math.round(ttfb) + ' ms  ' + (ttfb > ttfbCritical ? '✗' : ttfb > ttfbWarning ? '⚠' : '✓'),
        'DCL       ' + (dclDone ? Math.round(dcl) + ' ms  ' + (dcl > dclWarning ? '⚠' : '✓') : 'loading...'),
        'Load      ' + (pageLoaded ? Math.round(loadTime) + ' ms  ' + (loadTime > loadWarning ? '⚠' : '✓') : 'loading...'),
        'Protocol  ' + protocol,
        'Redirects ' + redirectCount,
      ].join('\n')
    });

    if (ttfb > ttfbCritical) {
      issues.push({ type: 'high_ttfb', message: 'TTFB is very high (' + Math.round(ttfb) + ' ms)', severity: 'critical', detail: 'Time to First Byte should be under ' + ttfbCritical + ' ms. Check server response time, CDN, and hosting.' });
    } else if (ttfb > ttfbWarning) {
      issues.push({ type: 'moderate_ttfb', message: 'TTFB is elevated (' + Math.round(ttfb) + ' ms)', severity: 'warning', detail: 'Time to First Byte should be under ' + ttfbWarning + ' ms.' });
    }

    if (dclDone && dcl > dclWarning) {
      issues.push({ type: 'high_dcl', message: 'DOMContentLoaded takes ' + (dcl / 1000).toFixed(1) + 's (threshold: ' + (dclWarning / 1000).toFixed(1) + 's)', severity: 'warning' });
    }

    if (pageLoaded && loadTime > loadWarning) {
      issues.push({ type: 'high_load_time', message: 'Page load time ' + (loadTime / 1000).toFixed(1) + 's exceeds ' + (loadWarning / 1000).toFixed(1) + 's', severity: 'warning' });
    }

    // Redirect chain
    if (redirectCount > 0) {
      issues.push({
        type: 'redirect_chain',
        message: 'Page has ' + redirectCount + ' redirect' + (redirectCount > 1 ? 's' : '') + ' before load',
        severity: redirectCount > 2 ? 'warning' : 'notice',
        detail: 'Each redirect adds latency. Minimize redirect chains.'
      });
    }

    // HTTP/1.1 detection
    if (protocol.indexOf('h2') === -1 && protocol.indexOf('h3') === -1 && protocol !== '' && protocol !== 'unknown') {
      issues.push({
        type: 'no_http2',
        message: 'Site uses ' + protocol + ' instead of HTTP/2 or HTTP/3',
        severity: 'notice',
        detail: 'HTTP/2 enables multiplexing, header compression, and server push. Upgrade your server.'
      });
    }
  } else {
    issues.push({
      type: 'no_nav_timing',
      message: 'Navigation Timing API not available — load metrics cannot be measured',
      severity: 'notice',
      detail: 'This may occur in private browsing mode or if the API is blocked.'
    });
  }

  // ── Resource Timing Analysis ────────────────────────────────────────────────
  var resEntries = [];
  try { resEntries = performance.getEntriesByType('resource'); } catch(e) {}

  if (resEntries.length > 0) {
    var totalTransfer = 0;
    var totalEncoded = 0;
    var jsTransfer = 0;
    var cssTransfer = 0;
    var fontTransfer = 0;
    var imgTransfer = 0;
    var heavyJs = [];
    var heavyCss = [];
    var heavyFonts = [];
    var noCompression = [];
    var noCache = [];
    var scriptEvalTime = [];
    var cssParseTime = [];

    resEntries.forEach(function(r) {
      var transfer = r.transferSize || 0;
      var encoded = r.encodedBodySize || 0;
      totalTransfer += transfer;
      totalEncoded += encoded;

      var url = r.name || '';
      var urlLower = url.toLowerCase();
      var pathPart = urlLower.split('?')[0];

      var isJs = pathPart.slice(-3) === '.js' || pathPart.slice(-4) === '.mjs' || pathPart.slice(-4) === '.cjs' || urlLower.indexOf('.js?') !== -1;
      var isCss = pathPart.slice(-4) === '.css' || urlLower.indexOf('.css?') !== -1;
      var isFont = r.initiatorType === 'css' && (pathPart.indexOf('.woff') !== -1 || pathPart.indexOf('.ttf') !== -1 || pathPart.indexOf('.otf') !== -1 || pathPart.indexOf('.eot') !== -1);
      var isImg = r.initiatorType === 'img' || pathPart.slice(-4) === '.png' || pathPart.slice(-3) === '.jpg' || pathPart.slice(-4) === '.jpeg' || pathPart.slice(-5) === '.webp' || pathPart.slice(-5) === '.avif' || pathPart.slice(-4) === '.gif' || pathPart.slice(-4) === '.svg';

      if (isJs) { jsTransfer += transfer; }
      if (isCss) { cssTransfer += transfer; }
      if (isFont) { fontTransfer += transfer; }
      if (isImg) { imgTransfer += transfer; }

      // Heavy JS files
      if (isJs && transfer > 500 * 1024) {
        heavyJs.push(url.split('/').pop().split('?')[0] + ' (' + Math.round(transfer / 1024) + ' KB)');
      }
      // Heavy CSS files
      if (isCss && transfer > 200 * 1024) {
        heavyCss.push(url.split('/').pop().split('?')[0] + ' (' + Math.round(transfer / 1024) + ' KB)');
      }
      // Heavy font files
      if (isFont && transfer > 100 * 1024) {
        heavyFonts.push(url.split('/').pop().split('?')[0] + ' (' + Math.round(transfer / 1024) + ' KB)');
      }

      // Missing compression — large transfer relative to encoded size
      if (transfer > 10 * 1024 && encoded > 0 && transfer / encoded > 1.5) {
        noCompression.push(url.split('/').pop().split('?')[0] + ' (transfer: ' + Math.round(transfer / 1024) + ' KB, encoded: ' + Math.round(encoded / 1024) + ' KB)');
      }

      // No cache — transferSize equals encodedBodySize for repeat visits
      if (encoded > 5 * 1024 && transfer === encoded && transfer > 0) {
        noCache.push(url.split('/').pop().split('?')[0] + ' (' + Math.round(transfer / 1024) + ' KB)');
      }

      // Script evaluation time
      if (isJs && r.responseEnd > 0 && r.requestStart > 0) {
        var evalTime = r.responseEnd - r.requestStart;
        if (evalTime > 100) {
          scriptEvalTime.push({ name: url.split('/').pop().split('?')[0], time: Math.round(evalTime) });
        }
      }

      // CSS parse time (estimated from responseEnd to when styles apply)
      if (isCss && r.duration > 50) {
        cssParseTime.push({ name: url.split('/').pop().split('?')[0], duration: Math.round(r.duration) });
      }
    });

    // Page weight
    if (totalTransfer > 3 * 1024 * 1024) {
      issues.push({
        type: 'heavy_page_weight',
        message: 'Total page weight: ' + (totalTransfer / 1024 / 1024).toFixed(1) + ' MB (exceeds 3 MB)',
        severity: 'warning',
        detail: 'JS: ' + (jsTransfer / 1024).toFixed(0) + ' KB, CSS: ' + (cssTransfer / 1024).toFixed(0) + ' KB, Fonts: ' + (fontTransfer / 1024).toFixed(0) + ' KB, Images: ' + (imgTransfer / 1024).toFixed(0) + ' KB'
      });
    } else if (totalTransfer > 2 * 1024 * 1024) {
      issues.push({
        type: 'moderate_page_weight',
        message: 'Total page weight: ' + (totalTransfer / 1024 / 1024).toFixed(1) + ' MB',
        severity: 'notice',
        detail: 'JS: ' + (jsTransfer / 1024).toFixed(0) + ' KB, CSS: ' + (cssTransfer / 1024).toFixed(0) + ' KB, Fonts: ' + (fontTransfer / 1024).toFixed(0) + ' KB, Images: ' + (imgTransfer / 1024).toFixed(0) + ' KB'
      });
    }

    if (heavyJs.length > 0) {
      issues.push({
        type: 'heavy_js_file',
        message: 'Large JS files > 500 KB (' + heavyJs.length + ')',
        severity: 'notice',
        detail: heavyJs.join('\n')
      });
    }
    if (heavyCss.length > 0) {
      issues.push({
        type: 'heavy_css_file',
        message: 'Large CSS files > 200 KB (' + heavyCss.length + ')',
        severity: 'notice',
        detail: heavyCss.join('\n')
      });
    }
    if (heavyFonts.length > 0) {
      issues.push({
        type: 'heavy_font_file',
        message: 'Large font files > 100 KB (' + heavyFonts.length + ')',
        severity: 'notice',
        detail: 'Consider using font subsetting or variable fonts.\n' + heavyFonts.join('\n')
      });
    }

    // Missing compression
    if (noCompression.length > 0) {
      issues.push({
        type: 'missing_compression',
        message: 'Resources with poor compression ratio (' + noCompression.length + ')',
        severity: 'notice',
        detail: 'Enable gzip or Brotli compression on your server.\n' + noCompression.slice(0, 5).join('\n')
      });
    }

    // Script evaluation time
    scriptEvalTime.sort(function(a, b) { return b.time - a.time; });
    if (scriptEvalTime.length > 0) {
      issues.push({
        type: 'slow_script_evaluation',
        message: 'Slow script evaluation (' + scriptEvalTime.length + ' scripts > 100ms)',
        severity: 'notice',
        detail: scriptEvalTime.slice(0, 5).map(function(s) { return s.name + ' — ' + s.time + 'ms'; }).join('\n')
      });
    }

    // CSS parse time
    cssParseTime.sort(function(a, b) { return b.duration - a.duration; });
    if (cssParseTime.length > 0) {
      issues.push({
        type: 'slow_css_parsing',
        message: 'Slow CSS parsing (' + cssParseTime.length + ' files > 50ms)',
        severity: 'notice',
        detail: cssParseTime.slice(0, 5).map(function(c) { return c.name + ' — ' + c.duration + 'ms'; }).join('\n')
      });
    }
  }

  // ── Google Fonts ────────────────────────────────────────────────────────────
  var gFontsLinks = Array.prototype.slice.call(document.querySelectorAll('link[href*="fonts.googleapis.com"]'));
  if (gFontsLinks.length > 0) {
    gFontsLinks.forEach(function(link) {
      var href = link.getAttribute('href') || '';
      if (href.indexOf('/css') === -1) return;
      if (href.indexOf('display=swap') === -1) {
        issues.push({ type: 'font_no_swap', message: 'Google Fonts loaded without display=swap', severity: 'notice', detail: href });
      }
    });

    var allLinkRels = Array.prototype.slice.call(document.querySelectorAll('link[rel]'));
    function hasHint(rel, hostname) {
      return allLinkRels.some(function(l) {
        return (l.getAttribute('rel') || '').toLowerCase() === rel &&
               (l.getAttribute('href') || '').indexOf(hostname) !== -1;
      });
    }

    if (!hasHint('preconnect', 'fonts.googleapis.com') && !hasHint('dns-prefetch', 'fonts.googleapis.com')) {
      issues.push({ type: 'font_no_preconnect_gapi', message: 'Google Fonts: missing preconnect to fonts.googleapis.com', severity: 'notice', detail: '<link rel="preconnect" href="https://fonts.googleapis.com">' });
    }
    if (!hasHint('preconnect', 'fonts.gstatic.com') && !hasHint('dns-prefetch', 'fonts.gstatic.com')) {
      issues.push({ type: 'font_no_preconnect_gstatic', message: 'Google Fonts: missing preconnect to fonts.gstatic.com', severity: 'notice', detail: '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' });
    }
  }

  // ── Render-blocking scripts ─────────────────────────────────────────────────
  var headScripts = document.querySelectorAll('head script[src]');
  var blockingScripts = Array.prototype.slice.call(headScripts).filter(function(s) {
    return !s.hasAttribute('async') && !s.hasAttribute('defer') && s.getAttribute('type') !== 'module';
  });
  if (blockingScripts.length > 0) {
    issues.push({
      type: 'blocking_scripts',
      message: 'Render-blocking scripts in <head> without async/defer (' + blockingScripts.length + ')',
      severity: 'warning',
      detail: blockingScripts.map(function(s) { return s.getAttribute('src'); }).slice(0, 5).join('\n'),
      highlight: true
    });
  }

  // ── @font-face without font-display ─────────────────────────────────────────
  var styleEls = document.querySelectorAll('style');
  var fontFaceNoDisplay = 0;
  Array.prototype.slice.call(styleEls).forEach(function(style) {
    var text = style.textContent || '';
    if (text.indexOf('@font-face') !== -1 && text.indexOf('font-display') === -1) {
      fontFaceNoDisplay++;
    }
  });
  if (fontFaceNoDisplay > 0) {
    issues.push({
      type: 'font_face_no_display',
      message: 'Inline @font-face without font-display (' + fontFaceNoDisplay + ')',
      severity: 'notice',
      detail: 'Add font-display: swap to prevent invisible text during font loading.'
    });
  }

  // ── Script count ────────────────────────────────────────────────────────────
  var allScripts = document.querySelectorAll('script[src]');
  if (allScripts.length > maxScripts) {
    issues.push({
      type: 'too_many_scripts',
      message: 'Too many external scripts (' + allScripts.length + ', recommended ≤ ' + maxScripts + ')',
      severity: 'notice',
      detail: 'Each script adds network latency and parse overhead. Consider bundling or lazy loading.'
    });
  }

  // ── DOM size ────────────────────────────────────────────────────────────────
  var domNodes = document.getElementsByTagName('*').length;
  var domDepth = 0;
  try {
    var _stack = [{ el: document.body, d: 0 }];
    while (_stack.length) {
      var _frame = _stack.pop();
      if (_frame.d > domDepth) domDepth = _frame.d;
      if (_frame.d >= 200) continue;
      var _c = _frame.el.firstElementChild;
      while (_c) { _stack.push({ el: _c, d: _frame.d + 1 }); _c = _c.nextElementSibling; }
    }
  } catch(e) {}

  if (domNodes > 3000) {
    issues.push({ type: 'excessive_dom_size', message: 'Excessive DOM size (' + domNodes + ' nodes, depth ' + domDepth + ')', severity: 'warning', detail: 'Over 3000 nodes significantly impacts rendering performance.' });
  } else if (domNodes > maxDomNodes) {
    issues.push({ type: 'large_dom_size', message: 'Large DOM size (' + domNodes + ' nodes, depth ' + domDepth + ')', severity: 'notice', detail: 'Recommended: up to ' + maxDomNodes + ' nodes.' });
  }

  // ── Large inline CSS ────────────────────────────────────────────────────────
  var largeInlineStyles = [];
  Array.prototype.slice.call(document.querySelectorAll('style')).forEach(function(style) {
    var text = (style.textContent || '').trim();
    if (text.length > 10000) {
      largeInlineStyles.push(text.length + ' chars (' + Math.round(text.length / 1024 * 10) / 10 + ' KB)');
    }
  });
  if (largeInlineStyles.length > 0) {
    issues.push({
      type: 'large_inline_css',
      message: 'Large inline <style> blocks (' + largeInlineStyles.length + ')',
      severity: 'notice',
      detail: 'Very large inline styles cannot be cached. Move to external files.\n' + largeInlineStyles.slice(0, 5).join('\n')
    });
  }

  // ── Large inline JS ─────────────────────────────────────────────────────────
  var largeInlineScripts = [];
  Array.prototype.slice.call(document.querySelectorAll('script:not([src])')).forEach(function(script) {
    var text = (script.textContent || '').trim();
    if (text.length > 10000) {
      largeInlineScripts.push(text.length + ' chars (' + Math.round(text.length / 1024 * 10) / 10 + ' KB)');
    }
  });
  if (largeInlineScripts.length > 0) {
    issues.push({
      type: 'large_inline_js',
      message: 'Large inline <script> blocks (' + largeInlineScripts.length + ')',
      severity: 'notice',
      detail: 'Large inline scripts cannot be cached. Move to external files.\n' + largeInlineScripts.slice(0, 5).join('\n')
    });
  }

  // ── CSS @import (render-blocking) ───────────────────────────────────────────
  var cssImports = 0;
  try {
    var sheets = document.styleSheets;
    for (var si = 0; si < sheets.length; si++) {
      try {
        var rules = sheets[si].cssRules || sheets[si].rules;
        if (rules) {
          for (var ri = 0; ri < rules.length; ri++) {
            if (rules[ri].type === CSSRule.IMPORT_RULE) cssImports++;
          }
        }
      } catch(e) {} // cross-origin sheets
    }
  } catch(e) {}
  if (cssImports > 0) {
    issues.push({
      type: 'css_import_blocking',
      message: 'CSS @import rules detected (' + cssImports + ') — render-blocking',
      severity: 'notice',
      detail: '@import forces sequential CSS loading. Replace with <link rel="stylesheet"> for parallel loading.'
    });
  }

  // ── document.write() detection ──────────────────────────────────────────────
  var docWriteScripts = [];
  Array.prototype.slice.call(document.querySelectorAll('script')).forEach(function(script) {
    var text = script.textContent || '';
    if (text.indexOf('document.write') !== -1 || text.indexOf('document.writeln') !== -1) {
      docWriteScripts.push(script.src || '(inline)');
    }
  });
  if (docWriteScripts.length > 0) {
    issues.push({
      type: 'document_write',
      message: 'document.write() detected (' + docWriteScripts.length + ' scripts)',
      severity: 'warning',
      detail: 'document.write() blocks HTML parsing. Use DOM manipulation instead.\n' + docWriteScripts.slice(0, 5).join('\n')
    });
  }

  // ── <body onload> handler ───────────────────────────────────────────────────
  var bodyOnload = document.body && document.body.getAttribute('onload');
  if (bodyOnload) {
    issues.push({
      type: 'body_onload',
      message: '<body onload> handler detected',
      severity: 'notice',
      detail: 'Use addEventListener("load") instead for better separation of concerns.'
    });
  }

  // ── Multiple font families ──────────────────────────────────────────────────
  var fontFamilies = new Object();
  try {
    var allStyles = document.querySelectorAll('style, link[rel="stylesheet"]');
    Array.prototype.forEach.call(document.querySelectorAll('style'), function(style) {
      var css = style.textContent || '';
      var matches = css.match(/font-family\s*:\s*["']?([^";\}]+)["']?/gi) || [];
      matches.forEach(function(m) {
        var family = m.replace(/font-family\s*:\s*["']?/i, '').replace(/["']?\s*$/, '').trim();
        var families = family.split(',');
        families.forEach(function(f) {
          var clean = f.trim().replace(/["']/g, '');
          if (clean && clean !== 'sans-serif' && clean !== 'serif' && clean !== 'monospace' && clean !== 'cursive' && clean !== 'fantasy' && clean !== 'system-ui') {
            fontFamilies[clean] = (fontFamilies[clean] || 0) + 1;
          }
        });
      });
    });
  } catch(e) {}
  var fontFamilyCount = Object.keys(fontFamilies).length;
  if (fontFamilyCount > 5) {
    issues.push({
      type: 'too_many_font_families',
      message: 'Many font families (' + fontFamilyCount + ') — impacts font loading time',
      severity: 'notice',
      detail: 'Each font family adds HTTP requests and parsing overhead. Limit to 2-3 families.\n' + Object.keys(fontFamilies).slice(0, 8).join(', ')
    });
  }

  // ── Cookie size impact ──────────────────────────────────────────────────────
  var cookieSize = (document.cookie || '').length;
  if (cookieSize > 4096) {
    issues.push({
      type: 'large_cookies',
      message: 'Cookie size is ' + cookieSize + ' bytes (max recommended: 4096)',
      severity: 'warning',
      detail: 'Large cookies are sent with every request, increasing page weight. Remove unnecessary cookies.'
    });
  } else if (cookieSize > 1024) {
    issues.push({
      type: 'moderate_cookies',
      message: 'Cookie size is ' + cookieSize + ' bytes',
      severity: 'notice',
      detail: 'Cookies are sent with every HTTP request. Minimize cookie size for better performance.'
    });
  }

  // ── Connection type (Network Information API) ───────────────────────────────
  var connectionInfo = '';
  try {
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      var parts = [];
      if (conn.effectiveType) parts.push('effectiveType=' + conn.effectiveType);
      if (conn.downlink) parts.push('downlink=' + conn.downlink + 'Mbps');
      if (conn.rtt) parts.push('rtt=' + conn.rtt + 'ms');
      if (conn.saveData) parts.push('saveData=true');
      connectionInfo = parts.join(', ');
    }
  } catch(e) {}

  // ── Service Worker ──────────────────────────────────────────────────────────
  var hasServiceWorker = false;
  try {
    if ('serviceWorker' in navigator) {
      hasServiceWorker = navigator.serviceWorker.controller !== null;
    }
  } catch(e) {}

  // ── Preload misuse ──────────────────────────────────────────────────────────
  var preloads = document.querySelectorAll('link[rel="preload"]');
  var preloadIssues = [];
  Array.prototype.forEach.call(preloads, function(link) {
    var href = link.getAttribute('href') || '';
    var as = link.getAttribute('as') || '';
    if (!as) {
      preloadIssues.push(href + ' — missing "as" attribute');
    }
    if (href && href.indexOf(window.location.origin) === 0 && as === 'script') {
      // Preloading a script that's already in the DOM
      var existingScript = document.querySelector('script[src="' + href + '"]');
      if (existingScript && !existingScript.hasAttribute('defer') && !existingScript.hasAttribute('async')) {
        preloadIssues.push(href + ' — preloaded but also blocking (consider adding defer)');
      }
    }
  });
  if (preloadIssues.length > 0) {
    issues.push({
      type: 'preload_misuse',
      message: 'Preload issues (' + preloadIssues.length + ')',
      severity: 'notice',
      detail: preloadIssues.join('\n')
    });
  }

  // ── Noscript content size ───────────────────────────────────────────────────
  var noscriptContent = '';
  Array.prototype.forEach.call(document.querySelectorAll('noscript'), function(ns) {
    noscriptContent += (ns.textContent || '');
  });
  if (noscriptContent.trim().length > 5000) {
    issues.push({
      type: 'large_noscript_content',
      message: 'Large <noscript> fallback content (' + Math.round(noscriptContent.length / 1024) + ' KB)',
      severity: 'notice',
      detail: 'Large noscript blocks increase page weight for all users, even those with JS enabled.'
    });
  }

  // ── Resource timing summary (info) ──────────────────────────────────────────
  if (resEntries.length > 0) {
    var resourceTypes = {};
    resEntries.forEach(function(r) {
      var type = r.initiatorType || 'other';
      resourceTypes[type] = (resourceTypes[type] || 0) + 1;
    });
    var typeSummary = Object.keys(resourceTypes).map(function(t) { return t + ': ' + resourceTypes[t]; }).join(', ');
    issues.push({
      type: 'resource_summary',
      message: 'Resource breakdown (' + resEntries.length + ' total)',
      severity: 'info',
      detail: [
        'Resources by type: ' + typeSummary,
        'Total transfer: ' + (totalTransfer > 0 ? (totalTransfer / 1024).toFixed(0) + ' KB' : 'unknown (cached)'),
        'Connection: ' + (connectionInfo || 'unknown'),
        'Service Worker: ' + (hasServiceWorker ? 'active' : 'not detected'),
        'DOM nodes: ' + domNodes + ' (depth: ' + domDepth + ')',
        'External scripts: ' + allScripts.length,
      ].join('\n')
    });
  }

  return { id: 'performance', name: 'Performance', issues: issues };
}
