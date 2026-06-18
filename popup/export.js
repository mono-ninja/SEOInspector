// ─── Export audit report as HTML ──────────────────────────────────────────────

function triggerDownload(blob, filename) {
  var blobUrl = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
}

function exportReport() {
  var results = PopupState.lastResults;
  if (!results || !results.length) return;

  var url   = PopupState.currentTabUrl || '';
  var title = PopupState.currentTabTitle || url;
  var dateLocale = T.getLocale() === 'en' ? 'en-US' : 'uk-UA';
  var date  = new Date().toLocaleDateString(dateLocale, { year:'numeric', month:'long', day:'numeric' });

  var stats = calcStats(results);
  var critical = stats.critical, warning = stats.warning, notice = stats.notice;

  var sevLabel = {
    critical: T.t('export.sev.critical'),
    warning:  T.t('export.sev.warning'),
    notice:   T.t('export.sev.notice'),
    info:     T.t('export.sev.info')
  };
  var sevOrder = { critical: 0, warning: 1, notice: 2, info: 3 };

  var rows = '';
  results.forEach(function(r) {
    var checkerIssues = (r.issues || []).filter(function(i) { return !i.muted; }).sort(function(a, b) {
      return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3);
    });
    checkerIssues.forEach(function(i) {
      rows += '<tr class="sev-' + escapeHtml(i.severity) + '">' +
        '<td>' + escapeHtml(r.name || r.id) + '</td>' +
        '<td><span class="badge-' + escapeHtml(i.severity) + '">' + escapeHtml(sevLabel[i.severity] || i.severity) + '</span></td>' +
        '<td>' + escapeHtml(i.message) + (i.detail ? '<pre>' + escapeHtml(i.detail) + '</pre>' : '') + '</td>' +
        '</tr>';
    });
  });

  var html = '<!DOCTYPE html>\n<html lang="' + T.getLocale() + '">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>SEO Audit — ' + escapeHtml(url) + '</title>\n' +
    '<style>\n' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;font-size:13px;color:#111;margin:0;padding:24px;background:#f8fafc}\n' +
    '.header{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin-bottom:20px}\n' +
    '.header h1{margin:0 0 4px;font-size:18px;color:#1e293b}\n' +
    '.header .url{color:#64748b;font-size:12px;word-break:break-all;margin-bottom:12px}\n' +
    '.meta{display:flex;gap:16px;flex-wrap:wrap;align-items:center}\n' +
    '.stat{background:#f1f5f9;border-radius:6px;padding:6px 12px;text-align:center}\n' +
    '.stat .n{font-size:18px;font-weight:600}\n' +
    '.stat.c .n{color:#dc2626} .stat.w .n{color:#ea580c} .stat.n .n{color:#3b82f6}\n' +
    '.stat .l{font-size:10px;color:#64748b;display:block}\n' +
    'table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}\n' +
    'th{background:#f8fafc;padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e2e8f0}\n' +
    'td{padding:8px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top;font-size:12px}\n' +
    'tr:last-child td{border-bottom:none}\n' +
    'tr.sev-critical td{background:#fff5f5} tr.sev-warning td{background:#fffbf0} tr.sev-info td{background:#f8fafc}\n' +
    '.badge-critical,.badge-warning,.badge-notice,.badge-info{display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:600;white-space:nowrap}\n' +
    '.badge-critical{background:#fee2e2;color:#dc2626}\n' +
    '.badge-warning{background:#ffedd5;color:#ea580c}\n' +
    '.badge-notice{background:#dbeafe;color:#2563eb}\n' +
    '.badge-info{background:#f1f5f9;color:#64748b}\n' +
    'pre{margin:4px 0 0;padding:6px 8px;background:#f1f5f9;border-radius:4px;font-size:11px;white-space:pre-wrap;word-break:break-word;color:#475569}\n' +
    '.footer{margin-top:16px;text-align:center;font-size:11px;color:#94a3b8}\n' +
    '</style>\n</head>\n<body>\n' +
    '<div class="header">\n' +
    '  <h1>SEO Audit</h1>\n' +
    '  <div class="url">' + escapeHtml(url) + '</div>\n' +
    '  <div class="meta">\n' +
    '    <div class="stat c"><span class="n">' + critical + '</span><span class="l">' + T.t('export.stat.critical') + '</span></div>\n' +
    '    <div class="stat w"><span class="n">' + warning  + '</span><span class="l">' + T.t('export.stat.warning') + '</span></div>\n' +
    '    <div class="stat n"><span class="n">' + notice   + '</span><span class="l">' + T.t('export.stat.notice') + '</span></div>\n' +
    '    <div class="stat"><span class="n">' + stats.total + '</span><span class="l">' + T.t('export.stat.total') + '</span></div>\n' +
    '    <div style="flex:1"></div>\n' +
    '    <div style="font-size:12px;color:#94a3b8">' + escapeHtml(date) + '</div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '<table>\n' +
    '  <thead><tr><th>' + T.t('export.col.checker') + '</th><th>' + T.t('export.col.type') + '</th><th>' + T.t('export.col.message') + '</th></tr></thead>\n' +
    '  <tbody>' + rows + '</tbody>\n' +
    '</table>\n' +
    '<div class="footer">' + T.t('export.footer') + ' · ' + escapeHtml(date) + '</div>\n' +
    '</body>\n</html>';

  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var filename = 'seo-audit-' + (getDomain(url) || 'report') + '-' + new Date().toISOString().slice(0, 10) + '.html';
  triggerDownload(blob, filename);
}

