// ─── Storage panel ────────────────────────────────────────────────────────────

function initStoragePanel(tabId, tabUrl) {
  if (PopupState.storageLoaded) return;

  var loading = document.getElementById('storage-loading');
  var content = document.getElementById('storage-content');
  loading.classList.remove('hidden');
  content.classList.add('hidden');

  chrome.tabs.sendMessage(tabId, { action: 'getStorage' }, function(storageData) {
    if (chrome.runtime.lastError || !storageData) {
      loading.textContent = T.t('storage.loading_fail');
      return;
    }

    var getCookies = typeof chrome.cookies !== 'undefined' ? chrome.cookies.getAll : null;
    if (getCookies) {
      getCookies({ url: tabUrl }, function(chromeCookies) {
        loading.classList.add('hidden');
        content.classList.remove('hidden');
        content.innerHTML = '';
        renderStorageContent(content, storageData, chromeCookies || []);
        PopupState.storageLoaded = true;
      });
    } else {
      loading.classList.add('hidden');
      content.classList.remove('hidden');
      content.innerHTML = '';
      renderStorageContent(content, storageData, []);
      PopupState.storageLoaded = true;
    }
  });
}

function doExport(items, storageType) {
  var obj = {};
  items.forEach(function(item) { obj[item.key] = item.value; });
  var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = storageType + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function doImport(fileInput, storageType) {
  var file = fileInput.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
      var keys = Object.keys(data);
      if (!keys.length) { fileInput.value = ''; return; }
      var pending = keys.length;
      keys.forEach(function(k) {
        var v = String(data[k]);
        if (v.indexOf('<script') !== -1 || v.indexOf('javascript:') !== -1) return;
        chrome.tabs.sendMessage(PopupState.currentTabId, {
          action: 'setStorageKey', type: storageType, key: k, value: v
        }, function(resp) {
          void chrome.runtime.lastError;
          if (--pending === 0) { fileInput.value = ''; reloadStoragePanel(); }
        });
      });
    } catch(err) {
      var errEl = document.createElement('div');
      errEl.className = 'panel-error';
      errEl.textContent = T.t('storage.import_error');
      var content = document.getElementById('storage-content');
      if (content) {
        var firstChild = content.firstChild;
        if (firstChild) content.insertBefore(errEl, firstChild);
        else content.appendChild(errEl);
        setTimeout(function() { if (errEl.parentNode) errEl.parentNode.removeChild(errEl); }, 4000);
      }
      fileInput.value = '';
    }
  };
  reader.readAsText(file);
}

