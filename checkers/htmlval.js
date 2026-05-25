function runHtmlValChecker(p) {
  var issues = [];

  // Missing <!DOCTYPE html>
  if (!document.doctype) {
    issues.push({ type: 'missing_doctype', message: 'Missing <!DOCTYPE html>', severity: 'warning' });
  }

  // Multiple <title> tags — query only direct children of the primary <head>
  // to avoid false positives from: SVG sprites injected into <head>, multiple <head>
  // elements in malformed HTML, or framework-managed nested title wrappers
  var titles = document.head ? document.head.querySelectorAll('title') : [];
  if (titles.length > 1) {
    issues.push({ type: 'multiple_titles', message: 'Multiple <title> tags (' + titles.length + ')', severity: 'warning' });
  }

  // Multiple <meta name="description">
  var descriptions = document.querySelectorAll('meta[name="description"]');
  if (descriptions.length > 1) {
    issues.push({ type: 'multiple_descriptions', message: 'Multiple description meta tags (' + descriptions.length + ')', severity: 'warning' });
  }

  // Multiple <head> elements
  var heads = document.querySelectorAll('head');
  if (heads.length > 1) {
    issues.push({ type: 'multiple_heads', message: 'Multiple <head> elements (' + heads.length + ')', severity: 'warning' });
  }

  // Non-metadata elements in <head>
  var head = document.head;
  if (head) {
    var allowedInHead = { TITLE:1, META:1, LINK:1, STYLE:1, SCRIPT:1, BASE:1, NOSCRIPT:1, TEMPLATE:1 };
    var invalidInHead = Array.prototype.filter.call(head.children, function(el) {
      return !allowedInHead[el.tagName];
    });
    if (invalidInHead.length > 0) {
      issues.push({
        type: 'invalid_head_elements',
        message: 'Non-metadata elements in <head> (' + invalidInHead.length + ')',
        severity: 'warning',
        detail: invalidInHead.slice(0, 3).map(function(el) { return '<' + el.tagName.toLowerCase() + '>'; }).join(', ')
      });
    }

    // <noscript> in <head> (should be in <body>)
    var noscriptInHead = head.querySelectorAll('noscript');
    if (noscriptInHead.length > 0) {
      issues.push({ type: 'noscript_in_head', message: '<noscript> in <head> — recommended to place in <body>', severity: 'notice' });
    }
  }

  // Missing <meta charset>
  if (!document.querySelector('meta[charset], meta[http-equiv="Content-Type"]')) {
    issues.push({
      type: 'missing_charset',
      message: 'Missing <meta charset> declaration',
      severity: 'warning',
      detail: 'Add <meta charset="UTF-8"> as the first element inside <head>.'
    });
  }

  // Multiple <base> tags
  var baseTags = document.querySelectorAll('head base');
  if (baseTags.length > 1) {
    issues.push({ type: 'multiple_base', message: 'Multiple <base> tags (' + baseTags.length + ') — only one is allowed', severity: 'warning' });
  }

  // <meta http-equiv="refresh">
  var metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
  if (metaRefresh) {
    issues.push({
      type: 'meta_refresh',
      message: '<meta http-equiv="refresh"> — auto-redirect or auto-reload detected',
      severity: 'warning',
      detail: metaRefresh.getAttribute('content') || ''
    });
  }

  // HTML size > 5MB (Blob gives accurate UTF-8 byte count, unlike string .length)
  try {
    var html = document.documentElement.outerHTML || '';
    var htmlSize = new Blob([html]).size;
    if (htmlSize > 5 * 1024 * 1024) {
      issues.push({
        type: 'html_too_large',
        message: 'HTML size exceeds 5 MB (' + Math.round(htmlSize / 1024 / 1024 * 10) / 10 + ' MB)',
        severity: 'warning'
      });
    }
  } catch(e) {}

  // Lorem ipsum placeholder text
  var bodyText = document.body ? (document.body.innerText || '').toLowerCase() : '';
  if (bodyText.indexOf('lorem ipsum') !== -1) {
    issues.push({ type: 'lorem_ipsum', message: 'Placeholder text "Lorem ipsum" found on page', severity: 'warning' });
  }

  // Broken HTML structure checks
  var htmlErrors = [];

  // Duplicate IDs (breaks anchor links, form labels, aria)
  var idEls = Array.prototype.slice.call(document.querySelectorAll('[id]'));
  var seenIds = {};
  var dupIds = [];
  idEls.forEach(function(el) {
    var id = el.id;
    if (!id) return;
    if (seenIds[id]) {
      if (dupIds.indexOf(id) === -1) dupIds.push(id);
    } else {
      seenIds[id] = true;
    }
  });
  if (dupIds.length > 0) {
    htmlErrors.push('Duplicate id: ' + dupIds.slice(0, 5).map(function(id) { return '#' + id; }).join(', ') + (dupIds.length > 5 ? ' and ' + (dupIds.length - 5) + ' more' : ''));
  }

  // <li> not inside <ul>/<ol>/<menu>
  var orphanLi = Array.prototype.filter.call(document.querySelectorAll('li'), function(li) {
    var p = li.parentElement;
    return !p || (p.tagName !== 'UL' && p.tagName !== 'OL' && p.tagName !== 'MENU');
  });
  if (orphanLi.length > 0) {
    htmlErrors.push('<li> outside <ul>/<ol>: ' + orphanLi.length);
  }

  // <dt>/<dd> not inside <dl> (or <div> inside <dl>)
  var orphanDtDd = Array.prototype.filter.call(document.querySelectorAll('dt, dd'), function(el) {
    var p = el.parentElement;
    if (!p) return true;
    if (p.tagName === 'DL') return false;
    // <div> is allowed as a grouping wrapper inside <dl>
    if (p.tagName === 'DIV' && p.parentElement && p.parentElement.tagName === 'DL') return false;
    return true;
  });
  if (orphanDtDd.length > 0) {
    htmlErrors.push('<dt>/<dd> outside <dl>: ' + orphanDtDd.length);
  }

  // Inline elements containing block-level elements (invalid nesting)
  // <label> excluded: HTML5 allows label to wrap flow content including divs
  var inlineWithBlock = Array.prototype.filter.call(
    document.querySelectorAll('span, em, strong, b, i, small'),
    function(el) {
      return !!el.querySelector('div, p, h1, h2, h3, h4, h5, h6, ul, ol, table, section, article, blockquote, pre, figure');
    }
  );
  if (inlineWithBlock.length > 0) {
    htmlErrors.push('Block elements inside inline elements (' + inlineWithBlock.length + '): ' +
      inlineWithBlock.slice(0, 3).map(function(el) { return '<' + el.tagName.toLowerCase() + '>'; }).join(', '));
  }

  // Nested <a> tags (browsers auto-close, but DOM nesting is invalid)
  var nestedAnchors = Array.prototype.filter.call(document.querySelectorAll('a'), function(a) {
    return !!a.querySelector('a');
  });
  if (nestedAnchors.length > 0) {
    htmlErrors.push('Nested <a> tags (' + nestedAnchors.length + ') — interactive elements cannot be nested');
  }

  // Deprecated HTML elements
  var deprecatedTags = ['font', 'center', 'marquee', 'blink', 'strike', 'big', 'tt', 'basefont', 'applet', 'frame', 'frameset'];
  var foundDeprecated = deprecatedTags.filter(function(tag) { return !!document.querySelector(tag); });
  if (foundDeprecated.length > 0) {
    htmlErrors.push('Deprecated elements: <' + foundDeprecated.join('>, <') + '>');
  }

  if (htmlErrors.length > 0) {
    issues.push({
      type: 'broken_html_structure',
      message: 'HTML structural errors (' + htmlErrors.length + ' type' + (htmlErrors.length === 1 ? '' : 's') + ')',
      severity: 'warning',
      detail: htmlErrors.join('\n')
    });
  }

  return { id: 'htmlval', name: 'HTML Validation', issues: issues };
}
