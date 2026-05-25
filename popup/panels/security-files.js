// ─── Sensitive Files Panel ─────────────────────────────────────────────────

var SF_BASE_FILES = [
  // WordPress
  { path: '/xmlrpc.php',           label: 'xmlrpc.php',           method: 'POST', body: '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName><params></params></methodCall>', contentType: 'text/xml', readBody: true, detectXmlRpc: true, severity: 'critical', category: 'WordPress', desc: 'XML-RPC active — brute-force and DDoS amplification vector' },
  { path: '/wp-config.php',        label: 'wp-config.php',        method: 'HEAD', severity: 'critical', category: 'WordPress', desc: 'WordPress config accessible — may expose database credentials' },
  { path: '/wp-config.php.bak',    label: 'wp-config.php.bak',    method: 'HEAD', severity: 'critical', category: 'WordPress', desc: 'WordPress config backup accessible' },
  { path: '/wp-config.php~',       label: 'wp-config.php~',       method: 'HEAD', severity: 'critical', category: 'WordPress', desc: 'WordPress config editor temp file accessible' },
  { path: '/wp-config.bak',        label: 'wp-config.bak',        method: 'HEAD', severity: 'critical', category: 'WordPress', desc: 'WordPress config backup accessible' },
  { path: '/wp-admin/install.php', label: 'wp-admin/install.php', method: 'HEAD', severity: 'critical', category: 'WordPress', desc: 'WordPress install script accessible — should not exist on production' },
  { path: '/wp-admin/upgrade.php', label: 'wp-admin/upgrade.php', method: 'HEAD', severity: 'critical', category: 'WordPress', desc: 'WordPress upgrade script accessible — should not exist on production' },
  { path: '/wp-content/debug.log', label: 'wp-content/debug.log', method: 'HEAD', severity: 'warning',  category: 'WordPress', desc: 'WordPress debug log accessible — may expose internal paths and errors' },
  { path: '/wp-cron.php',          label: 'wp-cron.php',          method: 'HEAD', severity: 'warning',  category: 'WordPress', desc: 'WP-Cron accessible — can be triggered externally to overload the server' },
  { path: '/wp-trackback.php',     label: 'wp-trackback.php',     method: 'HEAD', severity: 'warning',  category: 'WordPress', desc: 'Trackback endpoint accessible — can be used for spam' },
  { path: '/wp-mail.php',          label: 'wp-mail.php',          method: 'HEAD', severity: 'warning',  category: 'WordPress', desc: 'WP-Mail accessible — potential security risk' },
  { path: '/wp-signup.php',        label: 'wp-signup.php',        method: 'HEAD', severity: 'notice',   category: 'WordPress', desc: 'Registration page accessible' },
  { path: '/wp-activate.php',      label: 'wp-activate.php',      method: 'HEAD', severity: 'notice',   category: 'WordPress', desc: 'Activation page accessible' },
  { path: '/wp-config-sample.php', label: 'wp-config-sample.php', method: 'HEAD', severity: 'notice',   category: 'WordPress', desc: 'WordPress config sample exposes configuration structure' },
  { path: '/wp-json/wp/v2/users',  label: 'wp-json/users',        method: 'GET',  severity: 'warning',  category: 'WordPress', desc: 'REST API user enumeration endpoint is public', readBody: true, detectUsers: true },
  { path: '/readme.html',          label: 'readme.html',          method: 'HEAD', severity: 'notice',   category: 'WordPress', desc: 'WordPress readme exposes CMS version' },
  { path: '/license.txt',          label: 'license.txt',          method: 'HEAD', severity: 'notice',   category: 'WordPress', desc: 'WordPress license file exposes CMS version' },
  // Environment / Config
  { path: '/.env',                 label: '.env',                 method: 'HEAD', severity: 'critical', category: 'Config',   desc: 'Environment file accessible — may contain API keys and passwords' },
  { path: '/.env.local',           label: '.env.local',           method: 'HEAD', severity: 'critical', category: 'Config',   desc: 'Local env file accessible' },
  { path: '/.env.production',      label: '.env.production',      method: 'HEAD', severity: 'critical', category: 'Config',   desc: 'Production env file accessible' },
  { path: '/.env.backup',          label: '.env.backup',          method: 'HEAD', severity: 'critical', category: 'Config',   desc: 'Env backup accessible' },
  { path: '/config.php',           label: 'config.php',           method: 'HEAD', severity: 'warning',  category: 'Config',   desc: 'Config file accessible' },
  { path: '/configuration.php',    label: 'configuration.php',    method: 'HEAD', severity: 'warning',  category: 'Joomla',   desc: 'Joomla configuration accessible' },
  { path: '/settings.php',         label: 'settings.php',         method: 'HEAD', severity: 'warning',  category: 'Drupal',   desc: 'Drupal settings accessible' },
  { path: '/.htaccess',            label: '.htaccess',            method: 'HEAD', severity: 'warning',  category: 'Config',   desc: 'Apache config file accessible — may expose rewrite rules and paths' },
  { path: '/web.config',           label: 'web.config',           method: 'HEAD', severity: 'warning',  category: 'Config',   desc: 'IIS config file accessible — may expose server settings' },
  // VCS
  { path: '/.git/config',          label: '.git/config',          method: 'HEAD', severity: 'critical', category: 'VCS',      desc: 'Git repository exposed — source code leak risk' },
  { path: '/.git/HEAD',            label: '.git/HEAD',            method: 'HEAD', severity: 'critical', category: 'VCS',      desc: 'Git HEAD ref exposed' },
  { path: '/.svn/entries',         label: '.svn/entries',         method: 'HEAD', severity: 'critical', category: 'VCS',      desc: 'SVN repository exposed' },
  // Backups
  { path: '/backup.zip',           label: 'backup.zip',           method: 'HEAD', severity: 'critical', category: 'Backup',   desc: 'Backup archive publicly accessible' },
  { path: '/backup.sql',           label: 'backup.sql',           method: 'HEAD', severity: 'critical', category: 'Backup',   desc: 'SQL dump publicly accessible' },
  { path: '/dump.sql',             label: 'dump.sql',             method: 'HEAD', severity: 'critical', category: 'Backup',   desc: 'SQL dump publicly accessible' },
  { path: '/db.sql',               label: 'db.sql',               method: 'HEAD', severity: 'critical', category: 'Backup',   desc: 'SQL dump publicly accessible' },
  { path: '/database.sql',         label: 'database.sql',         method: 'HEAD', severity: 'critical', category: 'Backup',   desc: 'SQL dump publicly accessible' },
  // System
  { path: '/phpinfo.php',          label: 'phpinfo.php',          method: 'HEAD', severity: 'warning',  category: 'System',   desc: 'PHP info page exposes server configuration' },
  { path: '/info.php',             label: 'info.php',             method: 'HEAD', severity: 'warning',  category: 'System',   desc: 'PHP info page exposes server configuration' },
  { path: '/test.php',             label: 'test.php',             method: 'HEAD', severity: 'warning',  category: 'System',   desc: 'Test PHP file publicly accessible' },
  { path: '/server-status',        label: 'server-status',        method: 'HEAD', severity: 'warning',  category: 'System',   desc: 'Apache server status accessible' },
  { path: '/server-info',          label: 'server-info',          method: 'HEAD', severity: 'warning',  category: 'System',   desc: 'Apache server info accessible' },
  { path: '/.DS_Store',            label: '.DS_Store',            method: 'HEAD', severity: 'notice',   category: 'System',   desc: 'macOS metadata file exposes directory structure' },
  { path: '/Thumbs.db',            label: 'Thumbs.db',            method: 'HEAD', severity: 'notice',   category: 'System',   desc: 'Windows thumbnail cache exposes directory structure' },
  // Packages
  { path: '/composer.json',        label: 'composer.json',        method: 'HEAD', severity: 'notice',   category: 'Package',  desc: 'Composer manifest exposes dependency versions' },
  { path: '/composer.lock',        label: 'composer.lock',        method: 'HEAD', severity: 'notice',   category: 'Package',  desc: 'Composer lock file exposes exact dependency versions' },
  { path: '/package.json',         label: 'package.json',         method: 'HEAD', severity: 'notice',   category: 'Package',  desc: 'npm manifest exposes dependency versions' },
  { path: '/package-lock.json',    label: 'package-lock.json',    method: 'HEAD', severity: 'notice',   category: 'Package',  desc: 'npm lock file exposes exact dependency versions' },
];

