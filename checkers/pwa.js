function runPwaChecker(p) {
  var issues = [];

  var manifestEl    = document.querySelector('link[rel="manifest"]');
  var manifestHref  = manifestEl ? manifestEl.getAttribute('href') : null;
  var manifestUrl   = manifestHref ? (function() { try { return new URL(manifestHref, location.href).href; } catch(e) { return null; } })() : null;
  var isHttps       = location.protocol === 'https:';
  var isLocalhost   = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var isSecure      = isHttps || isLocalhost;
  var hasSWApi      = 'serviceWorker' in navigator;
  var swActive      = null; // true = active, false = not registered, null = unknown

  // Manifest link in <head> check
  var manifestInHead = manifestEl && !!manifestEl.closest('head');

  // Theme color
  var themeColorMeta = document.querySelector('meta[name="theme-color"]');
  var themeColor     = themeColorMeta ? themeColorMeta.getAttribute('content') : null;

  // iOS PWA meta tags
  var appleCapable  = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
  var appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  var appleTitle    = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  var appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');

  // Legacy IE/Edge/Windows
  var appNameMeta    = document.querySelector('meta[name="application-name"]');
  var msTileImage    = document.querySelector('meta[name="msapplication-TileImage"]');
  var msTileColor    = document.querySelector('meta[name="msapplication-TileColor"]');

  // HTML lang for comparison
  var htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase().substring(0, 2);

  // Collect promises for async checks
  var promises = [];

  // ── Service Worker check ────────────────────────────────────────────────────
  if (hasSWApi) {
    promises.push(
      navigator.serviceWorker.getRegistration().then(function(reg) {
        if (!reg) {
          swActive = false;
          issues.push({
            type: 'pwa_no_sw',
            message: 'Service Worker not registered — offline mode and push notifications unavailable',
            severity: 'warning'
          });
        } else {
          swActive = !!reg.active;
          var state = reg.installing ? 'installing' : reg.waiting ? 'waiting' : reg.active ? 'active' : 'unknown';
          var scope = reg.scope || '/';

          if (!reg.active) {
            issues.push({
              type: 'pwa_sw_inactive',
              message: 'Service Worker registered but not active (state: ' + state + ')',
              severity: 'notice'
            });
          }

          // Check scope coverage
          if (scope && scope !== location.origin + '/') {
            issues.push({
              type: 'pwa_sw_limited_scope',
              message: 'Service Worker scope is limited: ' + scope,
              severity: 'notice',
              detail: 'A scope of ' + location.origin + '/ covers the entire site. Limited scope means some pages won\'t be cached.'
            });
          }
        }
      }).catch(function() {
        swActive = null;
      })
    );
  }

  // ── HTTPS check ─────────────────────────────────────────────────────────────
  if (!isSecure) {
    issues.push({
      type: 'pwa_no_https',
      message: 'Site is not on HTTPS — Service Worker and PWA installation require a secure connection',
      severity: 'critical'
    });
  }

  // ── Manifest link check ─────────────────────────────────────────────────────
  if (!manifestUrl) {
    issues.push({
      type: 'pwa_no_manifest',
      message: 'Missing Web App Manifest (link rel="manifest") — required for PWA installation',
      severity: 'warning'
    });
  } else if (!manifestInHead) {
    issues.push({
      type: 'pwa_manifest_not_in_head',
      message: 'Web App Manifest link is not in <head>',
      severity: 'notice',
      detail: 'The <link rel="manifest"> should be placed in the <head> section.'
    });
  }

  // ── Manifest content check (async fetch) ────────────────────────────────────
  var manifestData = null;
  if (manifestUrl) {
    promises.push(
      fetch(manifestUrl, { credentials: 'same-origin' }).then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function(m) {
        manifestData = m;

        // ── Manifest: name ────────────────────────────────────────────────────
        if (!m.name && !m.short_name) {
          issues.push({
            type: 'pwa_manifest_no_name',
            message: 'Manifest: missing name and short_name fields',
            severity: 'warning'
          });
        } else if (!m.name) {
          issues.push({
            type: 'pwa_manifest_no_full_name',
            message: 'Manifest: missing name field (short_name only: "' + m.short_name + '")',
            severity: 'notice'
          });
        }

        // ── Manifest: start_url ───────────────────────────────────────────────
        if (!m.start_url) {
          issues.push({
            type: 'pwa_manifest_no_start_url',
            message: 'Manifest: missing start_url',
            severity: 'notice',
            detail: 'start_url defines the URL loaded when the PWA is launched. Default: /'
          });
        } else {
          // Validate start_url is reachable
          try {
            var startUrl = new URL(m.start_url, manifestUrl);
            if (startUrl.origin !== location.origin) {
              issues.push({
                type: 'pwa_manifest_start_url_cross_origin',
                message: 'Manifest: start_url points to a different origin',
                severity: 'warning',
                detail: 'start_url: ' + m.start_url + '\nCurrent origin: ' + location.origin
              });
            }
          } catch(e) {}
        }

        // ── Manifest: display ─────────────────────────────────────────────────
        if (!m.display) {
          issues.push({
            type: 'pwa_manifest_no_display',
            message: 'Manifest: display not specified — standalone or minimal-ui recommended',
            severity: 'notice'
          });
        } else if (m.display === 'browser') {
          issues.push({
            type: 'pwa_manifest_display_browser',
            message: 'Manifest: display="browser" does not provide PWA appearance',
            severity: 'notice',
            detail: 'Use "standalone", "minimal-ui", or "fullscreen" for a native-app feel.'
          });
        }

        // ── Manifest: orientation ─────────────────────────────────────────────
        if (m.orientation) {
          var validOrientations = ['any', 'natural', 'landscape', 'landscape-primary', 'landscape-secondary', 'portrait', 'portrait-primary', 'portrait-secondary'];
          if (validOrientations.indexOf(m.orientation) === -1) {
            issues.push({
              type: 'pwa_manifest_invalid_orientation',
              message: 'Manifest: invalid orientation value: "' + m.orientation + '"',
              severity: 'notice',
              detail: 'Valid values: ' + validOrientations.join(', ')
            });
          }
          if (m.orientation === 'landscape' || m.orientation === 'portrait') {
            issues.push({
              type: 'pwa_manifest_forced_orientation',
              message: 'Manifest: forces ' + m.orientation + ' orientation — may frustrate users',
              severity: 'notice',
              detail: 'Allow users to choose their preferred orientation unless the app specifically requires one.'
            });
          }
        }

        // ── Manifest: icons ───────────────────────────────────────────────────
        var icons = m.icons || [];
        var has192 = icons.some(function(i) { return (i.sizes || '').indexOf('192') !== -1; });
        var has512 = icons.some(function(i) { return (i.sizes || '').indexOf('512') !== -1; });
        var hasMaskable = icons.some(function(i) { return (i.purpose || '').indexOf('maskable') !== -1; });

        if (icons.length === 0) {
          issues.push({
            type: 'pwa_manifest_no_icons',
            message: 'Manifest: no icons defined — required for installation',
            severity: 'warning'
          });
        } else {
          var missingSizes = [];
          if (!has192) missingSizes.push('192×192');
          if (!has512) missingSizes.push('512×512');
          if (missingSizes.length > 0) {
            issues.push({
              type: 'pwa_manifest_icons',
              message: 'Manifest: missing icons ' + missingSizes.join(' and ') + ' — required for installation',
              severity: 'notice'
            });
          }

          if (!hasMaskable) {
            issues.push({
              type: 'pwa_manifest_no_maskable_icon',
              message: 'Manifest: no maskable icon — may display poorly on Android home screen',
              severity: 'notice',
              detail: 'Add an icon with purpose="maskable" for proper display on devices that crop icons.'
            });
          }

          // Check icon MIME types
          var iconsWithoutType = icons.filter(function(i) { return !i.type; });
          if (iconsWithoutType.length > 0) {
            issues.push({
              type: 'pwa_manifest_icons_no_type',
              message: 'Manifest: ' + iconsWithoutType.length + ' icon(s) missing "type" field',
              severity: 'notice',
              detail: 'Specify type (e.g., "image/png") for each icon.'
            });
          }

          // Check icon URLs are absolute
          var iconsRelative = icons.filter(function(i) {
            var src = i.src || '';
            return src.indexOf('http') !== 0;
          });
          if (iconsRelative.length > 0) {
            issues.push({
              type: 'pwa_manifest_icons_relative',
              message: 'Manifest: ' + iconsRelative.length + ' icon(s) use relative URLs',
              severity: 'notice',
              detail: 'Icon URLs should be absolute for reliability across origins.'
            });
          }
        }

        // ── Manifest: background_color ────────────────────────────────────────
        if (!m.background_color) {
          issues.push({
            type: 'pwa_manifest_no_bg',
            message: 'Manifest: missing background_color — needed for splash screen on launch',
            severity: 'notice'
          });
        }

        // ── Manifest: theme_color ─────────────────────────────────────────────
        if (!m.theme_color) {
          issues.push({
            type: 'pwa_manifest_no_theme_color',
            message: 'Manifest: missing theme_color',
            severity: 'notice',
            detail: 'theme_color controls the browser UI color on Android.'
          });
        }

        // ── Manifest: description ─────────────────────────────────────────────
        if (!m.description) {
          issues.push({
            type: 'pwa_manifest_no_description',
            message: 'Manifest: missing description field',
            severity: 'notice',
            detail: 'Add a description for the app launcher and store listings.'
          });
        }

        // ── Manifest: lang vs HTML lang ───────────────────────────────────────
        if (m.lang && htmlLang) {
          var manifestLang = m.lang.toLowerCase().substring(0, 2);
          if (manifestLang !== htmlLang) {
            issues.push({
              type: 'pwa_manifest_lang_mismatch',
              message: 'Manifest lang ("' + m.lang + ') differs from <html lang="' + htmlLang + '">',
              severity: 'notice'
            });
          }
        }

        // ── Manifest: scope ───────────────────────────────────────────────────
        if (m.scope) {
          try {
            var scopeUrl = new URL(m.scope, manifestUrl);
            if (scopeUrl.origin !== location.origin) {
              issues.push({
                type: 'pwa_manifest_scope_cross_origin',
                message: 'Manifest scope points to a different origin',
                severity: 'warning',
                detail: 'scope: ' + m.scope + '\nCurrent origin: ' + location.origin
              });
            }
          } catch(e) {}
        }

        // ── Manifest: share_target ────────────────────────────────────────────
        if (m.share_target) {
          issues.push({
            type: 'pwa_manifest_share_target',
            message: 'Manifest: share_target configured (app can receive shared content)',
            severity: 'info',
            detail: JSON.stringify(m.share_target, null, 2).substring(0, 200)
          });
        }

        // ── Manifest: file_handlers ───────────────────────────────────────────
        if (m.file_handlers && m.file_handlers.length > 0) {
          issues.push({
            type: 'pwa_manifest_file_handlers',
            message: 'Manifest: file_handlers configured (' + m.file_handlers.length + ' types)',
            severity: 'info'
          });
        }

        // ── Manifest: protocol_handlers ───────────────────────────────────────
        if (m.protocol_handlers && m.protocol_handlers.length > 0) {
          issues.push({
            type: 'pwa_manifest_protocol_handlers',
            message: 'Manifest: protocol_handlers configured (' + m.protocol_handlers.length + ')',
            severity: 'info'
          });
        }

        // ── Manifest: categories ──────────────────────────────────────────────
        if (m.categories && m.categories.length > 0) {
          issues.push({
            type: 'pwa_manifest_categories',
            message: 'Manifest: categories defined (' + m.categories.join(', ') + ')',
            severity: 'info'
          });
        }

      }).catch(function(e) {
        issues.push({
          type: 'pwa_manifest_error',
          message: 'Failed to load or parse manifest.json',
          severity: 'warning',
          detail: String(e)
        });
      })
    );
  }

  // ── iOS PWA checks ──────────────────────────────────────────────────────────
  if (!appleCapable) {
    issues.push({
      type: 'pwa_no_ios_capable',
      message: 'Missing apple-mobile-web-app-capable — iOS will not show standalone mode',
      severity: 'notice',
      detail: '<meta name="apple-mobile-web-app-capable" content="yes">'
    });
  }

  if (!appleStatusBar) {
    issues.push({
      type: 'pwa_no_ios_status_bar',
      message: 'Missing apple-mobile-web-app-status-bar-style — iOS status bar will use default style',
      severity: 'notice',
      detail: '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
    });
  }

  if (!appleTitle) {
    issues.push({
      type: 'pwa_no_ios_title',
      message: 'Missing apple-mobile-web-app-title — iOS will auto-capture the home screen title',
      severity: 'notice',
      detail: '<meta name="apple-mobile-web-app-title" content="...">'
    });
  }

  if (!appleTouchIcon) {
    issues.push({
      type: 'pwa_no_ios_icon',
      message: 'Missing apple-touch-icon — iOS home screen icon will be auto-captured',
      severity: 'notice',
      detail: '<link rel="apple-touch-icon" href="/icon-180.png">'
    });
  }

  // ── Theme color ─────────────────────────────────────────────────────────────
  if (!themeColor) {
    issues.push({
      type: 'pwa_no_theme_color_meta',
      message: 'Missing <meta name="theme-color"> — browser chrome will not be themed',
      severity: 'notice',
      detail: '<meta name="theme-color" content="#ffffff">'
    });
  }

  // ── Legacy IE/Edge/Windows tiles ────────────────────────────────────────────
  var legacyMissing = 0;
  if (!appNameMeta) legacyMissing++;
  if (!msTileImage) legacyMissing++;
  if (!msTileColor) legacyMissing++;
  if (legacyMissing === 3) {
    issues.push({
      type: 'pwa_no_legacy_windows',
      message: 'Missing Windows/Edge pinned site meta tags',
      severity: 'notice',
      detail: 'For full compatibility: application-name, msapplication-TileImage, msapplication-TileColor'
    });
  }

  // ── Resolve async checks, then build overview ───────────────────────────────
  if (!promises.length) {
    buildOverview();
    return { id: 'pwa', name: 'PWA', issues: issues };
  }

  return Promise.all(promises).then(function() {
    buildOverview();
    return { id: 'pwa', name: 'PWA', issues: issues };
  });

  function buildOverview() {
    var swStatus = 'not supported';
    if (swActive === true) swStatus = '✓ active';
    else if (swActive === false) swStatus = '✗ not registered';
    else if (swActive === null && hasSWApi) swStatus = 'unknown';
    else if (hasSWApi) swStatus = 'checking...';

    // Calculate installability score
    var score = 0;
    var maxScore = 10;
    if (isSecure) score++;
    if (manifestUrl) score++;
    if (swActive === true) score++;
    if (themeColor) score++;
    if (appleCapable) score++;
    if (appleTouchIcon) score++;
    if (manifestData) {
      if (manifestData.name || manifestData.short_name) score++;
      if (manifestData.icons && manifestData.icons.length > 0) score++;
      if (manifestData.start_url) score++;
      if (manifestData.display) score++;
      if (manifestData.background_color) score++;
    }

    var overviewLines = [
      'HTTPS              ' + (isSecure ? '✓' : '✗'),
      'Manifest           ' + (manifestHref || '✗ missing'),
      'Service Worker     ' + swStatus,
      'theme-color        ' + (themeColor || '✗ missing'),
      'apple-touch-icon   ' + (appleTouchIcon ? '✓' : '✗'),
      'Installability     ' + score + '/' + maxScore,
    ];

    if (manifestData) {
      overviewLines.push('');
      overviewLines.push('manifest.json:');
      overviewLines.push('  name           ' + (manifestData.name || '—'));
      overviewLines.push('  short_name     ' + (manifestData.short_name || '—'));
      overviewLines.push('  start_url      ' + (manifestData.start_url || '—'));
      overviewLines.push('  display        ' + (manifestData.display || '—'));
      overviewLines.push('  background     ' + (manifestData.background_color || '—'));
      overviewLines.push('  theme_color    ' + (manifestData.theme_color || '—'));
      overviewLines.push('  icons          ' + ((manifestData.icons || []).length + ' items'));
      if (manifestData.description) overviewLines.push('  description    ' + manifestData.description.substring(0, 60));
    }

    // Insert overview as first issue
    issues.unshift({
      type: 'pwa_overview',
      message: 'PWA — installability ' + score + '/' + maxScore,
      severity: 'info',
      detail: overviewLines.join('\n')
    });
  }
}
