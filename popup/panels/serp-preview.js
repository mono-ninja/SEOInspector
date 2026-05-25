// ─── SERP Snippet Preview Panel ───────────────────────────────────────────────

var SERP_TITLE_WARN  = 60;
var SERP_TITLE_MAX   = 70;
var SERP_DESC_WARN   = 155;
var SERP_DESC_MAX    = 165;
var SERP_MOBILE_TITLE_MAX = 30;
var SERP_MOBILE_DESC_MAX  = 120;

function initSerpPreviewPanel(tabId) {
  if (PopupState.serpPreviewLoaded) return;
  PopupState.serpPreviewLoaded = true;

  var panel = document.getElementById('serp-preview-panel');
  var loadingDiv = document.createElement('div');
  loadingDiv.className = 'panel-loading';
  loadingDiv.textContent = T.t('popup.loading');
  panel.innerHTML = '';
  panel.appendChild(loadingDiv);

  chrome.tabs.sendMessage(tabId, { action: 'getPageMeta' }, function(meta) {
    if (chrome.runtime.lastError || !meta) {
      var errDiv = document.createElement('div');
      errDiv.className = 'panel-error';
      errDiv.textContent = T.t('serp.fetch_fail');
      panel.innerHTML = '';
      panel.appendChild(errDiv);
      return;
    }
    panel.innerHTML = '';
    renderSerpPreview(panel, meta);
  });
}

function getSerpCheckerData() {
  var results = PopupState.lastResults || [];
  for (var i = 0; i < results.length; i++) {
    if (results[i].id !== 'serp') continue;
    var issues = results[i].issues || [];
    var snippet = null;
    for (var j = 0; j < issues.length; j++) {
      if (issues[j].type === 'serp_snippet') {
        snippet = issues[j];
        break;
      }
    }
    return { snippet: snippet, issues: issues };
  }
  return { snippet: null, issues: [] };
}

