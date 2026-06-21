// ─── Stats & Results Rendering ────────────────────────────────────────────────

function calcScore(critical, warning, notice) {
  return Math.max(0, 100 - Math.min(60, critical * 10) - Math.min(25, warning * 3) - Math.min(15, notice));
}

function countSeverities(issues) {
  var c = 0, w = 0, n = 0;
  issues.forEach(function(i) {
    if (i.muted) return;
    if (i.severity === 'critical') c++;
    else if (i.severity === 'warning') w++;
    else if (i.severity !== 'info') n++;
  });
  return { critical: c, warning: w, notice: n };
}

function calcStats(results) {
  var critical = 0, warning = 0, notice = 0;
  results.forEach(function(r) {
    var c = countSeverities(r.issues);
    critical += c.critical; warning += c.warning; notice += c.notice;
  });
  var total = critical + warning + notice;
  return { critical: critical, warning: warning, notice: notice, total: total };
}

function getCheckerCounts(result) {
  return countSeverities(result.issues);
}

function renderSummary(results) {
  var stats = calcStats(results);

  // Total count
  var totalEl = document.getElementById('total-count');
  if (totalEl) totalEl.textContent = stats.total;

  // Health status pill
  var healthEl = document.getElementById('health-status');
  if (healthEl) {
    if (stats.critical > 0) {
      healthEl.textContent = T.t('popup.health.attention');
      healthEl.className = 'health-status health-attention';
    } else if (stats.warning > 0) {
      healthEl.textContent = T.t('popup.health.ok-warnings');
      healthEl.className = 'health-status health-warnings';
    } else {
      healthEl.textContent = T.t('popup.health.clean');
      healthEl.className = 'health-status health-clean';
    }
  }

  // Progress bar — score-contribution segments (always sum to 100%)
  var critContrib = Math.min(60, stats.critical * 10);
  var warnContrib = Math.min(25, stats.warning * 3);
  var noteContrib = Math.min(15, stats.notice);
  var goodPct = calcScore(stats.critical, stats.warning, stats.notice);
  var barCrit = document.getElementById('bar-critical');
  var barWarn = document.getElementById('bar-warning');
  var barNote = document.getElementById('bar-notice');
  var barGood = document.getElementById('bar-good');
  if (barCrit) barCrit.style.width = critContrib + '%';
  if (barWarn) barWarn.style.width = warnContrib + '%';
  if (barNote) barNote.style.width = noteContrib + '%';
  if (barGood) barGood.style.width = goodPct + '%';

  var scoreEl = document.getElementById('health-score');
  if (scoreEl) {
    scoreEl.textContent = goodPct;
    scoreEl.className = 'health-score ' + (goodPct >= 80 ? 'score-good' : goodPct >= 50 ? 'score-mid' : 'score-bad');
  }

  var numCrit = document.getElementById('stat-num-critical');
  var numWarn = document.getElementById('stat-num-warning');
  var numNote = document.getElementById('stat-num-notice');
  if (numCrit) numCrit.textContent = stats.critical;
  if (numWarn) numWarn.textContent = stats.warning;
  if (numNote) numNote.textContent = stats.notice;

  // Show issue count on "All Issues" tab
  var allTab = document.querySelector('.c-tab[data-tab="all-issues"]');
  if (allTab) allTab.textContent = T.t('popup.tab.all_issues') + ' ' + stats.total;

  var tabs = document.querySelector('.content-tabs');
  if (tabs) tabs.classList.remove('hidden');

  return stats;
}

function updateTabBadges(results) {
  var countsMap = {};
  var tot = { critical: 0, warning: 0, notice: 0 };
  results.forEach(function(r) {
    var c = getCheckerCounts(r);
    countsMap[r.id] = c;
    tot.critical += c.critical;
    tot.warning  += c.warning;
    tot.notice   += c.notice;
  });

  document.querySelectorAll('.sidebar-item').forEach(function(item) {
    var id = item.dataset.checker;
    var old = item.querySelector('.badge');
    if (old) old.remove();
    var counts = id === 'all' ? tot : countsMap[id];
    if (!counts) return;
    var total = counts.critical + counts.warning + counts.notice;
    var badge = document.createElement('span');
    if (total === 0) {
      if (id === 'all') return;
      badge.className = 'badge check-badge';
      badge.textContent = '✓';
    } else {
      badge.className = 'badge' + (counts.critical > 0 ? '' : counts.warning > 0 ? ' warning-badge' : ' notice-badge');
      badge.textContent = total;
    }
    item.appendChild(badge);
  });
}