function exportReportJSON() {
  var results = PopupState.lastResults;
  if (!results || !results.length) return;

  var url = PopupState.currentTabUrl || '';
  var stats = calcStats(results);

  var data = {
    extension: 'SEOInspector',
    version: chrome.runtime.getManifest().version,
    url: url,
    title: PopupState.currentTabTitle || '',
    date: new Date().toISOString(),
    critical: stats.critical,
    warning: stats.warning,
    notice: stats.notice,
    total: stats.total,
    results: results.map(function(r) {
      return { id: r.id, name: r.name, issues: (r.issues || []).filter(function(i) { return !i.muted; }) };
    })
  };

  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  var filename = 'seo-audit-' + (getDomain(url) || 'report') + '-' + new Date().toISOString().slice(0, 10) + '.json';
  triggerDownload(blob, filename);
}

function printReport() {
  var results = PopupState.lastResults;
  if (!results || !results.length) return;

  var data = {
    url:     PopupState.currentTabUrl   || '',
    title:   PopupState.currentTabTitle || '',
    date:    new Date().toISOString(),
    results: results
  };

  chrome.storage.local.set({ printReportData: data }, function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('report.html') });
  });
}

function exportReportCSV() {
  var results = PopupState.lastResults;
  if (!results || !results.length) return;

  var url  = PopupState.currentTabUrl || '';
  var date = new Date().toISOString().slice(0, 10);

  function csvEsc(s) {
    s = String(s || '').replace(/\r?\n/g, ' ');
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  var rows = [[T.t('export.col.checker'), T.t('export.col.type'), T.t('export.col.severity'), T.t('export.col.message'), T.t('export.col.details')]];
  results.forEach(function(r) {
    (r.issues || []).forEach(function(i) {
      if (i.muted) return;
      rows.push([
        csvEsc(r.name || r.id),
        csvEsc(i.type || ''),
        csvEsc(i.severity || ''),
        csvEsc(i.message),
        csvEsc(i.detail || '')
      ]);
    });
  });

  // UTF-8 BOM for correct Excel opening
  var csv = '﻿' + rows.map(function(r) { return r.join(','); }).join('\r\n');

  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var filename = 'seo-audit-' + (getDomain(url) || 'report') + '-' + date + '.csv';
  triggerDownload(blob, filename);
}
