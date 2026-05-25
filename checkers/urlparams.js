function runUrlParamsChecker(p) {
  var issues = [];
  var search = window.location.search;

  if (!search || search === '?') {
    return { id: 'urlparams', name: 'URL-параметри', issues: [] };
  }

  // Collect all pairs (preserve duplicates)
  var rawPairs = search.substring(1).split('&');
  var params = {};
  var duplicateKeys = {};
  var emptyValues = [];

  rawPairs.forEach(function(pair) {
    if (!pair) return;
    var idx = pair.indexOf('=');
    var key = idx >= 0 ? pair.substring(0, idx) : pair;
    var val = idx >= 0 ? pair.substring(idx + 1) : '';
    try { key = decodeURIComponent(key.replace(/\+/g, ' ')); val = decodeURIComponent(val.replace(/\+/g, ' ')); } catch(e) {}
    if (params.hasOwnProperty(key)) {
      duplicateKeys[key] = (duplicateKeys[key] || 0) + 1;
    }
    params[key] = val;
    if (val === '' && idx >= 0) {
      emptyValues.push(key);
    }
  });

  var paramKeys = Object.keys(params);
  if (paramKeys.length === 0) {
    return { id: 'urlparams', name: 'URL-параметри', issues: [] };
  }

  // ── Tracking parameters (synced with canonical.js) ─────────────────────────
  var isTrackingParam = function(k) {
    var kl = k.toLowerCase();
    return /^(utm_|mc_|gbraid|wbraid|fbclid|gclid|irclid|yclid|msclkid|tr|twclid|att_clsid|igshid|anid|gad_source|fb_xtid|s_cid|piwik_id|_ga|_gac|_gl|_kx|_openstat|share|session|sid|ref|ref_src|source|medium|campaign|content|term)$/i.test(kl);
  };

  var trackingParams = paramKeys.filter(isTrackingParam);

  // ── Session / identity parameters ──────────────────────────────────────────
  var isSessionParam = function(k) {
    var kl = k.toLowerCase();
    return /^(session_id|sessid|sid|user_id|uid|csrf|csrf_token|token|auth_token|access_token|api_key|jwt|bearer|phpsessid|asp\.net_sessionid|jsessionid|request_token|verification_token)$/i.test(kl);
  };

  var sessionParams = paramKeys.filter(isSessionParam);

  // ── Filter / sort parameters (conservative: exact match + known prefixes) ──
  var isFilterSortParam = function(k) {
    var kl = k.toLowerCase();
    return /^(sort|filter|order|orderby|order_by|price_min|price_max|color|size|brand|material|type|status|rating|min_price|max_price|category|cat|min|max|from|to|page|per_page|limit|offset|direction|dir|view|layout|stock|availability)$/i.test(kl) ||
           /^sort[_-]/i.test(kl) ||
           /^(filter|filters|facet|facets|attribute|attr)[_-]/i.test(kl);
  };

  var filterSortParams = paramKeys.filter(isFilterSortParam);

  // ── Search parameters ──────────────────────────────────────────────────────
  var isSearchParam = function(k) {
    return /^(q|query|search|s|keyword|kw|term|find|text|phrase|ask)$/i.test(k);
  };

  var searchParams = paramKeys.filter(isSearchParam);

  // ── Pagination parameters ──────────────────────────────────────────────────
  var isPaginationParam = function(k) {
    return /^(page|p|pg|paged|pg_no|pageNum|pagenumber|offset|start|cursor|limit|per_page|rows)$/i.test(k.toLowerCase());
  };

  var paginationParams = paramKeys.filter(isPaginationParam);

  // ── Unrecognized parameters ────────────────────────────────────────────────
  var categorized = {};
  trackingParams.forEach(function(k) { categorized[k] = true; });
  sessionParams.forEach(function(k) { categorized[k] = true; });
  filterSortParams.forEach(function(k) { categorized[k] = true; });
  searchParams.forEach(function(k) { categorized[k] = true; });
  paginationParams.forEach(function(k) { categorized[k] = true; });
  var otherParams = paramKeys.filter(function(k) { return !categorized[k]; });

  // ── Overview ────────────────────────────────────────────────────────────────
  var overviewParts = [];
  overviewParts.push('Всього параметрів: ' + paramKeys.length);
  if (trackingParams.length) overviewParts.push('Трекінг: ' + trackingParams.join(', '));
  if (sessionParams.length) overviewParts.push('Сесійні: ' + sessionParams.join(', '));
  if (filterSortParams.length) overviewParts.push('Фільтри/сортування: ' + filterSortParams.join(', '));
  if (searchParams.length) overviewParts.push('Пошук: ' + searchParams.join(', '));
  if (paginationParams.length) overviewParts.push('Пагінація: ' + paginationParams.join(', '));
  if (otherParams.length) overviewParts.push('Інші: ' + otherParams.join(', '));
  overviewParts.push('');
  overviewParts.push(paramKeys.map(function(k) { return k + '=' + params[k]; }).join('\n'));

  issues.push({
    type: 'urlparams_overview',
    message: 'URL-параметри (' + paramKeys.length + ')',
    severity: 'info',
    detail: overviewParts.join('\n')
  });

  // ── URL length ──────────────────────────────────────────────────────────────
  var fullUrl = window.location.href;
  if (fullUrl.length > 1500) {
    issues.push({
      type: 'urlparams_long_url',
      message: 'URL занадто довгий (' + fullUrl.length + ' символів)',
      severity: fullUrl.length > 2000 ? 'critical' : 'warning',
      detail: 'URL містить ' + fullUrl.length + ' символів. Рекомендовано менше 2000. Довгі URL можуть бути обрізані браузерами та пошуковими системами.' +
        (fullUrl.length > 2000 ? '\nURL перевищує 2000 символів — деякі браузери та сервери можуть його не обробити.' : '')
    });
  }

  // ── Duplicate parameters ────────────────────────────────────────────────────
  if (Object.keys(duplicateKeys).length > 0) {
    issues.push({
      type: 'urlparams_duplicates',
      message: 'Повторювані параметри в URL',
      severity: 'notice',
      detail: Object.keys(duplicateKeys).map(function(k) {
        return k + ' (повторюється ' + (duplicateKeys[k] + 1) + ' разі)';
      }).join('\n') +
      '\nПовторювані параметри можуть створити непередбачуване поводження. Залишається лише останнє значення.'
    });
  }

  // ── Empty values ────────────────────────────────────────────────────────────
  if (emptyValues.length > 0) {
    issues.push({
      type: 'urlparams_empty_values',
      message: 'Параметри з порожніми значеннями (' + emptyValues.length + ')',
      severity: 'notice',
      detail: emptyValues.join(', ') + '\nПорожні параметри не несуть користі та ускладнюють URL.'
    });
  }

  // ── Canonical helpers ───────────────────────────────────────────────────────
  var canonical = document.querySelector('link[rel="canonical"]');
  var canonicalHref = canonical ? (canonical.getAttribute('href') || '') : '';
  var metaRobots = document.querySelector('meta[name="robots"]');
  var robotsContent = metaRobots ? (metaRobots.getAttribute('content') || '').toLowerCase() : '';
  var hasNoindex = robotsContent.indexOf('noindex') !== -1;

  // ── Tracking parameters ────────────────────────────────────────────────────
  if (trackingParams.length > 0) {
    var trackingInCanonical = trackingParams.some(function(k) {
      return canonicalHref.indexOf(k) !== -1;
    });

    if (!canonical) {
      issues.push({
        type: 'urlparams_tracking_no_canonical',
        message: 'Трекінг-параметри в URL без canonical',
        severity: 'warning',
        detail: 'Параметри: ' + trackingParams.join(', ') +
          '\nДодано <link rel="canonical">, який вказує на чистий URL без трекінг-параметрів, щоб уникнути дублікатів в індексі.'
      });
    } else if (trackingInCanonical) {
      issues.push({
        type: 'urlparams_tracking_in_canonical',
        message: 'Canonical містить трекінг-параметри',
        severity: 'warning',
        detail: 'Параметри: ' + trackingParams.join(', ') +
          '\nCanonical: ' + canonicalHref +
          '\nCanonical має вказувати на чистий URL без трекінг-параметрів.'
      });
    } else {
      var canonUrl;
      try {
        canonUrl = new URL(canonicalHref, window.location.href);
        var canonHasParams = canonUrl.search.length > 0;
        if (canonHasParams) {
          issues.push({
            type: 'urlparams_tracking_canon_has_params',
            message: 'Canonical має параметри, але не трекінг-параметри',
            severity: 'notice',
            detail: 'Canonical: ' + canonicalHref +
              '\nCanonical містить URL-параметри. Переконайтеся, що це свідоме рішення.'
          });
        }
      } catch(e) {}
    }
  }

  // ── Session parameters ─────────────────────────────────────────────────────
  if (sessionParams.length > 0) {
    issues.push({
      type: 'urlparams_session',
      message: 'Сесійні/ідентифікаційні параметри в URL',
      severity: 'warning',
      detail: 'Параметри: ' + sessionParams.join(', ') +
        '\nСесійні параметри створюють масивне дублювання URL в індексі. Використовуйте cookies замість URL-параметрів або додайте noindex.'
    });
  }

  // ── Filter/sort parameters ─────────────────────────────────────────────────
  if (filterSortParams.length > 0) {
    var isSelfCanonical = false;
    if (canonical) {
      var ch = (canonical.getAttribute('href') || '').split('#')[0].replace(/\/$/, '');
      var cu = window.location.href.split('#')[0].replace(/\/$/, '');
      isSelfCanonical = ch === cu;
    }

    if (!hasNoindex && (!canonical || isSelfCanonical)) {
      issues.push({
        type: 'urlparams_filter_not_handled',
        message: 'Сторінка з фільтрами/сортуванням без захисту від індексації',
        severity: 'warning',
        detail: 'Параметри: ' + filterSortParams.join(', ') +
          '\nРекомендація: noindex або canonical, що вказує на базовий URL без параметрів фільтрації.'
      });
    }
  }

  // ── Search parameters ──────────────────────────────────────────────────────
  if (searchParams.length > 0) {
    if (!hasNoindex) {
      issues.push({
        type: 'urlparams_search_indexable',
        message: 'Сторінка результатів пошуку відкрита для індексації',
        severity: 'warning',
        detail: 'Параметри: ' + searchParams.map(function(k) { return k + '=' + params[k]; }).join(', ') +
          '\nСторінки внутрішнього пошуку мають бути виключені з індексації (noindex).'
      });
    }
  }

  // ── Unrecognized parameters ────────────────────────────────────────────────
  if (otherParams.length > 0) {
    issues.push({
      type: 'urlparams_unrecognized',
      message: 'URL містить невизнані параметри (' + otherParams.length + ')',
      severity: 'notice',
      detail: 'Параметри: ' + otherParams.join(', ') +
        '\nЦі параметри не відносяться до відомих категорій. Переконайтеся, що вони не створюють дублікатів.'
    });
  }

  return { id: 'urlparams', name: 'URL-параметри', issues: issues };
}
