function runExternalLinksChecker(p) {
  var issues = [];
  var params = p || {};

  var maxNofollowPct = params.max_nofollow_pct !== undefined ? params.max_nofollow_pct : 30;
  var maxExternal = params.max_external_links !== undefined ? params.max_external_links : 100;

  var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
  var anchors = Array.prototype.slice.call(document.querySelectorAll('a[href]'));
  var isHttps = window.location.protocol === 'https:';

  var externalCount = 0;
  var blankAll = 0;
  var noFollowMissing = [];
  var blankNoOpener = [];
  var doubleSlash = [];
  var httpLinks = [];
  var emptyAnchor = [];

  anchors.forEach(function(a) {
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' ||
        href.indexOf('mailto:') === 0 ||
        href.indexOf('tel:') === 0 ||
        href.indexOf('javascript:') === 0) return;

    try {
      var url = new URL(href, window.location.href);
      if (!url.hostname) return;
      var host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (host === currentHost) return;

      externalCount++;

      var rel = (a.getAttribute('rel') || '').toLowerCase();

      // Nofollow / sponsored / ugc
      if (rel.indexOf('nofollow') === -1 && rel.indexOf('sponsored') === -1 && rel.indexOf('ugc') === -1) {
        noFollowMissing.push(href.length > 80 ? href.substring(0, 80) + '…' : href);
      }

      // target="_blank" — count all, then flag unsafe ones
      if ((a.getAttribute('target') || '') === '_blank') {
        blankAll++;
        if (rel.indexOf('noopener') === -1 && rel.indexOf('noreferrer') === -1) {
          blankNoOpener.push(href.length > 80 ? href.substring(0, 80) + '…' : href);
        }
      }

      // Double slash in path
      if (/[^:]\/\//.test(url.pathname)) {
        doubleSlash.push(href.length > 80 ? href.substring(0, 80) + '…' : href);
      }

      // HTTP link on HTTPS page
      if (isHttps && url.protocol === 'http:') {
        httpLinks.push(href.length > 80 ? href.substring(0, 80) + '…' : href);
      }

      // Empty anchor: no visible text, no img alt, no aria-label, no svg title
      var text = (a.innerText || a.textContent || '').trim();
      var img = a.querySelector('img');
      var hasImgAlt = img && (img.getAttribute('alt') || '').trim();
      var hasAriaLabel = (a.getAttribute('aria-label') || '').trim();
      var hasSvgTitle = a.querySelector('svg title');
      if (!text && !hasImgAlt && !hasAriaLabel && !hasSvgTitle) {
        emptyAnchor.push(href.length > 80 ? href.substring(0, 80) + '…' : href);
      }

    } catch(e) {}
  });

  var nofollowPct = externalCount > 0 ? Math.round(noFollowMissing.length / externalCount * 100) : 0;

  // ── Overview ─────────────────────────────────────────────────────────────
  issues.push({
    type: 'external_links_overview',
    message: 'External links — overview',
    severity: 'info',
    detail: [
      'Total external links    ' + externalCount,
      'Without nofollow        ' + (noFollowMissing.length > 0 ? noFollowMissing.length + ' (' + nofollowPct + '%)' : '—'),
      'target="_blank"         ' + (blankAll > 0 ? blankAll + (blankNoOpener.length > 0 ? ' (' + blankNoOpener.length + ' unsafe)' : '') : '—'),
      'HTTP links (on HTTPS)   ' + (httpLinks.length || '—'),
      'Double slash in path    ' + (doubleSlash.length || '—'),
      'Empty anchor text       ' + (emptyAnchor.length || '—'),
    ].join('\n')
  });

  // ── Checks ───────────────────────────────────────────────────────────────

  if (externalCount > maxExternal) {
    issues.push({
      type: 'too_many_external_links',
      message: 'Too many external links (' + externalCount + ', recommended max ' + maxExternal + ')',
      severity: 'notice',
      detail: 'A large number of external links dilutes PageRank and may look unnatural to crawlers.'
    });
  }

  if (noFollowMissing.length > 0) {
    issues.push({
      type: 'external_nofollow_missing',
      message: 'External links without rel="nofollow" (' + noFollowMissing.length + ' — ' + nofollowPct + '%)',
      severity: nofollowPct > maxNofollowPct ? 'warning' : 'notice',
      detail: noFollowMissing.slice(0, 5).join('\n') + (noFollowMissing.length > 5 ? '\n… and ' + (noFollowMissing.length - 5) + ' more' : ''),
      highlight: true
    });
  }

  if (blankNoOpener.length > 0) {
    issues.push({
      type: 'blank_no_opener',
      message: 'External links with target="_blank" missing rel="noopener noreferrer" (' + blankNoOpener.length + ')',
      severity: 'warning',
      detail: blankNoOpener.slice(0, 5).join('\n') + (blankNoOpener.length > 5 ? '\n… and ' + (blankNoOpener.length - 5) + ' more' : ''),
      highlight: true
    });
  }

  if (httpLinks.length > 0) {
    issues.push({
      type: 'external_http_link',
      message: 'External links using HTTP on an HTTPS page (' + httpLinks.length + ')',
      severity: 'notice',
      detail: httpLinks.slice(0, 5).join('\n') + (httpLinks.length > 5 ? '\n… and ' + (httpLinks.length - 5) + ' more' : ''),
      highlight: true
    });
  }

  if (doubleSlash.length > 0) {
    issues.push({
      type: 'url_duplicate_slash',
      message: 'URLs with a double slash in the path (' + doubleSlash.length + ')',
      severity: 'notice',
      detail: doubleSlash.slice(0, 5).join('\n') + (doubleSlash.length > 5 ? '\n… and ' + (doubleSlash.length - 5) + ' more' : '')
    });
  }

  if (emptyAnchor.length > 0) {
    issues.push({
      type: 'external_empty_anchor',
      message: 'External links with no accessible anchor text (' + emptyAnchor.length + ')',
      severity: 'warning',
      detail: emptyAnchor.slice(0, 5).join('\n') + (emptyAnchor.length > 5 ? '\n… and ' + (emptyAnchor.length - 5) + ' more' : ''),
      highlight: true
    });
  }

  return { id: 'external_links', name: 'External links', issues: issues };
}
