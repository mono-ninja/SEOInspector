// ─── Popup App — Init & Event Wiring ──────────────────────────────────────────

var currentPinnedIds = [];

var SEV_ICONS = { critical: '🔴', warning: '🟡', notice: '🔵', info: 'ℹ️' };

// Dispatch table for sidebar panel init functions.
var PANEL_INIT_FNS = {
  broken_links:   function() { if (PopupState.currentTabId)  initBrokenLinksPanel(PopupState.currentTabId); },
  storage:        function() { if (PopupState.currentTabId)  initStoragePanel(PopupState.currentTabId, PopupState.currentTabUrl); },
  headers:        function() { if (PopupState.currentTabUrl) initHeadersPanel(PopupState.currentTabUrl); },
  og_preview:     function() { if (PopupState.currentTabId)  initOgPreviewPanel(PopupState.currentTabId); },
  serp_preview:   function() { if (PopupState.currentTabId)  initSerpPreviewPanel(PopupState.currentTabId); },
  sitemap:        function() { if (PopupState.currentTabUrl) initSitemapPanel(PopupState.currentTabUrl); },

  redirect_chain:   function() { initRedirectChainPanel(); },
  security_files:   function() { initSecurityFilesPanel(); },
};

var PANEL_LOADED_FLAGS = [
  'brokenLinksChecked', 'storageLoaded', 'headersLoaded',
  'ogPreviewLoaded', 'serpPreviewLoaded',
  'robotsTxtLoaded', 'sitemapLoaded',
];

function activateChecker(checkerId) {
  clearPageHighlight();
  if (checkerId !== 'all' && PopupState.activeContentTab === 'quick-wins') {
    PopupState.activeContentTab = 'all-issues';
    PopupState.expandedQuickWin = null;
    document.querySelectorAll('.c-tab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.tab === 'all-issues');
    });
    var filterBarEl = document.getElementById('filter-bar');
    if (filterBarEl) filterBarEl.classList.remove('hidden');
  }
  document.querySelectorAll('.sidebar-item').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.sidebar-item[data-checker="' + checkerId + '"]').forEach(function(t) { t.classList.add('active'); });
  PopupState.currentTab = checkerId;
  switchPanel(checkerId);
  var initFn = PANEL_INIT_FNS[checkerId];
  if (initFn) {
    initFn();
  } else if (PopupState.lastResults) {
    renderResults(PopupState.lastResults, checkerId);
    updateSevFilter(PopupState.lastResults, checkerId);
  }
}

function createPinSvg() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M16 1v6l2 4H6l2-4V1h8zm-5 18v-4h2v4l-1 3-1-3z');
  svg.appendChild(path);
  return svg;
}

function createPinSpan(checkerId, isPinned) {
  var pinSpan = document.createElement('span');
  pinSpan.className = 'sidebar-pin-btn' + (isPinned ? ' pinned' : '');
  pinSpan.title = T.t(isPinned ? 'popup.pin.unpin' : 'popup.pin.pin');
  pinSpan.appendChild(createPinSvg());
  pinSpan.dataset.checker = checkerId;
  (function(id) {
    pinSpan.addEventListener('click', function(e) {
      e.stopPropagation();
      togglePin(id);
    });
  })(checkerId);
  return pinSpan;
}

function resetPanelUI() {
  PANEL_LOADED_FLAGS.forEach(function(key) { PopupState[key] = false; });
  PopupState.blAnchorMap = {};
  PopupState.panelGen = {};
  PopupState.w3cState = null;
  if (PopupState.activeHlBtn) {
    PopupState.activeHlBtn.classList.remove('active');
    PopupState.activeHlBtn = null;
  }
  if (PopupState.brokenLinksPort) {
    PopupState.brokenLinksPort.disconnect();
    PopupState.brokenLinksPort = null;
  }
  var panelResets = {
    'bl-idle':         function(el) { el.classList.remove('hidden'); },
    'bl-progress':     function(el) { el.classList.add('hidden'); },
    'bl-results':      function(el) { el.classList.add('hidden'); },
    'storage-content': function(el) { el.classList.add('hidden'); },
    'storage-loading': function(el) { el.classList.remove('hidden'); el.textContent = T.t('popup.storage.loading'); },
    'headers-content': function(el) { el.classList.add('hidden'); },
    'headers-loading': function(el) { el.classList.remove('hidden'); },
  };
  Object.keys(panelResets).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) panelResets[id](el);
  });
}

