// ─── Sitemap Viewer Panel ─────────────────────────────────────────────────────

var SITEMAP_URL_PREVIEW = 50;
var SITEMAP_SHOW_MORE_INCREMENT = 100;

function getSitemapUrlsFromRobots() {
  var results = PopupState.lastResults || [];
  for (var i = 0; i < results.length; i++) {
    if (results[i].id !== 'robots') continue;
    var issues = results[i].issues || [];
    for (var j = 0; j < issues.length; j++) {
      var iss = issues[j];
      if (iss.type === 'robots_overview' && iss.sitemapUrls && iss.sitemapUrls.length) {
        return iss.sitemapUrls;
      }
    }
  }
  return [];
}

function trySitemapUrls(urls, panel, origin) {
  if (!urls.length) {
    panel.innerHTML = '';
    renderSitemapNotFound(panel, origin);
    return;
  }
  var url = urls[0];
  var rest = urls.slice(1);
  fetchSitemap(url, function(resp) {
    if (resp && resp.ok) {
      panel.innerHTML = '';
      renderSitemap(panel, resp.text, url);
    } else {
      trySitemapUrls(rest, panel, origin);
    }
  });
}

function initSitemapPanel(pageUrl) {
  if (PopupState.sitemapLoaded) return;
  PopupState.sitemapLoaded = true;

  var panel = document.getElementById('sitemap-panel');
  var loadingDiv = document.createElement('div');
  loadingDiv.className = 'panel-loading';
  loadingDiv.textContent = T.t('popup.loading');
  panel.innerHTML = '';
  panel.appendChild(loadingDiv);

  var origin = '';
  try { origin = new URL(pageUrl).origin; } catch(e) {
    var errDiv = document.createElement('div');
    errDiv.className = 'panel-error';
    errDiv.textContent = T.t('sitemap.invalid_url');
    panel.innerHTML = '';
    panel.appendChild(errDiv);
    return;
  }

  var robotsUrls = getSitemapUrlsFromRobots();
  var fallbacks = [origin + '/sitemap.xml', origin + '/sitemap_index.xml'];
  var seen = {};
  var candidates = [];
  Array.prototype.forEach.call(robotsUrls.concat(fallbacks), function(u) {
    if (u && !seen[u]) { seen[u] = true; candidates.push(u); }
  });

  trySitemapUrls(candidates, panel, origin);
}

function fetchSitemap(url, cb) {
  fetchTextWithRetry(url, function(resp) { cb(resp); });
}

function renderSitemapNotFound(panel, origin) {
  var wrap = document.createElement('div');
  wrap.className = 'sitemap-wrap';
  var msg = document.createElement('div');
  msg.className = 'panel-error';
  msg.textContent = T.t('sitemap.not_found');
  var hint = document.createElement('div');
  hint.className = 'sitemap-hint';
  hint.textContent = T.t('sitemap.hint_robots');
  wrap.appendChild(msg);
  wrap.appendChild(hint);

  wrap.appendChild(buildSitemapInput(panel, origin));
  panel.appendChild(wrap);
}

function buildSitemapInput(panel, origin) {
  var form = document.createElement('div');
  form.className = 'sitemap-manual';
  var label = document.createElement('div');
  label.className = 'sitemap-manual-label';
  label.textContent = T.t('sitemap.manual_label');
  var row = document.createElement('div');
  row.className = 'sitemap-manual-row';
  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'sitemap-manual-input';
  input.value = origin + '/sitemap.xml';
  input.placeholder = 'https://example.com/sitemap.xml';
  var btn = document.createElement('button');
  btn.className = 'sitemap-fetch-btn';
  btn.textContent = T.t('sitemap.fetch_btn');
  btn.addEventListener('click', function() {
    var url = input.value.trim();
    if (!url) return;
    btn.disabled = true;
    btn.textContent = T.t('popup.loading');
    fetchSitemap(url, function(resp) {
      btn.disabled = false;
      btn.textContent = T.t('sitemap.fetch_btn');
      if (resp && resp.ok) {
        panel.innerHTML = '';
        renderSitemap(panel, resp.text, url);
      } else {
        label.textContent = T.t('sitemap.fetch_fail');
      }
    });
  });
  row.appendChild(input); row.appendChild(btn);
  form.appendChild(label); form.appendChild(row);
  return form;
}

function renderSitemap(panel, xml, sourceUrl) {
  var wrap = document.createElement('div');
  wrap.className = 'sitemap-wrap';

  var urlBar = document.createElement('div');
  urlBar.className = 'rtxt-url-bar';
  urlBar.textContent = sourceUrl;
  wrap.appendChild(urlBar);

  var parser = new DOMParser();
  var doc;
  try { doc = parser.parseFromString(xml, 'application/xml'); } catch(e) {
    wrap.appendChild(makeError(T.t('sitemap.parse_fail')));
    panel.appendChild(wrap);
    return;
  }
  var parseErr = doc.querySelector('parsererror');
  if (parseErr) {
    wrap.appendChild(makeError(T.t('sitemap.parse_fail')));
    panel.appendChild(wrap);
    return;
  }

  var root = doc.documentElement;
  var isIndex = root.localName === 'sitemapindex';

  if (isIndex) {
    renderSitemapIndex(wrap, doc, panel);
  } else {
    renderUrlset(wrap, doc, sourceUrl, panel);
  }

  panel.appendChild(wrap);
}

