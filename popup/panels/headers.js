// ─── Headers panel ────────────────────────────────────────────────────────────

var SECURITY_HEADERS = [
  'content-security-policy', 'x-frame-options', 'x-content-type-options',
  'strict-transport-security', 'referrer-policy', 'permissions-policy',
  'cross-origin-opener-policy', 'cross-origin-embedder-policy'
];
var CACHE_HEADERS = [
  'cache-control', 'etag', 'last-modified', 'age', 'expires',
  'vary', 'cdn-cache-control', 'surrogate-control',
  'x-cache', 'cf-cache-status', 'x-cache-status'
];

function initHeadersPanel(tabUrl) {
  if (PopupState.headersLoaded) return;

  var loading = document.getElementById('headers-loading');
  var content = document.getElementById('headers-content');
  loading.classList.remove('hidden');
  content.classList.add('hidden');

  chrome.runtime.sendMessage({ action: 'fetchHeaders', url: tabUrl }, function(resp) {
    loading.classList.add('hidden');
    content.classList.remove('hidden');
    content.innerHTML = '';

    if (chrome.runtime.lastError || !resp || !resp.ok) {
      var errMsg = (chrome.runtime.lastError && chrome.runtime.lastError.message) ||
                   (resp && resp.error) || T.t('render.connection_error');
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'panel-empty';
      emptyDiv.textContent = T.t('headers.fetch_fail', { error: errMsg });
      content.appendChild(emptyDiv);
      return;
    }

    renderHeadersContent(content, resp, tabUrl);
    PopupState.headersLoaded = true;
  });
}

function analyzeHeaders(headers, isHttps) {
  var recs = [];

  // HTTPS
  if (!isHttps) {
    recs.push({ sev: 'critical', msg: T.t('headers.no_https') });
  }

  // Security headers (only on HTTPS — no point recommending HSTS etc. for HTTP)
  if (isHttps) {
    [
      { key: 'content-security-policy',  label: 'Content-Security-Policy', sev: 'warning' },
      { key: 'x-frame-options',          label: 'X-Frame-Options',         sev: 'warning' },
      { key: 'x-content-type-options',   label: 'X-Content-Type-Options',  sev: 'notice'  },
      { key: 'strict-transport-security',label: 'HSTS',                    sev: 'warning' },
      { key: 'referrer-policy',          label: 'Referrer-Policy',         sev: 'notice'  },
      { key: 'permissions-policy',       label: 'Permissions-Policy',      sev: 'notice'  },
    ].forEach(function(h) {
      if (!headers[h.key]) {
        recs.push({ sev: h.sev, msg: T.t('headers.missing_header', { label: h.label }) });
      }
    });

    // HSTS quality check
    var hsts = headers['strict-transport-security'] || '';
    if (hsts) {
      var maxAgeMatch = hsts.match(/max-age=(\d+)/i);
      if (maxAgeMatch) {
        var maxAge = parseInt(maxAgeMatch[1], 10);
        if (maxAge < 31536000) {
          recs.push({ sev: 'notice', msg: T.t('headers.hsts_short', { value: maxAge }), detail: hsts });
        }
      }
      if (hsts.toLowerCase().indexOf('includesubdomains') === -1) {
        recs.push({ sev: 'notice', msg: T.t('headers.hsts_no_subdomains'), detail: hsts });
      }
    }

    // CSP quality check
    var csp = headers['content-security-policy'] || '';
    if (csp) {
      if (csp.indexOf("'unsafe-inline'") !== -1) {
        recs.push({ sev: 'warning', msg: T.t('headers.csp_unsafe', { directive: "'unsafe-inline'" }) });
      }
      if (csp.indexOf("'unsafe-eval'") !== -1) {
        recs.push({ sev: 'warning', msg: T.t('headers.csp_unsafe', { directive: "'unsafe-eval'" }) });
      }
    }
  }

  // Cache-Control
  var cc = headers['cache-control'] || '';
  if (!cc) {
    recs.push({ sev: 'warning', msg: T.t('headers.missing_header', { label: 'Cache-Control' }) });
  } else if (cc.indexOf('no-store') !== -1) {
    recs.push({ sev: 'notice', msg: T.t('headers.cc_no_store'), detail: cc });
  }

  // ETag / Last-Modified
  if (cc && cc.indexOf('no-store') === -1 && !headers['etag'] && !headers['last-modified']) {
    recs.push({ sev: 'notice', msg: T.t('headers.etag_missing') });
  }

  // Compression
  var encoding = headers['content-encoding'] || '';
  var vary = headers['vary'] || '';
  if (!encoding && vary.toLowerCase().indexOf('accept-encoding') === -1) {
    recs.push({ sev: 'notice', msg: T.t('headers.no_compression') });
  }

  // Brotli vs gzip
  if (encoding && encoding.toLowerCase().indexOf('br') === -1 && encoding.toLowerCase().indexOf('gzip') !== -1) {
    recs.push({ sev: 'notice', msg: T.t('headers.gzip_not_brotli'), detail: 'Content-Encoding: ' + encoding });
  }

  // Version disclosure
  if (headers['x-powered-by']) {
    recs.push({ sev: 'notice', msg: T.t('headers.x_powered_by'), detail: headers['x-powered-by'] });
  }
  if (headers['server'] && /\d+\.\d+/.test(headers['server'])) {
    recs.push({ sev: 'notice', msg: T.t('headers.server_version'), detail: headers['server'] });
  }

  // HTTP Refresh redirect
  var refresh = headers['refresh'] || '';
  if (refresh && /url=/i.test(refresh)) {
    recs.push({ sev: 'warning', msg: T.t('headers.refresh_redirect'), detail: 'Refresh: ' + refresh });
  }

  return recs;
}