function renderStorageEditSection(container, items, storageType) {
  var isLocal = storageType === 'localStorage';
  var titleKey = isLocal ? 'storage.localStorage' : 'storage.sessionStorage';
  var emptyKey = isLocal ? 'storage.localStorage.empty' : 'storage.sessionStorage.empty';

  var section = makePanelSection(T.t(titleKey, { count: items.length }));
  var titleSpan = section.querySelector('.panel-section-title span');
  var titleEl = section.querySelector('.panel-section-title');

  function updateCount() {
    if (titleSpan) titleSpan.textContent = T.t(titleKey, { count: items.length });
  }

  // ── Header actions: Export / Import / Clear ───────────────────────────────
  var actionsWrap = document.createElement('div');
  actionsWrap.className = 'storage-header-actions';

  var exportBtn = document.createElement('button');
  exportBtn.className = 'storage-hdr-btn';
  exportBtn.textContent = T.t('storage.export');
  exportBtn.addEventListener('click', function() { doExport(items, storageType); });
  actionsWrap.appendChild(exportBtn);

  var importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = '.json,application/json';
  importInput.className = 'hidden';
  var importBtn = document.createElement('button');
  importBtn.className = 'storage-hdr-btn';
  importBtn.textContent = T.t('storage.import_btn');
  importBtn.addEventListener('click', function() { importInput.click(); });
  importInput.addEventListener('change', function() { doImport(importInput, storageType); });
  actionsWrap.appendChild(importBtn);
  actionsWrap.appendChild(importInput);

  if (items.length > 0) {
    var clearBtn = document.createElement('button');
    clearBtn.className = 'storage-hdr-btn storage-hdr-clear-btn';
    clearBtn.textContent = T.t('storage.clear');
    var clearTimer = null;
    clearBtn.addEventListener('click', function() {
      if (clearBtn.classList.contains('confirm')) {
        clearTimeout(clearTimer);
        clearBtn.disabled = true;
        clearBtn.textContent = '...';
        chrome.tabs.sendMessage(PopupState.currentTabId, { action: 'clearStorage', type: storageType }, function() {
          reloadStoragePanel();
        });
      } else {
        clearBtn.classList.add('confirm');
        clearBtn.textContent = T.t('storage.clear_confirm');
        clearTimer = setTimeout(function() {
          clearBtn.classList.remove('confirm');
          clearBtn.textContent = T.t('storage.clear');
        }, 3000);
      }
    });
    actionsWrap.appendChild(clearBtn);
  }

  titleEl.appendChild(actionsWrap);

  // ── Size bar (localStorage only) ──────────────────────────────────────────
  if (isLocal) {
    var totalChars = 0;
    items.forEach(function(item) { totalChars += (item.size || 0); });
    var totalBytes = totalChars * 2;
    var limitBytes = 5 * 1024 * 1024;
    var pct = Math.min(100, totalBytes / limitBytes * 100);
    var usedKB = (totalBytes / 1024).toFixed(1);

    var sizeWrap = document.createElement('div');
    sizeWrap.className = 'storage-size-wrap';

    var sizeBar = document.createElement('div');
    sizeBar.className = 'storage-size-bar';
    var sizeFill = document.createElement('div');
    sizeFill.className = 'storage-size-bar-fill' + (pct > 80 ? ' danger' : pct > 50 ? ' warn' : '');
    sizeFill.style.width = pct.toFixed(2) + '%';
    sizeBar.appendChild(sizeFill);

    var sizeInfo = document.createElement('span');
    sizeInfo.className = 'storage-size-info';
    sizeInfo.textContent = T.t('storage.size_used', { kb: usedKB });

    sizeWrap.appendChild(sizeBar);
    sizeWrap.appendChild(sizeInfo);
    section.appendChild(sizeWrap);
  }

  // ── Search / filter by key ────────────────────────────────────────────────
  var searchWrap = document.createElement('div');
  searchWrap.className = 'storage-search-wrap';
  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'storage-search-input';
  searchInput.placeholder = T.t('storage.search_placeholder');
  searchWrap.appendChild(searchInput);
  section.appendChild(searchWrap);

  // ── Table ─────────────────────────────────────────────────────────────────
  var tbl = makeTable([T.t('storage.table.key'), T.t('storage.table.value'), '']);
  var ths = tbl.querySelectorAll('thead th');
  if (ths[2]) ths[2].style.width = '56px';
  var tbody = tbl.querySelector('tbody');

  if (items.length === 0) {
    var emptyTr = document.createElement('tr');
    var emptyTd = document.createElement('td');
    emptyTd.colSpan = 3;
    emptyTd.className = 'storage-empty-cell';
    emptyTd.textContent = T.t(emptyKey);
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
  }

  searchInput.addEventListener('input', function() {
    var q = searchInput.value.toLowerCase();
    var rows = tbody.querySelectorAll('tr.storage-row');
    rows.forEach(function(row) {
      var keyCell = row.querySelector('.storage-key-cell');
      if (!keyCell) return;
      var show = !q || keyCell.textContent.toLowerCase().indexOf(q) !== -1;
      row.style.display = show ? '' : 'none';
      var next = row.nextSibling;
      if (next && next.className && next.className.indexOf('storage-json-row') !== -1) {
        next.style.display = show ? '' : 'none';
      }
    });
  });

  function renderRow(item) {
    var tr = document.createElement('tr');
    tr.className = 'storage-row';

    var tdKey = document.createElement('td');
    tdKey.className = 'storage-key-cell';
    tdKey.textContent = item.key;
    tdKey.title = item.key;
    tr.appendChild(tdKey);

    var tdVal = document.createElement('td');
    tdVal.className = 'storage-val-cell';

    var valText = document.createElement('span');
    valText.className = 'storage-val-text';
    valText.textContent = truncate(item.value, 50);
    valText.title = T.t('storage.click_to_edit');

    var valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.className = 'storage-val-input hidden';
    valInput.value = item.value;

    tdVal.appendChild(valText);
    tdVal.appendChild(valInput);

    // JSON expand button — show only for objects and arrays
    var parsedJson = null;
    var v = item.value;
    if (v && (v[0] === '{' || v[0] === '[')) {
      try { parsedJson = JSON.parse(v); } catch(e) {}
    }

    var jsonExpandRow = null;
    if (parsedJson !== null) {
      var jsonBtn = document.createElement('button');
      jsonBtn.className = 'storage-json-btn';
      jsonBtn.textContent = '{ }';
      jsonBtn.title = T.t('storage.json_expand');
      jsonBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (jsonExpandRow) {
          if (jsonExpandRow.parentNode) jsonExpandRow.parentNode.removeChild(jsonExpandRow);
          jsonExpandRow = null;
          jsonBtn.textContent = '{ }';
          jsonBtn.title = T.t('storage.json_expand');
        } else {
          jsonExpandRow = document.createElement('tr');
          jsonExpandRow.className = 'storage-json-row';
          var jsonTd = document.createElement('td');
          jsonTd.colSpan = 3;
          var pre = document.createElement('pre');
          pre.className = 'storage-json-pre';
          pre.textContent = JSON.stringify(parsedJson, null, 2);
          jsonTd.appendChild(pre);
          jsonExpandRow.appendChild(jsonTd);
          if (tr.parentNode) tr.parentNode.insertBefore(jsonExpandRow, tr.nextSibling);
          jsonBtn.textContent = '×';
          jsonBtn.title = T.t('storage.json_collapse');
        }
      });
      tdVal.appendChild(jsonBtn);
    }

    tr.appendChild(tdVal);

    var tdAct = document.createElement('td');
    tdAct.className = 'storage-act-cell';

    var editBtn = document.createElement('button');
    editBtn.className = 'storage-row-btn storage-edit-btn';
    editBtn.title = T.t('storage.edit');
    editBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'storage-row-btn storage-save-btn hidden';
    saveBtn.title = T.t('storage.save');
    saveBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'storage-row-btn storage-cancel-btn hidden';
    cancelBtn.title = T.t('storage.cancel');
    cancelBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    var delBtn = document.createElement('button');
    delBtn.className = 'storage-row-btn storage-del-btn';
    delBtn.title = T.t('storage.delete');
    delBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>';

    tdAct.appendChild(editBtn);
    tdAct.appendChild(saveBtn);
    tdAct.appendChild(cancelBtn);
    tdAct.appendChild(delBtn);
    tr.appendChild(tdAct);

    function startEdit() {
      valText.classList.add('hidden');
      valInput.classList.remove('hidden');
      valInput.value = item.value;
      valInput.focus();
      valInput.select();
      editBtn.classList.add('hidden');
      delBtn.classList.add('hidden');
      saveBtn.classList.remove('hidden');
      cancelBtn.classList.remove('hidden');
      tr.classList.add('editing');
    }

    function cancelEdit() {
      valText.classList.remove('hidden');
      valInput.classList.add('hidden');
      editBtn.classList.remove('hidden');
      delBtn.classList.remove('hidden');
      saveBtn.classList.add('hidden');
      cancelBtn.classList.add('hidden');
      tr.classList.remove('editing');
    }

    function saveEdit() {
      var newVal = valInput.value;
      saveBtn.disabled = true;
      chrome.tabs.sendMessage(PopupState.currentTabId, {
        action: 'setStorageKey',
        type: storageType,
        key: item.key,
        value: newVal
      }, function(resp) {
        saveBtn.disabled = false;
        if (chrome.runtime.lastError || !resp || !resp.ok) { cancelEdit(); return; }
        item.value = newVal;
        item.size = item.key.length + newVal.length;
        valText.textContent = truncate(newVal, 50);
        valText.title = T.t('storage.click_to_edit');
        cancelEdit();
      });
    }

    editBtn.addEventListener('click', startEdit);
    valText.addEventListener('click', startEdit);
    saveBtn.addEventListener('click', saveEdit);
    valInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
      else if (e.key === 'Escape') cancelEdit();
    });
    cancelBtn.addEventListener('click', cancelEdit);

    delBtn.addEventListener('click', function() {
      delBtn.disabled = true;
      chrome.tabs.sendMessage(PopupState.currentTabId, {
        action: 'deleteStorageKey',
        type: storageType,
        key: item.key
      }, function() {
        var idx = items.indexOf(item);
        if (idx !== -1) items.splice(idx, 1);
        if (jsonExpandRow && jsonExpandRow.parentNode) jsonExpandRow.parentNode.removeChild(jsonExpandRow);
        if (tr.parentNode) tr.parentNode.removeChild(tr);
        updateCount();
      });
    });

    return tr;
  }

  items.forEach(function(item) { tbody.appendChild(renderRow(item)); });
  section.appendChild(tbl);

  // ── Add entry form ────────────────────────────────────────────────────────
  var addForm = document.createElement('div');
  addForm.className = 'storage-add-form';

  var addKeyInput = document.createElement('input');
  addKeyInput.type = 'text';
  addKeyInput.className = 'storage-add-input';
  addKeyInput.placeholder = T.t('storage.add.key_placeholder');

  var addValInput = document.createElement('input');
  addValInput.type = 'text';
  addValInput.className = 'storage-add-input';
  addValInput.placeholder = T.t('storage.add.val_placeholder');

  var addBtn = document.createElement('button');
  addBtn.className = 'storage-add-btn';
  addBtn.textContent = T.t('storage.add');

  function doAdd() {
    var key = addKeyInput.value.trim();
    var val = addValInput.value;
    if (!key) {
      addKeyInput.focus();
      addKeyInput.classList.add('storage-input-error');
      return;
    }
    addKeyInput.classList.remove('storage-input-error');
    addBtn.disabled = true;
    chrome.tabs.sendMessage(PopupState.currentTabId, {
      action: 'setStorageKey',
      type: storageType,
      key: key,
      value: val
    }, function(resp) {
      addBtn.disabled = false;
      if (chrome.runtime.lastError || !resp || !resp.ok) return;
      var emptyRow = tbody.querySelector('.storage-empty-cell');
      if (emptyRow) emptyRow.parentNode.parentNode.removeChild(emptyRow.parentNode);
      var newItem = { key: key, value: val, size: key.length + val.length };
      items.push(newItem);
      tbody.appendChild(renderRow(newItem));
      updateCount();
      addKeyInput.value = '';
      addValInput.value = '';
      addKeyInput.focus();
    });
  }

  addBtn.addEventListener('click', doAdd);
  addValInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') doAdd(); });
  addKeyInput.addEventListener('keydown', function(e) {
    addKeyInput.classList.remove('storage-input-error');
    if (e.key === 'Enter') addValInput.focus();
  });

  addForm.appendChild(addKeyInput);
  addForm.appendChild(addValInput);
  addForm.appendChild(addBtn);
  section.appendChild(addForm);

  container.appendChild(section);
}