function renderSerpPreview(panel, meta) {
  var wrap = document.createElement('div');
  wrap.className = 'serp-wrap';

  var checkerData = getSerpCheckerData();

  var rawTitle = meta.ogTitle || meta.title || '';
  var rawDesc  = meta.description || meta.ogDescription || '';
  var rawUrl   = meta.canonical || meta.ogUrl || meta.url || '';
  var favicon  = meta.favicon || '';

  var titleLen = rawTitle.length;
  var descLen  = rawDesc.length;

  var breadcrumb = rawUrl;
  var domain = '';
  var pathBreadcrumb = '';
  try {
    var u = new URL(rawUrl);
    domain = u.hostname.replace(/^www\./, '');
    var parts = [domain];
    var pathParts = u.pathname.split('/').filter(Boolean);
    pathParts.forEach(function(p) { try { parts.push(decodeURIComponent(p).replace(/-/g, ' ')); } catch(e) { parts.push(p.replace(/-/g, ' ')); } });
    pathBreadcrumb = parts.slice(1).join(' › ');
    breadcrumb = parts.join(' › ');
    if (breadcrumb.length > 70) breadcrumb = breadcrumb.substring(0, 68) + '…';
  } catch(e) {}

  var displayTitle = rawTitle.length > SERP_TITLE_MAX ? rawTitle.substring(0, SERP_TITLE_MAX - 1) + '…' : rawTitle;
  var displayDesc  = rawDesc.length > SERP_DESC_MAX   ? rawDesc.substring(0, SERP_DESC_MAX - 1) + '…' : rawDesc;

  var mobileDisplayTitle = rawTitle.length > SERP_MOBILE_TITLE_MAX ? rawTitle.substring(0, SERP_MOBILE_TITLE_MAX - 1) + '…' : rawTitle;
  var mobileDisplayDesc  = rawDesc.length > SERP_MOBILE_DESC_MAX   ? rawDesc.substring(0, SERP_MOBILE_DESC_MAX - 1) + '…' : rawDesc;

  var publishedDate = (checkerData.snippet && checkerData.snippet.extra ? checkerData.snippet.extra.publishedDate : '') || (meta.publishedDate || '');
  var schemaTypes = checkerData.snippet && checkerData.snippet.extra ? checkerData.snippet.extra.schemaTypes : [];
  var ratingInfo = checkerData.snippet && checkerData.snippet.extra ? checkerData.snippet.extra.ratingInfo : null;
  var hasRich = checkerData.snippet && checkerData.snippet.extra ? checkerData.snippet.extra.hasRich : false;

  var formattedDate = '';
  if (publishedDate) {
    try {
      var d = new Date(publishedDate);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('uk-UA', { year: 'numeric', month: 'short' });
      }
    } catch(e) {}
  }

  // ── Google Desktop preview ─────────────────────────────────────────────────
  var desktopSection = document.createElement('div');
  desktopSection.className = 'serp-section';
  var desktopLabel = document.createElement('div');
  desktopLabel.className = 'og-section-label';
  desktopLabel.textContent = T.t('serp.desktop_preview');
  desktopSection.appendChild(desktopLabel);

  var desktopCard = document.createElement('div');
  desktopCard.className = 'serp-card serp-desktop';

  var urlRow = document.createElement('div');
  urlRow.className = 'serp-url-row';
  if (favicon) {
    var fav = document.createElement('img');
    fav.src = favicon;
    fav.className = 'serp-favicon';
    fav.alt = '';
    fav.onerror = function() { fav.style.display = 'none'; };
    urlRow.appendChild(fav);
  }
  var urlText = document.createElement('span');
  urlText.className = 'serp-url';
  urlText.textContent = breadcrumb;
  urlRow.appendChild(urlText);
  desktopCard.appendChild(urlRow);

  var titleEl = document.createElement('div');
  titleEl.className = 'serp-title';
  titleEl.textContent = displayTitle || T.t('og.no_title');
  desktopCard.appendChild(titleEl);

  // Rich results stars under title
  if (ratingInfo && ratingInfo.rating) {
    var starsRow = document.createElement('div');
    starsRow.className = 'serp-stars-row';
    var starsEl = document.createElement('span');
    starsEl.className = 'serp-stars';
    var ratingNum = parseFloat(ratingInfo.rating);
    var fullStars = Math.floor(Math.min(ratingNum, 5));
    var halfStar = (ratingNum - fullStars) >= 0.3;
    var starStr = '';
    for (var s = 0; s < fullStars; s++) starStr += '★';
    if (halfStar) starStr += '½';
    for (var s2 = fullStars + (halfStar ? 1 : 0); s2 < 5; s2++) starStr += '☆';
    starsEl.textContent = starStr;
    starsRow.appendChild(starsEl);
    var ratingText = document.createElement('span');
    ratingText.className = 'serp-rating-text';
    ratingText.textContent = ratingInfo.rating + (ratingInfo.count ? ' (' + Number(ratingInfo.count).toLocaleString('uk-UA') + ' reviews)' : '');
    starsRow.appendChild(ratingText);
    desktopCard.appendChild(starsRow);
  }

  var descEl = document.createElement('div');
  descEl.className = 'serp-desc';
  var descPrefix = '';
  if (formattedDate) descPrefix = formattedDate + ' — ';
  if (hasRich && !ratingInfo) descPrefix = T.t('serp.rich_eligible') + ' — ';
  descEl.textContent = descPrefix + (displayDesc || T.t('serp.no_desc'));
  desktopCard.appendChild(descEl);

  desktopSection.appendChild(desktopCard);
  wrap.appendChild(desktopSection);

  // ── Google Mobile preview ──────────────────────────────────────────────────
  var mobileSection = document.createElement('div');
  mobileSection.className = 'serp-section';
  var mobileLabel = document.createElement('div');
  mobileLabel.className = 'og-section-label';
  mobileLabel.textContent = T.t('serp.mobile_preview');
  mobileSection.appendChild(mobileLabel);

  var mobileCard = document.createElement('div');
  mobileCard.className = 'serp-card serp-mobile';

  var mobUrlRow = document.createElement('div');
  mobUrlRow.className = 'serp-url-row';
  if (favicon) {
    var mobFav = document.createElement('img');
    mobFav.src = favicon;
    mobFav.className = 'serp-favicon';
    mobFav.alt = '';
    mobFav.onerror = function() { mobFav.style.display = 'none'; };
    mobUrlRow.appendChild(mobFav);
  }
  var mobUrlText = document.createElement('span');
  mobUrlText.className = 'serp-url';
  mobUrlText.textContent = domain;
  mobUrlRow.appendChild(mobUrlText);
  mobileCard.appendChild(mobUrlRow);

  var mobTitleEl = document.createElement('div');
  mobTitleEl.className = 'serp-title serp-title-mobile';
  mobTitleEl.textContent = mobileDisplayTitle || T.t('og.no_title');
  mobileCard.appendChild(mobTitleEl);

  if (ratingInfo && ratingInfo.rating) {
    var mobStarsRow = document.createElement('div');
    mobStarsRow.className = 'serp-stars-row';
    var mobStarsEl = document.createElement('span');
    mobStarsEl.className = 'serp-stars';
    var mobRating = parseFloat(ratingInfo.rating);
    var mobFull = Math.floor(Math.min(mobRating, 5));
    var mobHalf = (mobRating - mobFull) >= 0.3;
    var mobStarStr = '';
    for (var ms = 0; ms < mobFull; ms++) mobStarStr += '★';
    if (mobHalf) mobStarStr += '½';
    for (var ms2 = mobFull + (mobHalf ? 1 : 0); ms2 < 5; ms2++) mobStarStr += '☆';
    mobStarsEl.textContent = mobStarStr;
    mobStarsRow.appendChild(mobStarsEl);
    var mobRatingText = document.createElement('span');
    mobRatingText.className = 'serp-rating-text';
    mobRatingText.textContent = ratingInfo.rating + (ratingInfo.count ? ' (' + Number(ratingInfo.count).toLocaleString('uk-UA') + ')' : '');
    mobStarsRow.appendChild(mobRatingText);
    mobileCard.appendChild(mobStarsRow);
  }

  if (formattedDate) {
    var mobDate = document.createElement('div');
    mobDate.className = 'serp-date';
    mobDate.textContent = formattedDate;
    mobileCard.appendChild(mobDate);
  }

  var mobDescEl = document.createElement('div');
  mobDescEl.className = 'serp-desc serp-desc-mobile';
  var mobDescPrefix = '';
  if (hasRich && !ratingInfo) mobDescPrefix = T.t('serp.rich_eligible') + ' — ';
  mobDescEl.textContent = mobDescPrefix + (mobileDisplayDesc || T.t('serp.no_desc'));
  mobileCard.appendChild(mobDescEl);

  mobileSection.appendChild(mobileCard);
  wrap.appendChild(mobileSection);

  // ── Char counters ──────────────────────────────────────────────────────────
  var countersSection = document.createElement('div');
  countersSection.className = 'serp-counters-section';

  countersSection.appendChild(buildCharCounter(
    T.t('serp.title'), rawTitle, titleLen, SERP_TITLE_WARN, SERP_TITLE_MAX
  ));
  countersSection.appendChild(buildCharCounter(
    T.t('serp.desc'), rawDesc, descLen, SERP_DESC_WARN, SERP_DESC_MAX
  ));
  countersSection.appendChild(buildCharCounter(
    T.t('serp.mobile_title'), rawTitle, titleLen, SERP_MOBILE_TITLE_MAX - 10, SERP_MOBILE_TITLE_MAX
  ));

  wrap.appendChild(countersSection);

  // ── Schema types ───────────────────────────────────────────────────────────
  if (schemaTypes.length > 0) {
    var schemaSection = document.createElement('div');
    schemaSection.className = 'serp-schema-section';
    var schemaLabel = document.createElement('div');
    schemaLabel.className = 'og-section-label';
    schemaLabel.textContent = T.t('serp.schema_types');
    schemaSection.appendChild(schemaLabel);
    var schemaWrap = document.createElement('div');
    schemaWrap.className = 'serp-schema-tags';
    schemaTypes.forEach(function(st) {
      var tag = document.createElement('span');
      tag.className = 'serp-schema-tag';
      tag.textContent = st;
      schemaWrap.appendChild(tag);
    });
    schemaSection.appendChild(schemaWrap);
    wrap.appendChild(schemaSection);
  }

  // ── Optimization tips ──────────────────────────────────────────────────────
  var tips = buildSerpTips(rawTitle, rawDesc, titleLen, descLen, checkerData, hasRich, schemaTypes);
  if (tips.length > 0) {
    var tipsSection = document.createElement('div');
    tipsSection.className = 'serp-tips-section';
    var tipsLabel = document.createElement('div');
    tipsLabel.className = 'og-section-label';
    tipsLabel.textContent = T.t('serp.tips');
    tipsSection.appendChild(tipsLabel);
    tips.forEach(function(tip) {
      var tipEl = document.createElement('div');
      tipEl.className = 'serp-tip-item serp-tip-' + tip.severity;
      var icon = document.createElement('span');
      icon.className = 'serp-tip-icon';
      icon.textContent = tip.severity === 'critical' ? '✗' : tip.severity === 'warning' ? '!' : 'i';
      var tipText = document.createElement('span');
      tipText.className = 'serp-tip-text';
      tipText.textContent = tip.text;
      tipEl.appendChild(icon);
      tipEl.appendChild(tipText);
      tipsSection.appendChild(tipEl);
    });
    wrap.appendChild(tipsSection);
  }

  // ── Source values ──────────────────────────────────────────────────────────
  var sourceSection = document.createElement('div');
  sourceSection.className = 'serp-source-section';
  var sourceLabel = document.createElement('div');
  sourceLabel.className = 'og-section-label';
  sourceLabel.textContent = T.t('serp.source');
  sourceSection.appendChild(sourceLabel);

  [
    ['<title>', meta.title],
    ['og:title', meta.ogTitle],
    ['meta description', meta.description],
    ['og:description', meta.ogDescription],
    ['canonical', meta.canonical],
    ['published', formattedDate || publishedDate],
  ].forEach(function(row) {
    if (!row[1]) return;
    var item = document.createElement('div');
    item.className = 'serp-source-item';
    var key = document.createElement('span');
    key.className = 'serp-source-key';
    key.textContent = row[0];
    var val = document.createElement('span');
    val.className = 'serp-source-val';
    val.textContent = row[1];
    item.appendChild(key); item.appendChild(val);
    sourceSection.appendChild(item);
  });

  wrap.appendChild(sourceSection);
  panel.appendChild(wrap);
}

