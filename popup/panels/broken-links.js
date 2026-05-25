// ─── Broken Links ─────────────────────────────────────────────────────────────

var blLastResults    = null;
var blIgnoreList     = [];
var blShowIgnored    = false;
var blLastElapsed    = '0';
var blCurrentOrigin  = '';
var BL_TRANSIENT     = { 429: 1, 503: 1 };

function blClassifyResult(r) {
  var s = r.finalStatus;
  if (s >= 400 && s !== 403 && !BL_TRANSIENT[s]) return 'broken';
  if (BL_TRANSIENT[s]) return 'transient';
  if (s === 0) return 'unreachable';
  if (s === 403) return 'forbidden';
  if (r.chain && r.chain.length >= 3 && s > 0 && s < 400) return 'chain';
  if (r.chain && r.chain.length === 2 && s > 0 && s < 400) {
    var firstStatus = r.chain[0].status;
    if (firstStatus === 301 || (blCurrentOrigin && r.url.indexOf(blCurrentOrigin) === 0)) return 'redirected';
  }
  // Opaque redirect: browser followed all hops transparently, chain has 1 entry but URL changed
  if (s > 0 && s < 400 && r.finalUrl && r.finalUrl !== r.url) return 'redirected';
  return 'ok';
}

function blSaveIgnoreList() {
  chrome.storage.local.set({ blIgnoreList: blIgnoreList });
}

function blUpdateIgnoreBar() {
  var bar = document.getElementById('bl-ignore-bar');
  if (!bar) return;
  var count = blIgnoreList.length;
  if (count === 0) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  var countEl = bar.querySelector('.bl-ignore-count');
  if (countEl) countEl.textContent = T.t('bl.ignored_count', { count: count });
  var showBtn = bar.querySelector('.bl-show-ignored-btn');
  if (showBtn) showBtn.textContent = T.t(blShowIgnored ? 'bl.ignore_hide' : 'bl.ignore_show');
}

