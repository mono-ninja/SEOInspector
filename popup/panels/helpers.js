// ─── Panel helpers ────────────────────────────────────────────────────────────

function makePanelSection(title) {
  var section = document.createElement('div');
  section.className = 'panel-section';
  var h = document.createElement('div');
  h.className = 'panel-section-title';
  var span = document.createElement('span');
  span.textContent = title;
  h.appendChild(span);
  section.appendChild(h);
  return section;
}

function addClearButton(section, onConfirm) {
  var titleEl = section.querySelector('.panel-section-title');
  var btn = document.createElement('button');
  btn.className = 'panel-clear-btn';
  btn.textContent = T.t('storage.clear');
  var timer = null;

  btn.addEventListener('click', function() {
    if (btn.classList.contains('confirm')) {
      clearTimeout(timer);
      btn.disabled = true;
      btn.textContent = '⏳';
      onConfirm(function() {
        reloadStoragePanel();
      });
    } else {
      btn.classList.add('confirm');
      btn.textContent = T.t('storage.clear_confirm');
      timer = setTimeout(function() {
        btn.classList.remove('confirm');
        btn.textContent = T.t('storage.clear');
      }, 3000);
    }
  });

  titleEl.appendChild(btn);
}

function reloadStoragePanel() {
  PopupState.storageLoaded = false;
  var loading = document.getElementById('storage-loading');
  var content = document.getElementById('storage-content');
  if (loading) { loading.textContent = T.t('popup.storage.loading'); loading.classList.remove('hidden'); }
  if (content) content.classList.add('hidden');
  initStoragePanel(PopupState.currentTabId, PopupState.currentTabUrl);
}

function clearCookies(tabUrl, callback) {
  if (typeof chrome.cookies === 'undefined') { callback(); return; }
  var tabScheme = (tabUrl && tabUrl.indexOf('https://') === 0) ? 'https' : 'http';
  chrome.cookies.getAll({ url: tabUrl }, function(cookies) {
    if (chrome.runtime.lastError || !cookies || cookies.length === 0) { callback(); return; }
    var remaining = cookies.length;
    cookies.forEach(function(c) {
      var scheme = (c.secure || tabScheme === 'https') ? 'https' : 'http';
      var domain = c.domain.replace(/^\./, '');
      chrome.cookies.remove({ url: scheme + '://' + domain + (c.path || '/'), name: c.name }, function() {
        remaining--;
        if (remaining === 0) callback();
      });
    });
  });
}

// Sends fetchText via background.js with up to `maxRetries` retries on
// "message port closed" (MV3 service worker dormancy). Calls cb(resp, errMsg).
function fetchTextWithRetry(url, cb, maxRetries) {
  var remaining = (maxRetries !== undefined) ? maxRetries : 3;
  var delay = 600;
  function attempt() {
    chrome.runtime.sendMessage({ action: 'fetchText', url: url }, function(resp) {
      if (chrome.runtime.lastError) {
        var msg = chrome.runtime.lastError.message || '';
        // Service worker may be dormant — wait longer on first retry
        if (msg.indexOf('Extension context invalid') !== -1 || msg.indexOf('Could not establish') !== -1) {
          delay = Math.min(delay * 3, 5000);
        }
        if (remaining > 0) {
          remaining--;
          setTimeout(attempt, delay);
        } else {
          cb(null, msg || 'Extension error');
        }
        return;
      }
      cb(resp, null);
    });
  }
  attempt();
}

function makePanelEmpty(text) {
  var el = document.createElement('div');
  el.className = 'panel-empty';
  el.textContent = text;
  return el;
}

function makeTable(headers) {
  var tbl = document.createElement('table');
  tbl.className = 'data-table';
  var thead = document.createElement('thead');
  var tr = document.createElement('tr');
  headers.forEach(function(h) {
    var th = document.createElement('th');
    th.textContent = h;
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  tbl.appendChild(thead);
  tbl.appendChild(document.createElement('tbody'));
  return tbl;
}

function addTableRow(tbl, cells, classes) {
  var tbody = tbl.querySelector('tbody');
  var tr = document.createElement('tr');
  cells.forEach(function(val, i) {
    var td = document.createElement('td');
    td.textContent = val || '—';
    if (classes && classes[i]) td.className = classes[i];
    tr.appendChild(td);
  });
  tbody.appendChild(tr);
}