// Wrap each sidebar-item (except sidebar-all) in a .sidebar-item-row div,
// move data-i18n to a child label span, and add a pin button span.
function addPinButtons(pinnedIds) {
  document.querySelectorAll('.sidebar-item:not(.sidebar-all)').forEach(function(btn) {
    if (btn.parentNode && btn.parentNode.classList && btn.parentNode.classList.contains('sidebar-item-row')) return;

    var checkerId = btn.dataset.checker;
    var i18nKey = btn.getAttribute('data-i18n');
    var currentText = btn.textContent;

    btn.removeAttribute('data-i18n');
    btn.textContent = '';

    var labelSpan = document.createElement('span');
    labelSpan.className = 'sidebar-item-label';
    if (i18nKey) labelSpan.setAttribute('data-i18n', i18nKey);
    labelSpan.textContent = currentText;
    btn.appendChild(labelSpan);

    var row = document.createElement('div');
    row.className = 'sidebar-item-row';
    btn.parentNode.insertBefore(row, btn);
    row.appendChild(btn);

    // Pin span goes INSIDE the button — after label, before any future badge —
    // so it lives in the flex flow and never overlaps the badge.
    btn.appendChild(createPinSpan(checkerId, !!(pinnedIds && pinnedIds.indexOf(checkerId) !== -1)));
  });
}

// Rebuild the pinned section and update pin button states in the main sidebar.
function initPinnedSection(pinnedIds) {
  currentPinnedIds = pinnedIds || [];
  var section = document.getElementById('sidebar-pinned-section');
  if (!section) return;
  section.innerHTML = '';

  if (!currentPinnedIds.length) {
    section.classList.add('hidden');
  } else {
    section.classList.remove('hidden');

    var header = document.createElement('div');
    header.className = 'sidebar-pinned-header';
    var headerIcon = document.createElement('span');
    headerIcon.textContent = '📌';
    var headerText = document.createElement('span');
    headerText.setAttribute('data-i18n', 'popup.sidebar.pinned');
    headerText.textContent = T.t('popup.sidebar.pinned');
    header.appendChild(headerIcon);
    header.appendChild(headerText);
    section.appendChild(header);

    currentPinnedIds.forEach(function(checkerId) {
      var origBtn = document.querySelector('.sidebar-group-items .sidebar-item[data-checker="' + checkerId + '"]');
      if (!origBtn) return;

      var labelSpan = origBtn.querySelector('.sidebar-item-label');
      var i18nKey = labelSpan ? labelSpan.getAttribute('data-i18n') : null;
      var labelText = labelSpan ? labelSpan.textContent : origBtn.textContent;

      var row = document.createElement('div');
      row.className = 'sidebar-item-row';

      var cloneBtn = document.createElement('button');
      cloneBtn.className = 'sidebar-item sidebar-pinned-clone';
      cloneBtn.dataset.checker = checkerId;
      (function(id) {
        cloneBtn.addEventListener('click', function() { activateChecker(id); });
      })(checkerId);

      var cloneLabel = document.createElement('span');
      cloneLabel.className = 'sidebar-item-label';
      if (i18nKey) cloneLabel.setAttribute('data-i18n', i18nKey);
      cloneLabel.textContent = labelText;
      cloneBtn.appendChild(cloneLabel);

      cloneBtn.appendChild(createPinSpan(checkerId, true));
      row.appendChild(cloneBtn);

      section.appendChild(row);
    });
  }

  // Sync pinned state on main sidebar pin buttons
  document.querySelectorAll('.sidebar-group-items .sidebar-pin-btn').forEach(function(pinBtn) {
    var id = pinBtn.dataset.checker;
    if (currentPinnedIds.indexOf(id) !== -1) {
      pinBtn.classList.add('pinned');
      pinBtn.title = T.t('popup.pin.unpin');
    } else {
      pinBtn.classList.remove('pinned');
      pinBtn.title = T.t('popup.pin.pin');
    }
  });
}

function togglePin(checkerId) {
  chrome.storage.local.get({ pinnedCheckers: [] }, function(data) {
    var pinned = data.pinnedCheckers || [];
    var idx = pinned.indexOf(checkerId);
    if (idx === -1) {
      pinned.push(checkerId);
    } else {
      pinned.splice(idx, 1);
    }
    chrome.storage.local.set({ pinnedCheckers: pinned }, function() {
      initPinnedSection(pinned);
    });
  });
}

