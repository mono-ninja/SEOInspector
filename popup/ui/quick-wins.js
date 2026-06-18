// ─── Quick Wins ────────────────────────────────────────────────────────────────

// Estimated fix time per issue type, in minutes (rendered via the wins.fix_time i18n key).
// Each type listed here must also have a wins.hint.<type> key in both i18n.js locales.
var FIX_TIME_MIN = {
  missing_description:    2,
  empty_description:      2,
  missing_alt:            5,
  multiple_h1:            1,
  no_h1:                  1,
  missing_canonical:      2,
  missing_title:          2,
  short_title:            2,
  long_title:             2,
  short_description:      2,
  long_description:       2,
  missing_viewport:       1,
  missing_lang:           1,
  noindex:                1,
  missing_og_title:       3,
  missing_og_description: 3,
  missing_og_image:       5,
  favicon_missing:        3,
  insecure_http:          5,
  mixed_content_active:   10,
  mixed_content_passive:  10
};

function renderQuickWins(results) {
  var container = document.getElementById('results');
  container.innerHTML = '';

  var critical = [];
  var warning  = [];
  results.forEach(function(r) {
    r.issues.forEach(function(issue) {
      if (issue.muted) return;
      if (issue.severity === 'critical') {
        critical.push({ checkerName: r.name, issue: issue });
      } else if (issue.severity === 'warning') {
        warning.push({ checkerName: r.name, issue: issue });
      }
    });
  });

  var sorted = critical.concat(warning).slice(0, 10);

  if (sorted.length === 0) {
    var noWins = document.createElement('div');
    noWins.className = 'no-issues';
    var nwIcon = document.createElement('span');
    nwIcon.className = 'checkmark';
    nwIcon.textContent = '✅';
    var nwP = document.createElement('p');
    nwP.textContent = T.t('popup.wins.no_issues');
    noWins.appendChild(nwIcon);
    noWins.appendChild(nwP);
    container.appendChild(noWins);
    return;
  }

  var label = document.createElement('div');
  label.className = 'wins-label';
  label.textContent = T.t('popup.wins.label');
  container.appendChild(label);

  sorted.forEach(function(entry) {
    var issue = entry.issue;
    var isCritical = issue.severity === 'critical';
    var fixTime = FIX_TIME_MIN[issue.type] ? T.t('wins.fix_time', { min: FIX_TIME_MIN[issue.type] }) : '';
    var fixHintText = issue.fix || (FIX_TIME_MIN[issue.type] ? T.t('wins.hint.' + issue.type) : '');

    var card = document.createElement('div');
    card.className = 'win-card';
    card.dataset.type = issue.type;

    var row = document.createElement('div');
    row.className = 'win-card-row';

    var icon = document.createElement('span');
    icon.className = 'win-icon';
    icon.textContent = isCritical ? '🔴' : '🟡';

    var text = document.createElement('div');
    text.className = 'win-text';

    var title = document.createElement('div');
    title.className = 'win-title';
    title.textContent = issue.message;

    var meta = document.createElement('div');
    meta.className = 'win-meta';
    var metaParts = [entry.checkerName, isCritical ? T.t('popup.sev.critical_short') : T.t('popup.sev.warning_short')];
    if (fixTime) metaParts.push(fixTime);
    meta.textContent = metaParts.join(' · ');

    text.appendChild(title);
    text.appendChild(meta);

    row.appendChild(icon);
    row.appendChild(text);
    if (fixTime) {
      var timeBadge = document.createElement('span');
      timeBadge.className = 'win-time';
      timeBadge.textContent = fixTime;
      row.appendChild(timeBadge);
    }
    card.appendChild(row);

    var hint = null;
    if (fixHintText) {
      hint = document.createElement('div');
      hint.className = 'win-hint hidden';
      hint.textContent = fixHintText;
      card.appendChild(hint);
    }

    (function(cardEl, hintEl, issueType) {
      cardEl.addEventListener('click', function() {
        var prevType = PopupState.expandedQuickWin;

        if (prevType && prevType !== issueType) {
          var prevCard = container.querySelector('.win-card[data-type="' + prevType + '"]');
          if (prevCard) {
            var prevHint = prevCard.querySelector('.win-hint');
            if (prevHint) prevHint.classList.add('hidden');
          }
        }

        if (hintEl) {
          var isCurrentlyHidden = hintEl.classList.contains('hidden');
          hintEl.classList.toggle('hidden', !isCurrentlyHidden);
          PopupState.expandedQuickWin = isCurrentlyHidden ? issueType : null;
        } else {
          PopupState.expandedQuickWin = null;
        }

        if (PopupState.currentTabId) {
          chrome.tabs.sendMessage(
            PopupState.currentTabId,
            { action: 'highlightElements', issueType: issueType },
            function() {}
          );
        }
      });
    })(card, hint, issue.type);

    container.appendChild(card);
  });
}