function blExportCSV() {
  if (!blLastResults) return;

  var rows = [['URL', 'Anchor', 'Status', 'Type', 'Final URL']];
  blLastResults.forEach(function(r) {
    var type = blClassifyResult(r);
    var csvType = type === 'chain' ? 'redirect-chain' : type;
    var finalUrl = (r.chain && r.chain.length > 1) ? r.chain[r.chain.length - 1].url : (r.finalUrl || r.url);
    var anchor   = PopupState.blAnchorMap[r.url] || '';
    rows.push([r.url, anchor, String(r.finalStatus || r.error || ''), csvType, finalUrl]);
  });

  var csv = rows.map(function(row) {
    return row.map(function(cell) {
      return '"' + String(cell).replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\r\n');

  var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, 'broken-links.csv');
}

// Re-check a single link; replaces itemEl in-place with the new result.
function blRecheckItem(r, itemEl) {
  var btn = itemEl.querySelector('.bl-recheck-btn');
  if (btn) { btn.textContent = T.t('bl.rechecking'); btn.disabled = true; }

  // Disconnect any previous recheck port to avoid accumulation
  if (PopupState._blRecheckPort) {
    try { PopupState._blRecheckPort.disconnect(); } catch(e) {}
  }

  var port = chrome.runtime.connect({ name: 'linkChecker' });
  PopupState._blRecheckPort = port;
  var recheckDone = false;
  port.onMessage.addListener(function(msg) {
    if (msg.type !== 'done') return;
    recheckDone = true;
    port.disconnect();
    PopupState._blRecheckPort = null;
    var newResult = msg.results && msg.results[0];
    if (!newResult) return;
    if (blLastResults) {
      for (var i = 0; i < blLastResults.length; i++) {
        if (blLastResults[i].url === r.url) { blLastResults[i] = newResult; break; }
      }
    }
    var newEl = blBuildItem(newResult);
    if (itemEl.parentNode) itemEl.parentNode.replaceChild(newEl, itemEl);
  });
  port.onDisconnect.addListener(function() {
    if (recheckDone) return;
    PopupState._blRecheckPort = null;
    if (btn && btn.parentNode) { btn.textContent = '↻ ' + T.t('bl.recheck'); btn.disabled = false; }
  });

  port.postMessage({
    action: 'checkLinks',
    urls: [r.url],
    timeout: (PopupState.currentParams.bl_timeout || 12) * 1000,
    concurrent: 1
  });
}

// Attach ignore + re-check action buttons to a result item element.
function blAddActions(div, r) {
  var actions = document.createElement('div');
  actions.className = 'bl-item-actions';

  var recheckBtn = document.createElement('button');
  recheckBtn.className = 'bl-action-btn bl-recheck-btn';
  recheckBtn.textContent = '↻ ' + T.t('bl.recheck');
  recheckBtn.title = T.t('bl.recheck');
  (function(result, el) {
    recheckBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      blRecheckItem(result, el);
    });
  })(r, div);

  var isIgnored = blIgnoreList.indexOf(r.url) !== -1;
  var ignoreBtn = document.createElement('button');
  ignoreBtn.className = 'bl-action-btn bl-ignore-btn' + (isIgnored ? ' bl-unignore' : '');
  ignoreBtn.textContent = isIgnored ? T.t('bl.unignore') : T.t('bl.ignore');
  (function(result, el, btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var idx = blIgnoreList.indexOf(result.url);
      if (idx === -1) {
        blIgnoreList.push(result.url);
        el.classList.add('bl-ignored');
        if (!blShowIgnored) el.classList.add('hidden');
        btn.className = 'bl-action-btn bl-ignore-btn bl-unignore';
        btn.textContent = T.t('bl.unignore');
      } else {
        blIgnoreList.splice(idx, 1);
        el.classList.remove('bl-ignored', 'hidden');
        btn.className = 'bl-action-btn bl-ignore-btn';
        btn.textContent = T.t('bl.ignore');
      }
      blSaveIgnoreList();
      blUpdateIgnoreBar();
    });
  })(r, div, ignoreBtn);

  actions.appendChild(recheckBtn);
  actions.appendChild(ignoreBtn);
  div.appendChild(actions);
}

var BL_WARN_TYPES = { transient: true, unreachable: true, forbidden: true };

// Universal item builder — picks the right renderer and adds actions.
function blBuildItem(r, type) {
  type = type || blClassifyResult(r);
  var div;
  if (type === 'chain') {
    div = buildChainItem(r);
  } else if (type === 'redirected') {
    div = buildRedirectedItem(r);
  } else {
    div = buildBrokenItem(r, !!BL_WARN_TYPES[type]);
  }

  blAddActions(div, r);

  if (blIgnoreList.indexOf(r.url) !== -1) {
    div.classList.add('bl-ignored');
    if (!blShowIgnored) div.classList.add('hidden');
  }

  return div;
}

function initBrokenLinksPanel(tabId) {
  if (PopupState.brokenLinksChecked) return;

  chrome.storage.local.get({ blIgnoreList: [] }, function(d) {
    blIgnoreList = d.blIgnoreList || [];

    chrome.tabs.sendMessage(tabId, { action: 'getLinks' }, function(links) {
      if (chrome.runtime.lastError || !links) {
        document.getElementById('bl-count-msg').textContent = T.t('bl.fetch_fail');
        return;
      }
      PopupState.blAnchorMap = {};
      var urls = links.map(function(item) {
        PopupState.blAnchorMap[item.url] = item.anchor;
        return item.url;
      });
      var count = urls.length;
      var limit = PopupState.currentParams.bl_max_urls || 150;
      var toCheck = urls.slice(0, limit);
      var hint = T.t('bl.found', { count: count });
      if (count > limit) hint += ' · ' + T.t('bl.limited', { limit: limit });
      document.getElementById('bl-count-msg').textContent = hint;
      var btn = document.getElementById('bl-start-btn');
      btn.textContent = T.t('bl.check_btn', { count: toCheck.length });
      btn.addEventListener('click', function() { startBrokenLinksCheck(toCheck); });
    });
  });
}