// Copy all visible issues as markdown to clipboard.
function copyAllIssues() {
  if (!PopupState.lastResults) return;
  var lines = [];
  lines.push('# SEO Audit — ' + (PopupState.currentTabUrl || ''));
  lines.push('');
  var sevFilter = PopupState.currentSeverity || 'all';
  PopupState.lastResults.forEach(function(checker) {
    if (!checker || !checker.issues || !checker.issues.length) return;
    var filtered = checker.issues.filter(function(issue) {
      if (issue.muted) return false;
      if (sevFilter === 'all') return issue.severity !== 'info';
      return issue.severity === sevFilter;
    });
    if (!filtered.length) return;
    lines.push('## ' + (checker.name || checker.id));
    filtered.forEach(function(issue) {
      var icon = SEV_ICONS[issue.severity] || '•';
      var line = icon + ' ' + (issue.message || '');
      if (issue.detail) line += ' — ' + issue.detail;
      lines.push(line);
    });
    lines.push('');
  });
  var text = lines.join('\n');
  var btn = document.getElementById('btn-copy-issues');

  function onCopied() {
    if (!btn) return;
    var orig = btn.textContent;
    btn.textContent = '✓';
    setTimeout(function() { btn.textContent = orig; }, 1500);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onCopied).catch(function() {
      fallbackCopy(text);
      onCopied();
    });
  } else {
    fallbackCopy(text);
    onCopied();
  }
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(ta);
}

function initTheme() {
  chrome.storage.local.get({ seoTheme: 'dark' }, function(data) {
    var theme = data.seoTheme || 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    var btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = theme === 'dark' ? '◐' : '☀';
  });
}

document.addEventListener('DOMContentLoaded', init);

