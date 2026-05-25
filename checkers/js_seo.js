function runJsSeoChecker(p) {
  var issues = [];

  // ── 1. Framework detection ─────────────────────────────────────────────────
  var fw = [];
  var isSSR = false;

  // SSR/SSG frameworks
  if (window.__NEXT_DATA__)  { fw.push('Next.js');  isSSR = true; }
  if (window.__NUXT__)       { fw.push('Nuxt.js');  isSSR = true; }
  if (window.___gatsby)      { fw.push('Gatsby');   isSSR = true; }
  if (window.__remixContext__ || document.querySelector('script[data-type="remix-context"]'))
                              { fw.push('Remix');    isSSR = true; }
  if (document.querySelector('script[data-astro-compiled]'))
                              { fw.push('Astro');    isSSR = true; }
  if (window.__SVELTEKIT_HYDRATE__ || document.querySelector('[data-enhance]'))
                              { fw.push('SvelteKit'); isSSR = true; }

  // Client-side frameworks
  if (!isSSR) {
    if (document.querySelector('[ng-version]') || window.ng)
                                        fw.push('Angular');
    if (document.querySelector('[data-v-app]') || window.__VUE__ || window.Vue)
                                        fw.push('Vue.js');
    if (document.querySelector('[data-reactroot]') || window.React)
                                        fw.push('React');
    if (document.querySelector('[sveltekit]') || document.querySelector('[svelte]'))
                                        fw.push('Svelte');
    if (window.__solid_define__ || document.querySelector('[data-solidjs]'))
                                        fw.push('Solid.js');
    if (window.__PREACT_SIGNALS__ || window.Preact)
                                        fw.push('Preact');
    if (window.Ember)
                                        fw.push('Ember');
    if (window.LitElement || document.querySelector('[custom-elements-manifest]'))
                                        fw.push('Lit');
    if (document.querySelector('[q:validator]') || window.Qwik)
                                        fw.push('Qwik');
  }

  // Heuristic SSR check: if <title> and <meta description> are populated in
  // initial HTML, the page was likely server-rendered.
  var domTitle = (document.querySelector('title') || {}).textContent || '';
  var domDesc = document.querySelector('meta[name="description"]');
  if (!isSSR && fw.length > 0 && domTitle.trim().length > 5 && domDesc && (domDesc.getAttribute('content') || '').length > 10) {
    isSSR = true;
  }

  var isSPA = fw.length > 0 && !isSSR;

  if (fw.length > 0) {
    issues.push({
      type: 'js_framework',
      message: 'Framework: ' + fw.join(', ') + (isSSR ? ' (SSR/SSG)' : ' (client-side)'),
      severity: 'info'
    });
  }

  // ── 2. Noscript quality ────────────────────────────────────────────────────
  var noscripts = document.querySelectorAll('noscript');
  if (noscripts.length === 0) {
    if (isSPA) {
      issues.push({ type: 'js_no_noscript', message: 'No <noscript> fallback — SPA has no content for bots that disable JS', severity: 'warning' });
    }
  } else {
    var empty = Array.prototype.filter.call(noscripts, function(ns) {
      return ns.textContent.trim() === '';
    });
    var filled = Array.prototype.filter.call(noscripts, function(ns) {
      return ns.textContent.trim() !== '';
    });
    if (empty.length > 0 && filled.length === 0) {
      issues.push({ type: 'js_empty_noscript', message: 'All <noscript> tags are empty — no fallback content for non-JS crawlers', severity: 'notice' });
    } else {
      issues.push({ type: 'js_noscript_ok', message: 'noscript fallback present (' + filled.length + ' with content' + (empty.length > 0 ? ', ' + empty.length + ' empty' : '') + ')', severity: 'info' });
      if (empty.length > 0) {
        issues.push({ type: 'js_empty_noscript', message: empty.length + ' empty <noscript> tag' + (empty.length > 1 ? 's' : '') + ' found', severity: 'notice' });
      }
    }
  }

  // ── 3. SPA meta tag risk ───────────────────────────────────────────────────
  if (isSPA) {
    var robotsMeta = document.querySelector('meta[name="robots"]');
    var robotsContent = robotsMeta ? (robotsMeta.getAttribute('content') || '').toLowerCase() : '';
    if (robotsContent.indexOf('noindex') !== -1) {
      issues.push({ type: 'js_spa_noindex', message: 'Client-side SPA with noindex meta — verify this is intentional and not a rendering bug', severity: 'critical' });
    } else {
      issues.push({ type: 'js_spa_meta_risk', message: 'Client-side SPA — verify title, description and robots meta are set on every route', severity: 'warning' });
    }
  }

  // ── 4. JS-navigation links (href="#" used as buttons) ─────────────────────
  var anchors = document.querySelectorAll('a');
  var deadLinks = Array.prototype.filter.call(anchors, function(a) {
    var href = a.getAttribute('href') || '';
    return href === '#' || href.toLowerCase() === 'javascript:void(0)';
  });
  if (deadLinks.length > 5) {
    issues.push({
      type: 'js_dead_links',
      message: 'Links with non-crawlable href (' + deadLinks.length + ') — crawlers cannot follow them',
      severity: 'warning',
      detail: Array.prototype.slice.call(deadLinks, 0, 5).map(function(a) {
        return (a.textContent.trim() || '[no text]').slice(0, 60);
      }).join('\n')
    });
  } else if (deadLinks.length > 0) {
    issues.push({ type: 'js_dead_links', message: 'Links with non-crawlable href (' + deadLinks.length + ')', severity: 'notice' });
  }

  // ── 5. Hash-based routing ──────────────────────────────────────────────────
  var hashNavLinks = Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
    var href = a.getAttribute('href') || '';
    return href.length > 1 && href.charAt(0) === '#';
  });
  if (hashNavLinks.length > 10 && isSPA) {
    issues.push({ type: 'js_hash_routing', message: 'Hash-based navigation detected (' + hashNavLinks.length + ' #links) — content behind hash fragments may not be indexed', severity: 'warning' });
  }

  // ── 6. data-nosnippet usage ────────────────────────────────────────────────
  var nosnippetEls = document.querySelectorAll('[data-nosnippet]');
  if (nosnippetEls.length > 0) {
    var samples = Array.prototype.slice.call(nosnippetEls, 0, 3).map(function(el) {
      return (el.textContent.trim() || '[empty]').slice(0, 60);
    });
    var firstNosnippet = nosnippetEls[0];
    var bodyText = '';
    var nosnippetPos = -1;
    if (document.body && firstNosnippet) {
      var bodyChildren = document.body.childNodes;
      for (var bi = 0; bi < bodyChildren.length; bi++) {
        var node = bodyChildren[bi];
        var nodeText = node.textContent ? node.textContent : node.nodeValue || '';
        if (node === firstNosnippet || firstNosnippet.contains(node)) {
          nosnippetPos = bodyText.length;
          break;
        }
        bodyText += (nodeText || '') + ' ';
      }
    }
    var nosnippetMsg = 'data-nosnippet on ' + nosnippetEls.length + ' element' + (nosnippetEls.length > 1 ? 's' : '') + ' — excluded from Google snippets';
    if (nosnippetPos !== -1 && nosnippetPos < 3000) {
      nosnippetMsg += ' (starts at char ' + nosnippetPos + ' — within Google\'s 3000-char limit)';
    }
    issues.push({
      type: 'js_nosnippet',
      message: nosnippetMsg,
      severity: 'notice',
      detail: samples.join('\n')
    });
  }

  // ── 7. Large inline JSON data blobs ───────────────────────────────────────
  var inlineScripts = document.querySelectorAll('script:not([src])');
  var blobs = [];
  Array.prototype.forEach.call(inlineScripts, function(s) {
    var content = s.textContent || '';
    var id = s.id || s.getAttribute('type') || '';
    var firstChar = content.trimLeft().charAt(0);
    if ((firstChar === '{' || firstChar === '[') && content.length > 50000) {
      blobs.push((id || 'inline') + ': ' + Math.round(content.length / 1024) + ' KB');
    }
  });
  if (blobs.length > 0) {
    issues.push({
      type: 'js_large_inline_data',
      message: 'Large inline JSON data blob' + (blobs.length > 1 ? 's' : '') + ' — inflates initial HTML payload',
      severity: 'notice',
      detail: blobs.join('\n')
    });
  }

  // ── 8. Inline scripts in <head> total size ────────────────────────────────
  var headInlineSize = 0;
  Array.prototype.forEach.call(document.querySelectorAll('head script:not([src])'), function(s) {
    headInlineSize += (s.textContent || '').length;
  });
  if (headInlineSize > 150000) {
    issues.push({
      type: 'js_large_head_scripts',
      message: 'Inline scripts in <head>: ' + Math.round(headInlineSize / 1024) + ' KB — delays HTML parsing',
      severity: 'notice'
    });
  }

  // ── 9. Next.js large __NEXT_DATA__ ────────────────────────────────────────
  if (window.__NEXT_DATA__) {
    try {
      var nextDataEl = document.getElementById('__NEXT_DATA__');
      if (nextDataEl) {
        var nextDataSize = (nextDataEl.textContent || '').length;
        if (nextDataSize > 100000) {
          issues.push({
            type: 'js_next_data_large',
            message: '__NEXT_DATA__ is ' + Math.round(nextDataSize / 1024) + ' KB — large initial payload slows hydration',
            severity: 'warning'
          });
        } else {
          issues.push({
            type: 'js_next_data_ok',
            message: '__NEXT_DATA__: ' + Math.round(nextDataSize / 1024) + ' KB',
            severity: 'info'
          });
        }
      }
    } catch(e) {}
  }

  // ── 10. <base> tag check ──────────────────────────────────────────────────
  var baseTag = document.querySelector('base[href]');
  if (baseTag) {
    var baseHref = baseTag.getAttribute('href') || '';
    issues.push({
      type: 'js_base_tag',
      message: '<base href="' + baseHref + '"> — affects all relative URLs, may impact crawler link resolution',
      severity: 'notice'
    });
  }

  // ── 11. Service Worker detection ──────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    try {
      // Check if SW is registered by looking for common patterns
      var swRegistered = false;
      if (navigator.serviceWorker.controller) {
        swRegistered = true;
      }
      // Also check for SW registration scripts
      var swScripts = document.querySelectorAll('script');
      Array.prototype.forEach.call(swScripts, function(s) {
        var txt = s.textContent || '';
        if (txt.indexOf('navigator.serviceWorker.register') !== -1) {
          swRegistered = true;
        }
      });
      if (swRegistered) {
        issues.push({
          type: 'js_service_worker',
          message: 'Service Worker detected — may intercept requests and affect crawler behavior',
          severity: 'notice'
        });
      }
    } catch(e) {}
  }

  // ── 12. Hidden content (display:none / visibility:hidden blocks) ──────────
  var hiddenBlocks = Array.prototype.filter.call(
    document.querySelectorAll('div, section, article, main'),
    function(el) {
      try {
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') {
          var text = (el.textContent || '').trim();
          return text.length > 200; // Only flag substantial hidden content
        }
      } catch(e) {}
      return false;
    }
  );
  if (hiddenBlocks.length > 0) {
    issues.push({
      type: 'js_hidden_content',
      message: hiddenBlocks.length + ' large hidden content block' + (hiddenBlocks.length > 1 ? 's' : '') + ' (display:none/visibility:hidden) — possible cloaking risk',
      severity: 'warning'
    });
  }

  // ── 13. Dynamic title/description mismatch ────────────────────────────────
  var domTitleEl = document.querySelector('title');
  var domTitleText = domTitleEl ? (domTitleEl.textContent || '').trim() : '';
  var jsTitle = document.title ? document.title.trim() : '';
  if (domTitleText && jsTitle && domTitleText !== jsTitle) {
    issues.push({
      type: 'js_title_mismatch',
      message: 'Title changed by JS — bots without JS see: "' + domTitleText.slice(0, 80) + '"',
      severity: 'warning'
    });
  }

  // ── 14. History API usage (SPA routing indicator) ─────────────────────────
  var usesHistoryApi = false;
  var allScripts = document.querySelectorAll('script');
  Array.prototype.forEach.call(allScripts, function(s) {
    var txt = s.textContent || '';
    if (txt.indexOf('history.pushState') !== -1 || txt.indexOf('history.replaceState') !== -1) {
      usesHistoryApi = true;
    }
  });
  if (usesHistoryApi && isSPA) {
    issues.push({
      type: 'js_history_api',
      message: 'History API (pushState/replaceState) used — ensure each route renders unique title/meta for crawlers',
      severity: 'notice'
    });
  }

  // ── 15. Inline event handlers ──────────────────────────────────────────────
  var inlineHandlers = document.querySelectorAll('[onclick], [onload], [onerror], [onmouseover], [onfocus], [onblur]');
  if (inlineHandlers.length > 10) {
    issues.push({
      type: 'js_inline_handlers',
      message: inlineHandlers.length + ' inline event handlers — slows HTML parsing and couples markup with behavior',
      severity: 'notice'
    });
  } else if (inlineHandlers.length > 0) {
    issues.push({
      type: 'js_inline_handlers',
      message: inlineHandlers.length + ' inline event handler' + (inlineHandlers.length > 1 ? 's' : '') + ' found',
      severity: 'info'
    });
  }

  return { id: 'js_seo', name: 'JS SEO', issues: issues };
}
