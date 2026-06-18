// ─── Loading / Error / Analyze ────────────────────────────────────────────────

// Derived from CHECKERS (constants.js), excluding entries that have no physical file.
// Injected on demand when the popup opens — avoids loading checker files on every page visit.
var CONTENT_SCRIPT_FILES = CHECKERS.filter(function(id) {
  return CHECKERS_NO_FILE.indexOf(id) === -1;
}).map(function(id) {
  return 'checkers/' + id + '.js';
}).concat(['content.js']);

function injectContentScripts(tabId, callback) {
  chrome.scripting.executeScript(
    { target: { tabId: tabId }, files: CONTENT_SCRIPT_FILES },
    function() {
      if (chrome.runtime.lastError) {
        callback(false, chrome.runtime.lastError.message);
      } else {
        callback(true, null);
      }
    }
  );
}

function showLoading() {
  var loading = document.getElementById('loading');
  if (!loading) return;
  loading.classList.remove('hidden');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('filter-bar').classList.add('hidden');
  hideAllPanels();
  document.getElementById('summary-bar').classList.add('hidden');
}

function hideLoading() {
  var loading = document.getElementById('loading');
  if (!loading) return;
  loading.classList.add('hidden');
  document.getElementById('summary-bar').classList.remove('hidden');
  switchPanel(PopupState.currentTab);
}

function showError(msg) {
  var results = document.getElementById('results');
  if (!results) return;
  var loading = document.getElementById('loading');
  if (loading) loading.classList.add('hidden');
  document.getElementById('filter-bar').classList.add('hidden');
  hideAllPanels();
  document.getElementById('summary-bar').classList.add('hidden');
  results.classList.remove('hidden');
  results.innerHTML = '';
  var errWrap = document.createElement('div');
  errWrap.className = 'error-message';
  var errP = document.createElement('p');
  errP.textContent = msg;
  var hintP = document.createElement('p');
  hintP.className = 'error-hint';
  hintP.textContent = T.t('popup.error.hint');
  errWrap.appendChild(errP);
  errWrap.appendChild(hintP);
  results.appendChild(errWrap);
}

// Flag issues whose type the user chose to ignore on this domain. Muted issues
// stay in the results (so they can be shown and un-muted) but are excluded from
// score, badges, quick wins and exports.
function applyMuteFlags(results) {
  var muted = PopupState.mutedTypes || {};
  results.forEach(function(r) {
    r.issues.forEach(function(issue) {
      issue.muted = !!(issue.type && muted[issue.type]);
    });
  });
  return results;
}

// Several checkers can emit the same issue type for the same page condition
// (e.g. thin_content from both seo and content_quality). Keep all issues from
// the checker that reported a type first; drop that type from later checkers
// so the score is not penalized twice. Repeats within one checker are kept
// (e.g. techstack emits many tech_lib entries).
function dedupeIssueTypes(results) {
  var ownerByType = {};
  results.forEach(function(r) {
    r.issues = r.issues.filter(function(issue) {
      if (!issue.type) return true;
      if (!(issue.type in ownerByType)) {
        ownerByType[issue.type] = r.id;
        return true;
      }
      return ownerByType[issue.type] === r.id;
    });
  });
  return results;
}

function saveAuditHistory(url, stats) {
  var entry = {
    url: url,
    critical: stats.critical,
    warning: stats.warning,
    notice: stats.notice,
    total: stats.total,
    date: new Date().toISOString()
  };
  chrome.storage.local.get({ audit_history: [] }, function(data) {
    var history = data.audit_history || [];
    history.unshift(entry);
    if (history.length > 50) history = history.slice(0, 50);
    chrome.storage.local.set({ audit_history: history });
  });
}

var currentAnalyzeId = 0;

function analyzeTab(tabId) {
  PopupState.lastResults = null;
  showLoading();

  var analyzeId = ++currentAnalyzeId;

  injectContentScripts(tabId, function(ok, injErr) {
    if (analyzeId !== currentAnalyzeId) return;
    if (!ok) {
      showError(T.t('popup.error.inject_failed') + ' ' + (injErr || ''));
      return;
    }

    chrome.storage.sync.get({ enabledCheckers: {}, seoParams: {}, showBadge: true }, function(data) {
      if (analyzeId !== currentAnalyzeId) return;
      var enabled = {};
      var enabledCheckers = data.enabledCheckers;
      for (var k in enabledCheckers) { enabled[k] = enabledCheckers[k]; }
      CHECKER_TABS.forEach(function(c) {
        if (!(c.id in enabled)) enabled[c.id] = true;
      });
      PopupState.currentParams = data.seoParams || {};
      PopupState.currentParams.target_keyword = PopupState.targetKeyword || '';

      chrome.storage.local.get({ customSecurityFiles: [] }, function(localData) {
        if (analyzeId !== currentAnalyzeId) return;
        PopupState.currentParams.customSecurityFiles = localData.customSecurityFiles || [];

        chrome.tabs.sendMessage(tabId, { action: 'analyze', enabledCheckers: enabled, params: PopupState.currentParams }, function(response) {
          if (analyzeId !== currentAnalyzeId) return;
          if (chrome.runtime.lastError) {
            showError(T.t('popup.error.connect_failed'));
            return;
          }
          if (!response || !Array.isArray(response)) {
            showError(T.t('popup.error.bad_response'));
            return;
          }

          PopupState.lastResults = applyMuteFlags(dedupeIssueTypes(response));
          response = PopupState.lastResults;
          hideLoading();
          var stats = renderSummary(response);
          updateTabBadges(response);
          renderResults(response, PopupState.currentTab);
          updateSevFilter(response, PopupState.currentTab);

          saveAuditHistory(PopupState.currentTabUrl, stats);
          chrome.runtime.sendMessage({
            action: 'updateBadge',
            show: data.showBadge !== false,
            tabId: tabId,
            critical: stats.critical,
            warning: stats.warning
          });
        });
      });
    });
  });
}