function init() {
  initTheme();
  // Set up pin buttons synchronously before any async callbacks so that
  // applyTranslations() (called later in a storage callback) only sets the
  // label span's textContent — not the whole button — preserving the pin span.
  addPinButtons([]);

  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || tabs.length === 0) { showError(T.t('popup.error.no_tab')); return; }
    var tab = tabs[0];
    PopupState.currentTabUrl = tab.url || '';
    if (PopupState.currentTabUrl.indexOf('https://') !== 0) {
      showError(T.t('popup.error.unsupported_page'));
      return;
    }
    var urlBar = document.getElementById('url-bar');
    if (urlBar) {
      urlBar.textContent = PopupState.currentTabUrl;
      urlBar.title = PopupState.currentTabUrl;
    }
    PopupState.currentTabId = tab.id;
    PopupState.currentTabTitle = tab.title || '';

    // Load per-domain target keyword and muted issue types before first analysis
    var domain = getDomain(PopupState.currentTabUrl);
    chrome.storage.local.get({ targetKeywords: {}, mutedIssues: {} }, function(d) {
      PopupState.targetKeyword = (d.targetKeywords || {})[domain] || '';
      PopupState.mutedTypes = {};
      ((d.mutedIssues || {})[domain] || []).forEach(function(t) { PopupState.mutedTypes[t] = true; });

      var kwBar = document.getElementById('kw-bar');
      var kwInput = document.getElementById('target-keyword');
      if (kwBar && kwInput) {
        kwBar.classList.remove('hidden');
        kwInput.value = PopupState.targetKeyword;
        kwInput.placeholder = T.t('popup.kw.placeholder');
        kwInput.title = T.t('popup.kw.title');
      }

      analyzeTab(tab.id);
    });
  });

  // Target keyword — apply on Enter or button click
  var kwApplyInput = document.getElementById('target-keyword');
  var kwApplyBtn = document.getElementById('btn-kw-apply');
  if (kwApplyInput) kwApplyInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') applyTargetKeyword();
  });
  if (kwApplyBtn) kwApplyBtn.addEventListener('click', applyTargetKeyword);

  // Sidebar navigation
  document.querySelectorAll('.sidebar-item:not(.sidebar-pinned-clone)').forEach(function(btn) {
    btn.addEventListener('click', function() { activateChecker(btn.dataset.checker); });
  });

  // Severity filter — restore persisted value, also load pinned checkers and group collapse state
  chrome.storage.local.get({ sevFilter: 'all', pinnedCheckers: [], collapsedGroups: {} }, function(d) {
    var saved = d.sevFilter || 'all';
    PopupState.currentSeverity = saved;
    document.querySelectorAll('.sev-btn').forEach(function(b) {
      var on = b.dataset.sev === saved;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (PopupState.lastResults) {
      applyIssueFilter(saved);
      updateSevFilter(PopupState.lastResults, PopupState.currentTab);
    }

    initPinnedSection(d.pinnedCheckers || []);
    initSidebarGroups(d.collapsedGroups);
  });

  document.querySelectorAll('.sev-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      PopupState.currentSeverity = btn.dataset.sev;
      document.querySelectorAll('.sev-btn').forEach(function(b) {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      chrome.storage.local.set({ sevFilter: PopupState.currentSeverity });
      if (PopupState.lastResults) applyIssueFilter(PopupState.currentSeverity);
    });
  });

  // Refresh
  var refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', function() {
    resetPanelUI();
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs.length > 0) {
        PopupState.currentTabId = tabs[0].id;
        PopupState.currentTabUrl = tabs[0].url || '';
        analyzeTab(tabs[0].id);
      }
    });
  });

  // More dropdown (export / print)
  var moreBtn = document.getElementById('btn-more');
  var moreDropdown = document.getElementById('more-dropdown');
  if (moreBtn && moreDropdown) {
    moreBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      moreDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', function() {
      moreDropdown.classList.add('hidden');
    });
    moreDropdown.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }

  var exportBtn = document.getElementById('btn-export');
  if (exportBtn) exportBtn.addEventListener('click', function() {
    if (moreDropdown) moreDropdown.classList.add('hidden');
    exportReport();
  });

  var exportCsvBtn = document.getElementById('btn-export-csv');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', function() {
    if (moreDropdown) moreDropdown.classList.add('hidden');
    exportReportCSV();
  });

  var exportJsonBtn = document.getElementById('btn-export-json');
  if (exportJsonBtn) exportJsonBtn.addEventListener('click', function() {
    if (moreDropdown) moreDropdown.classList.add('hidden');
    exportReportJSON();
  });

  var printBtn = document.getElementById('btn-print');
  if (printBtn) printBtn.addEventListener('click', function() {
    if (moreDropdown) moreDropdown.classList.add('hidden');
    printReport();
  });

  var copyIssuesBtn = document.getElementById('btn-copy-issues');
  if (copyIssuesBtn) copyIssuesBtn.addEventListener('click', function() {
    if (moreDropdown) moreDropdown.classList.add('hidden');
    copyAllIssues();
  });

  // Audit history panel
  var historyBtn = document.getElementById('btn-history');
  if (historyBtn) historyBtn.addEventListener('click', function() {
    clearPageHighlight();
    document.querySelectorAll('.sidebar-item').forEach(function(t) { t.classList.remove('active'); });
    PopupState.currentTab = 'audit_history';
    switchPanel('audit_history');
    initAuditHistoryPanel();
  });

  // Language toggle
  var langBtn = document.getElementById('btn-lang');
  if (langBtn) {
    langBtn.textContent = T.getLocale().toUpperCase();
    langBtn.addEventListener('click', function() {
      var newLocale = T.getLocale() === 'en' ? 'uk' : 'en';
      T.setLocale(newLocale);
      langBtn.textContent = newLocale.toUpperCase();
      document.documentElement.lang = newLocale;
      T.applyTranslations();
      initPinnedSection(currentPinnedIds);
      var kwInputLang = document.getElementById('target-keyword');
      if (kwInputLang) {
        kwInputLang.placeholder = T.t('popup.kw.placeholder');
        kwInputLang.title = T.t('popup.kw.title');
      }
      if (PopupState.lastResults) {
        renderSummary(PopupState.lastResults);
        renderResults(PopupState.lastResults, PopupState.currentTab);
        updateSevFilter(PopupState.lastResults, PopupState.currentTab);
      }
    });
  }

  // Sidebar search
  var sidebarSearch = document.getElementById('sidebar-search');
  if (sidebarSearch) {
    sidebarSearch.addEventListener('input', function() {
      var q = sidebarSearch.value.toLowerCase().trim();
      var sidebar = document.getElementById('sidebar');
      if (!q) {
        sidebar.classList.remove('searching');
        document.querySelectorAll('.sidebar-item-row').forEach(function(row) { row.style.display = ''; });
        document.querySelectorAll('.sidebar-item:not(.sidebar-all)').forEach(function(item) { item.style.display = ''; });
        document.querySelectorAll('.sidebar-group').forEach(function(grp) {
          grp.style.display = '';
          var items = document.getElementById('group-items-' + grp.dataset.group);
          if (items) items.style.display = '';
        });
        return;
      }
      sidebar.classList.add('searching');
      document.querySelectorAll('.sidebar-group').forEach(function(grp) {
        var itemsEl = document.getElementById('group-items-' + grp.dataset.group);
        if (!itemsEl) return;
        var hasMatch = false;
        itemsEl.querySelectorAll('.sidebar-item').forEach(function(item) {
          var text = (item.textContent || '').toLowerCase();
          var checker = (item.dataset.checker || '').toLowerCase();
          var match = text.indexOf(q) !== -1 || checker.indexOf(q) !== -1;
          var row = item.parentNode;
          if (row && row.classList && row.classList.contains('sidebar-item-row')) {
            row.style.display = match ? '' : 'none';
          } else {
            item.style.display = match ? '' : 'none';
          }
          if (match) hasMatch = true;
        });
        grp.style.display = hasMatch ? '' : 'none';
        itemsEl.style.display = hasMatch ? '' : 'none';
      });
    });
  }

  // Options
  document.getElementById('btn-options').addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  });

  // Theme toggle
  var themeBtn = document.getElementById('btn-theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', function() {
      var isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        document.documentElement.classList.remove('dark');
        themeBtn.textContent = '☀';
      } else {
        document.documentElement.classList.add('dark');
        themeBtn.textContent = '◐';
      }
      chrome.storage.local.set({ seoTheme: isDark ? 'light' : 'dark' });
    });
  }

  // Content tab switching
  document.querySelectorAll('.c-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var targetTab = tab.dataset.tab;
      PopupState.activeContentTab = targetTab;
      PopupState.expandedQuickWin = null;
      document.querySelectorAll('.c-tab').forEach(function(t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      var filterBar = document.getElementById('filter-bar');
      if (targetTab === 'quick-wins') {
        if (filterBar) filterBar.classList.add('hidden');
        if (PopupState.lastResults) renderQuickWins(PopupState.lastResults);
      } else {
        if (filterBar) filterBar.classList.remove('hidden');
        if (PopupState.lastResults) {
          renderResults(PopupState.lastResults, PopupState.currentTab);
          updateSevFilter(PopupState.lastResults, PopupState.currentTab);
          applyIssueFilter(PopupState.currentSeverity);
        }
      }
    });
  });

  // Stat card clicks — apply severity filter and switch to All Issues tab
  document.querySelectorAll('.stat-card').forEach(function(card) {
    function activateStatCard() {
      var sev = card.dataset.sev;
      PopupState.activeContentTab = 'all-issues';
      PopupState.expandedQuickWin = null;
      document.querySelectorAll('.c-tab').forEach(function(t) {
        var on = t.dataset.tab === 'all-issues';
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      var filterBar = document.getElementById('filter-bar');
      if (filterBar) filterBar.classList.remove('hidden');

      PopupState.currentSeverity = sev;
      document.querySelectorAll('.sev-btn').forEach(function(b) {
        var on = b.dataset.sev === sev;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      chrome.storage.local.set({ sevFilter: sev });

      if (PopupState.lastResults) {
        renderResults(PopupState.lastResults, PopupState.currentTab);
        applyIssueFilter(sev);
        updateSevFilter(PopupState.lastResults, PopupState.currentTab);
      }
    }
    card.addEventListener('click', activateStatCard);
    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateStatCard();
      }
    });
  });
}

