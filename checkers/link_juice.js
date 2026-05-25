function runLinkJuiceChecker(p) {
  var issues = [];
  var params = p || {};

  var maxExternalWithoutNofollow = params.max_external_links_without_nofollow !== undefined ? params.max_external_links_without_nofollow : 10;
  var maxFooterLinks = params.max_footer_links !== undefined ? params.max_footer_links : 20;

  var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
  var allAnchors = Array.prototype.slice.call(document.querySelectorAll('a[href]'));

  // ── Collect link data ────────────────────────────────────────────────────
  var internalTotal = 0;
  var internalNofollow = 0;
  var externalTotal = 0;
  var externalNofollow = 0;
  var externalSponsored = 0;
  var externalUgc = 0;
  var externalBlankNoOpener = 0;
  var internalBlankNoOpener = 0;

  // Zone distribution for internal links
  var zoneInternal = { header: 0, nav: 0, main: 0, footer: 0, aside: 0, other: 0 };

  // Anchor text tracking
  var anchorTextMap = {};
  var internalEmptyAnchor = [];
  var jsOnlyLinks = [];
  var hiddenLinks = [];
  var externalWithoutNofollow = [];

  allAnchors.forEach(function(a) {
    var href = (a.getAttribute('href') || '').trim();
    if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 || href.indexOf('javascript:') === 0) return;

    var rel = (a.getAttribute('rel') || '').toLowerCase();
    var isNofollow = rel.indexOf('nofollow') !== -1;
    var isSponsored = rel.indexOf('sponsored') !== -1;
    var isUgc = rel.indexOf('ugc') !== -1;
    var isBlank = a.target === '_blank';
    var hasOpener = rel.indexOf('noopener') !== -1 || rel.indexOf('noreferrer') !== -1;

    try {
      var url = new URL(href, window.location.href);
      var host = url.hostname.toLowerCase().replace(/^www\./, '');

      if (host === currentHost || !host) {
        internalTotal++;
        if (isNofollow) internalNofollow++;
        if (isBlank && !hasOpener) internalBlankNoOpener++;

        // Zone detection
        var zone = getZone(a);
        zoneInternal[zone]++;

        // Anchor text tracking
        var text = (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        var key = text || '(empty)';
        if (!anchorTextMap[key]) anchorTextMap[key] = [];
        anchorTextMap[key].push(url.pathname + url.search);

        // Empty anchor text
        if (!text && !a.querySelector('img[alt]:not([alt=""])') && !(a.getAttribute('aria-label') || '').trim() && !a.querySelector('svg title')) {
          internalEmptyAnchor.push(a);
        }

        // Hidden links
        try {
          var cs = window.getComputedStyle(a);
          if (cs.display === 'none' || cs.visibility === 'hidden' || (cs.opacity === '0' && !a.querySelector('img'))) {
            hiddenLinks.push(a);
          }
        } catch(e) {}

      } else {
        externalTotal++;
        if (isNofollow) externalNofollow++;
        if (isSponsored) externalSponsored++;
        if (isUgc) externalUgc++;
        if (isBlank && !hasOpener) externalBlankNoOpener++;

        // External without any rel deterrent
        if (!isNofollow && !isSponsored && !isUgc) {
          var displayHref = href.length > 100 ? href.substring(0, 100) + '…' : href;
          externalWithoutNofollow.push(displayHref);
        }
      }
    } catch(e) {}
  });

  // ── JS-only links (href="#" or javascript: with onclick) ─────────────────
  Array.prototype.slice.call(document.querySelectorAll('a')).forEach(function(a) {
    var href = (a.getAttribute('href') || '').trim();
    if (href === '#' || href === 'javascript:void(0)' || href === 'javascript:;') {
      if (a.hasAttribute('onclick') || a.getAttribute('role') === 'button') {
        jsOnlyLinks.push(a);
      }
    }
  });

  // ── Overview ─────────────────────────────────────────────────────────────
  var internalNofollowPct = internalTotal > 0 ? Math.round(internalNofollow / internalTotal * 100) : 0;
  var externalNofollowPct = externalTotal > 0 ? Math.round(externalNofollow / externalTotal * 100) : 0;

  issues.push({
    type: 'link_juice_overview',
    message: 'Link equity overview',
    severity: 'info',
    detail: [
      'Internal links: ' + internalTotal + ' (nofollow: ' + internalNofollow + ' / ' + internalNofollowPct + '%)',
      'External links: ' + externalTotal + ' (nofollow: ' + externalNofollow + ' / ' + externalNofollowPct + '%)',
      'External sponsored: ' + externalSponsored,
      'External UGC: ' + externalUgc,
      'Zone distribution (internal):',
      '  &lt;main&gt;  ' + zoneInternal.main,
      '  &lt;nav&gt;   ' + zoneInternal.nav,
      '  &lt;header&gt; ' + zoneInternal.header,
      '  &lt;footer&gt; ' + zoneInternal.footer,
      '  &lt;aside&gt;  ' + zoneInternal.aside,
      '  other     ' + zoneInternal.other,
    ].join('\n')
  });

  // ── Checks ───────────────────────────────────────────────────────────────

  // Internal nofollow too high
  if (internalTotal > 0 && internalNofollow / internalTotal > 0.3) {
    issues.push({
      type: 'link_juice_internal_nofollow_high',
      message: 'Over 30% of internal links use nofollow — link equity is being blocked',
      severity: 'critical',
      detail: internalNofollow + ' of ' + internalTotal + ' internal links have rel="nofollow". Only use nofollow on internal links you truly want search engines to ignore.'
    });
  }

  // External links without nofollow
  if (externalWithoutNofollow.length > maxExternalWithoutNofollow) {
    issues.push({
      type: 'link_juice_external_no_nofollow',
      message: externalWithoutNofollow.length + ' external links without nofollow — potential link equity leak',
      severity: 'notice',
      detail: 'Each outbound link without nofollow passes some PageRank. Consider adding rel="nofollow" or rel="ugc" to non-editorial links.' +
        '\n\nFirst 5:\n' + externalWithoutNofollow.slice(0, 5).join('\n') +
        (externalWithoutNofollow.length > 5 ? '\n… and ' + (externalWithoutNofollow.length - 5) + ' more' : ''),
      highlight: true
    });
  }

  // Footer has too many internal links (link farm signal)
  if (zoneInternal.footer > maxFooterLinks) {
    issues.push({
      type: 'link_juice_footer_heavy',
      message: 'Footer contains ' + zoneInternal.footer + ' internal links — possible link farm signal',
      severity: 'warning',
      detail: 'Excessive links in the footer carry less SEO value and may be flagged as manipulative. Keep footer links minimal and relevant.',
      highlight: true
    });
  }

  // Content area has very few links
  if (internalTotal > 5 && zoneInternal.main < internalTotal * 0.1) {
    issues.push({
      type: 'link_juice_content_light',
      message: 'Only ' + zoneInternal.main + ' internal links in &lt;main&gt; — content area is underlinked',
      severity: 'warning',
      detail: 'Links within the main content carry the most link equity. Consider adding contextual internal links to important pages.'
    });
  }

  // Same anchor text pointing to different URLs
  var ambiguousAnchors = [];
  var anchorKeys = Object.keys(anchorTextMap);
  anchorKeys.forEach(function(key) {
    if (key === '(empty)') return;
    var urls = anchorTextMap[key];
    var unique = {};
    urls.forEach(function(u) { unique[u] = true; });
    if (Object.keys(unique).length > 1) {
      ambiguousAnchors.push({ text: key, urls: Object.keys(unique) });
    }
  });
  if (ambiguousAnchors.length > 0) {
    issues.push({
      type: 'link_juice_ambiguous_anchor',
      message: ambiguousAnchors.length + ' anchor texts point to multiple different URLs',
      severity: 'notice',
      detail: 'Same anchor text linking to different pages confuses crawlers about page relevance.' +
        '\n\nExamples:\n' + ambiguousAnchors.slice(0, 5).map(function(a) {
          return '"' + a.text + '" → ' + a.urls.slice(0, 3).join(', ') + (a.urls.length > 3 ? ' +' + (a.urls.length - 3) : '');
        }).join('\n'),
      highlight: true
    });
  }

  // Internal links with empty anchor text
  if (internalEmptyAnchor.length > 0) {
    issues.push({
      type: 'link_juice_empty_anchor',
      message: internalEmptyAnchor.length + ' internal links have no accessible anchor text',
      severity: 'warning',
      detail: 'Links without descriptive anchor text pass less contextual relevance signal to crawlers.' +
        '\n\nFirst 5:\n' + internalEmptyAnchor.slice(0, 5).map(function(a) {
          return a.getAttribute('href');
        }).join('\n') + (internalEmptyAnchor.length > 5 ? '\n… and ' + (internalEmptyAnchor.length - 5) + ' more' : ''),
      highlight: true
    });
  }

  // JS-only links (bots can't follow)
  if (jsOnlyLinks.length > 0) {
    issues.push({
      type: 'link_juice_js_only',
      message: jsOnlyLinks.length + ' JS-only links (href="#" + onclick) — not crawlable',
      severity: 'warning',
      detail: 'Links that rely on JavaScript onclick handlers are invisible to search crawlers. Use real href URLs with progressive enhancement.',
      highlight: true
    });
  }

  // Hidden links that still pass link juice
  if (hiddenLinks.length > 0) {
    issues.push({
      type: 'link_juice_hidden',
      message: hiddenLinks.length + ' hidden internal links — may pass link equity invisibly',
      severity: 'notice',
      detail: 'Links that are visually hidden (display:none, visibility:hidden, opacity:0) may still pass PageRank but can be flagged as manipulative.',
      highlight: true
    });
  }

  // Internal _blank without noopener
  if (internalBlankNoOpener > 0) {
    issues.push({
      type: 'link_juice_internal_blank_noopener',
      message: internalBlankNoOpener + ' internal links with target="_blank" missing rel="noopener"',
      severity: 'notice',
      detail: 'Links with target="_blank" without noopener are vulnerable to reverse tabnabbing attacks.',
      highlight: true
    });
  }

  // External _blank without noopener
  if (externalBlankNoOpener > 0) {
    issues.push({
      type: 'link_juice_external_blank_noopener',
      message: externalBlankNoOpener + ' external links with target="_blank" missing rel="noopener"',
      severity: 'warning',
      detail: 'Links with target="_blank" without noopener are vulnerable to reverse tabnabbing.',
      highlight: true
    });
  }

  // Sponsored / UGC summary
  if (externalSponsored > 0) {
    issues.push({
      type: 'link_juice_sponsored',
      message: externalSponsored + ' external links marked as sponsored',
      severity: 'info'
    });
  }

  if (externalUgc > 0) {
    issues.push({
      type: 'link_juice_ugc',
      message: externalUgc + ' external links marked as UGC',
      severity: 'info'
    });
  }

  return { id: 'link_juice', name: 'Link Equity', issues: issues };
}

function getZone(el) {
  var p = el;
  while (p && p !== document.body && p !== document.documentElement) {
    var tag = p.tagName.toLowerCase();
    var role = (p.getAttribute('role') || '').toLowerCase();
    if (tag === 'main' || role === 'main') return 'main';
    if (tag === 'nav' || role === 'navigation') return 'nav';
    if (tag === 'header' || role === 'banner') return 'header';
    if (tag === 'footer' || role === 'contentinfo') return 'footer';
    if (tag === 'aside' || role === 'complementary') return 'aside';
    p = p.parentElement;
  }
  return 'other';
}
