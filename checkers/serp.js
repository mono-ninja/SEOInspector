function runSerpChecker(p) {
  var issues = [];
  var params = p || {};
  var titleMax = params.title_max || 60;
  var titleMin = params.title_min || 10;
  var descMax  = params.desc_max  || 160;
  var descMin  = params.desc_min  || 50;

  var title = (document.title || '').trim();
  var descEl = document.querySelector('meta[name="description"]');
  var desc = descEl ? (descEl.getAttribute('content') || '').trim() : '';
  var h1El = document.querySelector('h1');
  var h1 = h1El ? (h1El.textContent || '').trim() : '';
  var pageUrl = window.location.href.split('#')[0];

  var canonEl = document.querySelector('link[rel="canonical"]');
  var canonical = '';
  if (canonEl) {
    var canonAttr = (canonEl.getAttribute('href') || '').trim();
    if (canonAttr) {
      try { canonical = new URL(canonAttr, pageUrl).href.split('#')[0]; } catch(e) { canonical = canonAttr; }
    }
  }

  var robotsEl = document.querySelector('meta[name="robots"]');
  var robots = robotsEl ? (robotsEl.getAttribute('content') || '').trim() : '';
  var robotsLower = robots.toLowerCase();

  // ── noindex check ──────────────────────────────────────────────────────
  if (robotsLower.indexOf('noindex') !== -1 || /\bnone\b/.test(robotsLower)) {
    issues.push({
      type: 'serp_noindex',
      message: 'Page has noindex — will not appear in search results',
      severity: 'critical',
      detail: 'Meta robots content: "' + robots + '"'
    });
  }

  // ── Title checks ───────────────────────────────────────────────────────
  if (!title) {
    issues.push({
      type: 'serp_missing_title',
      message: 'Missing <title> — page will have no title in search results',
      severity: 'critical'
    });
  } else {
    if (title.length < titleMin) {
      issues.push({
        type: 'serp_short_title',
        message: 'Title is too short for SERP (' + title.length + ' chars, min ' + titleMin + ')',
        severity: 'warning',
        detail: 'Short titles get less attention in search results. Current: «' + title + '»'
      });
    }
    if (title.length > titleMax) {
      issues.push({
        type: 'serp_long_title',
        message: 'Title will be truncated in SERP (' + title.length + ' chars, max ~' + titleMax + ')',
        severity: 'notice',
        detail: 'Google typically shows 50–60 characters. Current: «' + title + '»'
      });
    }

    // Advertising words in title
    var t = title.toLowerCase();
    var promoWords = ['buy','купити','купить','дешево','cheap','deal','акція','sale','розпродаж','discount','знижка','promo','промо','order','замовити','замовить','shop','store','price','ціна','ціни','найкраща','best price','знижки'];
    for (var i = 0; i < promoWords.length; i++) {
      if (t.indexOf(promoWords[i]) !== -1) {
        issues.push({
          type: 'serp_advertising_title',
          message: 'Title contains advertising language ("' + promoWords[i] + '") — may hurt CTR',
          severity: 'notice',
          detail: 'Google may re-write clickbaity titles. Use factual, keyword-rich titles instead.'
        });
        break;
      }
    }
  }

  // ── Description checks ─────────────────────────────────────────────────
  if (!descEl) {
    issues.push({
      type: 'serp_missing_description',
      message: 'Missing meta description — Google will generate a snippet from page text',
      severity: 'warning'
    });
  } else if (!desc) {
    issues.push({
      type: 'serp_empty_description',
      message: 'Meta description tag is empty',
      severity: 'warning'
    });
  } else {
    if (desc.length < descMin) {
      issues.push({
        type: 'serp_short_description',
        message: 'Description is too short for SERP (' + desc.length + ' chars, min ' + descMin + ')',
        severity: 'notice',
        detail: 'Short descriptions miss the opportunity to attract clicks. Aim for ' + descMin + '–' + descMax + ' chars.'
      });
    }
    if (desc.length > descMax) {
      issues.push({
        type: 'serp_long_description',
        message: 'Description will be truncated in SERP (' + desc.length + ' chars, max ~' + descMax + ')',
        severity: 'notice',
        detail: 'Google typically shows 150–160 characters. Important info should be in the first 120 chars.'
      });
    }

    // Title equals description
    if (title && title.trim() === desc.trim()) {
      issues.push({
        type: 'serp_title_equals_desc',
        message: 'Title and description are identical — description should be unique',
        severity: 'notice'
      });
    }
  }

  // ── Title vs H1 mismatch ──────────────────────────────────────────────
  if (title && h1) {
    function normalize(s) {
      return s.toLowerCase().replace(/[^a-zа-яіїєёa-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
    }
    var titleNorm = normalize(title);
    var h1Norm = normalize(h1);

    if (titleNorm !== h1Norm) {
      var tWords = titleNorm.split(' ').filter(function(w) { return w.length > 3; });
      var hWords = h1Norm.split(' ').filter(function(w) { return w.length > 3; });
      if (tWords.length > 0 && hWords.length > 0) {
        var common = tWords.filter(function(w) { return hWords.indexOf(w) !== -1; });
        var similarity = common.length / Math.max(tWords.length, hWords.length);
        if (similarity < 0.3) {
          issues.push({
            type: 'serp_title_mismatch_h1',
            message: 'Title and H1 differ significantly (fewer than 30% words in common)',
            severity: 'warning',
            detail: 'Title: «' + title.substring(0, 60) + '»\nH1: «' + h1.substring(0, 60) + '»'
          });
        }
      }
    }
  }

  // ── Canonical SERP impact ──────────────────────────────────────────────
  if (canonical && canonical !== pageUrl) {
    issues.push({
      type: 'serp_cross_canonical',
      message: 'Page canonicalizes to a different URL — that URL will appear in search instead',
      severity: 'warning',
      detail: 'Current: ' + pageUrl + '\nCanonical: ' + canonical
    });
  }

  // ── Pixel width estimate (Canvas API) ──────────────────────────────────
  try {
    var _canvas = document.createElement('canvas');
    var _ctx = _canvas.getContext('2d');
    if (_ctx) {
      _ctx.font = '20px Arial';
      var titlePx = title ? Math.round(_ctx.measureText(title).width * 0.9) : 0;
      if (titlePx > 580) {
        issues.push({
          type: 'serp_title_too_wide',
          message: 'Title pixel width exceeds SERP limit (~' + titlePx + 'px, threshold 580px)',
          severity: 'notice',
          detail: 'Estimated width: ' + titlePx + 'px. Part of the title will be truncated in search results.'
        });
      }
      if (desc) {
        var descPx = Math.round(_ctx.measureText(desc).width * 0.78);
        if (descPx > 920) {
          issues.push({
            type: 'serp_desc_too_wide',
            message: 'Description pixel width exceeds SERP limit (~' + descPx + 'px, threshold 920px)',
            severity: 'notice',
            detail: 'Estimated width: ' + descPx + 'px. The description will be truncated.'
          });
        }
      }
    }
  } catch(e) {}

  // ── Published date detection for SERP ──────────────────────────────────
  var publishedDate = '';
  var dateSources = [
    { selector: 'time[datetime]', attr: 'datetime' },
    { selector: 'time[pubdate]', attr: 'datetime' },
    { selector: 'meta[itemprop="datePublished"]', attr: 'content' },
    { selector: 'meta[name="publication_date"]', attr: 'content' },
  ];
  for (var d = 0; d < dateSources.length; d++) {
    var el = document.querySelector(dateSources[d].selector);
    if (el) {
      publishedDate = el.getAttribute(dateSources[d].attr) || '';
      if (publishedDate) break;
    }
  }
  if (!publishedDate) {
    try {
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var s = 0; s < scripts.length; s++) {
        try {
          var j = JSON.parse(scripts[s].textContent || '');
          function findDate(obj) {
            if (!obj || typeof obj !== 'object') return '';
            if (obj.datePublished) return obj.datePublished;
            if (obj['@graph']) {
              for (var g = 0; g < obj['@graph'].length; g++) {
                var r = findDate(obj['@graph'][g]);
                if (r) return r;
              }
            }
            return '';
          }
          publishedDate = findDate(j);
          if (publishedDate) break;
        } catch(e) {}
      }
    } catch(e) {}
  }

  // ── Schema types for rich results ──────────────────────────────────────
  var schemaTypes = [];
  var ratingInfo = null;
  try {
    var ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var si = 0; si < ldScripts.length; si++) {
      try {
        var sd = JSON.parse(ldScripts[si].textContent || '');
        function collect(node) {
          if (!node || typeof node !== 'object') return;
          if (node['@type']) {
            var arr = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
            for (var ai = 0; ai < arr.length; ai++) schemaTypes.push(arr[ai]);
          }
          if (node.aggregateRating || node.review) {
            ratingInfo = {
              rating: node.aggregateRating ? (node.aggregateRating.rating || node.aggregateRating.bestRating) : (node.review.rating),
              count: node.aggregateRating ? node.aggregateRating.reviewCount : undefined,
              best: node.aggregateRating ? node.aggregateRating.bestRating : undefined,
              type: node['@type']
            };
          }
          if (Array.isArray(node['@graph'])) {
            for (var gi = 0; gi < node['@graph'].length; gi++) collect(node['@graph'][gi]);
          }
        }
        collect(sd);
      } catch(e) {}
    }
  } catch(e) {}

  var richResultTypes = ['FAQPage', 'HowTo', 'Recipe', 'VideoObject', 'NewsArticle', 'Product', 'Review', 'Event', 'JobPosting', 'QAPage'];
  var hasRich = false;
  for (var ri = 0; ri < richResultTypes.length; ri++) {
    if (schemaTypes.indexOf(richResultTypes[ri]) !== -1) { hasRich = true; break; }
  }

  // ── Info: SERP snippet summary ─────────────────────────────────────────
  var snippetLines = [
    'Title       «' + (title || '—') + '»' + (title ? '  [' + title.length + ' chars]' : ''),
    'Description «' + (desc  || '—') + '»' + (desc  ? '  [' + desc.length  + ' chars]' : ''),
    'H1          «' + (h1    || '—') + '»',
    'Robots       ' + (robots || 'not set (default: index, follow)'),
    'URL          ' + pageUrl,
  ];
  if (canonical && canonical !== pageUrl) {
    snippetLines.push('Canonical    ' + canonical);
  }
  if (publishedDate) {
    snippetLines.push('Published    ' + publishedDate);
  }
  if (schemaTypes.length > 0) {
    snippetLines.push('Schema       ' + schemaTypes.join(', '));
  }
  if (hasRich) {
    snippetLines.push('Rich results Eligible for rich results');
  }
  issues.push({
    type: 'serp_snippet',
    message: 'SERP snippet',
    severity: 'info',
    detail: snippetLines.join('\n'),
    extra: {
      publishedDate: publishedDate,
      schemaTypes: schemaTypes,
      ratingInfo: ratingInfo,
      hasRich: hasRich
    }
  });

  return { id: 'serp', name: 'SERP', issues: issues };
}
