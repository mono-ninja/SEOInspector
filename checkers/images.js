// CDN patterns — defined outside to avoid recreation on each call
var IMAGE_CDN_PATTERNS = [
  'cloudfront.net', 'fastly.net', 'akamaized.net', 'akamai.net',
  'imgix.net', 'cloudinary.com', 'imagekit.io', 'twic.pics',
  'cloudflare.com', 'cf-ipfs.com', 'cdn.jsdelivr.net',
  'wp.com', 'statically.io', 'bunnycdn.com', 'bunny.net',
  'gstatic.com', 'googleusercontent.com', 'amazonaws.com',
  'digitaloceanspaces.com', 'r2.dev',
  'imgdelivery.net', 'cdninstagram.com'
];

function isCdnUrl(src) {
  var lower = src.toLowerCase();
  return IMAGE_CDN_PATTERNS.some(function(cdn) { return lower.indexOf(cdn) !== -1; });
}

function isModernFormat(src) {
  var s = src.toLowerCase().split('?')[0];
  return s.slice(-5) === '.webp' || s.slice(-5) === '.avif' || s.slice(-4) === '.svg';
}

function getImgFilename(alt, src) {
  if (!src || !alt) return false;
  var name = src.split('?')[0].split('/').pop().toLowerCase();
  name = name.replace(/\.[^.]+$/, '');
  var cleanAlt = alt.trim().toLowerCase().replace(/\.[^.]+$/, '');
  return cleanAlt === name;
}

function isInViewport(el) {
  try {
    var rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.left < window.innerWidth &&
           rect.bottom > 0 && rect.right > 0;
  } catch(e) { return false; }
}