// ─── Severity filter ──────────────────────────────────────────────────────────

function updateSevFilter(results, activeTab) {
  var counts = { critical: 0, warning: 0, notice: 0, info: 0 };
  var source = activeTab === 'all' ? results : results.filter(function(r) { return r.id === activeTab; });
  source.forEach(function(r) {
    r.issues.forEach(function(i) {
      if (i.muted) return;
      if (i.severity === 'critical') counts.critical++;
      else if (i.severity === 'warning') counts.warning++;
      else if (i.severity === 'info') counts.info++;
      else counts.notice++;
    });
  });

  document.querySelectorAll('.sev-btn').forEach(function(btn) {
    var sev = btn.dataset.sev;
    var total = counts.critical + counts.warning + counts.notice;
    var label = T.t('popup.sev.' + sev) + ' (' + (sev === 'all' ? total : sev === 'info' ? counts.info : counts[sev] || 0) + ')';
    btn.textContent = label;
    var on = sev === PopupState.currentSeverity;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// ─── Results rendering ────────────────────────────────────────────────────────

function renderResults(results, activeTab) {
  if (PopupState.activeContentTab === 'quick-wins' && activeTab === 'all') {
    var filterBar = document.getElementById('filter-bar');
    if (filterBar) filterBar.classList.add('hidden');
    if (typeof renderQuickWins === 'function') renderQuickWins(results);
    return;
  }

  var container = document.getElementById('results');
  container.innerHTML = '';

  // Target keyword input for NLP / Content Quality tabs
  if (activeTab === 'nlp' || activeTab === 'content_quality') {
    var kwBar = document.createElement('div');
    kwBar.className = 'kw-inline-bar';

    var kwIcon = document.createElement('span');
    kwIcon.className = 'kw-inline-icon';
    kwIcon.textContent = '\uD83D\uDD11';
    kwBar.appendChild(kwIcon);

    var kwInput = document.createElement('input');
    kwInput.type = 'text';
    kwInput.className = 'kw-inline-input';
    kwInput.value = PopupState.targetKeyword || '';
    kwInput.placeholder = T.t('popup.kw.placeholder');
    kwInput.title = T.t('popup.kw.title');
    kwInput.autocomplete = 'off';
    kwInput.spellcheck = false;
    kwBar.appendChild(kwInput);

    var kwBtn = document.createElement('button');
    kwBtn.type = 'button';
    kwBtn.className = 'kw-inline-btn';
    kwBtn.textContent = '\u2192';
    kwBtn.title = T.t('popup.kw.apply');
    kwBar.appendChild(kwBtn);

    container.appendChild(kwBar);

    (function(input, btn) {
      function submit() {
        var kw = input.value.trim();
        if (typeof applyTargetKeyword === 'function') applyTargetKeyword(kw);
      }
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') submit();
      });
      btn.addEventListener('click', submit);
    })(kwInput, kwBtn);
  }

  var source = activeTab === 'all' ? results : results.filter(function(r) { return r.id === activeTab; });

  // Placeholder filled by applyIssueFilter when nothing is visible
  var noMsg = document.createElement('div');
  noMsg.className = 'no-issues hidden';
  noMsg.id = 'no-filter-match';
  container.appendChild(noMsg);

  var cardIndex = 0;
  source.forEach(function(r) {
    var isHtmlVal = r.id === 'htmlval' && activeTab === 'htmlval';

    if (r.issues.length === 0) {
      if (isHtmlVal) renderW3cSection(container);
      return;
    }

    var group = document.createElement('div');
    group.className = 'checker-group';

    if (activeTab === 'all') {
      var title = document.createElement('div');
      title.className = 'checker-group-title';
      title.textContent = r.name || r.id;
      group.appendChild(title);
    }

    r.issues.forEach(function(issue) {
      var sev = issue.severity || 'notice';
      var div = document.createElement('div');
      div.className = 'issue ' + sev + (issue.muted ? ' muted-issue' : '');
      div.dataset.sev = sev;
      if (issue.muted) div.dataset.muted = '1';
      div.style.animation = 'card-slide-in 0.15s ease-out ' + (Math.min(cardIndex, 10) * 20) + 'ms both';
      cardIndex++;

      var msgRow = document.createElement('div');
      msgRow.className = 'issue-msg-row';

      var msg = document.createElement('div');
      msg.className = 'issue-message';
      msg.textContent = issue.message;
      msgRow.appendChild(msg);

      if (issue.detail) {
        var copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.title = T.t('popup.copy.title');
        copyBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        (function(btn, text) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            navigator.clipboard.writeText(text).then(function() {
              btn.classList.add('copied');
              btn.title = T.t('popup.copy.done');
              setTimeout(function() {
                btn.classList.remove('copied');
                btn.title = T.t('popup.copy.title');
              }, 1500);
            }).catch(function() {});
          });
        })(copyBtn, issue.detail);
        msgRow.appendChild(copyBtn);
      }

      var hlBtn = document.createElement('button');
      hlBtn.className = 'hl-btn';
      hlBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>';
      if (issue.highlight) {
        hlBtn.title = T.t('popup.highlight.title');
        (function(btn, issueType) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (PopupState.activeHlBtn === btn) {
              clearPageHighlight();
            } else {
              if (PopupState.activeHlBtn) PopupState.activeHlBtn.classList.remove('active');
              PopupState.activeHlBtn = btn;
              btn.classList.add('active');
              if (PopupState.currentTabId) {
                chrome.tabs.sendMessage(PopupState.currentTabId, { action: 'highlightElements', issueType: issueType }, function(resp) {
                  if (chrome.runtime.lastError || (resp && resp.count === 0)) {
                    btn.classList.remove('active');
                    if (PopupState.activeHlBtn === btn) PopupState.activeHlBtn = null;
                  }
                });
              }
            }
          });
        })(hlBtn, issue.type);
      } else {
        hlBtn.classList.add('hl-no-highlight');
        hlBtn.disabled = true;
        hlBtn.title = T.t('popup.highlight.no_element');
      }
      msgRow.appendChild(hlBtn);

      if (issue.type) {
        var muteBtn = document.createElement('button');
        muteBtn.className = 'mute-btn' + (issue.muted ? ' muted' : '');
        muteBtn.textContent = issue.muted ? '↩' : '✕';
        muteBtn.title = T.t(issue.muted ? 'popup.mute.restore' : 'popup.mute.ignore');
        (function(type) {
          muteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleMuteIssue(type);
          });
        })(issue.type);
        msgRow.appendChild(muteBtn);
      }

      div.appendChild(msgRow);

      if (issue.detail) {
        var detailWrap = document.createElement('div');
        detailWrap.className = 'issue-detail-wrap';

        var detail = document.createElement('div');
        detail.className = 'issue-detail';
        detail.textContent = issue.detail;
        detailWrap.appendChild(detail);

        div.appendChild(detailWrap);
      }

      if (issue.url) {
        var linkEl = document.createElement('a');
        linkEl.className = 'issue-link';
        linkEl.href = '#';
        linkEl.textContent = issue.urlLabel || issue.url;
        (function(href) {
          linkEl.addEventListener('click', function(e) {
            e.preventDefault();
            chrome.tabs.create({ url: href });
          });
        })(issue.url);
        div.appendChild(linkEl);
      }

      group.appendChild(div);
    });

    container.appendChild(group);
    if (isHtmlVal) renderW3cSection(container);
  });

  // Toggle for issues the user chose to ignore on this domain
  var mutedCount = 0;
  source.forEach(function(r) {
    r.issues.forEach(function(i) { if (i.muted) mutedCount++; });
  });
  if (mutedCount > 0) {
    var mutedToggle = document.createElement('button');
    mutedToggle.id = 'muted-toggle';
    mutedToggle.className = 'muted-toggle';
    mutedToggle.textContent = T.t(PopupState.showMuted ? 'popup.muted.hide' : 'popup.muted.show', { count: mutedCount });
    mutedToggle.addEventListener('click', function() {
      PopupState.showMuted = !PopupState.showMuted;
      mutedToggle.textContent = T.t(PopupState.showMuted ? 'popup.muted.hide' : 'popup.muted.show', { count: mutedCount });
      applyIssueFilter(PopupState.currentSeverity);
    });
    container.appendChild(mutedToggle);
  }

  applyIssueFilter(PopupState.currentSeverity);
}