function renderSitemapIndex(wrap, doc, panel) {
  var sitemapNodes = doc.querySelectorAll('sitemap');
  var statsEl = document.createElement('div');
  statsEl.className = 'sitemap-stats';
  statsEl.textContent = T.t('sitemap.index_count', { count: sitemapNodes.length });
  wrap.appendChild(statsEl);

  // Search input
  var searchWrap = document.createElement('div');
  searchWrap.className = 'sitemap-search-wrap';
  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'sitemap-search-input';
  searchInput.placeholder = T.t('sitemap.search_placeholder');
  searchWrap.appendChild(searchInput);
  wrap.appendChild(searchWrap);

  // Collect all items
  var allItems = [];
  Array.prototype.forEach.call(sitemapNodes, function(s) {
    var locEl = s.querySelector('loc');
    var lastmodEl = s.querySelector('lastmod');
    if (!locEl) return;
    var url = locEl.textContent.trim();
    var lm = lastmodEl ? lastmodEl.textContent.trim() : '';
    allItems.push({ url: url, lastmod: lm });
  });

  var list = document.createElement('div');
  list.className = 'sitemap-list';
  wrap.appendChild(list);

  var countHint = document.createElement('div');
  countHint.className = 'sitemap-search-count';
  wrap.appendChild(countHint);

  function renderItems(filter) {
    list.innerHTML = '';
    filter = (filter || '').toLowerCase();
    var filtered = allItems;
    if (filter) {
      filtered = [];
      Array.prototype.forEach.call(allItems, function(it) {
        if (it.url.toLowerCase().indexOf(filter) !== -1) filtered.push(it);
      });
    }
    Array.prototype.forEach.call(filtered, function(it) {
      var item = document.createElement('div');
      item.className = 'sitemap-sub-item';
      var loc = document.createElement('div');
      loc.className = 'sitemap-sub-loc';
      loc.textContent = it.url;
      item.appendChild(loc);
      if (it.lastmod) {
        var lmEl = document.createElement('div');
        lmEl.className = 'sitemap-sub-meta';
        lmEl.textContent = it.lastmod;
        item.appendChild(lmEl);
      }
      var fetchBtn = document.createElement('button');
      fetchBtn.className = 'sitemap-fetch-sub-btn';
      fetchBtn.textContent = T.t('sitemap.view_btn');
      (function(url) {
        fetchBtn.addEventListener('click', function() {
          fetchBtn.disabled = true;
          fetchBtn.textContent = T.t('popup.loading');
          fetchSitemap(url, function(resp) {
            if (resp && resp.ok) {
              if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
              panel.innerHTML = '';
              var backBtn = document.createElement('button');
              backBtn.className = 'sitemap-back-btn';
              backBtn.textContent = '\u2190 ' + T.t('sitemap.back_to_index');
              backBtn.addEventListener('click', function() {
                panel.innerHTML = '';
                panel.appendChild(wrap);
              });
              panel.appendChild(backBtn);
              renderSitemap(panel, resp.text, url);
            } else {
              fetchBtn.disabled = false;
              fetchBtn.textContent = T.t('sitemap.fetch_fail');
            }
          });
        });
      })(it.url);
      item.appendChild(fetchBtn);
      list.appendChild(item);
    });
    countHint.textContent = filtered.length + ' / ' + allItems.length;
  }

  renderItems('');
  searchInput.addEventListener('input', function() {
    renderItems(searchInput.value);
  });
}

