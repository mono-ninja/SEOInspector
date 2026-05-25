// ─── OG / Social Preview Panel ────────────────────────────────────────────────

function initOgPreviewPanel(tabId) {
  if (PopupState.ogPreviewLoaded) return;
  PopupState.ogPreviewLoaded = true;

  var panel = document.getElementById('og-preview-panel');
  panel.innerHTML = '';
  var loadingDiv = document.createElement('div');
  loadingDiv.className = 'panel-loading';
  loadingDiv.setAttribute('data-i18n', 'popup.loading');
  loadingDiv.textContent = T.t('popup.loading');
  panel.appendChild(loadingDiv);

  chrome.tabs.sendMessage(tabId, { action: 'getPageMeta' }, function(meta) {
    if (chrome.runtime.lastError || !meta) {
      var errDiv = document.createElement('div');
      errDiv.className = 'panel-error';
      errDiv.textContent = T.t('og.fetch_fail');
      panel.innerHTML = '';
      panel.appendChild(errDiv);
      return;
    }
    panel.innerHTML = '';
    renderOgPreview(panel, meta);
  });
}

function renderOgPreview(panel, meta) {
  var wrap = document.createElement('div');
  wrap.className = 'og-preview-wrap';

  // ── Facebook / Open Graph card ─────────────────────────────────────────────
  var fbCard = ogCard('Facebook / LinkedIn', buildFbCard(meta), 'og-card-fb');
  wrap.appendChild(fbCard);

  // ── Twitter card ──────────────────────────────────────────────────────────
  var twCard = ogCard('Twitter / X', buildTwitterCard(meta), 'og-card-tw');
  wrap.appendChild(twCard);

  // ── Meta table ────────────────────────────────────────────────────────────
  var tableSection = document.createElement('div');
  tableSection.className = 'og-meta-table-section';
  var tableTitle = document.createElement('div');
  tableTitle.className = 'og-section-label';
  tableTitle.textContent = T.t('og.meta_tags');
  tableSection.appendChild(tableTitle);

  var rows = [
    ['og:title',       meta.ogTitle,       meta.ogTitle ? 'ok' : 'miss'],
    ['og:description', meta.ogDescription, meta.ogDescription ? 'ok' : 'miss'],
    ['og:image',       meta.ogImage,       meta.ogImage ? 'ok' : 'miss'],
    ['og:url',         meta.ogUrl,         meta.ogUrl ? 'ok' : 'warn'],
    ['og:type',        meta.ogType,        meta.ogType ? 'ok' : 'warn'],
    ['og:site_name',   meta.ogSiteName,    meta.ogSiteName ? 'ok' : 'warn'],
    ['twitter:card',   meta.twitterCard,   meta.twitterCard ? 'ok' : 'warn'],
    ['twitter:image',  meta.twitterImage,  meta.twitterImage ? 'ok' : 'warn'],
  ];

  var table = document.createElement('table');
  table.className = 'og-meta-table';
  rows.forEach(function(row) {
    var tr = document.createElement('tr');
    var tdKey = document.createElement('td');
    tdKey.className = 'og-meta-key';
    tdKey.textContent = row[0];
    var tdVal = document.createElement('td');
    tdVal.className = 'og-meta-val';
    tdVal.textContent = row[1] || '—';
    if (row[1] && row[1].length > 80) {
      tdVal.textContent = row[1].substring(0, 78) + '…';
      tdVal.title = row[1];
    }
    var tdSt = document.createElement('td');
    tdSt.className = 'og-meta-status og-st-' + row[2];
    tdSt.textContent = row[2] === 'ok' ? '✓' : row[2] === 'miss' ? '✗' : '!';
    tr.appendChild(tdKey); tr.appendChild(tdVal); tr.appendChild(tdSt);
    table.appendChild(tr);
  });
  tableSection.appendChild(table);
  wrap.appendChild(tableSection);

  panel.appendChild(wrap);
}

function ogCard(label, inner, cls) {
  var section = document.createElement('div');
  section.className = 'og-card-section';
  var lbl = document.createElement('div');
  lbl.className = 'og-section-label';
  lbl.textContent = label;
  section.appendChild(lbl);
  var card = document.createElement('div');
  card.className = 'og-card ' + cls;
  card.appendChild(inner);
  section.appendChild(card);
  return section;
}