function startBrokenLinksCheck(urls) {
  document.getElementById('bl-idle').classList.add('hidden');
  document.getElementById('bl-results').classList.add('hidden');
  document.getElementById('bl-progress').classList.remove('hidden');

  var progressBar  = document.getElementById('bl-progress-bar');
  var progressText = document.getElementById('bl-progress-text');
  progressBar.style.width = '0%';
  progressText.textContent = '0 / ' + urls.length;
  var startTime = Date.now();

  PopupState.brokenLinksPort = chrome.runtime.connect({ name: 'linkChecker' });

  PopupState.brokenLinksPort.onMessage.addListener(function(msg) {
    if (msg.type === 'progress') {
      var pct = urls.length ? Math.round((msg.checked / msg.total) * 100) : 0;
      progressBar.style.width = pct + '%';
      progressText.textContent = msg.checked + ' / ' + msg.total;
    } else if (msg.type === 'done') {
      blLastElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      PopupState.brokenLinksPort.disconnect();
      PopupState.brokenLinksPort = null;
      PopupState.brokenLinksChecked = true;
      document.getElementById('bl-progress').classList.add('hidden');
      renderBrokenLinksResults(msg.results, blLastElapsed);
    }
  });

  PopupState.brokenLinksPort.onDisconnect.addListener(function() {
    if (PopupState.brokenLinksChecked) { PopupState.brokenLinksPort = null; return; }
    PopupState.brokenLinksPort = null;
    document.getElementById('bl-progress').classList.add('hidden');
    document.getElementById('bl-idle').classList.remove('hidden');
    document.getElementById('bl-count-msg').textContent = T.t('bl.connection_lost');
  });

  PopupState.brokenLinksPort.postMessage({
    action: 'checkLinks',
    urls: urls,
    timeout: (PopupState.currentParams.bl_timeout || 12) * 1000,
    concurrent: PopupState.currentParams.bl_concurrent || 6
  });
}