function normalizeResUrl(src) {
  return src.replace(/#.*$/, '');
}

function runImagesChecker(p) {
  var issues = [];
  var params = p || {};

  var imgs = document.querySelectorAll('img');
  var imgList = Array.prototype.slice.call(imgs);

  // Filter out data: URIs
  var realImgs = imgList.filter(function(img) {
    var src = img.getAttribute('src') || '';
    return src.indexOf('data:') !== 0;
  });

  var missingAlt = [];
  var emptyAlt = [];
  var longAlt = [];
  var missingDimensions = [];
  var notModern = [];
  var srcsetWithoutSizes = [];
  var altIsFilename = [];

  realImgs.forEach(function(img) {
    var src = img.getAttribute('src') || '';
    var alt = img.getAttribute('alt');
    var role = img.getAttribute('role') || '';

    // Missing alt attribute
    if (alt === null) {
      missingAlt.push(src || '(no src)');
    } else if (alt.trim() === '') {
      // Empty alt — only flag if not explicitly decorative
      if (role !== 'presentation' && role !== 'none') {
        emptyAlt.push(src || '(no src)');
      }
    } else if (alt.length > 125) {
      longAlt.push({ src: src, length: alt.length });
    } else if (getImgFilename(alt, src)) {
      altIsFilename.push({ src: src, alt: alt });
    }

    // Missing width or height — skip if CSS aspect-ratio is set (prevents CLS without attributes)
    if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
      var ar = window.getComputedStyle(img).aspectRatio;
      if (!ar || ar === 'auto') {
        missingDimensions.push(src || '(no src)');
      }
    }

    // Not modern format — skip <img> that is a fallback inside <picture> with WebP/AVIF <source>
    var srcLower = src.toLowerCase().split('?')[0];
    if (src && !isModernFormat(src)) {
      var pictureParent = img.closest('picture');
      var hasModernSource = pictureParent && Array.prototype.some.call(
        pictureParent.querySelectorAll('source'),
        function(s) {
          var t = (s.getAttribute('type') || '').toLowerCase();
          return t === 'image/webp' || t === 'image/avif';
        }
      );
      if (!hasModernSource) {
        notModern.push(src);
      }
    }

    // srcset without sizes
    if (img.hasAttribute('srcset') && !img.hasAttribute('sizes')) {
      srcsetWithoutSizes.push(src || '(no src)');
    }
  });

  // CDN detection
  var cdnImgs = realImgs.filter(function(img) {
    return isCdnUrl(img.getAttribute('src') || '');
  }).length;

  // Local = not CDN, not external (relative URL or same hostname)
  var localImgs = realImgs.filter(function(img) {
    var src = img.getAttribute('src') || '';
    return src &&
      !isCdnUrl(src) &&
      (src.indexOf('//') === -1 || src.indexOf(window.location.hostname) !== -1 || src.indexOf('/') === 0);
  }).length;

  // Info: images overview — includes missing alt count for quick triage
  var _webpAvif = realImgs.filter(function(img) {
    return isModernFormat(img.getAttribute('src') || '');
  }).length;
  var _lazyImgs = realImgs.filter(function(img) { return img.getAttribute('loading') === 'lazy'; }).length;
  var _withAlt = realImgs.filter(function(img) { var a = img.getAttribute('alt'); return a !== null && a.trim() !== ''; }).length;
  var _withSrcset = realImgs.filter(function(img) { return img.hasAttribute('srcset'); }).length;
  var _missingAltTotal = missingAlt.length + emptyAlt.length;
  issues.push({
    type: 'images_overview',
    message: 'Images overview (' + realImgs.length + ')',
    severity: 'info',
    detail: [
      'Total images       ' + realImgs.length,
      'WebP / AVIF / SVG  ' + _webpAvif,
      'With alt           ' + _withAlt + (_missingAltTotal > 0 ? ' / missing or empty ' + _missingAltTotal : ''),
      'Lazy loading       ' + _lazyImgs,
      'With srcset        ' + _withSrcset,
      'Via CDN            ' + cdnImgs + ' / local ' + localImgs
    ].join('\n')
  });

  // Warn if large images are not served via CDN
  if (realImgs.length >= 5 && cdnImgs === 0) {
    issues.push({
      type: 'no_image_cdn',
      message: 'Images are not served via CDN',
      severity: 'notice',
      detail: 'A CDN speeds up image delivery for geographically distributed visitors. Consider Cloudflare Images, Cloudinary, or Imgix.'
    });
  }

  // Large images without srcset — use rendered width (works for lazy images too)
  var noSrcset = realImgs.filter(function(img) {
    var src = img.getAttribute('src') || '';
    if (!src || src.indexOf('data:') === 0) return false;
    var w = img.getBoundingClientRect().width || img.naturalWidth || 0;
    return w >= 400 && !img.hasAttribute('srcset') && !img.closest('picture');
  });
  if (noSrcset.length >= 3) {
    issues.push({
      type: 'missing_srcset',
      message: 'Large images without srcset attribute (' + noSrcset.length + ')',
      severity: 'notice',
      detail: 'srcset allows the browser to load the optimally sized image for the device.\n' +
        noSrcset.slice(0, 5).map(function(img) { return img.getAttribute('src') || ''; }).join('\n')
    });
  }

  // First image loading=lazy (LCP candidate)
  if (realImgs.length > 0) {
    var firstImg = realImgs[0];
    if (firstImg.getAttribute('loading') === 'lazy') {
      issues.push({
        type: 'first_image_lazy',
        message: 'First image (LCP candidate) has loading="lazy" attribute',
        severity: 'notice',
        detail: 'Src: ' + (firstImg.getAttribute('src') || '(no src)') + '. This may delay LCP.',
        highlight: true
      });
    }
  }

  // First non-lazy image should have fetchpriority="high" (LCP candidate)
  // Also flag fetchpriority="low" which is actively harmful
  if (realImgs.length > 0) {
    var firstVisible = null;
    for (var fvi = 0; fvi < realImgs.length; fvi++) {
      if (realImgs[fvi].getAttribute('loading') !== 'lazy') { firstVisible = realImgs[fvi]; break; }
    }
    if (firstVisible) {
      var fp = firstVisible.getAttribute('fetchpriority');
      if (!fp) {
        issues.push({
          type: 'lcp_image_no_fetchpriority',
          message: 'First image missing fetchpriority="high" attribute',
          severity: 'notice',
          detail: 'Add fetchpriority="high" to the LCP candidate image to speed up loading.\nSrc: ' + (firstVisible.getAttribute('src') || '(no src)'),
          highlight: true
        });
      } else if (fp === 'low') {
        issues.push({
          type: 'lcp_image_fetchpriority_low',
          message: 'First image has fetchpriority="low" — actively delays LCP',
          severity: 'warning',
          detail: 'Change fetchpriority to "high" on the LCP candidate.\nSrc: ' + (firstVisible.getAttribute('src') || '(no src)'),
          highlight: true
        });
      }
    }
  }

  // LCP image preload check — look for <link rel="preload" as="image" href="...">
  if (realImgs.length > 0) {
    var lcpCandidate = firstVisible || firstImg;
    var lcpSrc = lcpCandidate.getAttribute('src') || '';
    if (lcpSrc) {
      var preloadLinks = document.querySelectorAll('link[rel="preload"][as="image"]');
      var hasPreload = false;
      Array.prototype.some.call(preloadLinks, function(link) {
        if (link.getAttribute('href') === lcpSrc) { hasPreload = true; return true; }
        return false;
      });
      if (!hasPreload) {
        issues.push({
          type: 'lcp_image_no_preload',
          message: 'LCP candidate image not preloaded',
          severity: 'notice',
          detail: 'Add <link rel="preload" as="image" href="..."> in <head> for faster LCP.\nSrc: ' + lcpSrc
        });
      }
    }
  }

  // decoding="async" missing — check all images, not just large ones
  var noDecoding = realImgs.filter(function(img) {
    var src = img.getAttribute('src') || '';
    if (!src) return false;
    return img.getAttribute('decoding') !== 'async';
  });
  if (noDecoding.length > 0) {
    issues.push({
      type: 'missing_decoding_async',
      message: 'Images missing decoding="async" (' + noDecoding.length + ')',
      severity: 'notice',
      detail: 'decoding="async" lets the browser decode images off the main thread, reducing jank.\n' +
        noDecoding.slice(0, 5).map(function(img) { return img.getAttribute('src') || ''; }).join('\n'),
      highlight: true
    });
  }

  if (missingAlt.length > 0) {
    issues.push({
      type: 'missing_alt',
      message: 'Images missing alt attribute (' + missingAlt.length + ')',
      severity: 'warning',
      detail: missingAlt.slice(0, 5).join('\n') + (missingAlt.length > 5 ? '\n...and ' + (missingAlt.length - 5) + ' more' : ''),
      highlight: true
    });
  }

  if (emptyAlt.length > 0) {
    issues.push({
      type: 'empty_alt',
      message: 'Images with empty alt attribute (' + emptyAlt.length + ')',
      severity: 'notice',
      detail: emptyAlt.slice(0, 5).join('\n') + (emptyAlt.length > 5 ? '\n...and ' + (emptyAlt.length - 5) + ' more' : ''),
      highlight: true
    });
  }

  longAlt.forEach(function(item) {
    issues.push({
      type: 'long_alt',
      message: 'Image alt text is too long (more than 125 chars)',
      severity: 'notice',
      detail: 'Length: ' + item.length + ' chars. Src: ' + item.src
    });
  });

  if (missingDimensions.length > 0) {
    issues.push({
      type: 'missing_dimensions',
      message: 'Images missing width/height attributes (' + missingDimensions.length + ') — CLS risk',
      severity: 'notice',
      detail: missingDimensions.slice(0, 5).join('\n') + (missingDimensions.length > 5 ? '\n...and ' + (missingDimensions.length - 5) + ' more' : ''),
      highlight: true
    });
  }

  // width/height attribute mismatch vs actual aspect ratio
  var wrongAspectRatio = [];
  realImgs.forEach(function(img) {
    if (!img.hasAttribute('width') || !img.hasAttribute('height')) return;
    var w = parseInt(img.getAttribute('width'), 10);
    var h = parseInt(img.getAttribute('height'), 10);
    if (!w || !h) return;
    var attrRatio = w / h;
    var natW = img.naturalWidth;
    var natH = img.naturalHeight;
    if (!natW || !natH) return;
    var realRatio = natW / natH;
    if (Math.abs(attrRatio - realRatio) > 0.1) {
      wrongAspectRatio.push(img.getAttribute('src') || '(no src)');
    }
  });
  if (wrongAspectRatio.length > 0) {
    issues.push({
      type: 'wrong_aspect_ratio',
      message: 'Images with mismatched width/height vs actual aspect ratio (' + wrongAspectRatio.length + ') — CLS risk',
      severity: 'notice',
      detail: wrongAspectRatio.slice(0, 5).join('\n') + (wrongAspectRatio.length > 5 ? '\n...and ' + (wrongAspectRatio.length - 5) + ' more' : ''),
      highlight: true
    });
  }

  if (notModern.length > 0) {
    issues.push({
      type: 'not_modern_format',
      message: 'Images not in modern WebP/AVIF/SVG format (' + notModern.length + ')',
      severity: 'notice',
      detail: notModern.slice(0, 5).join('\n') + (notModern.length > 5 ? '\n...and ' + (notModern.length - 5) + ' more' : '')
    });
  }

  if (srcsetWithoutSizes.length > 0) {
    issues.push({
      type: 'srcset_without_sizes',
      message: 'Images with srcset but no sizes attribute (' + srcsetWithoutSizes.length + ')',
      severity: 'notice',
      detail: 'Without sizes, the browser assumes the image is 100vw wide and may download an unnecessarily large file on mobile.\n' + srcsetWithoutSizes.slice(0, 5).join('\n') + (srcsetWithoutSizes.length > 5 ? '\n...and ' + (srcsetWithoutSizes.length - 5) + ' more' : '')
    });
  }

  // Broken images — img.complete = true + naturalWidth = 0 means load failed
  // Exclude browser default broken image icon src
  var brokenImgs = realImgs.filter(function(img) {
    var src = img.getAttribute('src') || '';
    if (!src) return false;
    if (src === document.location.href) return false;
    return img.complete && img.naturalWidth === 0 && img.naturalHeight === 0;
  });
  if (brokenImgs.length > 0) {
    issues.push({
      type: 'broken_images',
      message: 'Broken (failed to load) images (' + brokenImgs.length + ')',
      severity: 'warning',
      detail: brokenImgs.map(function(img) { return img.getAttribute('src') || '(no src)'; }).slice(0, 5).join('\n') + (brokenImgs.length > 5 ? '\n...and ' + (brokenImgs.length - 5) + ' more' : ''),
      highlight: true
    });
  }

  // Image file sizes via PerformanceResourceTiming
  // encodedBodySize is used as fallback: transferSize is 0 for cached resources
  try {
    var resMap = {};
    performance.getEntriesByType('resource').forEach(function(r) {
      var size = r.transferSize > 0 ? r.transferSize : r.encodedBodySize;
      if (size > 0) resMap[normalizeResUrl(r.name)] = size;
    });
    var heavyKb = params.heavy_image_kb || 100;
    var heavyImgs = realImgs.filter(function(img) {
      var src = normalizeResUrl(img.src || img.getAttribute('src') || '');
      return src && resMap[src] && resMap[src] > heavyKb * 1024;
    });
    if (heavyImgs.length > 0) {
      issues.push({
        type: 'heavy_image',
        message: 'Images larger than ' + heavyKb + ' KB (' + heavyImgs.length + ')',
        severity: 'notice',
        detail: heavyImgs.slice(0, 5).map(function(img) {
          var src = normalizeResUrl(img.src || img.getAttribute('src') || '');
          return src.split('/').pop().split('?')[0] + ' (' + Math.round(resMap[src] / 1024) + ' KB)';
        }).join('\n')
      });
    }
  } catch(e) {}

  // Duplicate images — same src used multiple times
  var srcCounts = {};
  realImgs.forEach(function(img) {
    var src = img.getAttribute('src') || '';
    if (src) srcCounts[src] = (srcCounts[src] || 0) + 1;
  });
  var duplicateSrcs = [];
  var srcKeys = Object.keys(srcCounts);
  srcKeys.forEach(function(k) { if (srcCounts[k] > 1) duplicateSrcs.push(k + ' (' + srcCounts[k] + 'x)'); });
  if (duplicateSrcs.length > 0) {
    issues.push({
      type: 'duplicate_images',
      message: 'Duplicate image sources (' + duplicateSrcs.length + ')',
      severity: 'notice',
      detail: 'Same image loaded multiple times. Consider reusing <img> references or using <link rel="preload">.\n' +
        duplicateSrcs.slice(0, 5).join('\n')
    });
  }

  // alt text equals filename — not descriptive
  if (altIsFilename.length > 0) {
    issues.push({
      type: 'alt_is_filename',
      message: 'Images with alt equal to filename (' + altIsFilename.length + ')',
      severity: 'notice',
      detail: 'Alt text should be descriptive, not just the filename.\n' +
        altIsFilename.slice(0, 5).map(function(i) { return i.src + ' alt="' + i.alt + '"'; }).join('\n')
    });
  }

  // Viewport images with loading="lazy" — may delay rendering
  var viewportLazy = realImgs.filter(function(img) {
    return img.getAttribute('loading') === 'lazy' && isInViewport(img);
  });
  if (viewportLazy.length > 0) {
    issues.push({
      type: 'viewport_lazy_images',
      message: 'Images in viewport with loading="lazy" (' + viewportLazy.length + ')',
      severity: 'notice',
      detail: 'Images visible in the initial viewport should not use lazy loading as it delays rendering.\n' +
        viewportLazy.slice(0, 5).map(function(img) { return img.getAttribute('src') || '(no src)'; }).join('\n'),
      highlight: true
    });
  }

  // <picture> <source> validation — each source should have media or sizes
  var pictureSourcesBad = [];
  var pictures = document.querySelectorAll('picture');
  Array.prototype.forEach.call(pictures, function(pic) {
    var sources = pic.querySelectorAll('source');
    Array.prototype.forEach.call(sources, function(s) {
      if (!s.hasAttribute('media') && !s.hasAttribute('sizes') && !s.hasAttribute('type')) {
        pictureSourcesBad.push(s.getAttribute('srcset') || '(no srcset)');
      }
    });
  });
  if (pictureSourcesBad.length > 0) {
    issues.push({
      type: 'picture_source_no_media',
      message: '<picture> <source> without media/sizes/type (' + pictureSourcesBad.length + ')',
      severity: 'notice',
      detail: 'Each <source> should specify when it applies via media, sizes, or type attribute.\n' +
        pictureSourcesBad.slice(0, 5).join('\n')
    });
  }

  // <figure> without <figcaption>
  var figuresWithoutCaption = Array.prototype.filter.call(
    document.querySelectorAll('figure'),
    function(fig) { return !fig.querySelector('figcaption'); }
  );
  if (figuresWithoutCaption.length > 0) {
    issues.push({
      type: 'figure_no_caption',
      message: '<figure> without <figcaption> (' + figuresWithoutCaption.length + ')',
      severity: 'notice',
      detail: 'Image captions improve accessibility and SEO.'
    });
  }

  // <picture> without <img> fallback
  var pictureNoImg = Array.prototype.filter.call(
    document.querySelectorAll('picture'),
    function(pic) { return !pic.querySelector('img'); }
  );
  if (pictureNoImg.length > 0) {
    issues.push({
      type: 'picture_no_img_fallback',
      message: '<picture> without <img> fallback (' + pictureNoImg.length + ')',
      severity: 'warning',
      detail: 'The <picture> element must contain an <img> as a fallback.'
    });
  }

  // Inline SVG size > 5KB
  var largeSvgs = Array.prototype.filter.call(
    document.querySelectorAll('svg'),
    function(svg) { return (svg.outerHTML || '').length > 5120; }
  );
  if (largeSvgs.length > 0) {
    issues.push({
      type: 'large_inline_svg',
      message: 'Large inline SVGs (> 5 KB): ' + largeSvgs.length,
      severity: 'notice',
      detail: 'Move large SVGs to external files for caching.'
    });
  }

  // Inline SVG accessibility — should have role="img" and aria-label/title
  var svgNoA11y = Array.prototype.filter.call(
    document.querySelectorAll('svg'),
    function(svg) {
      if (svg.getAttribute('aria-hidden') === 'true') return false;
      if (svg.getAttribute('role') === 'img') return false;
      if (svg.getAttribute('aria-label')) return false;
      if (svg.querySelector('title')) return false;
      return true;
    }
  );
  if (svgNoA11y.length > 0) {
    issues.push({
      type: 'svg_no_accessibility',
      message: 'Inline SVGs missing accessibility attributes (' + svgNoA11y.length + ')',
      severity: 'notice',
      detail: 'Add role="img" and aria-label, or a <title> element inside each SVG.'
    });
  }

  // Low-quality image filenames — expanded patterns
  var badFilenameImgs = realImgs.filter(function(img) {
    var src = (img.getAttribute('src') || '').split('?')[0].split('/').pop().toLowerCase();
    var name = src.replace(/\.[^.]+$/, '');
    return name && (
      /^\d+$/.test(name) ||
      /^img[-_]?\d+$/i.test(name) ||
      /^image[-_]?\d+$/i.test(name) ||
      /^photo[-_]?\d+$/i.test(name) ||
      /^dsc\d+$/i.test(name) ||
      /^screenshot[-_]?\d+$/i.test(name) ||
      /^img_\d+$/i.test(name) ||
      /^ph_\d+$/i.test(name) ||
      /^whatsapp.image/i.test(name) ||
      /^capture/i.test(name) ||
      /^untitled/i.test(name) ||
      /^pic[-_]?\d+$/i.test(name)
    );
  });
  if (badFilenameImgs.length > 0) {
    issues.push({
      type: 'poor_image_filename',
      message: 'Images with poor filenames (' + badFilenameImgs.length + ')',
      severity: 'notice',
      detail: badFilenameImgs.slice(0, 5).map(function(img) { return img.getAttribute('src') || ''; }).join('\n')
    });
  }

  // CSS background-image on content elements (crawlers can't index CSS background images)
  try {
    var bgContentEls = [];
    var checked = 0;
    var blockEls = document.querySelectorAll('div, section, article, header, main, aside');
    for (var bi = 0; bi < blockEls.length && checked < 50; bi++) {
      var bel = blockEls[bi];
      var textLen = (bel.innerText || '').trim().length;
      if (textLen < 50) continue;
      checked++;
      var bg = window.getComputedStyle(bel).backgroundImage;
      if (bg && bg !== 'none' && bg.indexOf('url(') !== -1) {
        bgContentEls.push(bel);
      }
    }
    if (bgContentEls.length > 0) {
      issues.push({
        type: 'background_image_content',
        message: 'CSS background-image on content elements (' + bgContentEls.length + ') — search crawlers cannot index',
        severity: 'notice',
        detail: 'Use <img alt="..."> instead of background-image for content images.\n' +
          bgContentEls.slice(0, 5).map(function(el) {
            var cls = (el.className && typeof el.className === 'string' && el.className.trim())
              ? '.' + el.className.trim().split(/\s+/)[0] : '';
            var snippet = (el.innerText || '').trim().substring(0, 50).replace(/\n/g, ' ');
            return '<' + el.tagName.toLowerCase() + cls + '> «' + snippet + '…»';
          }).join('\n')
      });
    }
  } catch(e) {}

  return { id: 'images', name: 'Images', issues: issues };
}