// A–F grade in the spirit of securityheaders.com: six key headers, one grade
// step lost per missing header; no HTTPS is an automatic F.
function computeSecurityGrade(headers, isHttps) {
  var csp = headers['content-security-policy'] || '';
  var checks = [
    { label: 'Content-Security-Policy',   ok: !!csp },
    { label: 'Strict-Transport-Security', ok: !!headers['strict-transport-security'] },
    { label: 'X-Frame-Options',           ok: !!headers['x-frame-options'] || csp.indexOf('frame-ancestors') !== -1 },
    { label: 'X-Content-Type-Options',    ok: !!headers['x-content-type-options'] },
    { label: 'Referrer-Policy',           ok: !!headers['referrer-policy'] },
    { label: 'Permissions-Policy',        ok: !!headers['permissions-policy'] },
  ];
  var missing = checks.filter(function(c) { return !c.ok; }).map(function(c) { return c.label; });
  var grade;
  if (!isHttps) grade = 'F';
  else grade = ['F', 'F', 'E', 'D', 'C', 'B', 'A'][checks.length - missing.length];
  return { grade: grade, missing: missing };
}

function renderSecurityGrade(container, headers, isHttps) {
  var result = computeSecurityGrade(headers, isHttps);
  var wrap = document.createElement('div');
  wrap.className = 'sec-grade-wrap';

  var badge = document.createElement('div');
  badge.className = 'sec-grade sec-grade-' + result.grade.toLowerCase();
  badge.textContent = result.grade;
  wrap.appendChild(badge);

  var info = document.createElement('div');
  info.className = 'sec-grade-info';
  var title = document.createElement('div');
  title.className = 'sec-grade-title';
  title.textContent = T.t('headers.grade');
  info.appendChild(title);
  var desc = document.createElement('div');
  desc.className = 'sec-grade-desc';
  if (!isHttps) {
    desc.textContent = T.t('headers.grade.no_https');
  } else if (result.missing.length === 0) {
    desc.textContent = T.t('headers.grade.all_present');
  } else {
    desc.textContent = T.t('headers.grade.missing', { list: result.missing.join(', ') });
  }
  info.appendChild(desc);
  wrap.appendChild(info);

  container.appendChild(wrap);
}