function buildFbCard(meta) {
  var wrap = document.createElement('div');
  wrap.className = 'og-fb-card';

  // Image
  var imgUrl = meta.ogImage || '';
  var imgWrap = document.createElement('div');
  imgWrap.className = 'og-img-wrap';
  if (imgUrl) {
    var img = document.createElement('img');
    img.src = imgUrl;
    img.className = 'og-img';
    img.alt = '';
    img.onerror = function() { imgWrap.classList.add('og-img-err'); imgWrap.textContent = T.t('og.img_broken'); };
    imgWrap.appendChild(img);
  } else {
    imgWrap.className += ' og-img-placeholder';
    imgWrap.textContent = T.t('og.no_image');
  }
  wrap.appendChild(imgWrap);

  // Meta info
  var info = document.createElement('div');
  info.className = 'og-fb-info';
  var domain = '';
  try { domain = new URL(meta.ogUrl || meta.url || '').hostname.replace(/^www\./, ''); } catch(e) {}
  var domainEl = document.createElement('div');
  domainEl.className = 'og-fb-domain';
  domainEl.textContent = domain || (meta.ogSiteName || '');

  var title = document.createElement('div');
  title.className = 'og-fb-title';
  title.textContent = meta.ogTitle || meta.title || T.t('og.no_title');

  var desc = document.createElement('div');
  desc.className = 'og-fb-desc';
  var descText = meta.ogDescription || meta.description || '';
  desc.textContent = descText.length > 110 ? descText.substring(0, 108) + '…' : (descText || T.t('og.no_desc'));

  info.appendChild(domainEl); info.appendChild(title); info.appendChild(desc);
  wrap.appendChild(info);
  return wrap;
}

function buildTwitterCard(meta) {
  var card = meta.twitterCard || 'summary_large_image';
  var wrap = document.createElement('div');
  wrap.className = 'og-tw-card og-tw-' + (card === 'summary' ? 'summary' : 'large');

  var imgUrl = meta.twitterImage || meta.ogImage || '';

  if (card !== 'summary') {
    // Large image on top
    var imgWrap = document.createElement('div');
    imgWrap.className = 'og-img-wrap og-tw-img-wrap';
    if (imgUrl) {
      var img = document.createElement('img');
      img.src = imgUrl;
      img.className = 'og-img';
      img.alt = '';
    img.onerror = function() { imgWrap.classList.add('og-img-err'); imgWrap.removeChild(img); imgWrap.textContent = T.t('og.img_broken'); };
      imgWrap.appendChild(img);
    } else {
      imgWrap.className += ' og-img-placeholder';
      imgWrap.textContent = T.t('og.no_image');
    }
    wrap.appendChild(imgWrap);
  }

  var info = document.createElement('div');
  info.className = 'og-tw-info';

  if (card === 'summary' && imgUrl) {
    var thumbWrap = document.createElement('div');
    thumbWrap.className = 'og-tw-thumb-wrap';
    var thumb = document.createElement('img');
    thumb.src = imgUrl;
    thumb.className = 'og-tw-thumb';
    thumb.alt = '';
    thumbWrap.appendChild(thumb);
    info.appendChild(thumbWrap);
  }

  var textWrap = document.createElement('div');
  textWrap.className = 'og-tw-text';

  var title = document.createElement('div');
  title.className = 'og-tw-title';
  title.textContent = meta.twitterTitle || meta.ogTitle || meta.title || T.t('og.no_title');

  var desc = document.createElement('div');
  desc.className = 'og-tw-desc';
  var descText = meta.twitterDescription || meta.ogDescription || meta.description || '';
  desc.textContent = descText.length > 100 ? descText.substring(0, 98) + '…' : (descText || T.t('og.no_desc'));

  var site = document.createElement('div');
  site.className = 'og-tw-site';
  site.textContent = meta.twitterSite || '';

  textWrap.appendChild(title); textWrap.appendChild(desc);
  if (meta.twitterSite) textWrap.appendChild(site);
  info.appendChild(textWrap);
  wrap.appendChild(info);
  return wrap;
}
