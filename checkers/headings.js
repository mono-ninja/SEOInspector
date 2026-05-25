function runHeadingsChecker(p) {
  var issues = [];
  var params = p || {};
  var maxHeadingLen = params.max_heading_len || 120;
  var maxH2         = params.max_h2          || 10;
  var minH1Len      = params.min_h1_len      || 10;

  // Exclude aria-hidden and CSS-hidden headings — they are invisible to users and search engines
  var headingList = Array.prototype.filter.call(
    document.querySelectorAll('h1, h2, h3, h4, h5, h6'),
    function(el) {
      if (el.getAttribute('aria-hidden') === 'true') return false;
      var style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }
  );

  var headings = Array.prototype.map.call(headingList, function(el) {
    return {
      level: parseInt(el.tagName.substring(1), 10),
      // innerText is preferred (rendered text); textContent fallback for edge cases
      // where innerText is empty due to CSS clip/overflow tricks on visible elements
      text: (el.innerText || el.textContent || '').trim(),
      el: el
    };
  });

  // Per-level count for info breakdown
  var levelCounts = {};
  headings.forEach(function(h) {
    levelCounts[h.level] = (levelCounts[h.level] || 0) + 1;
  });
  var breakdown = [1, 2, 3, 4, 5, 6].filter(function(l) {
    return levelCounts[l];
  }).map(function(l) {
    return 'H' + l + ':' + levelCounts[l];
  }).join(' · ');

  // Heading chain info
  if (headings.length > 0) {
    var chain = headings.map(function(h) {
      return Array(h.level).join('  ') + 'H' + h.level + ' ' + (h.text || '(empty)');
    }).join('\n');
    issues.push({
      type: 'headings_chain',
      message: 'Heading structure (' + headings.length + ')' + (breakdown ? ' — ' + breakdown : ''),
      severity: 'info',
      detail: chain
    });
  }

  // No H1 / multiple H1
  var h1s = headings.filter(function(h) { return h.level === 1; });
  if (h1s.length === 0) {
    issues.push({ type: 'no_h1', message: 'Page is missing an H1 heading', severity: 'critical' });
  } else if (h1s.length > 1) {
    var h1texts = h1s.map(function(h) { return '"' + h.text + '"'; }).join(', ');
    issues.push({ type: 'multiple_h1', message: 'Multiple H1 headings found on the page (' + h1s.length + ')', severity: 'warning', detail: h1texts, highlight: true });
  }

  // H1 too short
  h1s.forEach(function(h) {
    if (h.text.length > 0 && h.text.length < minH1Len) {
      issues.push({
        type: 'h1_too_short',
        message: 'H1 heading is too short (' + h.text.length + ' chars) — minimum ' + minH1Len,
        severity: 'notice',
        detail: '"' + h.text + '"',
        highlight: true
      });
    }
  });

  // H1 inside wrong semantic container
  h1s.forEach(function(h) {
    var wrongParent = h.el.closest && h.el.closest('footer, nav, aside');
    if (wrongParent) {
      issues.push({
        type: 'h1_wrong_container',
        message: 'H1 is inside <' + wrongParent.tagName.toLowerCase() + '> — should be in main content',
        severity: 'warning',
        detail: '"' + h.text + '"',
        highlight: true
      });
    }
  });

  // H1 vs <title> comparison
  var pageTitle = document.title || '';
  if (h1s.length === 1 && h1s[0].text && pageTitle) {
    var titleWords = pageTitle.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 3; });
    var h1Words = h1s[0].text.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 3; });
    var hasCommon = h1Words.length > 0 && titleWords.length > 0 && h1Words.some(function(w) {
      return titleWords.indexOf(w) !== -1;
    });
    if (!hasCommon) {
      issues.push({
        type: 'h1_title_mismatch',
        message: 'H1 and <title> share no common words',
        severity: 'notice',
        detail: 'Title: "' + pageTitle + '"\nH1: "' + h1s[0].text + '"'
      });
    }
  }

  // Empty headings
  headings.filter(function(h) { return h.text === ''; }).forEach(function(h) {
    issues.push({ type: 'empty_heading', message: 'Empty H' + h.level + ' heading', severity: 'warning', highlight: true });
  });

  // Headings before first H1
  var firstH1Idx = -1;
  headings.forEach(function(h, idx) { if (h.level === 1 && firstH1Idx === -1) firstH1Idx = idx; });
  if (firstH1Idx > 0) {
    var beforeH1 = headings.slice(0, firstH1Idx);
    issues.push({
      type: 'headings_before_h1',
      message: 'Subheadings found before H1 (' + beforeH1.length + ')',
      severity: 'warning',
      detail: beforeH1.map(function(h) { return 'H' + h.level + ' "' + h.text + '"'; }).join('\n')
    });
  }

  // Heading hierarchy skip
  var prevLevel = 0;
  headings.forEach(function(h) {
    if (prevLevel > 0 && h.level > prevLevel + 1) {
      issues.push({
        type: 'heading_hierarchy_skip',
        message: 'Heading level skipped: H' + prevLevel + ' → H' + h.level,
        severity: 'warning',
        detail: 'Heading: "' + h.text + '"'
      });
    }
    prevLevel = h.level;
  });

  // Heading too long
  headings.forEach(function(h) {
    if (h.text.length > maxHeadingLen) {
      issues.push({
        type: 'heading_too_long',
        message: 'H' + h.level + ' heading is too long (more than ' + maxHeadingLen + ' chars)',
        severity: 'notice',
        detail: 'Length: ' + h.text.length + ' chars. Start: "' + h.text.substring(0, 80) + '..."',
        highlight: true
      });
    }
  });

  // Too many H2
  var h2s = headings.filter(function(h) { return h.level === 2; });
  if (h2s.length > maxH2) {
    issues.push({ type: 'too_many_h2', message: 'Too many H2 headings (' + h2s.length + ')', severity: 'notice', detail: 'Recommended no more than ' + maxH2 + ' H2 headings per page.' });
  }

  // Duplicate heading texts (per level)
  var headingTexts = {};
  var duplicateHeadings = [];
  headings.forEach(function(h) {
    if (!h.text) return;
    var key = 'h' + h.level + ':' + h.text.toLowerCase();
    if (headingTexts[key]) {
      duplicateHeadings.push('H' + h.level + ' «' + h.text.substring(0, 60) + '»');
    } else {
      headingTexts[key] = true;
    }
  });
  if (duplicateHeadings.length > 0) {
    issues.push({
      type: 'duplicate_headings',
      message: 'Duplicate headings (' + duplicateHeadings.length + ')',
      severity: 'notice',
      detail: duplicateHeadings.slice(0, 5).join('\n')
    });
  }

  return { id: 'headings', name: 'Headings', issues: issues };
}