function renderBrokenLinksResults(results, elapsed) {
  blLastResults = results;

  var container = document.getElementById('bl-results');
  container.innerHTML = '';
  container.classList.remove('hidden');

  try { blCurrentOrigin = new URL(PopupState.currentTabUrl).origin; } catch(e) { blCurrentOrigin = ''; }

  var broken = [], transient = [], unreached = [], forbidden = [], chains = [], redirected = [];
  results.forEach(function(r) {
    var t = blClassifyResult(r);
    if (t === 'broken') broken.push(r);
    else if (t === 'transient') transient.push(r);
    else if (t === 'unreachable') unreached.push(r);
    else if (t === 'forbidden') forbidden.push(r);
    else if (t === 'chain') chains.push(r);
    else if (t === 'redirected') redirected.push(r);
  });

  // Update sidebar badge
  var brokenItem = document.querySelector('.sidebar-item[data-checker="broken_links"]');
  if (brokenItem) {
    var old = brokenItem.querySelector('.badge');
    if (old) old.remove();
    var total = broken.length + chains.length + transient.length + redirected.length;
    if (total > 0) {
      var badge = document.createElement('span');
      badge.className = 'badge' + (broken.length > 0 ? '' : ' warning-badge');
      badge.textContent = total;
      brokenItem.appendChild(badge);
    }
  }

  // ── Toolbar: ignore bar + export button ──────────────────────────────────
  var toolbar = document.createElement('div');
  toolbar.className = 'bl-toolbar';

  // Ignore bar
  var ignoreBar = document.createElement('div');
  ignoreBar.id = 'bl-ignore-bar';
  ignoreBar.className = 'bl-ignore-bar' + (blIgnoreList.length ? '' : ' hidden');
  var ignoreCount = document.createElement('span');
  ignoreCount.className = 'bl-ignore-count';
  ignoreCount.textContent = T.t('bl.ignored_count', { count: blIgnoreList.length });

  var showBtn = document.createElement('button');
  showBtn.className = 'bl-action-btn bl-show-ignored-btn';
  showBtn.textContent = T.t(blShowIgnored ? 'bl.ignore_hide' : 'bl.ignore_show');
  showBtn.addEventListener('click', function() {
    blShowIgnored = !blShowIgnored;
    showBtn.textContent = T.t(blShowIgnored ? 'bl.ignore_hide' : 'bl.ignore_show');
    container.querySelectorAll('.bl-item.bl-ignored').forEach(function(el) {
      el.classList.toggle('hidden', !blShowIgnored);
    });
  });

  var clearBtn = document.createElement('button');
  clearBtn.className = 'bl-action-btn';
  clearBtn.textContent = T.t('bl.ignore_clear');
  clearBtn.addEventListener('click', function() {
    blIgnoreList = [];
    blSaveIgnoreList();
    container.querySelectorAll('.bl-item.bl-ignored').forEach(function(el) {
      el.classList.remove('bl-ignored', 'hidden');
      var ignBtn = el.querySelector('.bl-ignore-btn');
      if (ignBtn) {
        ignBtn.className = 'bl-action-btn bl-ignore-btn';
        ignBtn.textContent = T.t('bl.ignore');
      }
    });
    ignoreBar.classList.add('hidden');
  });

  ignoreBar.appendChild(ignoreCount);
  ignoreBar.appendChild(showBtn);
  ignoreBar.appendChild(clearBtn);

  // Export CSV button
  var exportBtn = document.createElement('button');
  exportBtn.className = 'bl-action-btn bl-export-csv-btn';
  exportBtn.textContent = T.t('bl.export_csv');
  exportBtn.title = T.t('bl.export_csv');
  exportBtn.addEventListener('click', blExportCSV);

  toolbar.appendChild(ignoreBar);
  toolbar.appendChild(exportBtn);
  container.appendChild(toolbar);

  // ── Summary ───────────────────────────────────────────────────────────────
  var summaryParts = [T.t('bl.summary', { count: results.length, elapsed: elapsed })];
  if (broken.length)    summaryParts.push(T.t('bl.broken',    { count: broken.length }));
  if (transient.length) summaryParts.push(T.t('bl.transient', { count: transient.length }));
  if (unreached.length) summaryParts.push(T.t('bl.unreached', { count: unreached.length }));
  if (forbidden.length) summaryParts.push(T.t('bl.forbidden', { count: forbidden.length }));
  if (chains.length)    summaryParts.push(T.t('bl.chains',    { count: chains.length }));
  if (redirected.length) summaryParts.push(T.t('bl.redirected', { count: redirected.length }));
  var summary = document.createElement('p');
  summary.className = 'bl-summary';
  summary.textContent = summaryParts.join(' · ');
  container.appendChild(summary);

  if (!broken.length && !chains.length && !forbidden.length && !unreached.length && !transient.length && !redirected.length) {
    var ok = document.createElement('div');
    ok.className = 'bl-no-issues';
    var okSpan = document.createElement('span');
    okSpan.className = 'checkmark';
    okSpan.textContent = '✅';
    var okP = document.createElement('p');
    okP.textContent = T.t('bl.all_ok');
    ok.appendChild(okSpan);
    ok.appendChild(okP);
    container.appendChild(ok);
    return;
  }

  function addSection(title, cls) {
    var t = document.createElement('div');
    t.className = 'bl-section-title' + (cls ? ' ' + cls : '');
    t.textContent = title;
    container.appendChild(t);
  }

  if (broken.length) {
    addSection(T.t('bl.section.broken', { count: broken.length }));
    broken.forEach(function(r) { container.appendChild(blBuildItem(r, 'broken')); });
  }
  if (chains.length) {
    addSection(T.t('bl.section.chains', { count: chains.length }));
    chains.forEach(function(r) { container.appendChild(blBuildItem(r, 'chain')); });
  }
  if (redirected.length) {
    addSection(T.t('bl.section.redirected', { count: redirected.length }), 'bl-section-warn');
    var hintR = document.createElement('div');
    hintR.className = 'bl-403-hint';
    hintR.textContent = T.t('bl.redirected_hint');
    container.appendChild(hintR);
    redirected.forEach(function(r) { container.appendChild(blBuildItem(r, 'redirected')); });
  }
  if (transient.length) {
    addSection(T.t('bl.section.transient', { count: transient.length }), 'bl-section-warn');
    var hintT = document.createElement('div');
    hintT.className = 'bl-403-hint';
    hintT.textContent = T.t('bl.transient_hint');
    container.appendChild(hintT);
    transient.forEach(function(r) { container.appendChild(blBuildItem(r, 'transient')); });
  }
  if (unreached.length) {
    addSection(T.t('bl.section.unreached', { count: unreached.length }), 'bl-section-warn');
    var hint2 = document.createElement('div');
    hint2.className = 'bl-403-hint';
    hint2.textContent = T.t('bl.unreached_hint');
    container.appendChild(hint2);
    unreached.forEach(function(r) { container.appendChild(blBuildItem(r, 'unreachable')); });
  }
  if (forbidden.length) {
    addSection(T.t('bl.section.forbidden', { count: forbidden.length }), 'bl-section-warn');
    var hintF = document.createElement('div');
    hintF.className = 'bl-403-hint';
    hintF.textContent = T.t('bl.forbidden_hint');
    container.appendChild(hintF);
    forbidden.forEach(function(r) { container.appendChild(blBuildItem(r, 'forbidden')); });
  }
}