var sfRunning = false;

function sfProbe(origin, file) {
  return new Promise(function(resolve) {
    chrome.runtime.sendMessage({
      action: 'checkSensitiveFile',
      url: origin + file.path,
      method: file.method || 'HEAD',
      body: file.body || null,
      contentType: file.contentType || null,
      readBody: !!file.readBody,
    }, function(resp) {
      void chrome.runtime.lastError;
      resolve({ file: file, resp: resp || { ok: false } });
    });
  });
}

function sfIsXmlRpcActive(resp) {
  if (resp.status !== 200 || !resp.text) return false;
  return resp.text.indexOf('<?xml') !== -1 &&
    (resp.text.indexOf('methodResponse') !== -1 || resp.text.indexOf('faultCode') !== -1);
}

function sfStatusClass(status) {
  if (!status) return 'sf-code-err';
  if (status >= 200 && status < 300) return 'sf-code-2xx';
  if (status >= 300 && status < 400) return 'sf-code-3xx';
  if (status === 403) return 'sf-code-403';
  if (status >= 400 && status < 500) return 'sf-code-4xx';
  return 'sf-code-err';
}

function sfCopyReport(found, origin) {
  var lines = ['Sensitive Files Report — ' + origin, ''];
  if (found.length === 0) {
    lines.push('No sensitive files found publicly accessible.');
  } else {
    found.forEach(function(item) {
      var f = item.file;
      var sev = (item.confirmed ? f.severity : 'notice').toUpperCase();
      lines.push('[' + sev + '] ' + f.label + '  HTTP ' + item.status);
      lines.push(origin + f.path);
      lines.push(f.desc + (item.note ? ' (' + item.note + ')' : ''));
      lines.push('');
    });
  }
  var text = lines.join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(function() {});
  }
}