function renderHeadersContent(container, resp, tabUrl) {
  var headers = resp.headers || {};
  var isHttps = (resp.url || '').indexOf('https://') === 0;

  // Status line
  var statusEl = document.createElement('div');
  statusEl.className = 'headers-status';
  statusEl.textContent = 'HTTP ' + resp.status + ' — ' + resp.url;
  container.appendChild(statusEl);

  // Security grade badge
  renderSecurityGrade(container, headers, isHttps);

  // ── Recommendations ───────────────────────────────────────────────────────
  var recs = analyzeHeaders(headers, isHttps);

  // Redirect detection
  if (tabUrl && resp.url && resp.url !== tabUrl) {
    recs.unshift({ sev: 'notice', msg: T.t('headers.redirect_detected', { from: tabUrl, to: resp.url }) });
  }

  if (recs.length > 0) {
    var recSection = makePanelSection(T.t('headers.recommendations', { count: recs.length }));
    var recList = document.createElement('div');
    recList.className = 'header-rec-list';
    var SEV_ICON = { warning: '⚠', notice: 'ℹ', critical: '✗' };
    var SEV_CLASS = { warning: 'rec-warn', notice: 'rec-notice', critical: 'rec-critical' };
    recs.forEach(function(r) {
      var row = document.createElement('div');
      row.className = 'header-rec-row ' + (SEV_CLASS[r.sev] || 'rec-notice');
      var iconSpan = document.createElement('span');
      iconSpan.className = 'rec-icon';
      iconSpan.textContent = SEV_ICON[r.sev] || 'ℹ';
      row.appendChild(iconSpan);
      var msgSpan = document.createElement('span');
      msgSpan.className = 'rec-msg';
      msgSpan.textContent = r.msg;
      row.appendChild(msgSpan);
      if (r.detail) {
        var detailSpan = document.createElement('span');
        detailSpan.className = 'rec-detail';
        detailSpan.textContent = ' — ' + r.detail;
        msgSpan.appendChild(detailSpan);
      }
      recList.appendChild(row);
    });
    recSection.appendChild(recList);
    container.appendChild(recSection);
  }

  // ── Security headers checklist ────────────────────────────────────────────
  var secSection = makePanelSection(T.t('headers.security'));
  var secList = document.createElement('div');
  secList.className = 'header-checklist';
  SECURITY_HEADERS.forEach(function(h) {
    var present = !!headers[h];
    var row = document.createElement('div');
    row.className = 'hcheck-row ' + (present ? 'hcheck-ok' : 'hcheck-miss');
    var iconSp = document.createElement('span');
    iconSp.className = 'hcheck-icon';
    iconSp.textContent = present ? '✓' : '✗';
    row.appendChild(iconSp);
    var nameSp = document.createElement('span');
    nameSp.className = 'hcheck-name';
    nameSp.textContent = h;
    row.appendChild(nameSp);
    if (present) {
      var valSp = document.createElement('span');
      valSp.className = 'hcheck-val';
      valSp.textContent = truncate(headers[h], 50);
      row.appendChild(valSp);
    }
    secList.appendChild(row);
  });
  secSection.appendChild(secList);
  container.appendChild(secSection);

  // ── Cache & CDN headers ───────────────────────────────────────────────────
  var cacheHeaders = CACHE_HEADERS.filter(function(h) { return headers[h]; });
  if (cacheHeaders.length > 0) {
    var cacheSection = makePanelSection(T.t('headers.cache_cdn'));
    var cacheTbl = makeTable([T.t('headers.table.header'), T.t('headers.table.value')]);
    cacheHeaders.forEach(function(h) {
      addTableRow(cacheTbl, [h, headers[h]]);
    });
    cacheSection.appendChild(cacheTbl);
    container.appendChild(cacheSection);
  }

  // ── All headers ───────────────────────────────────────────────────────────
  var allSection = makePanelSection(T.t('headers.all', { count: Object.keys(headers).length }));
  var allTbl = makeTable([T.t('headers.table.header'), T.t('headers.table.value')]);
  Object.keys(headers).sort().forEach(function(h) {
    addTableRow(allTbl, [h, headers[h]]);
  });
  allSection.appendChild(allTbl);
  container.appendChild(allSection);
}