function toggleMuteIssue(type) {
  if (!type) return;
  var domain = getDomain(PopupState.currentTabUrl);
  if (!domain) return;
  chrome.storage.local.get({ mutedIssues: {} }, function(d) {
    var all = d.mutedIssues || {};
    var list = all[domain] || [];
    var idx = list.indexOf(type);
    if (idx === -1) list.push(type);
    else list.splice(idx, 1);
    if (list.length) all[domain] = list;
    else delete all[domain];
    chrome.storage.local.set({ mutedIssues: all }, function() {
      PopupState.mutedTypes = {};
      list.forEach(function(t) { PopupState.mutedTypes[t] = true; });
      if (!PopupState.lastResults) return;
      applyMuteFlags(PopupState.lastResults);
      var stats = renderSummary(PopupState.lastResults);
      updateTabBadges(PopupState.lastResults);
      renderResults(PopupState.lastResults, PopupState.currentTab);
      updateSevFilter(PopupState.lastResults, PopupState.currentTab);
      chrome.storage.sync.get({ showBadge: true }, function(s) {
        chrome.runtime.sendMessage({
          action: 'updateBadge',
          show: s.showBadge !== false,
          tabId: PopupState.currentTabId,
          critical: stats.critical,
          warning: stats.warning
        });
      });
    });
  });
}

