function runCanonicalChecker(p) {
  var issues = [];
  var params = p || {};

  var canonEls = document.querySelectorAll('link[rel="canonical"]');

  if (canonEls.length > 1) {
    issues.push({
      type: 'canonical_multiple',
      message: 'Знайдено ' + canonEls.length + ' canonical теги на сторінці',
      severity: 'critical',
      detail: 'Дозволено лише один <link rel="canonical">. Кілька тегів плутають пошукові роботи.'
    });
  }

  var canonEl = canonEls.length > 0 ? canonEls[0] : null;
  var canonHref = canonEl ? (canonEl.getAttribute('href') || '').trim() : '';
  var currentUrl = window.location.href.split('#')[0];
  var currentHostname = window.location.hostname.toLowerCase();
  var currentDomain = currentHostname.replace(/^www\./, '');

  if (!canonHref) {
    issues.push({
      type: 'canonical_missing',
      message: 'Відсутній canonical тег',
      severity: 'warning',
      detail: 'Додайте <link rel="canonical" href="..."> для запобігання проблемам з дубльованим контентом.'
    });
    return { id: 'canonical', name: 'Canonical', issues: issues };
  }

  if (canonHref.indexOf('#') !== -1) {
    issues.push({
      type: 'canonical_has_fragment',
      message: 'Canonical URL містить фрагмент (#)',
      severity: 'warning',
      detail: 'Canonical не повинен містити якір. Видаліть все після #: ' + canonHref.split('#')[0]
    });
  }

  issues.push({
    type: 'canonical_info',
    message: 'Canonical: ' + canonHref,
    severity: 'info',
    detail: 'Current URL: ' + currentUrl
  });

  try {
    var canonUrl = new URL(canonHref, window.location.href);
    var canonHostname = canonUrl.hostname.toLowerCase();
    var canonDomain = canonHostname.replace(/^www\./, '');

    if (canonDomain !== currentDomain) {
      issues.push({
        type: 'canonical_cross_domain',
        message: 'Canonical вказує на інший домен: ' + canonUrl.hostname,
        severity: 'critical',
        detail: 'Поточний: ' + currentDomain + '\nCanonical: ' + canonUrl.hostname + '\nCanonical на інший домен може викликати проблеми з індексацією.'
      });
    } else if (canonHostname !== currentHostname) {
      issues.push({
        type: 'canonical_www_mismatch',
        message: 'Невідповідність www між canonical та поточним URL',
        severity: 'notice',
        detail: 'Поточний: ' + currentHostname + '\nCanonical: ' + canonHostname + '\nПереконайтесь, що www-консолідація однакова на всьому сайті.'
      });
    }

    var canonPath = canonUrl.pathname;
    var currentPath = new URL(currentUrl).pathname;
    if (canonPath !== currentPath && canonDomain === currentDomain) {
      issues.push({
        type: 'canonical_different_path',
        message: 'Canonical URL має інший шлях, ніж поточна сторінка',
        severity: 'warning',
        detail: 'Поточний шлях: ' + currentPath + '\nCanonical шлях: ' + canonPath + '\nПереконайтеся, що це свідоме рішення (напр., пагінація).'
      });
    }

    if (canonHref.indexOf('http://') === 0 && window.location.protocol === 'https:') {
      issues.push({
        type: 'canonical_http_on_https',
        message: 'Canonical використовує HTTP на HTTPS-сторінці',
        severity: 'warning',
        detail: 'Canonical має використовувати HTTPS: ' + canonHref.replace('http://', 'https://')
      });
    }

    var canonHasParams = canonUrl.search.length > 0;
    if (canonHasParams) {
      var paramKeys = canonUrl.search.replace('?', '').split('&').map(function(k) { return k.split('=')[0]; });
      var trackingParams = paramKeys.filter(function(k) {
        return /^(utm_|mc_|fbclid|gclid|gbraid|wbraid|session|sid|ref)/i.test(k);
      });
      if (trackingParams.length > 0) {
        issues.push({
          type: 'canonical_tracking_params',
          message: 'Canonical URL містить трекінг-параметри',
          severity: 'notice',
          detail: 'Параметри: ' + trackingParams.join(', ') + '\nВидаліть трекінг-параметри з canonical, щоб не розбавляти link equity.'
        });
      }
    }

    var robotsMeta = document.querySelector('meta[name="robots"]');
    var robotsContent = robotsMeta ? (robotsMeta.getAttribute('content') || '').toLowerCase() : '';
    if (robotsContent.indexOf('noindex') !== -1 && canonDomain === currentDomain && canonPath === currentPath) {
      issues.push({
        type: 'canonical_noindex_conflict',
        message: 'Сторінка має одночасно canonical (самопосилання) та noindex',
        severity: 'warning',
        detail: 'Якщо сторінка не має індексуватися, self-canonical зайвий. Якщо має — видаліть noindex.'
      });
    }

    var ogUrlMeta = document.querySelector('meta[property="og:url"]');
    if (ogUrlMeta) {
      var ogUrl = (ogUrlMeta.getAttribute('content') || '').trim();
      if (ogUrl) {
        try {
          var ogUrlNorm = new URL(ogUrl).href.split('#')[0];
          var canonNorm = canonUrl.href.split('#')[0];
          if (ogUrlNorm !== canonNorm) {
            issues.push({
              type: 'canonical_og_url_mismatch',
              message: 'og:url не збігається з canonical URL',
              severity: 'notice',
              detail: 'Canonical: ' + canonNorm + '\nog:url: ' + ogUrlNorm + '\nРекомендується тримати og:url та canonical однаковими.'
            });
          }
        } catch(e) {}
      }
    }

  } catch(e) {
    issues.push({
      type: 'canonical_invalid_url',
      message: 'Canonical URL недійсний: ' + canonHref,
      severity: 'warning'
    });
  }

  return { id: 'canonical', name: 'Canonical', issues: issues };
}