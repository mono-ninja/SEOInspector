function runAccessibilityChecker(p) {
  var issues = [];

  // Info: accessibility overview
  issues.push({
    type: 'a11y_overview',
    message: 'Accessibility — overview',
    severity: 'info',
    detail: [
      'Page language (<html lang>)  ' + (document.documentElement.getAttribute('lang') || 'not set'),
      'Form fields                  ' + document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select').length,
      'Buttons                      ' + document.querySelectorAll('button').length,
      'Links                        ' + document.querySelectorAll('a[href]').length,
      'Videos                       ' + document.querySelectorAll('video').length,
      'ARIA elements                ' + document.querySelectorAll('[role]').length,
      'Landmark regions             ' + document.querySelectorAll('main, header, footer, nav, aside, [role="main"], [role="banner"], [role="contentinfo"], [role="navigation"], [role="complementary"]').length,
    ].join('\n')
  });

  // <html> missing lang attribute
  var htmlEl = document.documentElement;
  if (!htmlEl.hasAttribute('lang') || htmlEl.getAttribute('lang').trim() === '') {
    issues.push({ type: 'missing_lang', message: '<html> tag is missing the lang attribute', severity: 'warning' });
  }

  // Form elements without labels
  var formEls = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select');
  var unlabeledCount = 0;
  Array.prototype.slice.call(formEls).forEach(function(el) {
    var id = el.id;
    var hasLabel = false;
    if (id) {
      var escapedId = id.replace(/([[\]".'*:])/g, '\\$1');
      hasLabel = !!document.querySelector('label[for="' + escapedId + '"]');
    }
    if (!hasLabel &&
        !el.hasAttribute('aria-label') &&
        !el.hasAttribute('aria-labelledby') &&
        !el.hasAttribute('title') &&
        !el.hasAttribute('placeholder')) {
      var parent = el.parentElement;
      while (parent) {
        if (parent.tagName === 'LABEL') { hasLabel = true; break; }
        parent = parent.parentElement;
      }
      if (!hasLabel) unlabeledCount++;
    }
  });
  if (unlabeledCount > 0) {
    issues.push({ type: 'unlabeled_inputs', message: 'Form fields without labels (label/aria-label/title) (' + unlabeledCount + ')', severity: 'warning', highlight: true });
  }

  // <video> without <track kind="captions"> — aggregated
  var videosWithoutCaptions = Array.prototype.slice.call(document.querySelectorAll('video')).filter(function(v) {
    return !v.querySelector('track[kind="captions"]');
  });
  if (videosWithoutCaptions.length > 0) {
    issues.push({ type: 'video_no_captions', message: 'Videos without captions (<track kind="captions">) (' + videosWithoutCaptions.length + ')', severity: 'warning', highlight: true });
  }

  // Interactive elements with no accessible text
  var interactiveEls = document.querySelectorAll('button, a[href], [role="button"]:not(button)');
  var noAccessibleText = [];
  Array.prototype.slice.call(interactiveEls).forEach(function(el) {
    var text = (el.textContent || '').trim();
    var ariaLabel = (el.getAttribute('aria-label') || '').trim();
    var ariaLabelledBy = el.getAttribute('aria-labelledby');
    var ariaLabelledByValid = false;
    if (ariaLabelledBy) {
      ariaLabelledByValid = ariaLabelledBy.split(/\s+/).some(function(id) {
        var ref = document.getElementById(id);
        return ref && (ref.textContent || '').trim() !== '';
      });
    }
    var title = (el.getAttribute('title') || '').trim();
    var hasImg = !!el.querySelector('img[alt]:not([alt=""])');
    var hasSvgTitle = !!el.querySelector('svg title');

    if (!text && !ariaLabel && !ariaLabelledByValid && !title && !hasImg && !hasSvgTitle) {
      noAccessibleText.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''));
    }
  });
  if (noAccessibleText.length > 0) {
    issues.push({
      type: 'no_accessible_text',
      message: 'Interactive elements without accessible text (' + noAccessibleText.length + ')',
      severity: 'warning',
      detail: noAccessibleText.slice(0, 10).join(', '),
      highlight: true
    });
  }

  // Missing skip-to-content link
  var skipLink = document.querySelector('a[href="#main"], a[href="#content"], a[href="#maincontent"], a[href="#skip"]');
  if (!skipLink) {
    issues.push({ type: 'missing_skip_link', message: 'Missing skip-to-content link', severity: 'notice' });
  }

  // ── Landmark regions ──────────────────────────────────────────────────────

  var hasMain = !!document.querySelector('main, [role="main"]');
  var hasBanner = !!document.querySelector('header, [role="banner"]');
  var hasContentinfo = !!document.querySelector('footer, [role="contentinfo"]');
  var hasNav = !!document.querySelector('nav, [role="navigation"]');

  if (!hasMain) {
    issues.push({ type: 'missing_landmark_main', message: 'Missing landmark region <main> or [role="main"]', severity: 'warning', detail: 'WCAG 1.3.1: the main page content should be wrapped in <main>.' });
  }

  if (!hasBanner) {
    issues.push({ type: 'missing_landmark_banner', message: 'Missing landmark region <header> or [role="banner"]', severity: 'notice' });
  }

  if (!hasContentinfo) {
    issues.push({ type: 'missing_landmark_contentinfo', message: 'Missing landmark region <footer> or [role="contentinfo"]', severity: 'notice' });
  }

  if (!hasNav) {
    issues.push({ type: 'missing_landmark_nav', message: 'Missing landmark region <nav> or [role="navigation"]', severity: 'notice' });
  }

  // Multiple <main> elements
  var mainCount = document.querySelectorAll('main, [role="main"]').length;
  if (mainCount > 1) {
    issues.push({ type: 'multiple_main', message: 'Multiple <main>/' + '[role="main"] elements (' + mainCount + ')', severity: 'warning', detail: 'There should be only one main content region.' });
  }

  // ── ARIA role validation ──────────────────────────────────────────────────

  var validRoles = {
    'alert':1,'alertdialog':1,'application':1,'article':1,'banner':1,'button':1,
    'cell':1,'checkbox':1,'columnheader':1,'combobox':1,'complementary':1,
    'contentinfo':1,'definition':1,'dialog':1,'directory':1,'document':1,
    'feed':1,'figure':1,'form':1,'grid':1,'gridcell':1,'group':1,'heading':1,
    'img':1,'link':1,'list':1,'listbox':1,'listitem':1,'log':1,'main':1,
    'marquee':1,'math':1,'menu':1,'menubar':1,'menuitem':1,'menuitemcheckbox':1,
    'menuitemradio':1,'navigation':1,'none':1,'note':1,'option':1,'presentation':1,
    'progressbar':1,'radio':1,'radiogroup':1,'region':1,'row':1,'rowgroup':1,
    'rowheader':1,'scrollbar':1,'search':1,'searchbox':1,'separator':1,
    'slider':1,'spinbutton':1,'status':1,'switch':1,'tab':1,'table':1,
    'tablist':1,'tabpanel':1,'term':1,'textbox':1,'timer':1,'toolbar':1,
    'tooltip':1,'tree':1,'treegrid':1,'treeitem':1
  };

  var roleEls = document.querySelectorAll('[role]');
  var invalidRoles = [];
  Array.prototype.slice.call(roleEls).forEach(function(el) {
    var roleParts = el.getAttribute('role').trim().toLowerCase().split(/\s+/);
    roleParts.forEach(function(role) {
      if (role && !validRoles[role]) {
        invalidRoles.push(el.tagName.toLowerCase() + '[role="' + role + '"]');
      }
    });
  });
  if (invalidRoles.length > 0) {
    issues.push({
      type: 'invalid_aria_role',
      message: 'Invalid ARIA roles (' + invalidRoles.length + ')',
      severity: 'warning',
      detail: invalidRoles.slice(0, 10).join(', '),
      highlight: true
    });
  }

  // ARIA required attributes missing
  var ariaAttrChecks = [
    { role: 'checkbox', attrs: ['aria-checked'] },
    { role: 'combobox', attrs: ['aria-expanded'] },
    { role: 'option', attrs: ['aria-selected'] },
    { role: 'radio', attrs: ['aria-checked'] },
    { role: 'scrollbar', attrs: ['aria-controls', 'aria-valuenow', 'aria-orientation'] },
    { role: 'slider', attrs: ['aria-valuenow'] },
    { role: 'spinbutton', attrs: ['aria-valuenow'] },
    { role: 'switch', attrs: ['aria-checked'] },
    { role: 'tab', attrs: ['aria-selected'] },
  ];

  var missingAriaAttrs = [];
  Array.prototype.slice.call(roleEls).forEach(function(el) {
    var role = el.getAttribute('role').trim().toLowerCase();
    var check = ariaAttrChecks.filter(function(c) { return c.role === role; })[0];
    if (check) {
      check.attrs.forEach(function(attr) {
        if (!el.hasAttribute(attr)) {
          missingAriaAttrs.push(el.tagName.toLowerCase() + '[role="' + role + '"] missing ' + attr);
        }
      });
    }
  });
  if (missingAriaAttrs.length > 0) {
    issues.push({
      type: 'missing_aria_attributes',
      message: 'ARIA elements missing required attributes (' + missingAriaAttrs.length + ')',
      severity: 'warning',
      detail: missingAriaAttrs.slice(0, 10).join(', ')
    });
  }

  // aria-hidden on focusable elements
  var ariaHiddenFocusable = [];
  Array.prototype.slice.call(document.querySelectorAll('[aria-hidden="true"]')).forEach(function(el) {
    var tag = el.tagName;
    var isSelfFocusable = (tag === 'A' && !!el.getAttribute('href')) ||
        tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' ||
        (el.getAttribute('tabindex') && el.getAttribute('tabindex') !== '-1');
    if (isSelfFocusable) {
      ariaHiddenFocusable.push(el.tagName.toLowerCase() + ' (self)');
    } else {
      var focusable = el.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length > 0) {
        ariaHiddenFocusable.push(el.tagName.toLowerCase() + ' (' + focusable.length + ' focusable)');
      }
    }
  });
  if (ariaHiddenFocusable.length > 0) {
    issues.push({
      type: 'aria_hidden_focusable',
      message: 'aria-hidden="true" on focusable elements (' + ariaHiddenFocusable.length + ')',
      severity: 'warning',
      detail: ariaHiddenFocusable.slice(0, 10).join(', ')
    });
  }

  // ── Focus order ───────────────────────────────────────────────────────────

  var focusables = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]');
  var tabindexIssues = [];
  Array.prototype.slice.call(focusables).forEach(function(el) {
    var ti = el.getAttribute('tabindex');
    if (ti) {
      var tiVal = parseInt(ti, 10);
      if (tiVal > 0) {
        tabindexIssues.push(el.tagName.toLowerCase() + '[tabindex="' + tiVal + '"]');
      }
    }
  });
  if (tabindexIssues.length > 0) {
    issues.push({
      type: 'positive_tabindex',
      message: 'Elements with tabindex > 0 (' + tabindexIssues.length + ')',
      severity: 'notice',
      detail: 'Positive tabindex breaks the natural focus order. ' + tabindexIssues.slice(0, 5).join(', ')
    });
  }

  // ── Color contrast (computed styles) ──────────────────────────────────────

  var contrastFailures = [];

  function parseColor(colorStr) {
    if (!colorStr) return null;
    colorStr = colorStr.trim().toLowerCase();
    var match = colorStr.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      return { r: parseInt(match[1], 10), g: parseInt(match[2], 10), b: parseInt(match[3], 10) };
    }
    match = colorStr.match(/^#([0-9a-f]{3,8})$/);
    if (match) {
      var h = match[1];
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      return { r: parseInt(h.substr(0,2),16), g: parseInt(h.substr(2,2),16), b: parseInt(h.substr(4,2),16) };
    }
    var named = { black: [0,0,0], white: [255,255,255], red: [255,0,0], green: [0,128,0], blue: [0,0,255],
      transparent: null };
    if (named[colorStr] !== undefined) {
      var v = named[colorStr];
      return v ? { r: v[0], g: v[1], b: v[2] } : null;
    }
    return null;
  }

  function relativeLuminance(c) {
    var rs = c.r / 255, gs = c.g / 255, bs = c.b / 255;
    rs = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
    gs = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
    bs = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function contrastRatio(c1, c2) {
    var l1 = relativeLuminance(c1), l2 = relativeLuminance(c2);
    var lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function getBackgroundComputed(el) {
    try {
      var style = window.getComputedStyle(el);
      var bg = style.backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return parseColor(bg);
      var parent = el.parentElement;
      var depth = 0;
      while (parent && depth < 5) {
        try {
          var ps = window.getComputedStyle(parent);
          var pb = ps.backgroundColor;
          if (pb && pb !== 'transparent' && pb !== 'rgba(0, 0, 0, 0)') return parseColor(pb);
        } catch(e) { break; }
        parent = parent.parentElement;
        depth++;
      }
      return { r: 255, g: 255, b: 255 };
    } catch(e) { return null; }
  }

  try {
    var textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, label, a, li, td, th, strong, em');
    var maxContrastChecks = Math.min(textElements.length, 100);
    for (var ci = 0; ci < maxContrastChecks; ci++) {
      var cel = textElements[ci];
      if (cel.offsetParent === null) continue;
      try {
        var cs = window.getComputedStyle(cel);
        var color = parseColor(cs.color);
        var bg = getBackgroundComputed(cel);
        if (color && bg) {
          var ratio = contrastRatio(color, bg);
          var fontSize = parseFloat(cs.fontSize);
          var isBold = parseInt(cs.fontWeight, 10) >= 600;
          var largeText = (isBold && fontSize >= 18.67) || fontSize >= 24;
          var normalThreshold = largeText ? 3.0 : 4.5;
          if (ratio < normalThreshold) {
            var text = (cel.textContent || '').trim().substring(0, 60);
            if (text.length > 10) {
              contrastFailures.push({ ratio: ratio, text: text, el: cel.tagName.toLowerCase(), large: largeText });
            }
          }
        }
      } catch(e) {}
    }
  } catch(e) {}

  if (contrastFailures.length > 0) {
    var worst = contrastFailures.sort(function(a, b) { return a.ratio - b.ratio; })[0];
    issues.push({
      type: 'low_color_contrast',
      message: 'Low color contrast (' + contrastFailures.length + ' elements, worst: ' + worst.ratio.toFixed(2) + ':1)',
      severity: 'warning',
      detail: 'WCAG AA: normal text >= 4.5:1, large text >= 3:1. Example: "' + worst.text + '" (' + worst.el + ', ratio ' + worst.ratio.toFixed(2) + ':1)'
    });
  }

  return { id: 'accessibility', name: 'Accessibility', issues: issues };
}
