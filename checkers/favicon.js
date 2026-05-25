function runFaviconChecker(p) {
  var issues = [];

  // ── Collect all favicon-related declarations ──────────────────────────────
  var favLinks = Array.prototype.slice.call(
    document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]')
  );
  var appleLinks = Array.prototype.slice.call(
    document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')
  );
  var maskIcon  = document.querySelector('link[rel="mask-icon"]');
  var manifest  = document.querySelector('link[rel="manifest"]');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var msTile    = document.querySelector('meta[name="msapplication-TileImage"], meta[name="msapplication-config"]');

  var hasFav      = favLinks.length > 0;
  var hasApple    = appleLinks.length > 0;
  var hasSvgFav   = favLinks.some(function(l) {
    return (l.getAttribute('type') || '').toLowerCase().indexOf('svg') !== -1;
  });
  var hasApple180 = appleLinks.some(function(l) {
    return (l.getAttribute('sizes') || '') === '180x180';
  });

  // ── Overview ─────────────────────────────────────────────────────────────
  var lines = [];

  if (favLinks.length === 0) {
    lines.push('Favicon              —');
  } else {
    favLinks.forEach(function(l) {
      var href  = l.getAttribute('href') || '✓';
      var sizes = l.getAttribute('sizes') || '';
      var type  = l.getAttribute('type')  || '';
      var info  = href.length > 45 ? '…' + href.slice(-42) : href;
      if (sizes) info += ' [' + sizes + ']';
      if (type.indexOf('svg') !== -1) info += ' (SVG)';
      lines.push('Favicon              ' + info);
    });
  }

  if (appleLinks.length === 0) {
    lines.push('Apple Touch Icon     —');
  } else {
    appleLinks.forEach(function(l) {
      var href  = l.getAttribute('href') || '✓';
      var sizes = l.getAttribute('sizes') || '';
      var info  = href.length > 45 ? '…' + href.slice(-42) : href;
      if (sizes) info += ' [' + sizes + ']';
      lines.push('Apple Touch Icon     ' + info);
    });
  }

  lines.push('mask-icon (Safari)   ' + (maskIcon ? (maskIcon.getAttribute('href') || '✓') : '—'));
  lines.push('Web App Manifest     ' + (manifest  ? '✓' : '—'));
  lines.push('theme-color          ' + (themeMeta ? (themeMeta.getAttribute('content') || '✓') : '—'));
  lines.push('MS Tile              ' + (msTile    ? '✓' : '—'));

  issues.push({
    type: 'favicon_overview',
    message: 'Favicon — overview',
    severity: 'info',
    detail: lines.join('\n')
  });

  // ── Checks ─────────────────────────────────────────

  if (!hasFav) {
    issues.push({
      type: 'favicon_missing',
      message: 'Missing favicon (link rel="icon")',
      severity: 'warning'
    });
  }

  if (hasFav && !hasSvgFav) {
    issues.push({
      type: 'favicon_no_svg',
      message: 'No SVG favicon — SVG scales perfectly at all resolutions and supports dark mode',
      severity: 'notice',
      detail: '<link rel="icon" type="image/svg+xml" href="/favicon.svg">'
    });
  }

  if (!hasApple) {
    issues.push({
      type: 'apple_touch_icon_missing',
      message: 'Missing Apple Touch Icon (link rel="apple-touch-icon") — used when saving to iOS home screen',
      severity: 'notice'
    });
  }

  if (hasApple && !hasApple180) {
    issues.push({
      type: 'apple_touch_icon_size',
      message: 'Apple Touch Icon without sizes="180x180" — recommended size for modern iOS devices',
      severity: 'notice',
      detail: '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">'
    });
  }

  if (!themeMeta) {
    issues.push({
      type: 'theme_color_missing',
      message: 'Missing <meta name="theme-color"> — controls browser chrome color on Android and PWA',
      severity: 'notice',
      detail: '<meta name="theme-color" content="#ffffff">'
    });
  }

  return { id: 'favicon', name: 'Favicon', issues: issues };
}
