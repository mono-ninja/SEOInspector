// ─── Audit Score History Panel ─────────────────────────────────────────────────

function initAuditHistoryPanel() {
  var panel = document.getElementById('audit-history-panel');
  if (!panel) return;
  panel.innerHTML = '';
  var loadingRow = document.createElement('div');
  loadingRow.className = 'sa-loading-row';
  var spinner = document.createElement('div');
  spinner.className = 'spinner';
  var loadingText = document.createElement('span');
  loadingText.textContent = T.t('popup.storage.loading');
  loadingRow.appendChild(spinner);
  loadingRow.appendChild(loadingText);
  panel.appendChild(loadingRow);

  chrome.storage.local.get({ audit_history: [] }, function(data) {
    var history = data.audit_history || [];
    renderAuditHistory(panel, history);
  });
}

function renderAuditHistory(panel, history) {
  panel.innerHTML = '';

  var header = document.createElement('div');
  header.className = 'ah-header';

  var title = document.createElement('span');
  title.className = 'ah-title';
  title.textContent = T.t('ah.title');
  header.appendChild(title);

  if (history.length > 0) {
    var clearBtn = document.createElement('button');
    clearBtn.className = 'ah-clear-btn';
    clearBtn.textContent = T.t('storage.clear');
    clearBtn.addEventListener('click', function() {
      chrome.storage.local.set({ audit_history: [] }, function() {
        renderAuditHistory(panel, []);
      });
    });
    header.appendChild(clearBtn);
  }

  panel.appendChild(header);

  if (history.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'panel-empty';
    empty.textContent = T.t('ah.empty');
    panel.appendChild(empty);
    return;
  }

  var table = document.createElement('table');
  table.className = 'ah-table';

  var thead = document.createElement('thead');
  var headerTr = document.createElement('tr');
  var ths = [T.t('ah.col.date'), T.t('ah.col.url'), T.t('ah.col.total'), T.t('ah.col.counts')];
  ths.forEach(function(t) {
    var th = document.createElement('th');
    th.textContent = t;
    headerTr.appendChild(th);
  });
  thead.appendChild(headerTr);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  history.forEach(function(entry, idx) {
    var tr = document.createElement('tr');
    tr.className = 'ah-row';
    tr.style.cursor = 'pointer';
    tr.title = T.t('ah.diff.title');
    (function(e, i) {
      tr.addEventListener('click', function() { showAuditDiff(panel, history, i); });
    })(entry, idx);

    var dateStr = '';
    try {
      var d = new Date(entry.date);
      var dl = T.getLocale() === 'en' ? 'en-US' : 'uk-UA';
      dateStr = d.toLocaleDateString(dl, { day: '2-digit', month: '2-digit', year: '2-digit' }) +
        ' ' + d.toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' });
    } catch(e) { dateStr = entry.date || ''; }

    var domain = '';
    try { domain = new URL(entry.url).hostname.replace(/^www\./, ''); } catch(e) { domain = entry.url || ''; }

    var total = entry.total != null ? entry.total : (entry.critical + entry.warning + entry.notice);

    var tdDate = document.createElement('td');
    tdDate.className = 'ah-date';
    tdDate.textContent = dateStr;
    tr.appendChild(tdDate);

    var tdUrl = document.createElement('td');
    tdUrl.className = 'ah-url';
    tdUrl.textContent = domain;
    tdUrl.title = entry.url || '';
    tr.appendChild(tdUrl);

    var tdTotal = document.createElement('td');
    tdTotal.className = 'ah-total';
    tdTotal.textContent = String(total);
    tr.appendChild(tdTotal);

    var tdCounts = document.createElement('td');
    tdCounts.className = 'ah-counts';
    var cSpan = document.createElement('span');
    cSpan.className = 'ah-c';
    cSpan.textContent = entry.critical || 0;
    var wSpan = document.createElement('span');
    wSpan.className = 'ah-w';
    wSpan.textContent = entry.warning || 0;
    var nSpan = document.createElement('span');
    nSpan.className = 'ah-n';
    nSpan.textContent = entry.notice || 0;
    tdCounts.appendChild(cSpan);
    tdCounts.appendChild(document.createTextNode(' / '));
    tdCounts.appendChild(wSpan);
    tdCounts.appendChild(document.createTextNode(' / '));
    tdCounts.appendChild(nSpan);
    tr.appendChild(tdCounts);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  panel.appendChild(table);
}

function showAuditDiff(panel, history, idx) {
  if (idx <= 0 || idx >= history.length) return;
  var current = history[idx];
  var previous = history[idx - 1];
  if (current.url !== previous.url) return;

  panel.innerHTML = '';
  var wrap = document.createElement('div');
  wrap.className = 'ah-diff-wrap';

  var backBtn = document.createElement('button');
  backBtn.className = 'ah-back-btn';
  backBtn.textContent = '← ' + T.t('ah.back');
  backBtn.addEventListener('click', function() { renderAuditHistory(panel, history); });
  wrap.appendChild(backBtn);

  var title = document.createElement('div');
  title.className = 'ah-diff-title';
  var curTotal = current.total != null ? current.total : (current.critical + current.warning + current.notice);
  var prevTotal = previous.total != null ? previous.total : (previous.critical + previous.warning + previous.notice);
  var diffTotal = curTotal - prevTotal;
  title.textContent = T.t('ah.diff.title') + ': ' + (diffTotal >= 0 ? '+' : '') + diffTotal;
  wrap.appendChild(title);

  var statsDiff = [
    { label: T.t('export.sev.critical'), cur: current.critical, prev: previous.critical },
    { label: T.t('export.sev.warning'), cur: current.warning, prev: previous.warning },
    { label: T.t('export.sev.notice'), cur: current.notice, prev: previous.notice },
  ];
  statsDiff.forEach(function(s) {
    var diff = s.cur - s.prev;
    var row = document.createElement('div');
    row.className = 'ah-diff-stat';
    row.textContent = s.label + ': ' + s.prev + ' → ' + s.cur + (diff !== 0 ? ' (' + (diff > 0 ? '+' : '') + diff + ')' : '');
    wrap.appendChild(row);
  });

  panel.appendChild(wrap);
}
