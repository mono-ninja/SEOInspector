function runMobileChecker(p) {
  var issues = [];
  var params = p || {};
  var MIN_FONT = params.min_font_size || 14;
  var MIN_FIXED_PX = 600;
  var MIN_TOUCH_TARGET = 48;
  var MAX_TEXT_ELS = params.max_mobile_text_els || 200;

  // ── Viewport ────────────────────────────────────────────────────────────────
  var vpEl = document.querySelector('meta[name="viewport"]');
  var vpContent = vpEl ? (vpEl.getAttribute('content') || '').trim() : '';
  var vpLower = vpContent.toLowerCase();
  var scalable = !vpContent || (vpLower.indexOf('user-scalable=no') === -1 && !/maximum-scale\s*=\s*1(?:[^0-9.]|$)/.test(vpLower));
  var hasDeviceWidth = vpLower.indexOf('width=device-width') !== -1;

  // Viewport missing width=device-width
  if (vpEl && !hasDeviceWidth) {
    issues.push({
      type: 'viewport_no_device_width',
      message: 'Viewport meta tag missing width=device-width',
      severity: 'warning',
      detail: 'Without width=device-width, mobile browsers render the page at desktop width (~980px) then scale down.\nCurrent: ' + vpContent
    });
  }

  // Viewport scalability
  if (vpEl) {
    var scaleIssues = [];
    if (vpLower.indexOf('user-scalable=no') !== -1) scaleIssues.push('user-scalable=no');
    if (/maximum-scale\s*=\s*1(?:[^0-9.]|$)/.test(vpLower)) scaleIssues.push('maximum-scale=1');
    if (scaleIssues.length > 0) {
      issues.push({
        type: 'viewport_non_scalable',
        message: 'Viewport disables scaling (' + scaleIssues.join(', ') + ')',
        severity: 'warning',
        detail: 'Disabling zoom violates WCAG 1.4.4 and harms accessibility. Users should be able to zoom to 200%.'
      });
    }
  }

  // Multiple viewport meta tags
  var viewportTags = document.querySelectorAll('meta[name="viewport"]');
  if (viewportTags.length > 0) {
    var vpContents = [];
    Array.prototype.forEach.call(viewportTags, function(v) { vpContents.push(v.getAttribute('content') || ''); });
    if (viewportTags.length > 1) {
      issues.push({
        type: 'multiple_viewports',
        message: 'Multiple viewport meta tags (' + viewportTags.length + ')',
        severity: 'warning',
        detail: 'Only one viewport meta tag is allowed. Found:\n' + vpContents.join('\n')
      });
    }
  }

  // ── Mobile-specific meta tags ───────────────────────────────────────────────
  var hasAppleTouchIcon = !!document.querySelector('link[rel="apple-touch-icon"]');
  var hasThemeColor = !!document.querySelector('meta[name="theme-color"]');
  var hasMobileWebApp = !!(document.querySelector('meta[name="apple-mobile-web-app-capable"]') ||
                            document.querySelector('meta[name="mobile-web-app-capable"]'));

  if (!hasAppleTouchIcon) {
    issues.push({
      type: 'no_apple_touch_icon',
      message: 'Missing apple-touch-icon',
      severity: 'notice',
      detail: 'Add <link rel="apple-touch-icon" href="..."> for iOS home screen icon when users add the page to their home screen.'
    });
  }

  if (!hasThemeColor) {
    issues.push({
      type: 'no_theme_color',
      message: 'Missing theme-color meta tag',
      severity: 'notice',
      detail: 'Add <meta name="theme-color" content="..."> to customize the browser chrome color on mobile.'
    });
  }

  // ── Horizontal overflow ─────────────────────────────────────────────────────
  if (document.body) {
    var docWidth = document.documentElement.scrollWidth;
    var vpWidth = window.innerWidth;
    if (docWidth > vpWidth + 10) {
      issues.push({
        type: 'horizontal_overflow',
        message: 'Horizontal scroll: content width (' + docWidth + 'px) exceeds viewport (' + vpWidth + 'px)',
        severity: 'warning',
        detail: 'Horizontal overflow causes poor mobile UX. Check for fixed-width elements, tables, or overflowing content.'
      });
    }
  }

  // ── Font size checks ────────────────────────────────────────────────────────
  var smallFonts = [];
  var textEls = Array.prototype.slice.call(
    document.querySelectorAll('p, li, td, th, span, div, a, label, button, input, textarea')
  ).slice(0, MAX_TEXT_ELS);
  textEls.forEach(function(el) {
    if (!(el.textContent || '').trim()) return;
    try {
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      var fs = parseFloat(style.fontSize);
      if (!isNaN(fs) && fs >= 1 && fs < MIN_FONT) {
        smallFonts.push({ size: Math.round(fs * 10) / 10, text: (el.textContent || '').trim().substring(0, 40) });
      }
    } catch(e) {}
  });
  if (smallFonts.length > 0) {
    var minFound = Math.min.apply(null, smallFonts.map(function(s) { return s.size; }));
    issues.push({
      type: 'font_size_too_small',
      message: 'Found font-size less than ' + MIN_FONT + 'px (min: ' + minFound + 'px, ' + smallFonts.length + ' elements)',
      severity: 'notice',
      detail: 'Text below ' + MIN_FONT + 'px is hard to read on mobile. Examples:\n' +
        smallFonts.slice(0, 5).map(function(s) { return s.size + 'px — "' + s.text + '"'; }).join('\n'),
      highlight: true
    });
  }

  // ── Single pass over all <style> elements ──────────────────────────────────
  var vwFontSizes = [];
  var fixedWidthIssues = [];
  var minWidthIssues = [];
  Array.prototype.slice.call(document.querySelectorAll('style')).forEach(function(style) {
    var css = style.textContent || '';

    // Font-size using vw/vh units
    var reVw = /\bfont-size\s*:\s*[\d.]+\s*(?:vw|vh|dvw|dvh)/gi;
    var mVw;
    while ((mVw = reVw.exec(css)) !== null) { vwFontSizes.push(mVw[0]); }

    // Fixed-width layout
    var reFw = /(?:body|html|main|\.wrapper|\.container|#wrapper|#container)\s*\{([^}]*?)\bwidth\s*:\s*(\d+)px([^}]*?)\}/gi;
    var mFw;
    while ((mFw = reFw.exec(css)) !== null) {
      var px = parseInt(mFw[2], 10);
      var block = mFw[0];
      if (px > MIN_FIXED_PX && block.indexOf('max-width') === -1 && block.indexOf('%') === -1) {
        fixedWidthIssues.push({ width: px, selector: block.substring(0, 60) });
      }
    }

    // min-width on html/body
    var reMw = /(html|body)\s*\{([^}]*?)\bmin-width\s*:\s*(\d+)px/gi;
    var mMw;
    while ((mMw = reMw.exec(css)) !== null) {
      var px2 = parseInt(mMw[3], 10);
      if (px2 > MIN_FIXED_PX) {
        minWidthIssues.push({ selector: mMw[1], minW: px2 });
      }
    }
  });

  if (vwFontSizes.length > 0) {
    issues.push({
      type: 'font_size_viewport_units',
      message: 'Font-size uses viewport units (vw/vh) (' + vwFontSizes.length + ')',
      severity: 'notice',
      detail: 'Viewport-based font sizes do not respect user zoom preferences. Use rem or em instead.\nFound: ' + vwFontSizes.slice(0, 5).join(', ')
    });
  }

  if (fixedWidthIssues.length > 0) {
    issues.push({
      type: 'fixed_width_layout',
      message: 'Fixed layout width found (' + fixedWidthIssues.length + ')',
      severity: 'notice',
      detail: 'Fixed widths break responsive design. Use max-width with percentage or auto.\n' +
        fixedWidthIssues.slice(0, 5).map(function(f) { return f.width + 'px — ' + f.selector; }).join('\n')
    });
  }

  if (minWidthIssues.length > 0) {
    issues.push({
      type: 'min_width_too_large',
      message: 'min-width on html/body exceeds ' + MIN_FIXED_PX + 'px (' + minWidthIssues.length + ')',
      severity: 'warning',
      detail: 'Large min-width forces horizontal scrolling on mobile.\n' +
        minWidthIssues.slice(0, 3).map(function(f) { return f.selector + ' min-width: ' + f.minW + 'px'; }).join('\n'),
      highlight: true
    });
  }

  // ── Touch targets ───────────────────────────────────────────────────────────
  var smallTouchTargets = [];
  var interactiveEls = Array.prototype.slice.call(
    document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"], [tabindex]')
  ).slice(0, 200);
  interactiveEls.forEach(function(el) {
    try {
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      var rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (rect.width < MIN_TOUCH_TARGET || rect.height < MIN_TOUCH_TARGET) {
        smallTouchTargets.push({
          tag: el.tagName.toLowerCase(),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          text: ((el.textContent || el.getAttribute('aria-label') || '').trim() || '').substring(0, 30)
        });
      }
    } catch(e) {}
  });
  if (smallTouchTargets.length > 0) {
    issues.push({
      type: 'touch_target_too_small',
      message: 'Touch targets smaller than ' + MIN_TOUCH_TARGET + 'px (' + smallTouchTargets.length + ')',
      severity: 'warning',
      detail: 'Google recommends minimum 48x48px touch targets. Examples:\n' +
        smallTouchTargets.slice(0, 5).map(function(t) {
          return '<' + t.tag + '> ' + t.w + 'x' + t.h + 'px' + (t.text ? ' "' + t.text + '"' : '');
        }).join('\n'),
      highlight: true
    });
  }

  // Double-tap zoom risk — tap targets with min-height < 32px (WCAG 2.5.5)
  var doubleTapRisk = smallTouchTargets.filter(function(t) {
    return t.h < 32 || t.w < 32;
  });
  if (doubleTapRisk.length > 0) {
    issues.push({
      type: 'double_tap_zoom_risk',
      message: 'Elements at risk of double-tap zoom (' + doubleTapRisk.length + ')',
      severity: 'notice',
      detail: 'Targets under 32px may trigger double-tap zoom instead of click on some devices. WCAG 2.5.5.',
      highlight: true
    });
  }

  // ── Fixed/sticky positioning on mobile ──────────────────────────────────────
  var fixedElements = [];
  var allEls = document.querySelectorAll('*');
  var fixedCheckLimit = Math.min(allEls.length, 300);
  for (var fci = 0; fci < fixedCheckLimit; fci++) {
    var cel = allEls[fci];
    try {
      var cs = window.getComputedStyle(cel);
      if ((cs.position === 'fixed' || cs.position === 'sticky') && cs.display !== 'none') {
        var rect = cel.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          fixedElements.push({
            tag: cel.tagName.toLowerCase(),
            pos: cs.position,
            cls: (typeof cel.className === 'string' && cel.className.trim()) ? '.' + cel.className.trim().split(/\s+/)[0] : '',
            h: Math.round(rect.height)
          });
        }
      }
    } catch(e) {}
  }
  var fullWidthFixed = fixedElements.filter(function(f) {
    return f.tag === 'div' || f.tag === 'header' || f.tag === 'footer' || f.tag === 'nav';
  });
  if (fullWidthFixed.length > 2) {
    issues.push({
      type: 'excessive_fixed_position',
      message: 'Multiple fixed/sticky elements (' + fullWidthFixed.length + ') — may block content on mobile',
      severity: 'notice',
      detail: 'Too many fixed/sticky elements can overlap and block interactive content on small screens.\n' +
        fullWidthFixed.slice(0, 5).map(function(f) { return '<' + f.tag + f.cls + '> position:' + f.pos + ' h:' + f.h + 'px'; }).join('\n')
    });
  }

  // ── Media queries presence ──────────────────────────────────────────────────
  var hasMediaQueries = false;
  var mediaQueryCount = 0;
  Array.prototype.slice.call(document.querySelectorAll('style')).forEach(function(style) {
    var css = style.textContent || '';
    var mqMatches = css.match(/@media\s*\(/gi);
    if (mqMatches) mediaQueryCount += mqMatches.length;
  });
  var linkStyles = document.querySelectorAll('link[rel="stylesheet"]');
  Array.prototype.forEach.call(linkStyles, function(l) {
    var media = (l.getAttribute('media') || '').trim();
    if (media && media !== 'all') hasMediaQueries = true;
  });
  if (mediaQueryCount > 0) hasMediaQueries = true;

  if (!hasMediaQueries && document.body) {
    issues.push({
      type: 'no_media_queries',
      message: 'No CSS media queries detected',
      severity: 'notice',
      detail: 'Responsive design typically uses @media queries to adapt layout for different screen sizes. External stylesheets may contain queries that cannot be detected.'
    });
  }

  // ── Image/Video max-width ───────────────────────────────────────────────────
  var mediaMaxWidthNone = [];
  var mediaEls = document.querySelectorAll('img, video');
  Array.prototype.forEach.call(mediaEls, function(el) {
    try {
      var cs = window.getComputedStyle(el);
      if (cs.maxWidth === 'none') {
        mediaMaxWidthNone.push(el.tagName.toLowerCase());
      }
    } catch(e) {}
  });
  if (mediaMaxWidthNone.length > 0) {
    issues.push({
      type: 'media_no_max_width',
      message: 'Media elements with max-width: none (' + mediaMaxWidthNone.length + ')',
      severity: 'notice',
      detail: 'Without max-width constraint, large images/videos will overflow the viewport on mobile.'
    });
  }

  // ── Intrusive interstitials ─────────────────────────────────────────────────
  try {
    var overlays = Array.prototype.filter.call(
      document.querySelectorAll('dialog[open], [role="dialog"], .modal, .popup, .overlay, [class*="interstitial"]'),
      function(el) {
        if (!el.offsetParent && el.tagName !== 'DIALOG') return false;
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        var rect = el.getBoundingClientRect();
        var vpArea = window.innerWidth * window.innerHeight;
        var elArea = rect.width * rect.height;
        return vpArea > 0 && elArea / vpArea > 0.3;
      }
    );
    if (overlays.length > 0) {
      issues.push({
        type: 'intrusive_interstitial',
        message: 'Possible intrusive popup/overlay (' + overlays.length + ') covering > 30% of the screen',
        severity: 'warning',
        detail: 'Google may demote rankings for intrusive interstitials on mobile.',
        highlight: true
      });
    }
  } catch(e) {}

  // ── Ad elements / <ins> tags ────────────────────────────────────────────────
  var adElements = document.querySelectorAll('ins, [class*="ad-"], [class*="adsby"], [class*="advertisement"], [id*="ad-"]');
  if (adElements.length > 0) {
    issues.push({
      type: 'ad_elements_detected',
      message: 'Ad elements detected (' + adElements.length + ')',
      severity: 'notice',
      detail: 'Ad elements can cause layout shift (CLS) on mobile. Ensure ads have reserved dimensions.'
    });
  }

  // ── Content-visibility ──────────────────────────────────────────────────────
  var hasContentVisibility = false;
  Array.prototype.slice.call(document.querySelectorAll('style')).forEach(function(style) {
    if ((style.textContent || '').indexOf('content-visibility') !== -1) {
      hasContentVisibility = true;
    }
  });
  if (!hasContentVisibility && document.body) {
    var bodyTextLen = (document.body.innerText || '').trim().length;
    if (bodyTextLen > 5000) {
      issues.push({
        type: 'no_content_visibility',
        message: 'Long page without content-visibility optimization',
        severity: 'notice',
        detail: 'Consider adding content-visibility: auto to long sections for faster rendering on mobile devices.'
      });
    }
  }

  // ── Meta refresh redirect ───────────────────────────────────────────────────
  var metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
  if (metaRefresh) {
    issues.push({
      type: 'meta_refresh_redirect',
      message: 'Meta refresh redirect detected',
      severity: 'warning',
      detail: 'Meta refresh redirects provide poor mobile UX. Use server-side redirects (301/302) instead.\nContent: ' + (metaRefresh.getAttribute('content') || '')
    });
  }

  // ── Overview ────────────────────────────────────────────────────────────────
  issues.unshift({
    type: 'mobile_overview',
    message: 'Mobile overview',
    severity: 'info',
    detail: [
      'Viewport            ' + (vpContent || 'not set'),
      'width=device-width  ' + (hasDeviceWidth ? 'yes' : 'no'),
      'User scaling        ' + (scalable ? 'allowed' : 'blocked'),
      'Viewport width      ' + window.innerWidth + 'px',
      'Media queries       ' + (hasMediaQueries ? 'detected (' + mediaQueryCount + ')' : 'not detected'),
      'Touch targets       ' + interactiveEls.length + ' checked / ' + smallTouchTargets.length + ' too small',
      'apple-touch-icon    ' + (hasAppleTouchIcon ? 'yes' : 'no'),
      'theme-color         ' + (hasThemeColor ? 'yes' : 'no'),
      'Fixed/sticky elems  ' + fullWidthFixed.length
    ].join('\n')
  });

  return { id: 'mobile', name: 'Mobile', issues: issues };
}
