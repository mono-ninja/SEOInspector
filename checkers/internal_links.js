function runInternalLinksChecker(p) {
  var issues = [];
  var params = p || {};
  var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
  var currentPath = window.location.pathname;
  var currentSearch = window.location.search;

  var allAnchors = Array.prototype.slice.call(document.querySelectorAll('a[href]'));
  var internalLinks = [];
  var externalCount = 0;
  var fragmentOnlyCount = 0;

  allAnchors.forEach(function(a) {
    var href = (a.getAttribute('href') || '').trim();
    if (!href || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 || href.indexOf('javascript:') === 0) return;
    if (href.charAt(0) === '#') { fragmentOnlyCount++; return; }
    try {
      var url = new URL(href, window.location.href);
      var host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (host === currentHost || !host) {
        internalLinks.push({ el: a, url: url, path: url.pathname });
      } else {
        externalCount++;
      }
    } catch(e) {}
  });

  var destCount = {};
  internalLinks.forEach(function(l) {
    var key = l.path + (l.url.search || '');
    destCount[key] = (destCount[key] || 0) + 1;
  });
  var uniqueCount = Object.keys(destCount).length;

  issues.push({
    type: 'internal_links_overview',
    message: 'Internal links: ' + internalLinks.length + ' (unique: ' + uniqueCount + ')',
    severity: 'info',
    detail: [
      'Internal           ' + internalLinks.length,
      'Unique URLs        ' + uniqueCount,
      'External           ' + externalCount,
      'Fragment only (#)  ' + fragmentOnlyCount,
    ].join('\n')
  });

  // Too few internal links — include 0 case (not just > 0)
  var minInternal = params.min_internal_links || 3;
  if (internalLinks.length < minInternal) {
    issues.push({
      type: 'few_internal_links',
      message: 'Too few internal links (' + internalLinks.length + ' of recommended ' + minInternal + ')',
      severity: 'warning',
      detail: 'Internal links pass PageRank and help crawlers navigate the site.'
    });
  }

  // Internal links with rel="nofollow" — show anchor text for context
  var internalNofollow = internalLinks.filter(function(l) {
    var rel = (l.el.getAttribute('rel') || '').toLowerCase();
    return rel.indexOf('nofollow') !== -1;
  });
  if (internalNofollow.length > 0) {
    issues.push({
      type: 'internal_nofollow',
      message: 'Internal links with rel="nofollow" (' + internalNofollow.length + ') — block PageRank',
      severity: 'warning',
      detail: internalNofollow.slice(0, 5).map(function(l) {
        var text = (l.el.textContent || '').replace(/\s+/g, ' ').trim();
        return (text ? '"' + text + '" → ' : '') + l.path;
      }).join('\n')
    });
  }

  // Links to deeply nested pages
  var maxDepth = params.max_url_depth || 4;
  var deepLinks = internalLinks.filter(function(l) {
    return l.path.split('/').filter(function(s) { return s.length > 0; }).length > maxDepth;
  });
  if (deepLinks.length > 0) {
    issues.push({
      type: 'deep_internal_links',
      message: 'Links to pages deeper than ' + maxDepth + ' levels (' + deepLinks.length + ')',
      severity: 'notice',
      detail: deepLinks.slice(0, 5).map(function(l) { return l.path; }).join('\n')
    });
  }

  // Generic / non-descriptive anchor text — normalize whitespace before matching
  var genericSet = {
    'тут':1, 'тут.':1, 'тут!':1, 'тут…':1,
    'тиснути тут':1, 'натисніть тут':1, 'клікніть тут':1,
    'детальніше':1, 'більше':1, 'докладніше':1, 'дізнатися більше':1,
    'ще':1, 'далі':1, 'читати далі':1, 'перейти':1, 'дивитись':1, 'переглянути':1,
    'here':1, 'click here':1, 'read more':1, 'more':1, 'learn more':1,
    'details':1, 'info':1, 'link':1, 'this':1, 'continue':1,
    'find out more':1, 'view more':1, 'see more':1
  };
  var genericAnchors = internalLinks.filter(function(l) {
    var text = (l.el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return !!genericSet[text];
  });
  if (genericAnchors.length > 0) {
    issues.push({
      type: 'generic_internal_anchor',
      message: 'Internal links with generic anchor text (' + genericAnchors.length + ')',
      severity: 'notice',
      detail: genericAnchors.slice(0, 5).map(function(l) {
        return '"' + (l.el.textContent || '').replace(/\s+/g, ' ').trim() + '" → ' + l.path;
      }).join('\n')
    });
  }

  // Too many links to the same page
  var duplicates = Object.keys(destCount).filter(function(k) { return destCount[k] >= 4; });
  if (duplicates.length > 0) {
    issues.push({
      type: 'duplicate_internal_links',
      message: 'URLs with 4+ links pointing to the same page (' + duplicates.length + ')',
      severity: 'notice',
      detail: duplicates.slice(0, 5).map(function(k) { return k + ' \xd7 ' + destCount[k]; }).join('\n')
    });
  }

  // Self-referencing links (page linking to itself)
  var selfLinks = internalLinks.filter(function(l) {
    return l.path === currentPath && (l.url.search || '') === currentSearch;
  });
  if (selfLinks.length > 0) {
    issues.push({
      type: 'self_referencing_links',
      message: 'Links pointing to the current page (' + selfLinks.length + ')',
      severity: 'notice',
      detail: selfLinks.slice(0, 5).map(function(l) {
        var text = (l.el.textContent || '').replace(/\s+/g, ' ').trim();
        return (text ? '"' + text + '" → ' : '') + l.path;
      }).join('\n')
    });
  }

  // Internal target="_blank" without rel="noopener"
  var blankNoOpener = internalLinks.filter(function(l) {
    return (l.el.getAttribute('target') || '') === '_blank' &&
           (l.el.getAttribute('rel') || '').toLowerCase().indexOf('noopener') === -1;
  });
  if (blankNoOpener.length > 0) {
    issues.push({
      type: 'internal_blank_no_opener',
      message: 'Internal links with target="_blank" missing rel="noopener" (' + blankNoOpener.length + ')',
      severity: 'notice',
      detail: blankNoOpener.slice(0, 5).map(function(l) { return l.path; }).join('\n')
    });
  }

  // Missing <nav> landmark
  if (!document.querySelector('nav, [role="navigation"]')) {
    issues.push({
      type: 'no_nav_element',
      message: 'Missing semantic <nav> element or role="navigation"',
      severity: 'notice',
      detail: 'The <nav> element helps crawlers and screen readers identify navigation.'
    });
  }

  // Missing <main> landmark
  if (!document.querySelector('main, [role="main"]')) {
    issues.push({
      type: 'no_main_element',
      message: 'Missing semantic <main> element or role="main"',
      severity: 'notice',
      detail: 'The <main> element identifies the primary content area for crawlers and assistive technology.'
    });
  }

  return { id: 'internal_links', name: 'Internal links', issues: issues };
}
