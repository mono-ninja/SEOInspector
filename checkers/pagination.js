function runPaginationChecker(p) {
  var issues = [];
  var url = window.location.href;
  var currentPath = window.location.pathname;

  // Detect pagination patterns in URL — covers major CMS frameworks
  var paginationPatterns = [
    /[?&]page=(\d+)/i,
    /[?&]p=(\d+)/i,
    /[?&]pg=(\d+)/i,
    /[?&]paged=(\d+)/i,
    /[?&]pg_no=(\d+)/i,
    /[?&]pageNum=(\d+)/i,
    /[?&]pagenumber=(\d+)/i,
    /[?&]offset=(\d+)/i,
    /[?&]start=(\d+)/i,
    /[?&]cursor=(\d+)/i,
    /\/page\/(\d+)/i,
    /\/page-(\d+)/i,
    /\/p\/(\d+)\//i,
    /\/p-(\d+)\//i,
  ];

  var pageNum = null;
  paginationPatterns.some(function(re) {
    var m = url.match(re);
    if (m) { pageNum = parseInt(m[1], 10); return true; }
    return false;
  });

  // rel="prev"/"next" in <head> (deprecated by Google in May 2019, still used by Bing)
  var prevLink = document.querySelector('link[rel="prev"]');
  var nextLink = document.querySelector('link[rel="next"]');
  var hasRelPrevNext = !!(prevLink || nextLink);

  // DOM pagination elements
  var paginationNavs = document.querySelectorAll('nav[aria-label*="Pagin"], nav[aria-label*="pagin"], nav.pagination, nav[role="navigation"].pagination, .pagination, .pager, [class*="pagination"], [class*="pager"]');
  var paginationLinks = [];
  var pageNumberLinks = [];
  Array.prototype.forEach.call(paginationNavs, function(nav) {
    var links = nav.querySelectorAll('a[href]');
    Array.prototype.forEach.call(links, function(a) {
      paginationLinks.push(a);
      var href = a.getAttribute('href') || '';
      var text = (a.textContent || '').trim();
      if (/^\d+$/.test(text) || href.match(/[?&]page=\d+/i) || href.match(/\/page\/\d+/i)) {
        pageNumberLinks.push(a);
      }
    });
  });

  // Also check for prev/next links in DOM (not in <head>)
  var domPrevLinks = document.querySelectorAll('a[rel="prev"], a[rel="previous"]');
  var domNextLinks = document.querySelectorAll('a[rel="next"], a[rel="following"]');

  // Infinite scroll detection
  var hasInfiniteScroll = false;
  var infiniteScrollHints = [];
  try {
    var bodyHtml = document.body.outerHTML;
    if (/intersectionobserver/i.test(bodyHtml)) infiniteScrollHints.push('IntersectionObserver');
    if (/infinite.scroll|infinitescroll/i.test(bodyHtml)) infiniteScrollHints.push('infinite-scroll class');
    if (/\.scroll\(/i.test(bodyHtml) && /load.more|append|fetch/i.test(bodyHtml)) infiniteScrollHints.push('scroll-based loading');
    var sentinelEls = document.querySelectorAll('[class*="sentinel"], [class*="infinite"], [class*="load-more-trigger"], [data-infinite-scroll]');
    if (sentinelEls.length > 0) infiniteScrollHints.push('sentinel element (' + sentinelEls.length + ')');
  } catch(e) {}
  if (infiniteScrollHints.length > 0) {
    hasInfiniteScroll = true;
  }

  // "Load more" button detection
  var loadMoreBtns = Array.prototype.filter.call(
    document.querySelectorAll('button, a[href="javascript:void(0)"], a[href="#"], [role="button"]'),
    function(el) {
      var text = (el.textContent || '').trim().toLowerCase();
      var cls = (el.className || '').toString().toLowerCase();
      return /load\s*more|show\s*more|view\s*more|more\s*items|more\s*posts|more\s*results|завантажити|показати|ще\s*результат/i.test(text) ||
             /load-more|show-more|more-items|more-posts|btn-more/i.test(cls);
    }
  );

  var isPaginated = pageNum !== null || hasRelPrevNext || paginationLinks.length > 0 || hasInfiniteScroll || loadMoreBtns.length > 0;

  if (!isPaginated) {
    return { id: 'pagination', name: 'Pagination', issues: [] };
  }

  // ── Overview ────────────────────────────────────────────────────────────────
  var paginationType = 'unknown';
  if (hasInfiniteScroll) paginationType = 'infinite scroll';
  else if (loadMoreBtns.length > 0) paginationType = 'load more';
  else if (pageNum !== null) paginationType = 'URL-based (page ' + pageNum + ')';
  else if (paginationLinks.length > 0) paginationType = 'DOM-based';
  else if (hasRelPrevNext) paginationType = 'rel=prev/next only';

  issues.push({
    type: 'pagination_overview',
    message: 'Pagination detected — ' + paginationType,
    severity: 'info',
    detail: [
      'Type              ' + paginationType,
      'Page number       ' + (pageNum !== null ? pageNum : 'not detected'),
      'URL               ' + url,
      'rel="prev"        ' + (prevLink ? prevLink.getAttribute('href') : 'missing'),
      'rel="next"        ' + (nextLink ? nextLink.getAttribute('href') : 'missing'),
      'DOM pagination    ' + (paginationLinks.length > 0 ? paginationLinks.length + ' links in ' + paginationNavs.length + ' container' + (paginationNavs.length !== 1 ? 's' : '') : 'not found'),
      'Page number links ' + pageNumberLinks.length,
      'Infinite scroll   ' + (hasInfiniteScroll ? 'yes (' + infiniteScrollHints.join(', ') + ')' : 'no'),
      'Load more button  ' + (loadMoreBtns.length > 0 ? 'yes (' + loadMoreBtns.length + ')' : 'no'),
      'Canonical         ' + (function() { var c = document.querySelector('link[rel="canonical"]'); return c ? c.getAttribute('href') : 'missing'; })(),
    ].join('\n')
  });

  // ── rel="prev"/"next" — deprecated by Google (May 2019) ────────────────────
  if (hasRelPrevNext) {
    issues.push({
      type: 'rel_prev_next_deprecated',
      message: 'rel="prev"/"next" are deprecated by Google (still used by Bing)',
      severity: 'notice',
      detail: 'Google removed support for rel="prev"/"next" in May 2019. They are still useful for Bing. Consider using a single canonical per paginated page instead.\n' +
        (prevLink ? 'prev: ' + prevLink.getAttribute('href') + '\n' : '') +
        (nextLink ? 'next: ' + nextLink.getAttribute('href') : '')
    });
  }

  // ── page=1 should redirect to base URL ──────────────────────────────────────
  if (pageNum === 1) {
    issues.push({
      type: 'pagination_page_one',
      message: 'URL contains page=1 — recommended 301 redirect to base URL',
      severity: 'warning',
      detail: 'Page 1 should be accessible without a page parameter to avoid duplicate content.\nCurrent URL: ' + url
    });
  }

  // ── Canonical check ─────────────────────────────────────────────────────────
  var canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    issues.push({
      type: 'pagination_no_canonical',
      message: 'Paginated page without canonical tag',
      severity: 'warning',
      detail: 'Each paginated page should have a canonical. Options:\n1. Self-referencing: each page points to itself (recommended by Google)\n2. First-page: all pages point to the first page (older approach)'
    });
  } else {
    var canonicalHref = (canonical.getAttribute('href') || '').split('#')[0].replace(/\/$/, '');
    var currentUrlClean = window.location.href.split('#')[0].replace(/\/$/, '');

    if (canonicalHref === currentUrlClean) {
      // Self-referencing — correct per Google
    } else if (canonicalHref.indexOf(currentPath.split('/page/')[0].split('/page-')[0]) !== -1) {
      // Points to first page or collection URL
      issues.push({
        type: 'pagination_canonical_first_page',
        message: 'Canonical вказує на першу сторінку серії',
        severity: 'notice',
        detail: 'Google рекомендує self-referencing canonical для пагінованих сторінок.\nCanonical: ' + canonicalHref + '\nПоточний: ' + currentUrlClean
      });
    } else {
      issues.push({
        type: 'pagination_canonical_mismatch',
        message: 'Canonical вказує на неспоріднений URL — перегляньте стратегію',
        severity: 'warning',
        detail: 'Canonical: ' + canonicalHref + '\nПоточний: ' + currentUrlClean
      });
    }
  }

  // ── Deep pages (page > 5) — consider noindex ────────────────────────────────
  if (pageNum !== null && pageNum > 5) {
    var noindex = document.querySelector('meta[name="robots"][content*="noindex"], meta[name="googlebot"][content*="noindex"]');
    if (!noindex) {
      issues.push({
        type: 'deep_pagination_noindex',
        message: 'Deep paginated page (page ' + pageNum + ') without noindex',
        severity: 'notice',
        detail: 'Pages beyond page 5 often have thin content and low traffic. Consider adding noindex to reduce crawl waste.'
      });
    }
  }

  // ── Title uniqueness ────────────────────────────────────────────────────────
  var title = (document.title || '').trim();
  if (pageNum && pageNum > 1 && title) {
    var hasPageInTitle = new RegExp('\\b' + pageNum + '\\b|page|сторінк|стор\\.|pg\\b', 'i').test(title);
    if (!hasPageInTitle) {
      issues.push({
        type: 'pagination_non_unique_title',
        message: 'Title of paginated page does not contain page number (' + pageNum + ')',
        severity: 'notice',
        detail: 'Current title: "' + title + '". Recommended format: "Topic — Page ' + pageNum + ' | Site Name"'
      });
    }
  }

  // ── Meta description uniqueness ─────────────────────────────────────────────
  if (pageNum && pageNum > 1) {
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      var descContent = (metaDesc.getAttribute('content') || '').toLowerCase();
      var hasPageInDesc = new RegExp('\\b' + pageNum + '\\b|page|сторінк', 'i').test(descContent);
      if (!hasPageInDesc) {
        issues.push({
          type: 'pagination_non_unique_description',
          message: 'Meta description does not indicate page number (' + pageNum + ')',
          severity: 'notice',
          detail: 'Each paginated page should have a unique description to avoid duplicate content issues.'
        });
      }
    }
  }

  // ── DOM pagination accessibility ────────────────────────────────────────────
  if (paginationNavs.length > 0) {
    // Check for aria-label on pagination nav
    var navsWithAriaLabel = Array.prototype.filter.call(paginationNavs, function(nav) {
      return nav.getAttribute('aria-label');
    });
    if (navsWithAriaLabel.length < paginationNavs.length) {
      issues.push({
        type: 'pagination_missing_aria_label',
        message: 'Pagination <nav> missing aria-label (' + (paginationNavs.length - navsWithAriaLabel.length) + ')',
        severity: 'notice',
        detail: 'Add aria-label="Pagination" to the <nav> element for screen reader accessibility.',
        highlight: true
      });
    }

    // Check for aria-current="page" on current page link
    var hasAriaCurrent = false;
    Array.prototype.some.call(paginationLinks, function(a) {
      if (a.getAttribute('aria-current') === 'page') { hasAriaCurrent = true; return true; }
      return false;
    });
    if (paginationLinks.length > 0 && !hasAriaCurrent) {
      issues.push({
        type: 'pagination_missing_aria_current',
        message: 'No pagination link has aria-current="page"',
        severity: 'notice',
        detail: 'The current page link should have aria-current="page" for accessibility.'
      });
    }

    // Check for aria-disabled on prev/next at boundaries
    if (pageNum === 1 && domPrevLinks.length > 0) {
      var prevDisabled = Array.prototype.some.call(domPrevLinks, function(a) {
        return a.getAttribute('aria-disabled') === 'true' || a.getAttribute('tabindex') === '-1';
      });
      if (!prevDisabled) {
        issues.push({
          type: 'pagination_prev_not_disabled',
          message: '"Previous" link is not disabled on first page',
          severity: 'notice',
          detail: 'Add aria-disabled="true" or tabindex="-1" to the previous link on the first page.'
        });
      }
    }

    // Check for title attributes on pagination links
    var linksWithoutTitle = Array.prototype.filter.call(paginationLinks, function(a) {
      return !a.getAttribute('title');
    });
    if (linksWithoutTitle.length > paginationLinks.length * 0.5 && paginationLinks.length >= 3) {
      issues.push({
        type: 'pagination_links_no_title',
        message: 'Pagination links missing title attribute (' + linksWithoutTitle.length + ')',
        severity: 'notice',
        detail: 'Add title="Go to page N" for better accessibility and UX.'
      });
    }
  }

  // ── Infinite scroll SEO issues ──────────────────────────────────────────────
  if (hasInfiniteScroll) {
    // Check for hash-based deep linking
    var hasHashBang = url.indexOf('#!') !== -1 || currentPath.indexOf('ajax.html') !== -1;
    if (!hasHashBang && !pageNum) {
      issues.push({
        type: 'infinite_scroll_no_deep_linking',
        message: 'Infinite scroll without deep linking support',
        severity: 'warning',
        detail: 'Search engines may not index content loaded dynamically. Implement hash-based URLs or History API for deep linking.'
      });
    }

    // Check for loading indicator
    var loadingIndicator = document.querySelector('[class*="loading"], [class*="spinner"], [aria-busy="true"], [role="status"]');
    if (!loadingIndicator) {
      issues.push({
        type: 'infinite_scroll_no_loading_indicator',
        message: 'Infinite scroll without loading indicator',
        severity: 'notice',
        detail: 'Add a visible loading state (spinner, "Loading..." text) for accessibility and UX.'
      });
    }

    // Check for end-of-content message
    var endMessage = Array.prototype.filter.call(document.querySelectorAll('div, p, span, section, footer'), function(el) {
      var text = (el.textContent || '').trim().toLowerCase();
      return /end of|no more|that's all|all posts|all items|кінець|більше немає/i.test(text) && el.children.length < 3;
    });
    if (endMessage.length === 0) {
      issues.push({
        type: 'infinite_scroll_no_end_message',
        message: 'Infinite scroll without end-of-content message',
        severity: 'notice',
        detail: 'Add an accessible message when all content is loaded for screen reader users.'
      });
    }
  }

  // ── Load more button accessibility ──────────────────────────────────────────
  if (loadMoreBtns.length > 0) {
    var btnsWithAria = Array.prototype.filter.call(loadMoreBtns, function(btn) {
      return btn.getAttribute('aria-label') || btn.getAttribute('aria-expanded');
    });
    if (btnsWithAria.length === 0) {
      issues.push({
        type: 'load_more_no_aria',
        message: '"Load more" button missing ARIA attributes',
        severity: 'notice',
        detail: 'Add aria-label="Load more content" and aria-expanded for accessibility.'
      });
    }

    // Load more without fallback pagination
    if (paginationLinks.length === 0 && pageNum === null && !hasRelPrevNext) {
      issues.push({
        type: 'load_more_no_fallback',
        message: '"Load more" without traditional pagination fallback',
        severity: 'warning',
        detail: 'Load more buttons can make it hard for users and crawlers to access deep content. Provide numbered pagination as a fallback or ensure all content is crawlable.'
      });
    }
  }

  // ── og:url on paginated pages ───────────────────────────────────────────────
  if (pageNum !== null) {
    var ogUrlEl = document.querySelector('meta[property="og:url"]');
    if (ogUrlEl) {
      var ogUrl = ogUrlEl.getAttribute('content') || '';
      var ogUrlPage = ogUrl.match(/[?&]page=(\d+)/i);
      if (ogUrlPage && parseInt(ogUrlPage[1], 10) !== pageNum) {
        issues.push({
          type: 'pagination_og_url_mismatch',
          message: 'og:url page number does not match current page',
          severity: 'notice',
          detail: 'og:url: ' + ogUrl + '\nCurrent page: ' + pageNum
        });
      }
    }
  }

  // ── Schema.org SiteNavigationElement ────────────────────────────────────────
  var schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
  var hasSiteNavSchema = false;
  Array.prototype.forEach.call(schemaScripts, function(script) {
    try {
      var json = JSON.parse(script.textContent || '');
      var text = JSON.stringify(json);
      if (text.indexOf('SiteNavigationElement') !== -1 || text.indexOf('pagination') !== -1) {
        hasSiteNavSchema = true;
      }
    } catch(e) {}
  });
  if (paginationLinks.length > 0 && !hasSiteNavSchema) {
    issues.push({
      type: 'pagination_no_schema',
      message: 'No Schema.org markup for pagination',
      severity: 'notice',
      detail: 'Consider adding SiteNavigationElement or pagination structured data for better search engine understanding.'
    });
  }

  // ── Pagination links with nofollow ──────────────────────────────────────────
  var nofollowPageLinks = Array.prototype.filter.call(paginationLinks, function(a) {
    var rel = (a.getAttribute('rel') || '').toLowerCase();
    return rel.indexOf('nofollow') !== -1;
  });
  if (nofollowPageLinks.length > 0) {
    issues.push({
      type: 'pagination_nofollow',
      message: 'Pagination links have rel="nofollow" (' + nofollowPageLinks.length + ')',
      severity: 'notice',
      detail: 'Adding nofollow to pagination links prevents link equity flow to deeper pages. Only use if pages should not be indexed.'
    });
  }

  return { id: 'pagination', name: 'Pagination', issues: issues };
}
