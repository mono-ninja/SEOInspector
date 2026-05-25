// ─── Quick Wins ────────────────────────────────────────────────────────────────

var FIX_TIME = {
  missing_description:    '~2 хв',
  missing_alt:            '~5 хв',
  multiple_h1:            '~1 хв',
  missing_h1:             '~1 хв',
  missing_canonical:      '~2 хв',
  missing_title:          '~2 хв',
  title_too_short:        '~2 хв',
  title_too_long:         '~2 хв',
  description_too_short:  '~2 хв',
  description_too_long:   '~2 хв',
  missing_viewport:       '~1 хв',
  missing_lang:           '~1 хв',
  noindex:                '~1 хв',
  missing_og_title:       '~3 хв',
  missing_og_description: '~3 хв',
  missing_og_image:       '~5 хв',
  no_favicon:             '~3 хв',
  http_not_redirected:    '~5 хв',
  mixed_content:          '~10 хв',
  duplicate_h1:           '~1 хв'
};

var FIX_HINTS = {
  missing_description:    'Додайте <meta name="description" content="..."> до <head>. Довжина: 120–160 символів.',
  missing_alt:            'Додайте атрибут alt до кожного <img>. Описуйте зміст зображення.',
  multiple_h1:            'Залиште лише один <h1> на сторінку — головний заголовок.',
  missing_h1:             'Додайте один <h1> з ключовим словом сторінки.',
  missing_canonical:      'Додайте <link rel="canonical" href="..."> до <head>.',
  missing_title:          'Додайте <title> з ключовим словом. Довжина: 50–60 символів.',
  title_too_short:        'Розгорніть заголовок: додайте ключові слова і бренд.',
  title_too_long:         'Скоротіть заголовок до 60 символів — він обрізається в SERP.',
  description_too_short:  'Зробіть опис довшим: 120–160 символів із закликом до дії.',
  description_too_long:   'Скоротіть опис до 160 символів.',
  missing_viewport:       'Додайте <meta name="viewport" content="width=device-width,initial-scale=1">.',
  noindex:                'Перевірте і видаліть <meta name="robots" content="noindex">, якщо сторінка має індексуватися.',
  missing_og_title:       'Додайте <meta property="og:title"> для коректного відображення у соціальних мережах.',
  missing_og_image:       'Додайте <meta property="og:image"> із зображенням 1200×630 px.',
  duplicate_h1:           'Видаліть або перетворіть зайві <h1> на <h2>.',
  mixed_content:          'Змініть всі http:// посилання на ресурси на https://.'
};

function renderQuickWins(results) {
  var container = document.getElementById('results');
  container.innerHTML = '';

  var critical = [];
  var warning  = [];
  results.forEach(function(r) {
    r.issues.forEach(function(issue) {
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
    var fixTime = FIX_TIME[issue.type] || '';
    var fixHintText = issue.fix || FIX_HINTS[issue.type] || '';

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
