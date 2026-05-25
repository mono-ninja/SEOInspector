// ─── Robots.txt Viewer Panel ──────────────────────────────────────────────────

function initRobotsTxtPanel(pageUrl) {
  if (PopupState.robotsTxtLoaded) return;
  PopupState.robotsTxtLoaded = true;

  var panel = document.getElementById('robots-txt-panel');
  var loadingDiv = document.createElement('div');
  loadingDiv.className = 'panel-loading';
  loadingDiv.textContent = T.t('popup.loading');
  panel.innerHTML = '';
  panel.appendChild(loadingDiv);

  var robotsUrl = '';
  try {
    var u = new URL(pageUrl);
    robotsUrl = u.protocol + '//' + u.host + '/robots.txt';
  } catch(e) {
    var errDiv = document.createElement('div');
    errDiv.className = 'panel-error';
    errDiv.textContent = T.t('robots_txt.invalid_url');
    panel.innerHTML = '';
    panel.appendChild(errDiv);
    return;
  }

  fetchTextWithRetry(robotsUrl, function(resp, errMsg) {
    if (!resp) {
      PopupState.robotsTxtLoaded = false;
      var errDiv = document.createElement('div');
      errDiv.className = 'panel-error';
      errDiv.textContent = T.t('robots_txt.fetch_fail') + (errMsg ? ' (' + escapeHtml(errMsg) + ')' : '');
      panel.innerHTML = '';
      panel.appendChild(errDiv);
      return;
    }
    if (resp.status === 404) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'panel-empty';
      emptyDiv.textContent = T.t('robots_txt.not_found');
      panel.innerHTML = '';
      panel.appendChild(emptyDiv);
      return;
    }
    if (!resp.ok) {
      var errDiv2 = document.createElement('div');
      errDiv2.className = 'panel-error';
      errDiv2.textContent = T.t('robots_txt.fetch_fail') + ' (HTTP ' + resp.status + ')';
      panel.innerHTML = '';
      panel.appendChild(errDiv2);
      return;
    }
    panel.innerHTML = '';
    renderRobotsTxt(panel, resp.text, robotsUrl, pageUrl);
  });
}

function renderRobotsTxt(panel, text, robotsUrl, pageUrl) {
  var wrap = document.createElement('div');
  wrap.className = 'rtxt-wrap';

  // ── URL bar ────────────────────────────────────────────────────────────────
  var urlBar = document.createElement('div');
  urlBar.className = 'rtxt-url-bar';
  urlBar.textContent = robotsUrl;
  wrap.appendChild(urlBar);

  // ── Parse ──────────────────────────────────────────────────────────────────
  var parsed = parseRobotsTxt(text);

  // ── Current page check ────────────────────────────────────────────────────
  var pagePath = '/';
  try { pagePath = new URL(pageUrl).pathname + new URL(pageUrl).search; } catch(e) {}
  var allowed = isAllowed(parsed, pagePath);

  var statusEl = document.createElement('div');
  statusEl.className = 'rtxt-status ' + (allowed ? 'rtxt-allowed' : 'rtxt-blocked');
  var statusIcon = document.createTextNode(allowed ? '✓ ' : '✗ ');
  statusEl.appendChild(statusIcon);
  var statusText = document.createTextNode(T.t(allowed ? 'robots_txt.page_allowed' : 'robots_txt.page_blocked'));
  statusEl.appendChild(statusText);
  var codeEl = document.createElement('code');
  codeEl.textContent = pagePath;
  statusEl.appendChild(codeEl);
  wrap.appendChild(statusEl);

  // ── Sitemaps ──────────────────────────────────────────────────────────────
  if (parsed.sitemaps.length > 0) {
    var sitemapSection = document.createElement('div');
    sitemapSection.className = 'rtxt-section';
    var sitemapTitle = document.createElement('div');
    sitemapTitle.className = 'rtxt-section-title';
    sitemapTitle.textContent = T.t('robots_txt.sitemaps') + ' (' + parsed.sitemaps.length + ')';
    sitemapSection.appendChild(sitemapTitle);
    parsed.sitemaps.forEach(function(s) {
      var item = document.createElement('div');
      item.className = 'rtxt-sitemap-item';
      item.textContent = s;
      sitemapSection.appendChild(item);
    });
    wrap.appendChild(sitemapSection);
  }

  // ── User-agent groups ─────────────────────────────────────────────────────
  parsed.groups.forEach(function(group) {
    var section = document.createElement('div');
    section.className = 'rtxt-section';

    var title = document.createElement('div');
    title.className = 'rtxt-section-title';
    title.textContent = 'User-agent: ' + group.agents.join(', ');
    if (group.crawlDelay) title.textContent += '  (Crawl-delay: ' + group.crawlDelay + ')';
    section.appendChild(title);

    group.rules.forEach(function(rule) {
      var item = document.createElement('div');
      item.className = 'rtxt-rule rtxt-rule-' + rule.type;
      var icon = document.createElement('span');
      icon.className = 'rtxt-rule-icon';
      icon.textContent = rule.type === 'disallow' ? '✗' : '✓';
      var path = document.createElement('span');
      path.className = 'rtxt-rule-path';
      path.textContent = rule.type.charAt(0).toUpperCase() + rule.type.slice(1) + ': ' + (rule.path || '/');
      item.appendChild(icon); item.appendChild(path);
      section.appendChild(item);
    });

    if (group.rules.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'rtxt-rule rtxt-rule-allow';
      empty.textContent = T.t('robots_txt.no_rules');
      section.appendChild(empty);
    }

    wrap.appendChild(section);
  });

  // ── Raw text ──────────────────────────────────────────────────────────────
  var rawToggle = document.createElement('button');
  rawToggle.className = 'rtxt-raw-toggle';
  rawToggle.textContent = T.t('robots_txt.show_raw');
  var rawPre = document.createElement('pre');
  rawPre.className = 'rtxt-raw hidden';
  rawPre.textContent = text;
  rawToggle.addEventListener('click', function() {
    var hidden = rawPre.classList.toggle('hidden');
    rawToggle.textContent = T.t(hidden ? 'robots_txt.show_raw' : 'robots_txt.hide_raw');
  });
  wrap.appendChild(rawToggle);
  wrap.appendChild(rawPre);

  panel.appendChild(wrap);
}

