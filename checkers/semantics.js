function runSemanticsChecker(p) {
  var issues = [];
  var params = p || {};
  var body = document.body;
  if (!body) return { id: 'semantics', name: 'Semantics', issues: issues };

  var mainEl = document.querySelector('main, article, [role="main"]');

  // ── <main> tag count (presence + ARIA role covered by accessibility.js) ──
  var mainTags = document.querySelectorAll('main');
  if (mainTags.length > 1) {
    issues.push({ type: 'multiple_main_tags', message: 'Multiple <main> tags found (' + mainTags.length + ') — only one is allowed', severity: 'warning' });
  }

  // ── <figure> / <figcaption> ──
  var figures = document.querySelectorAll('figure');
  var figsNoCaption = 0;
  figures.forEach(function(f) {
    if (!f.querySelector('figcaption')) {
      figsNoCaption++;
    }
  });
  if (figsNoCaption > 0) {
    issues.push({ type: 'figure_no_figcaption', message: '<figure> elements without <figcaption> (' + figsNoCaption + ')', severity: 'notice', highlight: true });
  }

  // ── Images outside <figure> (in main content) ──
  if (mainEl) {
    var mainImages = mainEl.querySelectorAll('img');
    var imgsOutsideFigure = 0;
    mainImages.forEach(function(img) {
      if (!img.closest('figure')) {
        imgsOutsideFigure++;
      }
    });
    if (imgsOutsideFigure > 3) {
      issues.push({ type: 'images_outside_figure', message: 'Many images outside <figure> in main content (' + imgsOutsideFigure + ') — consider wrapping in <figure> for better semantics', severity: 'notice' });
    }
  }

  // ── <time> element ──
  var timeTags = document.querySelectorAll('time');
  var timeNoDatetime = 0;
  timeTags.forEach(function(t) {
    if (!t.getAttribute('datetime')) {
      timeNoDatetime++;
    }
  });
  if (timeNoDatetime > 0) {
    issues.push({ type: 'time_no_datetime', message: '<time> elements missing datetime attribute (' + timeNoDatetime + ')', severity: 'notice', highlight: true });
  }

  // ── Dates as plain text (heuristic) ──
  if (mainEl) {
    var datePattern = /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g;
    var paragraphs = mainEl.querySelectorAll('p, span, div, td');
    var plainDates = 0;
    paragraphs.forEach(function(el) {
      var text = el.textContent || '';
      if (el.querySelector('time')) return;
      if (datePattern.test(text)) {
        plainDates++;
        datePattern.lastIndex = 0;
      }
    });
    if (plainDates > 0) {
      issues.push({ type: 'plain_text_dates', message: 'Date-like strings found as plain text (' + plainDates + ') — consider using <time datetime="...">', severity: 'notice' });
    }
  }

  // ── <blockquote> without cite ──
  var blockquotes = document.querySelectorAll('blockquote');
  var bqNoCite = 0;
  blockquotes.forEach(function(bq) {
    if (!bq.getAttribute('cite')) {
      bqNoCite++;
    }
  });
  if (bqNoCite > 0) {
    issues.push({ type: 'blockquote_no_cite', message: '<blockquote> elements without cite attribute (' + bqNoCite + ')', severity: 'notice', highlight: true });
  }

  // ── <abbr> without title ──
  var abbrs = document.querySelectorAll('abbr');
  var abbrNoTitle = 0;
  abbrs.forEach(function(abbr) {
    if (!abbr.getAttribute('title')) {
      abbrNoTitle++;
    }
  });
  if (abbrNoTitle > 0) {
    issues.push({ type: 'abbr_no_title', message: '<abbr> elements without title attribute (' + abbrNoTitle + ')', severity: 'notice', highlight: true });
  }

  // ── <details> without <summary> ──
  var details = document.querySelectorAll('details');
  var detailsNoSummary = 0;
  details.forEach(function(d) {
    if (!d.querySelector('summary')) {
      detailsNoSummary++;
    }
  });
  if (detailsNoSummary > 0) {
    issues.push({ type: 'details_no_summary', message: '<details> elements without <summary> (' + detailsNoSummary + ')', severity: 'warning', highlight: true });
  }

  // ── <address> usage ──
  var addressTags = document.querySelectorAll('address');
  addressTags.forEach(function(addr) {
    var parent = addr.parentElement;
    if (parent && parent.tagName !== 'MAIN' && parent.tagName !== 'ARTICLE' && parent.tagName !== 'SECTION' && parent.tagName !== 'BODY') {
      issues.push({ type: 'address_wrong_context', message: '<address> used outside <main>, <article>, or <section>', severity: 'notice', highlight: true });
    }
  });

  // ── Div soup detection ──
  if (mainEl) {
    var allDivs = mainEl.querySelectorAll('div');
    var nestedDivs = 0;
    allDivs.forEach(function(div) {
      var parent = div.parentElement;
      if (parent && parent.tagName === 'DIV') {
        var text = (div.textContent || '').trim();
        var childElements = div.children.length;
        if (childElements === 0 || (childElements === 1 && div.querySelector('div'))) {
          nestedDivs++;
        }
      }
    });
    var divSoupThreshold = params.div_soup_threshold || 15;
    if (nestedDivs > divSoupThreshold) {
      issues.push({ type: 'div_soup', message: 'Excessive nested <div> elements in main content (' + nestedDivs + ') — consider using semantic HTML', severity: 'notice' });
    }
  }

  // ── Semantic content blocks ──
  var semanticTags = ['article', 'section', 'aside'];
  var hasSemantic = semanticTags.some(function(tag) { return !!document.querySelector(tag); });
  if (!hasSemantic && mainEl) {
    var mainText = (mainEl.innerText || mainEl.textContent || '').trim();
    var wordCount = mainText.split(/\s+/).filter(function(w) { return w.length > 0; }).length;
    if (wordCount > 300) {
      issues.push({ type: 'low_semantic_density', message: 'No semantic blocks <article>, <section>, <aside> despite significant content (' + wordCount + ' words)', severity: 'notice' });
    }
  }

  // ── <mark> without context ──
  var marks = document.querySelectorAll('mark');
  if (marks.length > 5) {
    issues.push({ type: 'excessive_mark', message: 'Excessive <mark> elements (' + marks.length + ') — may indicate poor use for highlighting', severity: 'notice' });
  }

  // ── Semantic summary (info) ──
  var semCounts = {};
  var allSemantic = ['main', 'header', 'footer', 'nav', 'article', 'section', 'aside', 'figure', 'figcaption', 'time', 'blockquote', 'details', 'summary', 'address', 'abbr', 'mark'];
  allSemantic.forEach(function(tag) {
    var count = document.querySelectorAll(tag).length;
    if (count > 0) semCounts[tag] = count;
  });
  var semSummary = Object.keys(semCounts).map(function(t) { return t + ':' + semCounts[t]; }).join(', ');
  if (semSummary) {
    issues.push({ type: 'semantic_summary', message: 'Semantic elements: ' + semSummary, severity: 'info' });
  }

  return { id: 'semantics', name: 'Semantics', issues: issues };
}
