function runTocChecker(p) {
  var issues = [];
  var params = p || {};

  // ── Collect all headings ────────────────────────────────────────────────────
  var allHeadings = Array.prototype.slice.call(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  var h2h3Headings = Array.prototype.slice.call(document.querySelectorAll('h2, h3'));
  var headingCount = h2h3Headings.length;

  // Heading level distribution
  var levelCounts = {};
  allHeadings.forEach(function(h) {
    var level = parseInt(h.tagName.substring(1), 10);
    levelCounts[level] = (levelCounts[level] || 0) + 1;
  });

  // ── Body word count ─────────────────────────────────────────────────────────
  var bodyWordCount = 0;
  if (document.body) {
    bodyWordCount = (document.body.textContent || '').trim().split(/\s+/).filter(function(w) { return w.length > 0; }).length;
  }

  // ── Detect Table of Contents ────────────────────────────────────────────────
  var hasToc = false;
  var tocNav = null;
  var tocLinks = [];
  var tocLinkHrefs = [];

  // Search for TOC in common patterns
  var tocCandidates = document.querySelectorAll('nav.toc, nav#toc, nav[class*="toc"], nav[id*="toc"], nav[class*="table-of-contents"], [role="navigation"].toc, [role="navigation"]#toc, .toc, #toc, [class*="table-of-contents"], [id*="table-of-contents"]');
  Array.prototype.forEach.call(tocCandidates, function(el) {
    var links = el.querySelectorAll('a[href^="#"]');
    if (links.length >= 2 && !tocNav) {
      tocNav = el;
      hasToc = true;
      Array.prototype.forEach.call(links, function(a) {
        var href = a.getAttribute('href');
        if (href) {
          tocLinks.push(a);
          tocLinkHrefs.push(href.substring(1)); // strip #
        }
      });
    }
  });

  // ── Heading ID analysis ─────────────────────────────────────────────────────
  var headingsWithExplicitId = 0;
  var headingsWithAutoId = 0;
  var headingsWithoutId = 0;
  var headingIds = [];
  var duplicateIds = [];
  var seenIds = {};

  h2h3Headings.forEach(function(h) {
    var idAttr = h.getAttribute('id');
    if (idAttr) {
      headingsWithExplicitId++;
      headingIds.push(idAttr);
      if (seenIds[idAttr]) {
        duplicateIds.push(idAttr);
      }
      seenIds[idAttr] = (seenIds[idAttr] || 0) + 1;
    } else {
      // Check if browser auto-generated an ID (modern browsers do this)
      if (h.id && h.id !== '') {
        headingsWithAutoId++;
      } else {
        headingsWithoutId++;
      }
    }
  });

  // Remove duplicates from duplicateIds list
  var uniqueDuplicateIds = [];
  var seenDupes = {};
  duplicateIds.forEach(function(d) {
    if (!seenDupes[d]) { uniqueDuplicateIds.push(d); seenDupes[d] = true; }
  });

  // ── Heading ID format check (kebab-case recommended) ────────────────────────
  var badIdFormat = [];
  h2h3Headings.forEach(function(h) {
    var idAttr = h.getAttribute('id');
    if (idAttr) {
      // Check for spaces, uppercase, or special chars (not kebab-case)
      if (/[\sА-Яа-яЇїІіЄєҐґ]/.test(idAttr) || idAttr.indexOf(' ') !== -1 || idAttr.indexOf('heading') === 0) {
        badIdFormat.push(idAttr);
      }
    }
  });

  // ── TOC validation (if TOC exists) ──────────────────────────────────────────
  var brokenTocLinks = [];
  var missingFromToc = [];
  var tocHasH1 = false;

  if (hasToc) {
    // Check for broken TOC links (pointing to non-existent IDs)
    tocLinkHrefs.forEach(function(href) {
      var el = document.getElementById(href);
      if (!el) {
        brokenTocLinks.push(href);
      }
    });

    // Check which headings are missing from TOC
    h2h3Headings.forEach(function(h) {
      var idAttr = h.getAttribute('id');
      if (idAttr) {
        var isInToc = tocLinkHrefs.indexOf(idAttr) !== -1;
        if (!isInToc) {
          missingFromToc.push({ id: idAttr, text: (h.textContent || '').trim().substring(0, 40) });
        }
        // Check if H1 is in TOC (usually not desired)
        if (h.tagName === 'H1') tocHasH1 = true;
      }
    });

    // TOC placement check — should be near the top
    var tocRect = null;
    try { tocRect = tocNav.getBoundingClientRect(); } catch(e) {}
    var tocIsTop = tocRect && tocRect.top < window.innerHeight * 0.5;

    if (!tocIsTop && tocRect) {
      issues.push({
        type: 'toc_not_at_top',
        message: 'Table of Contents is not in the upper half of the viewport',
        severity: 'notice',
        detail: 'TOC should appear near the top of the content for easy access.'
      });
    }

    // TOC accessibility
    var tocAriaLabel = tocNav.getAttribute('aria-label') || tocNav.getAttribute('aria-labelledby');
    var tocRole = tocNav.getAttribute('role');
    var tocIsNav = tocNav.tagName === 'NAV';

    if (!tocAriaLabel && !tocIsNav) {
      issues.push({
        type: 'toc_no_accessibility',
        message: 'TOC lacks accessibility attributes',
        severity: 'notice',
        detail: 'Add aria-label="Table of Contents" or wrap in <nav> element.'
      });
    }

    // TOC nesting structure — check if H2/H3 hierarchy is preserved
    var tocHasNesting = false;
    var tocUl = tocNav.querySelectorAll('ul ul, ol ol');
    if (tocUl.length > 0) tocHasNesting = true;

    if (levelCounts[3] && !tocHasNesting) {
      issues.push({
        type: 'toc_flat_structure',
        message: 'TOC does not reflect heading hierarchy (H2/H3 nesting)',
        severity: 'notice',
        detail: 'Nested <ul> inside TOC helps users understand content structure.'
      });
    }

    // Broken TOC links
    if (brokenTocLinks.length > 0) {
      issues.push({
        type: 'toc_broken_links',
        message: 'TOC has broken links (' + brokenTocLinks.length + ' pointing to non-existent IDs)',
        severity: 'warning',
        detail: brokenTocLinks.slice(0, 5).map(function(id) { return '#' + id; }).join('\n'),
        highlight: true
      });
    }

    // Headings missing from TOC
    if (missingFromToc.length > 0 && missingFromToc.length < h2h3Headings.length) {
      issues.push({
        type: 'toc_incomplete',
        message: 'TOC is missing ' + missingFromToc.length + ' section' + (missingFromToc.length > 1 ? 's' : ''),
        severity: 'notice',
        detail: missingFromToc.slice(0, 5).map(function(h) { return h.id + ': "' + h.text + '"'; }).join('\n')
      });
    }

    // H1 in TOC
    if (tocHasH1) {
      issues.push({
        type: 'toc_includes_h1',
        message: 'TOC includes H1 — usually not needed',
        severity: 'notice',
        detail: 'H1 represents the page title. TOC typically starts from H2.'
      });
    }

    // TOC expand/collapse for long TOCs
    if (tocLinks.length > 10) {
      var hasToggle = tocNav.querySelector('button, [onclick], [class*="toggle"], [class*="collapse"], [class*="expand"]');
      if (!hasToggle) {
        issues.push({
          type: 'toc_no_collapse',
          message: 'Long TOC (' + tocLinks.length + ' items) without expand/collapse',
          severity: 'notice',
          detail: 'Consider adding a toggle for long tables of contents to save vertical space.'
        });
      }
    }
  }

  // ── Missing TOC ─────────────────────────────────────────────────────────────
  if (headingCount >= 4 && bodyWordCount >= 500 && !hasToc) {
    var severity = headingCount >= 8 ? 'warning' : 'notice';
    issues.push({
      type: 'missing_toc',
      message: 'Long content with ' + headingCount + ' headings but no Table of Contents',
      severity: severity,
      detail: 'TOC improves UX, enables Google sitelinks, and helps with featured snippets.\nAdd a <nav> with links to each H2/H3 section.',
      highlight: true
    });
  }

  // ── Heading ID issues ───────────────────────────────────────────────────────
  if (headingsWithoutId > 0 && headingCount >= 3) {
    issues.push({
      type: 'headings_missing_ids',
      message: headingsWithoutId + ' heading' + (headingsWithoutId > 1 ? 's have' : ' has') + ' no id attribute',
      severity: 'notice',
      detail: 'Add id attributes to H2/H3 elements for deep linking and TOC navigation.\nModern browsers auto-generate IDs, but explicit IDs are more reliable.'
    });
  }

  // ── Duplicate heading IDs ───────────────────────────────────────────────────
  if (uniqueDuplicateIds.length > 0) {
    issues.push({
      type: 'duplicate_heading_ids',
      message: 'Duplicate heading id attributes (' + uniqueDuplicateIds.length + ' duplicates)',
      severity: 'warning',
      detail: 'Duplicate IDs break TOC links and deep linking.\nDuplicates: ' + uniqueDuplicateIds.slice(0, 5).join(', '),
      highlight: true
    });
  }

  // ── Heading ID format ───────────────────────────────────────────────────────
  if (badIdFormat.length > 0) {
    issues.push({
      type: 'heading_id_bad_format',
      message: 'Heading IDs not in kebab-case format (' + badIdFormat.length + ')',
      severity: 'notice',
      detail: 'Use lowercase kebab-case for IDs (e.g., "getting-started" instead of "Getting Started").\nExamples: ' + badIdFormat.slice(0, 3).join(', ')
    });
  }

  // ── Back-to-top link ────────────────────────────────────────────────────────
  var hasBackToTop = false;
  var allLinks = document.querySelectorAll('a[href="#top"], a[href="#"], a[href="#main"]');
  Array.prototype.forEach.call(allLinks, function(a) {
    var text = (a.textContent || '').trim().toLowerCase();
    if (text.indexOf('top') !== -1 || text.indexOf('↑') !== -1 || text.indexOf('back') !== -1 || a.getAttribute('title') && a.getAttribute('title').toLowerCase().indexOf('top') !== -1) {
      hasBackToTop = true;
    }
  });
  // Also check for data-back-to-top or class patterns
  var bttEls = document.querySelectorAll('[class*="back-to-top"], [class*="scroll-top"], [id*="back-to-top"], [id*="scroll-top"]');
  if (bttEls.length > 0) hasBackToTop = true;

  if (bodyWordCount > 1000 && !hasBackToTop) {
    issues.push({
      type: 'no_back_to_top',
      message: 'Long page (' + bodyWordCount + ' words) without back-to-top link',
      severity: 'notice',
      detail: 'A back-to-top link improves navigation on long pages.'
    });
  }

  // ── Skip to content link ────────────────────────────────────────────────────
  var hasSkipLink = !!document.querySelector('a[href="#main"], a[href="#content"], a[href="#main-content"], a[href="#skip"], [class*="skip-link"]');
  if (!hasSkipLink && headingCount >= 3) {
    issues.push({
      type: 'no_skip_link',
      message: 'Missing skip-to-content link',
      severity: 'notice',
      detail: 'Add a skip link for keyboard and screen reader users to bypass navigation.'
    });
  }

  // ── Auto-generated TOC detection (JS-rendered) ──────────────────────────────
  if (hasToc && tocNav) {
    var tocHtml = tocNav.outerHTML || '';
    var isAutoGenerated = tocHtml.indexOf('data-toc') !== -1 ||
      tocHtml.indexOf('data-generated') !== -1 ||
      tocHtml.indexOf('js-toc') !== -1 ||
      tocHtml.indexOf('auto-toc') !== -1;

    if (isAutoGenerated) {
      issues.push({
        type: 'toc_auto_generated',
        message: 'TOC appears to be auto-generated by JavaScript',
        severity: 'info',
        detail: 'Auto-generated TOCs may not be visible to search engine crawlers. Consider server-side rendering or static HTML fallback.'
      });
    }
  }

  // ── Overview ────────────────────────────────────────────────────────────────
  var levelSummary = [];
  [1, 2, 3, 4, 5, 6].forEach(function(l) {
    if (levelCounts[l]) levelSummary.push('H' + l + ':' + levelCounts[l]);
  });

  issues.unshift({
    type: 'toc_overview',
    message: 'Table of Contents — overview',
    severity: 'info',
    detail: [
      'H2/H3 headings      ' + headingCount,
      'All headings        ' + allHeadings.length + ' (' + levelSummary.join(', ') + ')',
      'TOC found           ' + (hasToc ? 'yes (' + tocLinks.length + ' links)' : 'no'),
      'Headings with ID    ' + headingsWithExplicitId + ' explicit / ' + headingsWithAutoId + ' auto / ' + headingsWithoutId + ' none',
      'Body word count     ' + bodyWordCount,
      'Broken TOC links    ' + (brokenTocLinks.length || '0'),
      'Missing from TOC    ' + (missingFromToc.length || '0'),
      'Back-to-top link    ' + (hasBackToTop ? 'yes' : 'no'),
      'Skip-to-content     ' + (hasSkipLink ? 'yes' : 'no'),
    ].join('\n')
  });

  return { id: 'toc', name: 'Table of Contents', issues: issues };
}
