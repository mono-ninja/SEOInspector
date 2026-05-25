function runLinksChecker(p) {
  var issues = [];
  var params = p || {};
  var maxLinks = params.max_links || 150;
  var maxNofollowPct = params.max_nofollow_pct || 30;
  var maxExternal = params.max_external_links !== undefined ? params.max_external_links : 100;

  var anchors = document.querySelectorAll('a[href]');
  var anchorList = Array.prototype.slice.call(anchors);
  var totalLinks = anchorList.length;

  // ── Collect link data ────────────────────────────────────────────────────
  var _currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
  var _internal = 0, _external = 0;
  var nofollowCount = 0;
  var validLinks = 0;

  anchorList.forEach(function(a) {
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;
    try {
      var u = new URL(href, window.location.href);
      var h = u.hostname.toLowerCase().replace(/^www\./, '');
      if (h === _currentHost) _internal++; else if (h) _external++;
    } catch(e) {}
  });
  validLinks = _internal + _external;

  // Too many links
  if (totalLinks > maxLinks) {
    issues.push({ type: 'too_many_links', message: 'Too many links on the page (' + totalLinks + ')', severity: 'notice', detail: 'Recommended no more than ' + maxLinks + ' links.' });
  }

  // Info: links overview
  issues.push({
    type: 'links_overview',
    message: 'Links overview (' + totalLinks + ')',
    severity: 'info',
    detail: [
      'Total links  ' + totalLinks,
      'Internal     ' + _internal,
      'External     ' + _external,
    ].join('\n')
  });

  // ── Generic anchor texts (expanded set with Ukrainian) ───────────────────
  var genericSet = {
    'тут':1, 'тут.':1, 'тут!':1, 'тут…':1,
    'тиснути тут':1, 'натисніть тут':1, 'клікніть тут':1,
    'детальніше':1, 'більше':1, 'докладніше':1, 'дізнатися більше':1,
    'ще':1, 'далі':1, 'читати далі':1, 'перейти':1, 'дивитись':1, 'переглянути':1,
    'here':1, 'click here':1, 'read more':1, 'more':1, 'learn more':1,
    'details':1, 'info':1, 'link':1, 'this':1, 'continue':1,
    'find out more':1, 'view more':1, 'see more':1
  };
  var genericLinks = [];

  // Empty anchor text check
  var emptyAnchors = [];

  // HTTP on HTTPS page
  var isHttps = window.location.protocol === 'https:';
  var httpLinksCount = 0;
  var httpLinksList = [];

  // Nofollow count (only on valid crawlable links)
  anchorList.forEach(function(a) {
    var href = a.getAttribute('href') || '';
    var text = (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    var rel = (a.getAttribute('rel') || '').toLowerCase();
    var ariaLabel = (a.getAttribute('aria-label') || '').trim();

    // Empty anchor text: no text, no img with alt, no aria-label, no svg title
    if (text === '' && !ariaLabel && !a.querySelector('img[alt]:not([alt=""])') && !a.querySelector('svg title')) {
      emptyAnchors.push(href);
    }

    // HTTP links on HTTPS page
    if (isHttps && href.indexOf('http://') === 0) {
      httpLinksCount++;
      httpLinksList.push(href.length > 100 ? href.substring(0, 100) + '…' : href);
    }

    // Nofollow (only on real crawlable links)
    if (href && href.charAt(0) !== '#' && href.indexOf('mailto:') !== 0 && href.indexOf('tel:') !== 0 && rel.indexOf('nofollow') !== -1) {
      nofollowCount++;
    }

    // Generic anchor text
    if (genericSet[text]) {
      genericLinks.push({ text: (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim(), href: href });
    }
  });

  if (emptyAnchors.length > 0) {
    issues.push({
      type: 'empty_anchor_text',
      message: 'Links without text or image (' + emptyAnchors.length + ')',
      severity: 'notice',
      detail: emptyAnchors.slice(0, 5).join('\n') + (emptyAnchors.length > 5 ? '\n...and ' + (emptyAnchors.length - 5) + ' more' : ''),
      highlight: true
    });
  }

  if (httpLinksCount > 0) {
    issues.push({
      type: 'http_links_on_https',
      message: 'HTTP links on an HTTPS page (' + httpLinksCount + ')',
      severity: 'notice',
      detail: httpLinksList.slice(0, 5).join('\n') + (httpLinksList.length > 5 ? '\n...and ' + (httpLinksList.length - 5) + ' more' : ''),
      highlight: true
    });
  }

  // Nofollow ratio check (from valid crawlable links only)
  var maxNofollowRatio = maxNofollowPct / 100;
  if (validLinks > 0 && nofollowCount / validLinks > maxNofollowRatio) {
    issues.push({
      type: 'too_many_nofollow',
      message: 'Too many links with nofollow attribute (' + nofollowCount + ' of ' + validLinks + ')',
      severity: 'notice',
      detail: Math.round(nofollowCount / validLinks * 100) + '% of crawlable links have nofollow.',
      highlight: true
    });
  }

  if (genericLinks.length > 0) {
    issues.push({
      type: 'generic_anchor_text',
      message: 'Links with non-descriptive anchor text (' + genericLinks.length + ')',
      severity: 'warning',
      detail: genericLinks.map(function(l) { return '"' + l.text + '" → ' + l.href; }).slice(0, 10).join('\n'),
      highlight: true
    });
  }

  // External links count
  if (_external > maxExternal) {
    issues.push({ type: 'too_many_external_links', message: 'Too many external links (' + _external + ')', severity: 'notice', detail: 'Recommended no more than ' + maxExternal + ' external links per page.' });
  }

  // No internal links (only flag if there are valid crawlable links at all)
  if (_internal === 0 && validLinks > 0) {
    issues.push({ type: 'no_internal_links', message: 'No internal links on the page', severity: 'warning' });
  }

  // ── Invalid / dangerous hrefs ────────────────────────────────────────────
  var invalidHrefs = [];
  var whitespaceHrefs = [];
  var localfileHrefs = [];
  var localhostHrefs = [];
  var badTelMailto = [];
  var brokenFragments = [];
  var onclickNav = [];

  anchorList.forEach(function(a) {
    var href = (a.getAttribute('href') || '');

    // Whitespace in href
    if (/^\s|\s$/.test(href) || /\s/.test(href.split('?')[0])) {
      whitespaceHrefs.push(href.trim() || '(whitespace)');
    }

    // file:// links
    if (href.indexOf('file://') === 0) {
      localfileHrefs.push(href);
    }

    // localhost / 127.0.0.1
    if (/(?:localhost|127\.0\.0\.1)(?:[:/]|$)/.test(href)) {
      localhostHrefs.push(href);
    }

    // javascript: hrefs
    if (/^javascript:/i.test(href.trim())) {
      invalidHrefs.push(href.trim().substring(0, 60));
    }

    // tel: / mailto: format validation
    if (/^tel:/i.test(href)) {
      var tel = href.replace(/^tel:/i, '');
      if (!/^\+?[\d\s\-().]+$/.test(tel)) {
        badTelMailto.push(href);
      }
    }
    if (/^mailto:/i.test(href)) {
      var mail = href.replace(/^mailto:/i, '').split('?')[0];
      if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        badTelMailto.push(href);
      }
    }

    // Broken fragment: href="#something" where no element with that id exists
    if (href.charAt(0) === '#' && href.length > 1) {
      var fragId = href.substring(1);
      if (!document.getElementById(fragId) && !document.querySelector('[name="' + fragId.replace(/["\\]/g, '\\$&').replace(/\[/g, '\\[').replace(/\]/g, '\\]') + '"]')) {
        brokenFragments.push(href);
      }
    }
  });

  // onclick-based navigation (elements that navigate but aren't <a>)
  var onclickEls = Array.prototype.slice.call(document.querySelectorAll('[onclick]'));
  onclickEls.forEach(function(el) {
    var oc = (el.getAttribute('onclick') || '');
    if ((/location(?:\.href\s*=|\.assign|\.replace)/.test(oc) || /window\.open\(/.test(oc)) && el.tagName !== 'A') {
      onclickNav.push('<' + el.tagName.toLowerCase() + '> onclick="' + oc.substring(0, 50) + '"');
    }
  });

  if (invalidHrefs.length > 0) {
    issues.push({ type: 'invalid_href', message: 'Links with href="javascript:..." (' + invalidHrefs.length + ')', severity: 'notice', detail: invalidHrefs.slice(0, 5).join('\n'), highlight: true });
  }
  if (whitespaceHrefs.length > 0) {
    issues.push({ type: 'whitespace_href', message: 'Links with whitespace in href (' + whitespaceHrefs.length + ')', severity: 'notice', detail: whitespaceHrefs.slice(0, 5).join('\n'), highlight: true });
  }
  if (localfileHrefs.length > 0) {
    issues.push({ type: 'local_file_href', message: 'Links to local files file:// (' + localfileHrefs.length + ')', severity: 'warning', detail: localfileHrefs.slice(0, 3).join('\n'), highlight: true });
  }
  if (localhostHrefs.length > 0) {
    issues.push({ type: 'localhost_href', message: 'Links to localhost or 127.0.0.1 (' + localhostHrefs.length + ')', severity: 'warning', detail: localhostHrefs.slice(0, 3).join('\n'), highlight: true });
  }
  if (badTelMailto.length > 0) {
    issues.push({ type: 'invalid_tel_mailto', message: 'Invalid tel: or mailto: link format (' + badTelMailto.length + ')', severity: 'notice', detail: badTelMailto.slice(0, 5).join('\n'), highlight: true });
  }
  if (brokenFragments.length > 0) {
    issues.push({ type: 'broken_fragment', message: 'Anchor links (#…) with no matching id on the page (' + brokenFragments.length + ')', severity: 'notice', detail: brokenFragments.slice(0, 5).join('\n'), highlight: true });
  }
  if (onclickNav.length > 0) {
    issues.push({ type: 'onclick_navigation', message: 'Navigation via onclick instead of <a> tag (' + onclickNav.length + ')', severity: 'notice', detail: onclickNav.slice(0, 5).join('\n'), highlight: true });
  }

  return { id: 'links', name: 'Links', issues: issues };
}