function buildBrokenItem(r, isWarn) {
  var div = document.createElement('div');
  div.className = 'bl-item ' + (isWarn ? 'forbidden' : 'broken');
  div.style.cursor = 'pointer';
  div.title = T.t('bl.highlight_link');
  div.addEventListener('click', function() {
    if (PopupState.currentTabId) chrome.tabs.sendMessage(PopupState.currentTabId, { action: 'highlightLink', url: r.url });
  });
  var header = document.createElement('div');
  header.className = 'bl-item-header';
  var badge = document.createElement('span');
  badge.className = 'bl-status ' + (isWarn ? 's-chain' : 's-broken');
  badge.textContent = r.finalStatus === 0 ? (r.error === 'timeout' ? 'TIMEOUT' : 'ERR') : String(r.finalStatus);
  var url = document.createElement('span');
  url.className = 'bl-url';
  url.textContent = shortenUrl(r.url);
  url.title = r.url;
  header.appendChild(badge); header.appendChild(url);
  div.appendChild(header);
  var anchor = PopupState.blAnchorMap[r.url];
  if (anchor) {
    var anch = document.createElement('div');
    anch.className = 'bl-anchor';
    anch.textContent = anchor;
    div.appendChild(anch);
  }
  if (r.finalStatus === 0 && r.error) {
    var d = document.createElement('div');
    d.className = 'bl-chain-detail';
    if (r.error === 'timeout') {
      d.textContent = T.t('bl.timeout', { timeout: PopupState.currentParams.bl_timeout || 12 });
    } else if (r.error === 'opaque-redirect') {
      d.textContent = T.t('bl.opaque_redirect');
    } else {
      d.textContent = r.error;
    }
    div.appendChild(d);
  }
  return div;
}