function sfRenderResults(found, total, softOk, allResults) {
  var origin = '';
  try { origin = new URL(PopupState.currentTabUrl).origin; } catch(e) {}

  var container = document.getElementById('sf-results');
  container.innerHTML = '';
  container.classList.remove('hidden');

  // Summary bar
  var summary = document.createElement('div');
  summary.className = 'sf-summary';
  summary.textContent = found.length === 0
    ? T.t('sf.all_clear', { total: total })
    : T.t('sf.issues_found', { found: found.length, total: total });
  if (softOk) {
    var softNote = document.createElement('span');
    softNote.className = 'sf-soft404-note';
    softNote.textContent = T.t('sf.soft_404');
    summary.appendChild(softNote);
  }
  container.appendChild(summary);

  var btnRow = document.createElement('div');
  btnRow.className = 'sf-btn-row';

  var rerunBtn = document.createElement('button');
  rerunBtn.className = 'sf-rerun-btn';
  rerunBtn.textContent = T.t('sf.rerun');
  rerunBtn.addEventListener('click', function() { sfStartCheck(); });
  btnRow.appendChild(rerunBtn);

  var copyBtn = document.createElement('button');
  copyBtn.className = 'sf-rerun-btn';
  copyBtn.textContent = T.t('sf.copy');
  copyBtn.addEventListener('click', function() {
    sfCopyReport(found, origin);
    copyBtn.textContent = T.t('sf.copied');
    setTimeout(function() { copyBtn.textContent = T.t('sf.copy'); }, 1500);
  });
  btnRow.appendChild(copyBtn);

  container.appendChild(btnRow);

  if (found.length === 0) {
    var ok = document.createElement('div');
    ok.className = 'sf-clean';
    ok.textContent = T.t('sf.no_sensitive');
    container.appendChild(ok);
  } else {
    var SEV_ORDER = ['critical', 'warning', 'notice'];
    SEV_ORDER.forEach(function(sev) {
      var group = found.filter(function(it) {
        return (it.confirmed ? it.file.severity : 'notice') === sev;
      });
      if (group.length === 0) return;

      var groupEl = document.createElement('div');
      groupEl.className = 'sf-group';

      var sevLabel = T.t('popup.sev.' + sev, '') || sev.charAt(0).toUpperCase() + sev.slice(1);
      var groupTitle = document.createElement('div');
      groupTitle.className = 'sf-group-title sf-sev-' + sev;
      groupTitle.textContent = sevLabel + ' (' + group.length + ')';
      groupEl.appendChild(groupTitle);

      group.forEach(function(item) {
        var f = item.file;
        var row = document.createElement('div');
        row.className = 'sf-item sf-sev-' + (item.confirmed ? f.severity : 'notice');

        var top = document.createElement('div');
        top.className = 'sf-item-top';

        var cat = document.createElement('span');
        cat.className = 'sf-cat-badge';
        cat.textContent = f.category;
        top.appendChild(cat);

        var methodBadge = document.createElement('span');
        methodBadge.className = 'sf-method-badge sf-method-' + (f.method || 'HEAD').toLowerCase();
        methodBadge.textContent = f.method || 'HEAD';
        top.appendChild(methodBadge);

        var path = document.createElement('span');
        path.className = 'sf-item-path';
        path.textContent = f.label;
        top.appendChild(path);

        var status = document.createElement('span');
        status.className = 'sf-item-status';
        status.textContent = 'HTTP ' + item.status;
        top.appendChild(status);

        var openLink = document.createElement('a');
        openLink.className = 'sf-open-link';
        openLink.textContent = '↗';
        openLink.title = origin + f.path;
        openLink.href = origin + f.path;
        openLink.target = '_blank';
        openLink.rel = 'noopener noreferrer';
        top.appendChild(openLink);

        row.appendChild(top);

        var desc = document.createElement('div');
        desc.className = 'sf-item-desc hidden';
        desc.textContent = f.desc + (item.note ? ' (' + item.note + ')' : '');
        row.appendChild(desc);

        top.title = T.t('sf.click_desc');
        top.style.cursor = 'pointer';
        (function(toggleTop, toggleDesc) {
          toggleTop.addEventListener('click', function(e) {
            if (e.target.classList.contains('sf-open-link')) return;
            toggleDesc.classList.toggle('hidden');
          });
        })(top, desc);

        groupEl.appendChild(row);
      });

      container.appendChild(groupEl);
    });
  }

  // All checked files section
  if (allResults && allResults.length > 0) {
    var allSection = document.createElement('div');
    allSection.className = 'sf-all-section';

    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'sf-all-toggle';
    toggleBtn.textContent = T.t('sf.all_files', { count: allResults.length }) + ' ▸';

    var allList = document.createElement('div');
    allList.className = 'sf-all-list hidden';

    allResults.forEach(function(item) {
      var f = item.file;
      var r = item.resp;
      var statusCode = (r && r.ok) ? r.status : (r && r.status ? r.status : null);

      var row = document.createElement('div');
      row.className = 'sf-all-row';

      var pathSpan = document.createElement('span');
      pathSpan.className = 'sf-all-path';
      pathSpan.textContent = f.label;
      row.appendChild(pathSpan);

      var codeSpan = document.createElement('span');
      codeSpan.className = 'sf-all-code ' + sfStatusClass(statusCode);
      codeSpan.textContent = statusCode ? statusCode : 'err';
      row.appendChild(codeSpan);

      allList.appendChild(row);
    });

    toggleBtn.addEventListener('click', function() {
      var hidden = allList.classList.toggle('hidden');
      toggleBtn.textContent = T.t('sf.all_files', { count: allResults.length }) + ' ' + (hidden ? '▸' : '▾');
    });

    allSection.appendChild(toggleBtn);
    allSection.appendChild(allList);
    container.appendChild(allSection);
  }
}

