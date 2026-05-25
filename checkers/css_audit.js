function runCssAuditChecker(p) {
  var issues = [];

  // ── Collect <link rel="stylesheet"> ──────────────────────────────────────
  var allLinks = Array.prototype.slice.call(document.querySelectorAll('link'));

  var cssLinks = allLinks.filter(function(l) {
    return (l.getAttribute('rel') || '').toLowerCase().indexOf('stylesheet') !== -1 &&
           (l.getAttribute('href') || '');
  });

  var preloadedHrefs = allLinks
    .filter(function(l) {
      return (l.getAttribute('rel') || '').toLowerCase().indexOf('preload') !== -1 &&
             (l.getAttribute('as') || '').toLowerCase() === 'style';
    })
    .map(function(l) { return l.getAttribute('href') || ''; });

  // ── Classify render-blocking stylesheets ─────────────────────────────────
  // A stylesheet is render-blocking when it is in <head> and its media applies to screens.
  var headCssLinks = Array.prototype.slice.call(document.querySelectorAll('head link')).filter(function(l) {
    if ((l.getAttribute('rel') || '').toLowerCase().indexOf('stylesheet') === -1) return false;
    if (!(l.getAttribute('href') || '')) return false;
    var media = (l.getAttribute('media') || '').trim().toLowerCase();
    // print / speech / embossed — do not block visual rendering
    if (media === 'print' || media === 'speech' || media === 'braille' || media === 'embossed') return false;
    // async CSS pattern: media="print" with onload="this.media='all'"
    var onload = (l.getAttribute('onload') || '').toLowerCase();
    if (onload.indexOf("this.media='all'") !== -1 || onload.indexOf('this.media="all"') !== -1) return false;
    return true;
  });

  // ── CSS loaded from <body> (causes repaints) ─────────────────────────────
  var bodyCssLinks = cssLinks.filter(function(l) { return !l.closest('head'); });

  // ── Duplicate CSS files (same href loaded more than once) ─────────────────
  var hrefSeen = {};
  var duplicateCss = [];
  cssLinks.forEach(function(l) {
    var href = (l.getAttribute('href') || '').split('?')[0];
    if (!href) return;
    if (hrefSeen[href]) { if (duplicateCss.indexOf(href) === -1) duplicateCss.push(href); }
    else hrefSeen[href] = true;
  });

  // ── Inline <style> blocks ─────────────────────────────────────────────────
  var styleBlocks = Array.prototype.slice.call(document.querySelectorAll('style'));
  var totalInlineChars = 0;
  var importCountInStyle = 0;
  styleBlocks.forEach(function(s) {
    var txt = s.textContent || '';
    totalInlineChars += txt.length;
    var m = txt.match(/@import/g);
    if (m) importCountInStyle += m.length;
  });

  // ── Count @import in loaded stylesheets ───────────────────────────────────
  var importCountInSheets = 0;
  var crossOriginSheets = 0;
  var totalCssRules = 0;
  try {
    Array.prototype.forEach.call(document.styleSheets, function(sheet) {
      try {
        var rules = sheet.cssRules || [];
        totalCssRules += rules.length;
        Array.prototype.forEach.call(rules, function(rule) {
          if (rule.type === CSSRule.IMPORT_RULE) importCountInSheets++;
        });
      } catch(e) { crossOriginSheets++; }
    });
  } catch(e) {}

  var totalImports = importCountInStyle + importCountInSheets;

  // ── Elements with inline style= ───────────────────────────────────────────
  var inlineStyleCount = document.querySelectorAll('[style]').length;

  // ── Overview ─────────────────────────────────────────────────────────────
  var inlineKB = (totalInlineChars / 1024).toFixed(1);
  issues.push({
    type: 'css_overview',
    message: 'CSS — overview',
    severity: 'info',
    detail: [
      'External CSS files       ' + cssLinks.length,
      'Render-blocking          ' + headCssLinks.length,
      'CSS in <body>            ' + (bodyCssLinks.length || '—'),
      'Preloaded CSS            ' + preloadedHrefs.length,
      'Inline <style> blocks    ' + styleBlocks.length + ' (~' + inlineKB + ' KB)',
      'Inline style= attributes ' + inlineStyleCount,
      '@import rules            ' + (totalImports || '—'),
      'Cross-origin sheets      ' + (crossOriginSheets ? crossOriginSheets + ' (rules hidden by CORS)' : '—'),
      'Total CSS rules          ' + (totalCssRules || '—'),
    ].join('\n')
  });

  // ── Render-blocking CSS ───────────────────────────────────────────────────
  if (headCssLinks.length > 5) {
    issues.push({
      type: 'many_render_blocking_css',
      message: 'Many render-blocking CSS files in <head> (' + headCssLinks.length + ')',
      severity: 'warning',
      detail: 'Each blocks the browser from rendering until it downloads.\n' +
        'Consider combining files or using Critical CSS + async loading.\n' +
        headCssLinks.slice(0, 5).map(function(l) { return l.getAttribute('href') || ''; }).join('\n') +
        (headCssLinks.length > 5 ? '\n… and ' + (headCssLinks.length - 5) + ' more' : '')
    });
  } else if (headCssLinks.length > 2) {
    issues.push({
      type: 'render_blocking_css',
      message: 'Render-blocking CSS in <head> (' + headCssLinks.length + ')',
      severity: 'notice',
      detail: headCssLinks.map(function(l) { return l.getAttribute('href') || ''; }).join('\n')
    });
  }

  // ── CSS loaded from <body> ────────────────────────────────────────────────
  if (bodyCssLinks.length > 0) {
    issues.push({
      type: 'css_in_body',
      message: 'Stylesheet(s) loaded from <body> (' + bodyCssLinks.length + ') — causes repaints and layout shifts',
      severity: 'warning',
      detail: bodyCssLinks.map(function(l) { return l.getAttribute('href') || ''; }).join('\n')
    });
  }

  // ── Duplicate CSS files ───────────────────────────────────────────────────
  if (duplicateCss.length > 0) {
    issues.push({
      type: 'duplicate_css',
      message: 'Same CSS file loaded more than once (' + duplicateCss.length + ')',
      severity: 'warning',
      detail: duplicateCss.join('\n')
    });
  }

  // ── CSS without <link rel="preload"> hint ─────────────────────────────────
  if (headCssLinks.length > 0 && preloadedHrefs.length === 0) {
    issues.push({
      type: 'css_no_preload',
      message: 'No <link rel="preload" as="style"> for render-blocking CSS',
      severity: 'notice',
      detail: 'Preload hints let the browser discover and start downloading critical stylesheets earlier.\n' +
        'Example: <link rel="preload" as="style" href="style.css" onload="this.rel=\'stylesheet\'">'
    });
  }

  // ── @import usage ─────────────────────────────────────────────────────────
  if (totalImports > 0) {
    issues.push({
      type: 'css_import_blocking',
      message: '@import in CSS (' + totalImports + ') — causes serial stylesheet loading',
      severity: 'warning',
      detail: '@import is only discovered after the parent file is fully downloaded,\ncausing a waterfall of serial requests. Use <link> elements instead.'
    });
  }

  // ── Large inline CSS ──────────────────────────────────────────────────────
  if (totalInlineChars > 50 * 1024) {
    issues.push({
      type: 'large_inline_css',
      message: 'Large inline <style> (~' + inlineKB + ' KB) — cannot be cached by the browser',
      severity: 'warning',
      detail: 'Consider extracting into external .css files so the browser can cache them.'
    });
  } else if (totalInlineChars > 20 * 1024) {
    issues.push({
      type: 'large_inline_css',
      message: 'Inline <style> blocks are large (~' + inlineKB + ' KB)',
      severity: 'notice',
      detail: 'Inline CSS is not cacheable. Critical CSS inline is fine, but keep it minimal.'
    });
  }

  // ── Too many external CSS files ───────────────────────────────────────────
  if (cssLinks.length > 8) {
    issues.push({
      type: 'too_many_css_files',
      message: 'Many external CSS files (' + cssLinks.length + ') — each is an HTTP request',
      severity: 'warning',
      detail: 'Bundle CSS files to reduce network overhead.'
    });
  } else if (cssLinks.length > 4) {
    issues.push({
      type: 'too_many_css_files',
      message: 'Multiple external CSS files (' + cssLinks.length + ')',
      severity: 'notice'
    });
  }

  // ── Over-reliance on inline style= ───────────────────────────────────────
  if (inlineStyleCount > 100) {
    issues.push({
      type: 'too_many_inline_styles',
      message: 'Many elements with inline style= attribute (' + inlineStyleCount + ')',
      severity: 'notice',
      detail: 'Inline styles reduce reusability and are harder to override.'
    });
  }

  return { id: 'css_audit', name: 'CSS Audit', issues: issues };
}