function buildChainItem(r) {
  var div = document.createElement('div');
  div.className = 'bl-item chain';
  div.style.cursor = 'pointer';
  div.title = T.t('bl.highlight_link');
  div.addEventListener('click', function() {
    if (PopupState.currentTabId) chrome.tabs.sendMessage(PopupState.currentTabId, { action: 'highlightLink', url: r.url });
  });
  var header = document.createElement('div');
  header.className = 'bl-item-header';
  var badge = document.createElement('span');
  badge.className = 'bl-status s-chain';
  badge.textContent = T.t('bl.hops', { count: r.chain.length });
  var url = document.createElement('span');
  url.className = 'bl-url';
  url.textContent = shortenUrl(r.url);
  url.title = r.url;
  header.appendChild(badge); header.appendChild(url);
  div.appendChild(header);
  var anchor = PopupState.blAnchorMap[r.url];
  if (anchor) {
    var anch = document.createElement('div');
    anch.className = 'bl-anchor';
    anch.textContent = anchor;
    div.appendChild(anch);
  }
  var detail = document.createElement('div');
  detail.className = 'bl-chain-detail';
  r.chain.forEach(function(hop, i) {
    var el = document.createElement('div');
    el.className = 'hop';
    var arrow = document.createElement('span');
    arrow.className = 'hop-arrow';
    arrow.textContent = i === 0 ? '↳' : '→';
    var hopUrl = document.createElement('span');
    hopUrl.textContent = shortenUrl(hop.url) + ' [' + hop.status + ']';
    el.appendChild(arrow); el.appendChild(hopUrl);
    detail.appendChild(el);
  });
  div.appendChild(detail);
  return div;
}

function buildRedirectedItem(r) {
  var div = document.createElement('div');
  div.className = 'bl-item chain';
  div.style.cursor = 'pointer';
  div.title = T.t('bl.highlight_link');
  div.addEventListener('click', function() {
    if (PopupState.currentTabId) chrome.tabs.sendMessage(PopupState.currentTabId, { action: 'highlightLink', url: r.url });
  });
  var header = document.createElement('div');
  header.className = 'bl-item-header';
  var badge = document.createElement('span');
  badge.className = 'bl-status s-chain';
  // chain.length >= 2: actual redirect status known; chain.length === 1: opaque redirect
  var firstHopStatus = (r.chain && r.chain.length >= 2) ? r.chain[0].status : 0;
  badge.textContent = firstHopStatus ? String(firstHopStatus) : '3xx';
  var url = document.createElement('span');
  url.className = 'bl-url';
  url.textContent = shortenUrl(r.url);
  url.title = r.url;
  header.appendChild(badge); header.appendChild(url);
  div.appendChild(header);
  var anchor = PopupState.blAnchorMap[r.url];
  if (anchor) {
    var anch = document.createElement('div');
    anch.className = 'bl-anchor';
    anch.textContent = anchor;
    div.appendChild(anch);
  }
  var detail = document.createElement('div');
  detail.className = 'bl-chain-detail';
  var hop = document.createElement('div');
  hop.className = 'hop';
  var arrow = document.createElement('span');
  arrow.className = 'hop-arrow';
  arrow.textContent = '→';
  var hopUrl = document.createElement('span');
  var targetUrl = (r.chain && r.chain.length >= 2) ? r.chain[1].url : r.finalUrl;
  var targetStatus = (r.chain && r.chain.length >= 2) ? r.chain[1].status : r.finalStatus;
  hopUrl.textContent = shortenUrl(targetUrl) + ' [' + targetStatus + ']';
  hop.appendChild(arrow); hop.appendChild(hopUrl);
  detail.appendChild(hop);
  div.appendChild(detail);
  return div;
}

function shortenUrl(url) {
  if (url.length <= 60) return url;
  try {
    var u = new URL(url);
    var path = u.pathname + u.search;
    if (path.length > 40) path = path.substring(0, 38) + '…';
    return u.hostname + path;
  } catch(e) { return url.substring(0, 57) + '…'; }
}