function sfStartCheck() {
  if (sfRunning) return;
  sfRunning = true;

  var origin;
  try { origin = new URL(PopupState.currentTabUrl).origin; } catch(e) { origin = ''; }
  if (!origin) return;

  document.getElementById('sf-idle').classList.add('hidden');
  document.getElementById('sf-results').classList.add('hidden');
  var runningEl = document.getElementById('sf-running');
  var countEl = document.getElementById('sf-running-count');
  runningEl.classList.remove('hidden');

  chrome.storage.local.get({ customSecurityFiles: [] }, function(data) {
    var customFiles = (data.customSecurityFiles || []).map(function(cf) {
      return {
        path: cf.path, label: cf.label || cf.path, method: cf.method || 'HEAD',
        body: cf.body || null, contentType: cf.contentType || null,
        readBody: !!(cf.body && cf.method === 'POST'),
        severity: cf.severity || 'warning', category: 'Custom', desc: cf.desc || '',
      };
    });

    var allFiles = SF_BASE_FILES.concat(customFiles);
    var softProbeFile = { path: '/zzz-seoaudit-nonexistent-7k2x.html', method: 'HEAD' };

    var totalCount = allFiles.length + 1;
    countEl.textContent = T.t('sf.progress', { done: 0, total: totalCount });

    var progressBar = document.getElementById('sf-progress-bar');
    var completed = 0;
    function onDone() {
      completed++;
      countEl.textContent = T.t('sf.progress', { done: completed, total: totalCount });
      if (progressBar) progressBar.style.width = (completed / totalCount * 100) + '%';
    }

    var softProbe = sfProbe(origin, softProbeFile).then(function(r) { onDone(); return r; });
    var checks = allFiles.map(function(f) {
      return sfProbe(origin, f).then(function(r) { onDone(); return r; });
    });

    Promise.all([softProbe].concat(checks)).then(function(results) {
      sfRunning = false;
      runningEl.classList.add('hidden');

      var softOk = results[0].resp.ok && results[0].resp.status === 200;
      var fileResults = results.slice(1);

      var found = [];
      fileResults.forEach(function(item) {
        var f = item.file;
        var r = item.resp;
        if (!r.ok) return;

        if (f.detectXmlRpc) {
          if (sfIsXmlRpcActive(r)) {
            found.push({ file: f, status: r.status, confirmed: true });
          } else if (r.status === 405) {
            found.push({ file: f, status: r.status, confirmed: false, note: 'endpoint exists, POST rejected' });
          }
          return;
        }

        if (f.detectUsers) {
          if (r.status === 200 && r.text) {
            try {
              var users = JSON.parse(r.text);
              if (Array.isArray(users) && users.length > 0 && users[0].id) {
                found.push({ file: f, status: r.status, confirmed: true, note: users.length + ' user(s) enumerable' });
              }
            } catch(e) {}
          }
          return;
        }

        if (r.status === 200) {
          found.push({ file: f, status: r.status, confirmed: !softOk, note: softOk ? 'soft 404 — unverified' : '' });
        }
      });

      sfRenderResults(found, allFiles.length, softOk, fileResults);
    });
  });
}

function initSecurityFilesPanel() {
  var idle = document.getElementById('sf-idle');
  var running = document.getElementById('sf-running');
  var results = document.getElementById('sf-results');

  idle.classList.remove('hidden');
  running.classList.add('hidden');
  results.classList.add('hidden');
  sfRunning = false;

  // Reset progress bar
  var progressBar = document.getElementById('sf-progress-bar');
  if (progressBar) progressBar.style.width = '0%';

  chrome.storage.local.get({ customSecurityFiles: [] }, function(data) {
    var customCount = (data.customSecurityFiles || []).length;
    var total = SF_BASE_FILES.length + customCount;
    var hint = document.getElementById('sf-hint-msg');
    hint.textContent = customCount
      ? T.t('sf.hint_custom', { total: total, custom: customCount }) + '.'
      : T.t('sf.hint', { total: total }) + '.';
  });

  var btn = document.getElementById('sf-start-btn');
  var oldBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(oldBtn, btn);
  oldBtn.textContent = T.t('sf.start_btn');
  oldBtn.addEventListener('click', function() { sfStartCheck(); });
}
