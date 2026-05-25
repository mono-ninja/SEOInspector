function runMediaChecker(p) {
  var issues = [];

  // ── iFrame ──────────────────────────────────────────────────────────────────
  var iframes = Array.prototype.slice.call(document.querySelectorAll('iframe'));

  var noTitle = iframes.filter(function(f) { return !(f.getAttribute('title') || '').trim(); });
  if (noTitle.length > 0) {
    issues.push({
      type: 'iframe_no_title',
      message: '<iframe> missing title attribute (' + noTitle.length + ')',
      severity: 'warning',
      detail: 'Required for screen readers (WCAG 2.4.1)',
      highlight: true
    });
  }

  var videoIframes = iframes.filter(function(f) {
    var src = f.getAttribute('src') || f.getAttribute('data-src') || '';
    return src.indexOf('youtube.') !== -1 || src.indexOf('youtu.be') !== -1 || src.indexOf('vimeo.com') !== -1;
  });
  var noLazy = videoIframes.filter(function(f) { return f.getAttribute('loading') !== 'lazy'; });
  if (noLazy.length > 0) {
    issues.push({
      type: 'iframe_no_lazy',
      message: 'YouTube/Vimeo iframe without loading="lazy" (' + noLazy.length + ')',
      severity: 'notice',
      highlight: true
    });
  }

  // YouTube privacy-enhanced mode — check for ?enablejsapi=1 or legacy nocookie domain
  var youtubeIframes = iframes.filter(function(f) {
    var src = f.getAttribute('src') || '';
    return src.indexOf('youtube.com/embed') !== -1 || src.indexOf('youtu.be/embed') !== -1;
  });
  var youtubeNoPrivacy = youtubeIframes.filter(function(f) {
    var src = f.getAttribute('src') || '';
    return src.indexOf('youtube-nocookie.com') === -1 &&
           src.indexOf('enablejsapi') === -1 &&
           src.indexOf('nocookie') === -1;
  });
  if (youtubeNoPrivacy.length > 0) {
    issues.push({
      type: 'youtube_not_nocookie',
      message: 'YouTube embed without privacy-enhanced mode (' + youtubeNoPrivacy.length + ')',
      severity: 'notice',
      detail: 'Use www.youtube-nocookie.com/embed/ or add ?enablejsapi=1 to avoid sending cookies before user interaction.'
    });
  }

  var crossOriginNoSandbox = iframes.filter(function(f) {
    var src = f.getAttribute('src') || '';
    if (!src || src.indexOf('javascript:') === 0) return false;
    try {
      var u = new URL(src, window.location.href);
      return u.hostname && u.hostname !== window.location.hostname && !f.hasAttribute('sandbox');
    } catch(e) { return false; }
  });
  if (crossOriginNoSandbox.length > 0) {
    issues.push({
      type: 'iframe_cross_origin_no_sandbox',
      message: 'Cross-origin <iframe> without sandbox attribute (' + crossOriginNoSandbox.length + ')',
      severity: 'warning',
      detail: 'Add sandbox="allow-scripts allow-same-origin" (or stricter) to limit what the iframe can do.\n' +
        crossOriginNoSandbox.slice(0, 3).map(function(f) {
          var s = f.getAttribute('src') || '';
          return s.length > 80 ? s.substring(0, 80) + '…' : s;
        }).join('\n'),
      highlight: true
    });
  }

  // iframe without loading="lazy" (all iframes, not just video)
  var iframesNoLazy = iframes.filter(function(f) {
    return f.getAttribute('loading') !== 'lazy';
  });
  if (iframesNoLazy.length > 0) {
    issues.push({
      type: 'iframe_no_lazy_loading',
      message: '<iframe> without loading="lazy" (' + iframesNoLazy.length + ')',
      severity: 'notice',
      detail: 'Lazy loading iframes improves page load performance. Add loading="lazy" to all iframes not needed immediately.',
      highlight: true
    });
  }

  // iframe sandbox permissions — overly permissive sandbox
  var sandboxIframes = iframes.filter(function(f) {
    return f.hasAttribute('sandbox');
  });
  var overlyPermissive = sandboxIframes.filter(function(f) {
    var s = (f.getAttribute('sandbox') || '').split(/\s+/);
    return s.indexOf('allow-scripts') !== -1 &&
           s.indexOf('allow-same-origin') !== -1 &&
           s.indexOf('allow-forms') !== -1 &&
           s.indexOf('allow-popups') !== -1;
  });
  if (overlyPermissive.length > 0) {
    issues.push({
      type: 'iframe_sandbox_overly_permissive',
      message: '<iframe> with overly permissive sandbox (' + overlyPermissive.length + ')',
      severity: 'notice',
      detail: 'Sandbox allows scripts, same-origin, forms, and popups — nearly equivalent to no sandbox. Consider restricting permissions.'
    });
  }

  // iframe allow attribute — dangerous permissions
  var allowIframes = iframes.filter(function(f) {
    var allow = (f.getAttribute('allow') || '').toLowerCase();
    return allow.indexOf('camera') !== -1 || allow.indexOf('microphone') !== -1 ||
           allow.indexOf('geolocation') !== -1 || allow.indexOf('payment') !== -1;
  });
  if (allowIframes.length > 0) {
    issues.push({
      type: 'iframe_sensitive_permissions',
      message: '<iframe> with sensitive permissions (camera/microphone/geolocation/payment) (' + allowIframes.length + ')',
      severity: 'warning',
      detail: 'Review whether the iframe truly needs access to sensitive device capabilities.'
    });
  }

  // iframe dimensions — missing width/height and no CSS sizing (CLS risk)
  var iframeNoDims = iframes.filter(function(f) {
    if (f.hasAttribute('width') || f.hasAttribute('height')) return false;
    try {
      var cs = window.getComputedStyle(f);
      var ar = cs.aspectRatio;
      if (ar && ar !== 'auto') return false;
      if (cs.width !== '0px' && cs.height !== '0px') return false;
    } catch(e) {}
    return true;
  });
  if (iframeNoDims.length > 0) {
    issues.push({
      type: 'iframe_no_dimensions',
      message: '<iframe> without width/height or CSS sizing (' + iframeNoDims.length + ') — CLS risk',
      severity: 'notice',
      detail: 'Set explicit width/height attributes or CSS dimensions to prevent layout shift.'
    });
  }

  // iframe hidden (width/height = 0) — likely tracking
  var hiddenIframes = iframes.filter(function(f) {
    var w = f.getAttribute('width');
    var h = f.getAttribute('height');
    if (w === '0' && h === '0') return true;
    try {
      var cs = window.getComputedStyle(f);
      if (cs.display === 'none' || cs.visibility === 'hidden') return true;
      if (parseInt(cs.width, 10) === 0 && parseInt(cs.height, 10) === 0) return true;
    } catch(e) {}
    return false;
  });
  if (hiddenIframes.length > 0) {
    issues.push({
      type: 'iframe_hidden',
      message: 'Hidden <iframe> elements (' + hiddenIframes.length + ') — possible tracking',
      severity: 'notice',
      detail: 'Hidden iframes are often used for analytics, ads, or pixel tracking. Review their purpose.'
    });
  }

  // iframe deprecated scrolling attribute
  var scrollingIframes = Array.prototype.slice.call(document.querySelectorAll('iframe[scrolling]'));
  if (scrollingIframes.length > 0) {
    issues.push({
      type: 'iframe_deprecated_scrolling',
      message: '<iframe> with deprecated scrolling attribute (' + scrollingIframes.length + ')',
      severity: 'notice',
      detail: 'Use CSS overflow property instead of the deprecated scrolling attribute.'
    });
  }

  // ── Video ───────────────────────────────────────────────────────────────────
  var videos = Array.prototype.slice.call(document.querySelectorAll('video'));

  var noTrack = videos.filter(function(v) {
    return !v.querySelector('track[kind="captions"], track[kind="subtitles"]');
  });
  if (noTrack.length > 0) {
    issues.push({
      type: 'video_no_captions',
      message: '<video> without captions (<track kind="captions">) (' + noTrack.length + ')',
      severity: 'warning',
      highlight: true
    });
  }

  var unmutedAutoplay = videos.filter(function(v) {
    return v.hasAttribute('autoplay') && !v.hasAttribute('muted');
  });
  if (unmutedAutoplay.length > 0) {
    issues.push({
      type: 'video_autoplay_unmuted',
      message: '<video autoplay> without muted attribute (' + unmutedAutoplay.length + ')',
      severity: 'warning',
      detail: 'Browsers block autoplay with sound'
    });
  }

  var eagerLoad = videos.filter(function(v) {
    // Skip autoplay videos — they need eager loading by design
    if (v.hasAttribute('autoplay')) return false;
    var p = v.getAttribute('preload');
    return p === 'auto' || p === null || p === '';
  });
  if (eagerLoad.length > 0) {
    issues.push({
      type: 'video_eager_preload',
      message: '<video> without preload="none" or "metadata" (' + eagerLoad.length + ')',
      severity: 'notice',
      detail: 'Browser may download the entire video unnecessarily. Set preload="metadata" or preload="none".',
      highlight: true
    });
  }

  // ── Audio ───────────────────────────────────────────────────────────────────
  var audios = Array.prototype.slice.call(document.querySelectorAll('audio'));

  var audioEager = audios.filter(function(a) {
    if (a.hasAttribute('autoplay')) return false;
    var p = a.getAttribute('preload');
    return p === 'auto' || p === null || p === '';
  });
  if (audioEager.length > 0) {
    issues.push({
      type: 'audio_eager_preload',
      message: '<audio> without preload="none" or "metadata" (' + audioEager.length + ')',
      severity: 'notice',
      detail: 'Browser may download the entire audio file unnecessarily.'
    });
  }

  var audioAutoplayUnmuted = audios.filter(function(a) {
    return a.hasAttribute('autoplay') && !a.hasAttribute('muted');
  });
  if (audioAutoplayUnmuted.length > 0) {
    issues.push({
      type: 'audio_autoplay_unmuted',
      message: '<audio autoplay> without muted attribute (' + audioAutoplayUnmuted.length + ')',
      severity: 'warning',
      detail: 'Browsers block autoplay with sound.'
    });
  }

  // ── Video + Audio shared checks ─────────────────────────────────────────────
  var allMedia = videos.concat(audios);

  // Missing poster on video
  var videoNoPoster = videos.filter(function(v) {
    return !v.hasAttribute('poster');
  });
  if (videoNoPoster.length > 0) {
    issues.push({
      type: 'video_no_poster',
      message: '<video> without poster image (' + videoNoPoster.length + ')',
      severity: 'notice',
      detail: 'A poster image provides a visual placeholder before video playback starts.',
      highlight: true
    });
  }

  // Missing controls on video/audio (unless autoplay)
  var noControls = allMedia.filter(function(m) {
    return !m.hasAttribute('controls') && !m.hasAttribute('autoplay');
  });
  if (noControls.length > 0) {
    issues.push({
      type: 'media_no_controls',
      message: 'Media elements without controls attribute (' + noControls.length + ')',
      severity: 'notice',
      detail: 'Without controls, users cannot interact with the media unless custom JS controls are provided.'
    });
  }

  // playsinline missing on video (mobile fullscreen issue)
  var videoNoPlaysinline = videos.filter(function(v) {
    return !v.hasAttribute('playsinline') && !v.hasAttribute('autoplay');
  });
  if (videoNoPlaysinline.length > 0) {
    issues.push({
      type: 'video_no_playsinline',
      message: '<video> without playsinline attribute (' + videoNoPlaysinline.length + ')',
      severity: 'notice',
      detail: 'Without playsinline, iOS Safari will force fullscreen playback. Add playsinline for inline video.'
    });
  }

  // <source> elements without type attribute (prevents early negotiation)
  var mediaSources = document.querySelectorAll('video source, audio source');
  var sourceNoType = [];
  Array.prototype.forEach.call(mediaSources, function(s) {
    if (!s.hasAttribute('type')) {
      sourceNoType.push(s.getAttribute('src') || '(no src)');
    }
  });
  if (sourceNoType.length > 0) {
    issues.push({
      type: 'media_source_no_type',
      message: '<source> without type attribute (' + sourceNoType.length + ')',
      severity: 'notice',
      detail: 'Adding type="video/mp4" (or other MIME) enables early content negotiation, avoiding extra requests.'
    });
  }

  // <source> elements without src
  var sourceNoSrc = [];
  Array.prototype.forEach.call(mediaSources, function(s) {
    if (!s.hasAttribute('src') && !s.hasAttribute('srcset')) {
      sourceNoSrc.push(s.parentElement.tagName.toLowerCase());
    }
  });
  if (sourceNoSrc.length > 0) {
    issues.push({
      type: 'media_source_no_src',
      message: '<source> without src or srcset (' + sourceNoSrc.length + ')',
      severity: 'warning',
      detail: 'Empty <source> elements serve no purpose and may indicate a configuration error.'
    });
  }

  // <track> elements without srclang or label
  var tracks = document.querySelectorAll('track');
  var trackBad = [];
  Array.prototype.forEach.call(tracks, function(t) {
    if (!t.hasAttribute('srclang')) {
      trackBad.push('missing srclang');
    } else if (!t.hasAttribute('label')) {
      trackBad.push('missing label (srclang="' + t.getAttribute('srclang') + '")');
    }
  });
  if (trackBad.length > 0) {
    issues.push({
      type: 'track_missing_attrs',
      message: '<track> missing srclang or label (' + trackBad.length + ')',
      severity: 'notice',
      detail: 'srclang is required. label is recommended for accessibility.\n' + trackBad.slice(0, 5).join('\n')
    });
  }

  // Heavy media via PerformanceResourceTiming
  try {
    var resMap = {};
    performance.getEntriesByType('resource').forEach(function(r) {
      var size = r.transferSize > 0 ? r.transferSize : r.encodedBodySize;
      if (size > 0) resMap[r.name.replace(/#.*$/, '')] = size;
    });
    var heavyMediaKb = (p && p.heavy_media_kb) || 2048;
    var heavyMedia = allMedia.filter(function(m) {
      var sources = m.querySelectorAll('source');
      var urls = [];
      if (m.src && m.src !== window.location.href) urls.push(m.src.replace(/#.*$/, ''));
      Array.prototype.forEach.call(sources, function(s) {
        var src = s.getAttribute('src');
        if (src) urls.push(src.replace(/#.*$/, ''));
      });
      return urls.some(function(u) { return resMap[u] && resMap[u] > heavyMediaKb * 1024; });
    });
    if (heavyMedia.length > 0) {
      issues.push({
        type: 'heavy_media',
        message: 'Heavy media files > ' + heavyMediaKb + ' KB (' + heavyMedia.length + ')',
        severity: 'notice',
        detail: heavyMedia.slice(0, 5).map(function(m) {
          var src = m.src || (m.querySelector('source') ? m.querySelector('source').getAttribute('src') : '');
          var name = src.split('/').pop().split('?')[0];
          var size = resMap[src.replace(/#.*$/, '')];
          return m.tagName.toLowerCase() + ' ' + name + ' (' + Math.round(size / 1024) + ' KB)';
        }).join('\n')
      });
    }
  } catch(e) {}

  // ── Overview ────────────────────────────────────────────────────────────────
  issues.unshift({
    type: 'media_overview',
    message: 'Media overview',
    severity: 'info',
    detail: [
      'iFrames          ' + iframes.length,
      'Videos           ' + videos.length,
      'Audio            ' + audios.length,
      'YouTube/Vimeo    ' + videoIframes.length,
      'With captions    ' + videos.filter(function(v) { return !!v.querySelector('track[kind="captions"], track[kind="subtitles"]'); }).length + ' / ' + videos.filter(function(v) { return !v.querySelector('track[kind="captions"], track[kind="subtitles"]'); }).length + ' without',
      'With poster      ' + videos.filter(function(v) { return v.hasAttribute('poster'); }).length + ' / ' + videos.filter(function(v) { return !v.hasAttribute('poster'); }).length + ' without',
      'With controls    ' + allMedia.filter(function(m) { return m.hasAttribute('controls'); }).length + ' / ' + allMedia.filter(function(m) { return !m.hasAttribute('controls'); }).length + ' without'
    ].join('\n')
  });

  return { id: 'media', name: 'Video / iFrame', issues: issues };
}