function parseRobotsTxt(text) {
  var groups = [];
  var sitemaps = [];
  var currentGroup = null;
  var lines = text.split('\n');

  lines.forEach(function(rawLine) {
    var trimmed = rawLine.trim();
    var commentIdx = trimmed.indexOf('#');
    var line = commentIdx === 0 ? '' : (commentIdx !== -1 ? trimmed.substring(0, commentIdx) : trimmed).trim();
    if (!line) {
      if (currentGroup) { groups.push(currentGroup); currentGroup = null; }
      return;
    }
    var colon = line.indexOf(':');
    if (colon === -1) return;
    var field = line.substring(0, colon).trim().toLowerCase();
    var value = line.substring(colon + 1).trim();

    if (field === 'user-agent') {
      if (!currentGroup) currentGroup = { agents: [], rules: [], crawlDelay: null };
      currentGroup.agents.push(value);
    } else if (field === 'disallow' && currentGroup) {
      currentGroup.rules.push({ type: 'disallow', path: value });
    } else if (field === 'allow' && currentGroup) {
      currentGroup.rules.push({ type: 'allow', path: value });
    } else if (field === 'crawl-delay' && currentGroup) {
      currentGroup.crawlDelay = value;
    } else if (field === 'sitemap') {
      sitemaps.push(value);
    }
  });

  if (currentGroup) groups.push(currentGroup);
  return { groups: groups, sitemaps: sitemaps };
}

function isAllowed(parsed, path) {
  // Find the most specific matching group (User-agent: * or exact bot)
  var starGroup = null;
  parsed.groups.forEach(function(g) {
    g.agents.forEach(function(a) { if (a === '*') starGroup = g; });
  });
  if (!starGroup) return true;  // no rules = allowed

  // Apply rules in order, longest match wins
  var lastMatch = null;
  var lastMatchLen = -1;
  starGroup.rules.forEach(function(rule) {
    if (!rule.path) return;
    // Simple wildcard: path prefix match
    var rpath = rule.path;
    var wildcard = rpath.indexOf('*') !== -1;
    var matches = false;
    if (wildcard) {
      var parts = rpath.split('*');
      var pos = 0;
      matches = parts.every(function(part, i) {
        if (i === 0) { matches = path.indexOf(part) === 0; pos = part.length; return matches; }
        var found = path.indexOf(part, pos);
        if (found === -1) return false;
        pos = found + part.length;
        return true;
      });
    } else {
      matches = path.indexOf(rpath) === 0;
    }
    if (matches && rpath.length > lastMatchLen) {
      lastMatchLen = rpath.length;
      lastMatch = rule.type;
    }
  });

  if (lastMatch === null) return true;  // no matching rule = allowed
  return lastMatch === 'allow';
}
