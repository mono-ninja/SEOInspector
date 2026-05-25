function runResourceHintsChecker(p) {
  var issues = [];
  var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');

  // ── Collect external origins from loaded resources ──────────────────────────
  var externalOrigins = {};
  try {
    performance.getEntriesByType('resource').forEach(function(entry) {
      try {
        var u = new URL(entry.name);
        var host = u.hostname.toLowerCase().replace(/^www\./, '');
        if (host && host !== currentHost) {
          externalOrigins[u.origin] = (externalOrigins[u.origin] || 0) + 1;
        }
      } catch(e) {}
    });
  } catch(e) {}

  // ── Collect ALL existing hints ──────────────────────────────────────────────
  var preconnectHints = [];
  var dnsPrefetchHints = [];
  var preloadHints = [];
  var prefetchHints = [];
  var prerenderHints = [];
  var modulepreloadHints = [];

  Array.prototype.slice.call(document.querySelectorAll('link[rel]')).forEach(function(link) {
    var rel = (link.getAttribute('rel') || '').toLowerCase().trim();
    var href = link.getAttribute('href') || '';
    var inHead = !!link.closest('head');

    switch(rel) {
      case 'preconnect':
        preconnectHints.push({ href: href, crossorigin: link.hasAttribute('crossorigin'), inHead: inHead });
        break;
      case 'dns-prefetch':
        dnsPrefetchHints.push({ href: href, inHead: inHead });
        break;
      case 'preload':
        preloadHints.push({
          href: href,
          as: link.getAttribute('as') || '',
          type: link.getAttribute('type') || '',
          crossorigin: link.hasAttribute('crossorigin'),
          fetchpriority: link.getAttribute('fetchpriority') || '',
          inHead: inHead
        });
        break;
      case 'prefetch':
        prefetchHints.push({ href: href, inHead: inHead });
        break;
      case 'prerender':
        prerenderHints.push({ href: href, inHead: inHead });
        break;
      case 'modulepreload':
        modulepreloadHints.push({ href: href, inHead: inHead });
        break;
    }
  });

  // Build preconnect origin set
  var preconnectOrigins = {};
  preconnectHints.forEach(function(h) {
    try { preconnectOrigins[new URL(h.href, window.location.href).origin] = h; } catch(e) {}
  });

  // ── Overview ────────────────────────────────────────────────────────────────
  var externalOriginCount = Object.keys(externalOrigins).length;
  issues.push({
    type: 'hints_overview',
    message: 'Resource Hints',
    severity: 'info',
    detail: [
      'Preconnect     ' + preconnectHints.length + (preconnectHints.length > 0 ? ' (' + preconnectHints.map(function(h) { return h.href; }).join(', ') + ')' : ''),
      'DNS-prefetch   ' + dnsPrefetchHints.length + (dnsPrefetchHints.length > 0 ? ' (deprecated)' : ''),
      'Preload        ' + preloadHints.length,
      'Prefetch       ' + prefetchHints.length,
      'Prerender      ' + prerenderHints.length,
      'Modulepreload  ' + modulepreloadHints.length,
      'External origins loaded  ' + externalOriginCount,
    ].join('\n')
  });

  // ── dns-prefetch → preconnect recommendation ────────────────────────────────
  if (dnsPrefetchHints.length > 0) {
    issues.push({
      type: 'dns_prefetch_deprecated',
      message: 'dns-prefetch is deprecated — use preconnect instead (' + dnsPrefetchHints.length + ')',
      severity: 'notice',
      detail: 'DNS-prefetch only resolves the hostname. Preconnect does DNS + TCP + TLS handshake.\n' +
        dnsPrefetchHints.map(function(h) { return 'Replace: ' + h.href; }).join('\n')
    });
  }

  // ── Excessive preconnect (> 4 is diminishing returns) ───────────────────────
  if (preconnectHints.length > 4) {
    issues.push({
      type: 'excessive_preconnect',
      message: 'Too many preconnect hints (' + preconnectHints.length + ') — browsers limit to ~4',
      severity: 'notice',
      detail: 'Chrome and Firefox cap preconnect at 4 origins. Extra hints are wasted.\n' +
        preconnectHints.map(function(h) { return h.href; }).join('\n')
    });
  }

  // ── Missing preconnect for loaded external origins ──────────────────────────
  var missingPreconnect = [];
  Object.keys(externalOrigins).forEach(function(origin) {
    if (preconnectOrigins[origin]) return;
    missingPreconnect.push(origin + ' (' + externalOrigins[origin] + ' resources)');
  });
  if (missingPreconnect.length > 0) {
    missingPreconnect.sort(function(a, b) {
      var aNum = parseInt(a.match(/\((\d+)/), 10) || 0;
      var bNum = parseInt(b.match(/\((\d+)/), 10) || 0;
      return bNum - aNum;
    });
    issues.push({
      type: 'missing_preconnect',
      message: 'Missing preconnect for ' + missingPreconnect.length + ' loaded external origin' + (missingPreconnect.length > 1 ? 's' : ''),
      severity: 'notice',
      detail: missingPreconnect.slice(0, 8).join('\n')
    });
  }

  // ── Preconnect without crossorigin (needed for CORS resources) ──────────────
  var preconnectNoCrossorigin = preconnectHints.filter(function(h) {
    return !h.crossorigin;
  });
  if (preconnectNoCrossorigin.length > 0) {
    issues.push({
      type: 'preconnect_no_crossorigin',
      message: 'Preconnect without crossorigin attribute (' + preconnectNoCrossorigin.length + ')',
      severity: 'notice',
      detail: 'Add crossorigin for CORS resources (fonts, fetch API). Without it, the preconnect may not be reused.\n' +
        preconnectNoCrossorigin.map(function(h) { return h.href; }).join('\n')
    });
  }

  // ── Preconnect href must be absolute origin URL ─────────────────────────────
  var preconnectBadHref = preconnectHints.filter(function(h) {
    try {
      var u = new URL(h.href, window.location.href);
      return u.pathname !== '/' || u.search || u.hash;
    } catch(e) { return true; }
  });
  if (preconnectBadHref.length > 0) {
    issues.push({
      type: 'preconnect_invalid_href',
      message: 'Preconnect href is not an origin URL (' + preconnectBadHref.length + ')',
      severity: 'warning',
      detail: 'Preconnect href must be an origin (e.g., https://cdn.example.com), not a full path.\n' +
        preconnectBadHref.map(function(h) { return h.href; }).join('\n')
    });
  }

  // ── Preconnect in <body> ────────────────────────────────────────────────────
  var preconnectInBody = preconnectHints.filter(function(h) { return !h.inHead; });
  if (preconnectInBody.length > 0) {
    issues.push({
      type: 'preconnect_in_body',
      message: 'Preconnect hints found outside <head> (' + preconnectInBody.length + ')',
      severity: 'notice',
      detail: 'Resource hints should be in <head> to take effect as early as possible.',
      highlight: true
    });
  }

  // ── Preload checks ──────────────────────────────────────────────────────────
  // Preload without 'as' attribute
  var preloadNoAs = preloadHints.filter(function(h) { return !h.as; });
  if (preloadNoAs.length > 0) {
    issues.push({
      type: 'preload_missing_as',
      message: 'Preload without "as" attribute (' + preloadNoAs.length + ')',
      severity: 'warning',
      detail: 'The "as" attribute is required for preload to work correctly.\n' +
        preloadNoAs.map(function(h) { return h.href; }).join('\n'),
      highlight: true
    });
  }

  // Preload font without crossorigin
  var preloadFontNoCrossorigin = preloadHints.filter(function(h) {
    return h.as === 'font' && !h.crossorigin;
  });
  if (preloadFontNoCrossorigin.length > 0) {
    issues.push({
      type: 'preload_font_no_crossorigin',
      message: 'Preload as="font" without crossorigin (' + preloadFontNoCrossorigin.length + ')',
      severity: 'warning',
      detail: 'Font preloads from cross-origin must have crossorigin attribute.\n' +
        preloadFontNoCrossorigin.map(function(h) { return h.href; }).join('\n')
    });
  }

  // Preload font without type
  var preloadFontNoType = preloadHints.filter(function(h) {
    return h.as === 'font' && !h.type;
  });
  if (preloadFontNoType.length > 0) {
    issues.push({
      type: 'preload_font_no_type',
      message: 'Preload as="font" without type attribute (' + preloadFontNoType.length + ')',
      severity: 'notice',
      detail: 'Specify type (e.g., font/woff2) to avoid a second request for MIME type detection.\n' +
        preloadFontNoType.map(function(h) { return h.href; }).join('\n')
    });
  }

  // Preload image without type
  var preloadImageNoType = preloadHints.filter(function(h) {
    return h.as === 'image' && !h.type;
  });
  if (preloadImageNoType.length > 0) {
    issues.push({
      type: 'preload_image_no_type',
      message: 'Preload as="image" without type attribute (' + preloadImageNoType.length + ')',
      severity: 'notice',
      detail: 'Specify type (e.g., image/webp) for correct MIME handling.\n' +
        preloadImageNoType.map(function(h) { return h.href; }).join('\n')
    });
  }

  // Excessive preload (> 4)
  if (preloadHints.length > 4) {
    issues.push({
      type: 'excessive_preload',
      message: 'Too many preload hints (' + preloadHints.length + ') — recommended ≤ 4',
      severity: 'notice',
      detail: 'Each preload competes with other critical resources. Only preload what\'s needed for the current page.'
    });
  }

  // Preload duplicates
  var preloadHrefCounts = {};
  preloadHints.forEach(function(h) {
    preloadHrefCounts[h.href] = (preloadHrefCounts[h.href] || 0) + 1;
  });
  var preloadDupes = [];
  Object.keys(preloadHrefCounts).forEach(function(href) {
    if (preloadHrefCounts[href] > 1) preloadDupes.push(href + ' (' + preloadHrefCounts[href] + '×)');
  });
  if (preloadDupes.length > 0) {
    issues.push({
      type: 'preload_duplicates',
      message: 'Duplicate preload hints (' + preloadDupes.length + ')',
      severity: 'notice',
      detail: preloadDupes.join('\n')
    });
  }

  // Preload in <body>
  var preloadInBody = preloadHints.filter(function(h) { return !h.inHead; });
  if (preloadInBody.length > 0) {
    issues.push({
      type: 'preload_in_body',
      message: 'Preload hints found outside <head> (' + preloadInBody.length + ')',
      severity: 'notice',
      detail: 'Preload hints in <body> are discovered too late to be effective.',
      highlight: true
    });
  }

  // Preload non-critical resources (prefetch would be better)
  var preloadStylesheets = preloadHints.filter(function(h) { return h.as === 'style'; });
  var preloadScripts = preloadHints.filter(function(h) { return h.as === 'script'; });
  if (preloadScripts.length > 0) {
    issues.push({
      type: 'preload_script',
      message: 'Script preloaded with <link rel="preload"> (' + preloadScripts.length + ')',
      severity: 'notice',
      detail: 'Preloading a script does not execute it. If the script is needed for rendering, use a <script> tag. If non-critical, use prefetch instead.\n' +
        preloadScripts.map(function(h) { return h.href; }).join('\n')
    });
  }

  // ── Prefetch checks ─────────────────────────────────────────────────────────
  if (prefetchHints.length > 0) {
    // Prefetch for critical resources (should be preload instead)
    var prefetchStyles = prefetchHints.filter(function(h) { return /\.css$/i.test(h.href); });
    if (prefetchStyles.length > 0) {
      issues.push({
        type: 'prefetch_critical_resource',
        message: 'CSS file prefetched instead of preloaded (' + prefetchStyles.length + ')',
        severity: 'notice',
        detail: 'CSS needed for the current page should use preload, not prefetch.\n' +
          prefetchStyles.map(function(h) { return h.href; }).join('\n')
      });
    }
  }

  // ── Prerender checks ────────────────────────────────────────────────────────
  if (prerenderHints.length > 0) {
    var prerenderExternal = prerenderHints.filter(function(h) {
      try {
        var u = new URL(h.href, window.location.href);
        return u.hostname.toLowerCase().replace(/^www\./, '') !== currentHost;
      } catch(e) { return false; }
    });
    if (prerenderExternal.length > 0) {
      issues.push({
        type: 'prerender_external',
        message: 'Prerender for external URLs (' + prerenderExternal.length + ')',
        severity: 'notice',
        detail: 'Prerendering external sites wastes bandwidth and may violate their terms.\n' +
          prerenderExternal.map(function(h) { return h.href; }).join('\n')
      });
    }
  }

  // ── Modulepreload checks ────────────────────────────────────────────────────
  if (modulepreloadHints.length > 0) {
    var modulepreloadNonJs = modulepreloadHints.filter(function(h) {
      return !/\.m?js($|\?)/i.test(h.href);
    });
    if (modulepreloadNonJs.length > 0) {
      issues.push({
        type: 'modulepreload_non_js',
        message: 'Modulepreload for non-JS files (' + modulepreloadNonJs.length + ')',
        severity: 'warning',
        detail: 'modulepreload should only be used for ES module scripts (.js, .mjs).\n' +
          modulepreloadNonJs.map(function(h) { return h.href; }).join('\n')
      });
    }
  }

  // ── LCP image preload check ─────────────────────────────────────────────────
  var preloadedImageSrcs = preloadHints
    .filter(function(h) { return h.as === 'image'; })
    .map(function(h) { return h.href; });

  var allImgs = Array.prototype.slice.call(document.querySelectorAll('img[src]'));
  var realImgs = allImgs.filter(function(img) {
    var src = img.getAttribute('src') || '';
    return src && src.indexOf('data:') !== 0;
  });

  if (realImgs.length > 0) {
    // First non-lazy image is the LCP candidate
    var lcpCandidate = null;
    for (var li = 0; li < realImgs.length; li++) {
      if (realImgs[li].getAttribute('loading') !== 'lazy') {
        lcpCandidate = realImgs[li];
        break;
      }
    }
    if (!lcpCandidate) lcpCandidate = realImgs[0];

    var lcpSrc = lcpCandidate.getAttribute('src') || '';
    var lcpSrcAbsolute = lcpCandidate.src || lcpSrc;
    var isLcpPreloaded = preloadedImageSrcs.some(function(ps) {
      try {
        return new URL(ps, window.location.href).href === lcpSrcAbsolute || ps === lcpSrc;
      } catch(e) { return ps === lcpSrc; }
    });

    if (!isLcpPreloaded && lcpSrc) {
      var lcpWidth = lcpCandidate.getBoundingClientRect().width || lcpCandidate.naturalWidth || 0;
      if (lcpWidth >= 300) {
        issues.push({
          type: 'lcp_image_no_preload',
          message: 'LCP candidate image not preloaded',
          severity: 'notice',
          detail: 'Add <link rel="preload" as="image" href="' + lcpSrc + '"> in <head> for faster LCP.',
          highlight: true
        });
      }
    }
  }

  // ── Above-fold images without preload (improved check) ──────────────────────
  var aboveFoldImgs = realImgs.filter(function(img) {
    try {
      var rect = img.getBoundingClientRect();
      // Include images that are partially in viewport
      return rect.top < window.innerHeight && rect.bottom > 0 &&
             rect.right > 0 && rect.left < window.innerWidth;
    } catch(e) { return false; }
  });

  var aboveFoldNotPreloaded = aboveFoldImgs.filter(function(img) {
    var src = img.src || img.getAttribute('src') || '';
    if (!src) return false;
    return !preloadedImageSrcs.some(function(ps) {
      try {
        return new URL(ps, window.location.href).href === src;
      } catch(e) { return ps === src; }
    });
  });

  if (aboveFoldNotPreloaded.length >= 1) {
    issues.push({
      type: 'above_fold_no_preload',
      message: 'Viewport images without preload (' + aboveFoldNotPreloaded.length + ')',
      severity: 'notice',
      detail: 'Consider preloading critical above-fold images for faster rendering.\n' +
        aboveFoldNotPreloaded.slice(0, 3).map(function(i) {
          var src = i.getAttribute('src') || '';
          return src.length > 60 ? src.substring(0, 60) + '…' : src;
        }).join('\n')
    });
  }

  return { id: 'resource_hints', name: 'Resource Hints', issues: issues };
}