function applyIssueFilter(severity) {
  var container = document.getElementById('results');
  if (!container) return;

  var visibleTotal = 0;
  Array.prototype.forEach.call(container.querySelectorAll('.checker-group'), function(group) {
    if (group.id === 'w3c-section') {
      group.classList.remove('hidden');
      return;
    }
    var visibleInGroup = 0;
    Array.prototype.forEach.call(group.querySelectorAll('.issue'), function(el) {
      var sev = el.dataset.sev;
      var sevMatch = (severity === 'all' && sev !== 'info') || sev === severity;
      var visible = sevMatch && (el.dataset.muted !== '1' || PopupState.showMuted);
      el.classList.toggle('hidden', !visible);
      if (visible) visibleInGroup++;
    });
    group.classList.toggle('hidden', visibleInGroup === 0);
    visibleTotal += visibleInGroup;
  });

  var noMsg = document.getElementById('no-filter-match');
  if (noMsg) {
    noMsg.classList.toggle('hidden', visibleTotal > 0);
    if (visibleTotal === 0) {
      noMsg.innerHTML = '';
      var icon = document.createElement('span');
      icon.className = 'checkmark';
      var p = document.createElement('p');
      var hasAnyIssue = !!container.querySelector('.checker-group:not(#w3c-section) .issue');
      if (severity !== 'all' && hasAnyIssue) {
        // Issues exist but the active severity filter hides them all
        noMsg.classList.add('filter-mismatch');
        icon.textContent = '🔍';
        p.textContent = T.t('popup.filter.no_match');
        noMsg.appendChild(icon);
        noMsg.appendChild(p);
        var resetBtn = document.createElement('button');
        resetBtn.className = 'filter-reset-btn';
        resetBtn.textContent = T.t('popup.filter.reset');
        resetBtn.addEventListener('click', resetSeverityFilter);
        noMsg.appendChild(resetBtn);
      } else {
        noMsg.classList.remove('filter-mismatch');
        icon.textContent = '✅';
        p.textContent = T.t('popup.no_issues');
        noMsg.appendChild(icon);
        noMsg.appendChild(p);
      }
    }
  }
}