function buildSerpTips(title, desc, titleLen, descLen, checkerData, hasRich, schemaTypes) {
  var tips = [];
  var issues = checkerData.issues || [];

  for (var i = 0; i < issues.length; i++) {
    var iss = issues[i];
    if (iss.severity === 'info') continue;
    if (iss.type === 'serp_noindex') {
      tips.push({ severity: 'critical', text: T.t('serp.tip_noindex') });
    } else if (iss.type === 'serp_missing_title') {
      tips.push({ severity: 'critical', text: T.t('serp.tip_add_title') });
    } else if (iss.type === 'serp_short_title') {
      tips.push({ severity: 'warning', text: T.t('serp.tip_extend_title') });
    } else if (iss.type === 'serp_long_title') {
      tips.push({ severity: 'notice', text: T.t('serp.tip_shorten_title') });
    } else if (iss.type === 'serp_title_too_wide') {
      tips.push({ severity: 'notice', text: T.t('serp.tip_narrow_title') });
    } else if (iss.type === 'serp_advertising_title') {
      tips.push({ severity: 'notice', text: T.t('serp.tip_ad_title') });
    } else if (iss.type === 'serp_missing_description') {
      tips.push({ severity: 'warning', text: T.t('serp.tip_add_desc') });
    } else if (iss.type === 'serp_empty_description') {
      tips.push({ severity: 'warning', text: T.t('serp.tip_fill_desc') });
    } else if (iss.type === 'serp_short_description') {
      tips.push({ severity: 'notice', text: T.t('serp.tip_extend_desc') });
    } else if (iss.type === 'serp_long_description') {
      tips.push({ severity: 'notice', text: T.t('serp.tip_shorten_desc') });
    } else if (iss.type === 'serp_title_equals_desc') {
      tips.push({ severity: 'notice', text: T.t('serp.tip_unique_desc') });
    } else if (iss.type === 'serp_title_mismatch_h1') {
      tips.push({ severity: 'warning', text: T.t('serp.tip_align_h1') });
    } else if (iss.type === 'serp_cross_canonical') {
      tips.push({ severity: 'warning', text: T.t('serp.tip_canonical') });
    } else if (iss.type === 'breadcrumb_schema_missing') {
      tips.push({ severity: 'notice', text: T.t('serp.tip_breadcrumb') });
    } else if (iss.type === 'website_schema_missing') {
      tips.push({ severity: 'notice', text: T.t('serp.tip_website_schema') });
    }
  }

  if (!hasRich && schemaTypes.length === 0) {
    tips.push({ severity: 'notice', text: T.t('serp.tip_no_schema') });
  } else if (hasRich) {
    tips.push({ severity: 'notice', text: T.t('serp.tip_rich_active') });
  }

  if (title && desc) {
    var tLower = title.toLowerCase();
    var dLower = desc.toLowerCase();
    var tWords = tLower.split(/\s+/).filter(function(w) { return w.length > 3; });
    var dWords = dLower.split(/\s+/).filter(function(w) { return w.length > 3; });
    var commonInDesc = tWords.filter(function(w) { return dWords.indexOf(w) !== -1; });
    if (tWords.length > 0 && commonInDesc.length === 0) {
      tips.push({ severity: 'notice', text: T.t('serp.tip_keyword_desc') });
    }
  }

  if (desc && desc.length > 0 && !/[0-9]/.test(desc)) {
    tips.push({ severity: 'notice', text: T.t('serp.tip_number_desc') });
  }

  return tips;
}

function buildCharCounter(label, text, len, warnAt, maxAt) {
  var row = document.createElement('div');
  row.className = 'serp-counter-row';

  var labelEl = document.createElement('span');
  labelEl.className = 'serp-counter-label';
  labelEl.textContent = label;

  var barWrap = document.createElement('div');
  barWrap.className = 'serp-counter-bar-wrap';
  var bar = document.createElement('div');
  bar.className = 'serp-counter-bar';
  var pct = Math.min(len / maxAt * 100, 100);
  bar.style.width = pct + '%';
  if (len > maxAt) bar.classList.add('over');
  else if (len > warnAt) bar.classList.add('warn');
  else bar.classList.add('ok');
  barWrap.appendChild(bar);

  var count = document.createElement('span');
  count.className = 'serp-counter-val' + (len > maxAt ? ' over' : len > warnAt ? ' warn' : '');
  count.textContent = len + ' / ' + maxAt;

  row.appendChild(labelEl); row.appendChild(barWrap); row.appendChild(count);
  return row;
}