function applyTargetKeyword() {
  var input = document.getElementById('target-keyword');
  if (!input) return;
  var kw = input.value.trim();
  if (kw === (PopupState.targetKeyword || '')) return;
  var domain = getDomain(PopupState.currentTabUrl);
  if (!domain) return;
  chrome.storage.local.get({ targetKeywords: {} }, function(d) {
    var all = d.targetKeywords || {};
    if (kw) all[domain] = kw;
    else delete all[domain];
    chrome.storage.local.set({ targetKeywords: all }, function() {
      PopupState.targetKeyword = kw;
      if (PopupState.currentTabId) analyzeTab(PopupState.currentTabId);
    });
  });
}

function initSidebarGroups(collapsedState) {
  collapsedState = collapsedState || {};

  document.querySelectorAll('.sidebar-group').forEach(function(group) {
    var groupId = group.dataset.group;
    var itemsEl = document.getElementById('group-items-' + groupId);
    if (!itemsEl) return;

    if (collapsedState[groupId]) {
      group.classList.add('collapsed');
      itemsEl.classList.add('collapsed');
      group.setAttribute('aria-expanded', 'false');
    }

    group.addEventListener('click', function() {
      var isCollapsed = group.classList.toggle('collapsed');
      itemsEl.classList.toggle('collapsed', isCollapsed);
      group.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      collapsedState[groupId] = isCollapsed;
      chrome.storage.local.set({ collapsedGroups: collapsedState });
    });
  });
}