function renderCookieEditSection(container, cookies) {
  var section = makePanelSection(T.t('storage.cookies', { count: cookies.length }));
  var titleSpan = section.querySelector('.panel-section-title span');
  var dateLocale = T.getLocale() === 'en' ? 'en-US' : 'uk-UA';

  function updateCount() {
    if (titleSpan) titleSpan.textContent = T.t('storage.cookies', { count: cookies.length });
  }

  if (cookies.length > 0) {
    addClearButton(section, function(done) {
      clearCookies(PopupState.currentTabUrl, done);
    });
  }

  var tbl = makeTable([T.t('storage.table.name'), T.t('storage.table.value'), 'Domain', 'Expires', 'Secure', 'HttpOnly', 'SameSite', '']);
  var ths = tbl.querySelectorAll('thead th');
  if (ths[7]) { ths[7].style.width = '32px'; }

  var tbody = tbl.querySelector('tbody');

  if (cookies.length === 0) {
    var emptyTr = document.createElement('tr');
    var emptyTd = document.createElement('td');
    emptyTd.colSpan = 8;
    emptyTd.className = 'storage-empty-cell';
    emptyTd.textContent = T.t('storage.cookies.empty');
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
  }

  function renderCookieRow(c) {
    var tr = document.createElement('tr');
    tr.className = 'storage-row';

    var exp = c.expirationDate
      ? new Date(c.expirationDate * 1000).toLocaleDateString(dateLocale)
      : 'Session';

    var tdName = document.createElement('td');
    tdName.className = 'storage-key-cell';
    tdName.textContent = c.name;
    tdName.title = c.name;
    tr.appendChild(tdName);

    var tdVal = document.createElement('td');
    tdVal.className = 'storage-val-cell';
    var valText = document.createElement('span');
    valText.className = 'storage-val-text';
    valText.textContent = truncate(c.value, 25);
    valText.title = T.t('storage.click_to_edit');
    var valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.className = 'storage-val-input hidden';
    valInput.value = c.value;
    tdVal.appendChild(valText);
    tdVal.appendChild(valInput);
    tr.appendChild(tdVal);

    var tdDomain = document.createElement('td');
    tdDomain.textContent = c.domain;
    tr.appendChild(tdDomain);

    var tdExp = document.createElement('td');
    tdExp.textContent = exp;
    tr.appendChild(tdExp);

    var tdSecure = document.createElement('td');
    tdSecure.textContent = c.secure ? '✓' : '✗';
    tdSecure.className = c.secure ? 'cell-ok' : 'cell-warn';
    tr.appendChild(tdSecure);

    var tdHttp = document.createElement('td');
    tdHttp.textContent = c.httpOnly ? '✓' : '✗';
    tdHttp.className = c.httpOnly ? 'cell-ok' : 'cell-warn';
    tr.appendChild(tdHttp);

    var tdSame = document.createElement('td');
    tdSame.textContent = c.sameSite || '—';
    tr.appendChild(tdSame);

    var tdAct = document.createElement('td');
    tdAct.className = 'storage-act-cell';

    var editBtn = document.createElement('button');
    editBtn.className = 'storage-row-btn storage-edit-btn';
    editBtn.title = T.t('storage.edit');
    editBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'storage-row-btn storage-save-btn hidden';
    saveBtn.title = T.t('storage.save');
    saveBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'storage-row-btn storage-cancel-btn hidden';
    cancelBtn.title = T.t('storage.cancel');
    cancelBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    var delBtn = document.createElement('button');
    delBtn.className = 'storage-row-btn storage-del-btn';
    delBtn.title = T.t('storage.delete');
    delBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>';

    tdAct.appendChild(editBtn);
    tdAct.appendChild(saveBtn);
    tdAct.appendChild(cancelBtn);
    tdAct.appendChild(delBtn);
    tr.appendChild(tdAct);

    function startEdit() {
      valText.classList.add('hidden');
      valInput.classList.remove('hidden');
      valInput.value = c.value;
      valInput.focus();
      valInput.select();
      editBtn.classList.add('hidden');
      delBtn.classList.add('hidden');
      saveBtn.classList.remove('hidden');
      cancelBtn.classList.remove('hidden');
      tr.classList.add('editing');
    }

    function cancelEdit() {
      valText.classList.remove('hidden');
      valInput.classList.add('hidden');
      editBtn.classList.remove('hidden');
      delBtn.classList.remove('hidden');
      saveBtn.classList.add('hidden');
      cancelBtn.classList.add('hidden');
      tr.classList.remove('editing');
    }

    function saveEdit() {
      var newVal = valInput.value;
      saveBtn.disabled = true;
      var scheme = c.secure ? 'https' : 'http';
      var domain = c.domain.replace(/^\./, '');
      var cookieUrl = scheme + '://' + domain + (c.path || '/');
      var params = { url: cookieUrl, name: c.name, value: newVal };
      if (c.domain) params.domain = c.domain;
      if (c.path) params.path = c.path;
      if (c.secure !== undefined) params.secure = c.secure;
      if (c.httpOnly !== undefined) params.httpOnly = c.httpOnly;
      if (c.sameSite) params.sameSite = c.sameSite;
      if (c.expirationDate) params.expirationDate = c.expirationDate;
      if (typeof chrome.cookies !== 'undefined') {
        chrome.cookies.set(params, function(updated) {
          saveBtn.disabled = false;
          if (chrome.runtime.lastError || !updated) { cancelEdit(); return; }
          c.value = newVal;
          valText.textContent = truncate(newVal, 25);
          cancelEdit();
        });
      } else { saveBtn.disabled = false; cancelEdit(); }
    }

    editBtn.addEventListener('click', startEdit);
    valText.addEventListener('click', startEdit);
    saveBtn.addEventListener('click', saveEdit);
    valInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
      else if (e.key === 'Escape') cancelEdit();
    });
    cancelBtn.addEventListener('click', cancelEdit);

    delBtn.addEventListener('click', function() {
      delBtn.disabled = true;
      var scheme = c.secure ? 'https' : 'http';
      var domain = c.domain.replace(/^\./, '');
      if (typeof chrome.cookies !== 'undefined') {
        chrome.cookies.remove({ url: scheme + '://' + domain + (c.path || '/'), name: c.name }, function() {
          var idx = cookies.indexOf(c);
          if (idx !== -1) cookies.splice(idx, 1);
          if (tr.parentNode) tr.parentNode.removeChild(tr);
          updateCount();
        });
      } else { delBtn.disabled = false; }
    });

    return tr;
  }

  cookies.forEach(function(c) { tbody.appendChild(renderCookieRow(c)); });
  section.appendChild(tbl);

  // ── Add cookie form ───────────────────────────────────────────────────────
  var addForm = document.createElement('div');
  addForm.className = 'storage-add-form';

  var addNameInput = document.createElement('input');
  addNameInput.type = 'text';
  addNameInput.className = 'storage-add-input';
  addNameInput.placeholder = T.t('storage.table.name');

  var addValInput = document.createElement('input');
  addValInput.type = 'text';
  addValInput.className = 'storage-add-input';
  addValInput.placeholder = T.t('storage.add.val_placeholder');

  var addBtn = document.createElement('button');
  addBtn.className = 'storage-add-btn';
  addBtn.textContent = T.t('storage.add');

  function doAdd() {
    var name = addNameInput.value.trim();
    var value = addValInput.value;
    if (!name) { addNameInput.focus(); addNameInput.classList.add('storage-input-error'); return; }
    addNameInput.classList.remove('storage-input-error');
    addBtn.disabled = true;
    if (typeof chrome.cookies !== 'undefined') {
      chrome.cookies.set({ url: PopupState.currentTabUrl, name: name, value: value }, function(newCookie) {
      addBtn.disabled = false;
      if (chrome.runtime.lastError || !newCookie) return;
      var emptyRow = tbody.querySelector('.storage-empty-cell');
      if (emptyRow) emptyRow.parentNode.parentNode.removeChild(emptyRow.parentNode);
      cookies.push(newCookie);
      tbody.appendChild(renderCookieRow(newCookie));
      updateCount();
      addNameInput.value = '';
      addValInput.value = '';
      addNameInput.focus();
    });
    } else { addBtn.disabled = false; }
  }

  addBtn.addEventListener('click', doAdd);
  addValInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') doAdd(); });
  addNameInput.addEventListener('keydown', function(e) {
    addNameInput.classList.remove('storage-input-error');
    if (e.key === 'Enter') addValInput.focus();
  });

  addForm.appendChild(addNameInput);
  addForm.appendChild(addValInput);
  addForm.appendChild(addBtn);
  section.appendChild(addForm);
  container.appendChild(section);
}

function renderStorageContent(container, storageData, chromeCookies) {
  // ── Cookies ──────────────────────────────────────────────────────────────
  renderCookieEditSection(container, chromeCookies);

  // ── LocalStorage ─────────────────────────────────────────────────────────
  renderStorageEditSection(container, storageData.localStorage || [], 'localStorage');

  // ── SessionStorage ────────────────────────────────────────────────────────
  renderStorageEditSection(container, storageData.sessionStorage || [], 'sessionStorage');
}