function resetSeverityFilter() {
  PopupState.currentSeverity = 'all';
  document.querySelectorAll('.sev-btn').forEach(function(b) {
    var on = b.dataset.sev === 'all';
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  chrome.storage.local.set({ sevFilter: 'all' });
  applyIssueFilter('all');
}

function renderW3cSection(container) {
  var section = document.createElement('div');
  section.className = 'checker-group';
  section.id = 'w3c-section';

  var title = document.createElement('div');
  title.className = 'checker-group-title';
  title.textContent = 'W3C Nu HTML Checker';
  section.appendChild(title);

  var body = document.createElement('div');
  body.id = 'w3c-body';

  if (PopupState.w3cState && PopupState.w3cState.loaded) {
    renderW3cResults(body, PopupState.w3cState.data);
  } else {
    var btn = document.createElement('button');
    btn.className = 'sa-run-btn';
    btn.id = 'btn-w3c-validate';
    btn.textContent = T.t('render.w3c.check');
    btn.style.margin = '8px 12px 10px';
    body.appendChild(btn);

    btn.addEventListener('click', function() {
      if (!PopupState.currentTabUrl) return;
      btn.disabled = true;
      btn.textContent = '⏳';
      var errEl = body.querySelector('.w3c-error');
      if (errEl) errEl.remove();

      chrome.runtime.sendMessage({ action: 'w3cValidate', url: PopupState.currentTabUrl }, function(resp) {
        btn.disabled = false;
        btn.textContent = T.t('render.w3c.check');
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          var err = document.createElement('div');
          err.className = 'issue warning w3c-error';
          var errMsg = document.createElement('div');
          errMsg.className = 'issue-message';
          errMsg.textContent = 'W3C: ' + ((resp && resp.error) || T.t('render.connection_error'));
          err.appendChild(errMsg);
          body.appendChild(err);
          return;
        }
        PopupState.w3cState = { loaded: true, data: resp.data };
        body.innerHTML = '';
        renderW3cResults(body, resp.data);
      });
    });
  }

  section.appendChild(body);
  container.appendChild(section);
}

function renderW3cResults(container, data) {
  container.innerHTML = '';
  var messages = (data && data.messages) || [];

  if (messages.length === 0) {
    var ok = document.createElement('div');
    ok.className = 'issue info';
    var okMsg = document.createElement('div');
    okMsg.className = 'issue-message';
    okMsg.textContent = T.t('render.w3c.no_errors');
    ok.appendChild(okMsg);
    container.appendChild(ok);
    return;
  }

  var errors = 0, warnings = 0;
  messages.forEach(function(m) { if (m.type === 'error') errors++; else warnings++; });

  var summary = document.createElement('div');
  summary.className = 'issue info';
  var summaryMsg = document.createElement('div');
  summaryMsg.className = 'issue-message';
  summaryMsg.textContent = T.t('render.w3c.found', { errors: errors, warnings: warnings });
  summary.appendChild(summaryMsg);
  container.appendChild(summary);

  messages.slice(0, 20).forEach(function(m) {
    var div = document.createElement('div');
    div.className = 'issue ' + (m.type === 'error' ? 'warning' : 'notice');

    var msg = document.createElement('div');
    msg.className = 'issue-message';
    msg.textContent = m.message || '';
    div.appendChild(msg);

    if (m.lastLine || m.extract) {
      var detail = document.createElement('div');
      detail.className = 'issue-detail';
      detail.textContent = (m.lastLine ? T.t('render.w3c.line') + ' ' + m.lastLine + (m.firstColumn ? ':' + m.firstColumn : '') + ' — ' : '') + (m.extract || '');
      div.appendChild(detail);
    }

    container.appendChild(div);
  });

  if (messages.length > 20) {
    var more = document.createElement('div');
    more.className = 'issue info';
    var moreMsg = document.createElement('div');
    moreMsg.className = 'issue-message';
    moreMsg.textContent = T.t('render.more_messages', { count: messages.length - 20 });
    more.appendChild(moreMsg);
    container.appendChild(more);
  }
}

function clearPageHighlight() {
  if (PopupState.activeHlBtn) {
    PopupState.activeHlBtn.classList.remove('active');
    PopupState.activeHlBtn = null;
  }
  if (PopupState.currentTabId) {
    chrome.tabs.sendMessage(PopupState.currentTabId, { action: 'clearHighlight' });
  }
}