function renderUrlset(wrap, doc, sourceUrl, panel) {
  var urlNodes = doc.querySelectorAll('url');
  var total = urlNodes.length;

  // Collect all URL data upfront
  var urlData = [];
  var lastmods = [];
  Array.prototype.forEach.call(urlNodes, function(u) {
    var locEl = u.querySelector('loc');
    var lmEl = u.querySelector('lastmod');
    var prioEl = u.querySelector('priority');
    if (!locEl) return;
    var entry = { loc: locEl.textContent.trim() };
    if (lmEl) {
      entry.lastmod = lmEl.textContent.trim();
      var d = new Date(lmEl.textContent.trim());
      if (!isNaN(d.getTime())) lastmods.push(d);
    }
    if (prioEl) entry.priority = prioEl.textContent.trim();
    urlData.push(entry);
  });

  lastmods.sort(function(a, b) { return a - b; });
  var newest = lastmods.length ? lastmods[lastmods.length - 1] : null;
  var oldest = lastmods.length ? lastmods[0] : null;

  var stats = document.createElement('div');
  stats.className = 'sitemap-stats-block';
  var statsItems = [
    [T.t('sitemap.total_urls'), total],
    [T.t('sitemap.with_lastmod'), lastmods.length],
  ];
  if (newest) statsItems.push([T.t('sitemap.newest'), newest.toISOString().substring(0, 10)]);
  if (oldest && oldest.getTime() !== newest.getTime()) statsItems.push([T.t('sitemap.oldest'), oldest.toISOString().substring(0, 10)]);
  Array.prototype.forEach.call(statsItems, function(pair) {
    var row = document.createElement('div');
    row.className = 'sitemap-stat-row';
    var k = document.createElement('span');
    k.className = 'sitemap-stat-key';
    k.textContent = pair[0];
    var v = document.createElement('span');
    v.className = 'sitemap-stat-val';
    v.textContent = pair[1];
    row.appendChild(k); row.appendChild(v);
    stats.appendChild(row);
  });
  wrap.appendChild(stats);

  // Actions row: copy all
  var actionsRow = document.createElement('div');
  actionsRow.className = 'sitemap-actions-row';
  var copyBtn = document.createElement('button');
  copyBtn.className = 'sitemap-action-btn';
  copyBtn.textContent = T.t('sitemap.copy_all');
  (function() {
    copyBtn.addEventListener('click', function() {
      var text = '';
      for (var i = 0; i < urlData.length; i++) { text += urlData[i].loc + '\n'; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          copyBtn.textContent = T.t('sitemap.copied');
          setTimeout(function() { copyBtn.textContent = T.t('sitemap.copy_all'); }, 1500);
        });
      }
    });
  })();
  actionsRow.appendChild(copyBtn);
  wrap.appendChild(actionsRow);

  // Search input
  var searchWrap = document.createElement('div');
  searchWrap.className = 'sitemap-search-wrap';
  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'sitemap-search-input';
  searchInput.placeholder = T.t('sitemap.search_placeholder');
  searchWrap.appendChild(searchInput);
  wrap.appendChild(searchWrap);

  // URL list
  var listLabel = document.createElement('div');
  listLabel.className = 'og-section-label';
  wrap.appendChild(listLabel);

  var list = document.createElement('div');
  list.className = 'sitemap-url-list';
  wrap.appendChild(list);

  var moreBtnWrap = document.createElement('div');
  moreBtnWrap.className = 'sitemap-more-wrap';
  wrap.appendChild(moreBtnWrap);

  var currentCount = 0;
  var currentFilter = '';

  function renderList(filter) {
    currentFilter = (filter || '').toLowerCase();
    list.innerHTML = '';
    currentCount = 0;

    var filtered = urlData;
    if (currentFilter) {
      filtered = [];
      for (var i = 0; i < urlData.length; i++) {
        if (urlData[i].loc.toLowerCase().indexOf(currentFilter) !== -1) filtered.push(urlData[i]);
      }
    }

    var toShow = Math.min(filtered.length, SITEMAP_URL_PREVIEW);
    for (var j = 0; j < toShow; j++) {
      list.appendChild(createUrlItem(filtered[j]));
    }
    currentCount = toShow;

    listLabel.textContent = T.t('sitemap.url_list', { shown: toShow, total: filtered.length });

    moreBtnWrap.innerHTML = '';
    if (filtered.length > toShow) {
      var moreBtn = document.createElement('button');
      moreBtn.className = 'sitemap-more-btn';
      moreBtn.textContent = T.t('sitemap.show_more', { count: filtered.length - toShow });
      (function() {
        moreBtn.addEventListener('click', function() {
          var prev = currentCount;
          currentCount = Math.min(filtered.length, currentCount + SITEMAP_SHOW_MORE_INCREMENT);
          for (var k = prev; k < currentCount; k++) {
            list.appendChild(createUrlItem(filtered[k]));
          }
          listLabel.textContent = T.t('sitemap.url_list', { shown: currentCount, total: filtered.length });
          if (currentCount >= filtered.length) {
            moreBtnWrap.innerHTML = '';
          } else {
            moreBtn.textContent = T.t('sitemap.show_more', { count: filtered.length - currentCount });
          }
        });
      })();
      moreBtnWrap.appendChild(moreBtn);
    }
  }

  renderList('');
  searchInput.addEventListener('input', function() {
    renderList(searchInput.value);
  });
}

function createUrlItem(entry) {
  var item = document.createElement('div');
  item.className = 'sitemap-url-item';
  var locText = document.createElement('div');
  locText.className = 'sitemap-url-loc';
  locText.textContent = entry.loc;
  item.appendChild(locText);
  if (entry.lastmod || entry.priority) {
    var meta = document.createElement('div');
    meta.className = 'sitemap-url-meta';
    var parts = [];
    if (entry.lastmod) parts.push(entry.lastmod);
    if (entry.priority) parts.push(T.t('sitemap.priority') + ': ' + entry.priority);
    meta.textContent = parts.join('  \u00b7  ');
    item.appendChild(meta);
  }
  return item;
}

function makeError(msg) {
  var el = document.createElement('div');
  el.className = 'panel-error';
  el.textContent = msg;
  return el;
}
