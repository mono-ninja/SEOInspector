// Valid og:type values
var VALID_OG_TYPES = {
  'article':1, 'book':1, 'profile':1, 'music.song':1, 'music.album':1,
  'music.playlist':1, 'music.radio_station':1, 'video.movie':1, 'video.episode':1,
  'video.tv_show':1, 'video.other':1, 'product':1, 'place':1,
  'event':1, 'group':1, 'organization':1, 'website':1, 'business.business':1,
  'business.restaurant':1, 'business.hotel':1, 'product.product':1,
  'restaurant':1, 'hotel':1, 'business':1
};

// Valid og:determiner values
var VALID_DETERMINERS = ['a', 'an', 'the', 'auto', 'none', ''];

function runOpenGraphChecker(p) {
  var issues = [];

  function getMeta(property) {
    var el = document.querySelector('meta[property="' + property + '"]') ||
             document.querySelector('meta[name="' + property + '"]');
    return el ? (el.getAttribute('content') || '') : null;
  }

  function getAllMeta(property) {
    var els = document.querySelectorAll('meta[property="' + property + '"], meta[name="' + property + '"]');
    var contents = [];
    Array.prototype.forEach.call(els, function(el) {
      var c = el.getAttribute('content');
      if (c) contents.push(c);
    });
    return contents;
  }

  // ── Collect all OG values ───────────────────────────────────────────────────
  var ogTitle       = getMeta('og:title');
  var ogDesc        = getMeta('og:description');
  var ogImage       = getMeta('og:image');
  var ogImages      = getAllMeta('og:image');
  var ogType        = getMeta('og:type');
  var ogUrl         = getMeta('og:url');
  var ogLocale      = getMeta('og:locale');
  var ogLocaleAlt   = getAllMeta('og:locale:alternate');
  var ogSiteName    = getMeta('og:site_name');
  var ogDeterminer  = getMeta('og:determiner');
  var ogVideo       = getMeta('og:video');
  var ogAudio       = getMeta('og:audio');
  var ogSeeAlso     = getMeta('og:see_also');
  var ogImageWidth  = getMeta('og:image:width');
  var ogImageHeight = getMeta('og:image:height');
  var ogImageType   = getMeta('og:image:type');
  var ogImageSecure = getMeta('og:image:secure_url');
  var ogVideoWidth  = getMeta('og:video:width');
  var ogVideoHeight = getMeta('og:video:height');
  var ogVideoType   = getMeta('og:video:type');
  var ogAudioType   = getMeta('og:audio:type');
  var ogDuration    = getMeta('og:video:duration') || getMeta('og:audio:duration');
  var fbAppId       = getMeta('fb:app_id');
  var fbAdmins      = getMeta('fb:admins');

  // Article namespace
  var artPublished  = getMeta('article:published_time');
  var artModified   = getMeta('article:modified_time');
  var artExpiration = getMeta('article:expiration_time');
  var artAuthor     = getMeta('article:author');
  var artSection    = getMeta('article:section');
  var artTags       = getAllMeta('article:tag');

  // HTML title and meta description for comparison
  var htmlTitle     = (document.title || '').trim();
  var metaDescEl    = document.querySelector('meta[name="description"]');
  var metaDesc      = metaDescEl ? (metaDescEl.getAttribute('content') || '') : null;
  var canonicalEl   = document.querySelector('link[rel="canonical"]');
  var canonicalUrl  = canonicalEl ? (canonicalEl.getAttribute('href') || '') : null;

  // ── Overview ────────────────────────────────────────────────────────────────
  var ogFieldsPresent = 0;
  var ogFieldsTotal = 14;
  [ogTitle, ogDesc, ogImage, ogType, ogUrl, ogLocale, ogSiteName, ogImageWidth, ogImageHeight,
   fbAppId, artPublished, artModified, artAuthor, artSection].forEach(function(v) {
    if (v !== null) ogFieldsPresent++;
  });

  issues.push({
    type: 'og_overview',
    message: 'Open Graph — overview',
    severity: 'info',
    detail: [
      'og:title           ' + (ogTitle       || '—'),
      'og:description     ' + (ogDesc        || '—'),
      'og:image           ' + (ogImage       || '—'),
      'og:image count     ' + ogImages.length,
      'og:image:width     ' + (ogImageWidth  || '—'),
      'og:image:height    ' + (ogImageHeight || '—'),
      'og:image:type      ' + (ogImageType   || '—'),
      'og:type            ' + (ogType        || '—'),
      'og:url             ' + (ogUrl         || '—'),
      'og:locale          ' + (ogLocale      || '—'),
      'og:locale:alternate' + (ogLocaleAlt.length > 0 ? ogLocaleAlt.join(', ') : '—'),
      'og:site_name       ' + (ogSiteName    || '—'),
      'og:determiner      ' + (ogDeterminer  !== null ? '"' + ogDeterminer + '"' : '—'),
      'og:video           ' + (ogVideo       || '—'),
      'og:audio           ' + (ogAudio       || '—'),
      'og:see_also        ' + (ogSeeAlso     || '—'),
      'fb:app_id          ' + (fbAppId       || '—'),
      'fb:admins          ' + (fbAdmins      || '—'),
      'article:published  ' + (artPublished  || '—'),
      'article:modified   ' + (artModified   || '—'),
      'article:author     ' + (artAuthor     || '—'),
      'article:section    ' + (artSection    || '—'),
      'article:tags       ' + (artTags.length > 0 ? artTags.join(', ') : '—'),
      'Fields filled      ' + ogFieldsPresent + '/' + ogFieldsTotal,
      'HTML <title>       ' + (htmlTitle     || '—'),
      'Meta description   ' + (metaDesc      || '—')
    ].join('\n')
  });

  // ── og:title ────────────────────────────────────────────────────────────────
  if (ogTitle === null) {
    issues.push({ type: 'missing_og_title', message: 'Missing og:title meta tag', severity: 'warning' });
  } else {
    if (ogTitle.length > 95) {
      issues.push({ type: 'long_og_title', message: 'og:title is too long (' + ogTitle.length + ' chars, max ~95)', severity: 'notice', detail: 'Facebook may truncate titles over 95 characters.\nValue: "' + ogTitle + '"' });
    }
    if (ogTitle.length < 10) {
      issues.push({ type: 'short_og_title', message: 'og:title is very short (' + ogTitle.length + ' chars)', severity: 'notice', detail: 'Short titles may not convey enough context in social previews.\nValue: "' + ogTitle + '"' });
    }
  }

  // og:title vs HTML <title> comparison
  if (ogTitle && htmlTitle) {
    var ogWords = ogTitle.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 3; });
    var htmlWords = htmlTitle.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 3; });
    var common = ogWords.filter(function(w) { return htmlWords.indexOf(w) !== -1; });
    if (ogWords.length > 0 && htmlWords.length > 0 && common.length === 0) {
      issues.push({
        type: 'og_title_mismatch_html',
        message: 'og:title and <title> share no common words',
        severity: 'notice',
        detail: 'og:title: "' + ogTitle + '"\n<title>: "' + htmlTitle + '"'
      });
    }
  }

  // ── og:description ──────────────────────────────────────────────────────────
  if (ogDesc === null) {
    issues.push({ type: 'missing_og_description', message: 'Missing og:description meta tag', severity: 'warning' });
  } else {
    if (ogDesc.length > 200) {
      issues.push({ type: 'long_og_description', message: 'og:description is too long (' + ogDesc.length + ' chars, max ~200)', severity: 'notice', detail: 'Facebook may truncate descriptions over 200 characters.\nValue: "' + ogDesc.substring(0, 100) + '…"' });
    }
    if (ogDesc.length < 20) {
      issues.push({ type: 'short_og_description', message: 'og:description is very short (' + ogDesc.length + ' chars)', severity: 'notice', detail: 'Short descriptions provide little context for social sharing.\nValue: "' + ogDesc + '"' });
    }
    // Check if description ends mid-sentence
    var lastChar = ogDesc.charAt(ogDesc.length - 1);
    if (ogDesc.length > 50 && lastChar !== '.' && lastChar !== '!' && lastChar !== '?' && lastChar !== '…') {
      issues.push({
        type: 'og_description_truncated',
        message: 'og:description appears to be cut off mid-sentence',
        severity: 'notice',
        detail: 'Description ends with "' + ogDesc.substring(ogDesc.length - 20) + '" — does not end with punctuation.'
      });
    }
  }

  // og:description vs meta description comparison
  if (ogDesc && metaDesc) {
    var ogDescWords = ogDesc.toLowerCase().split(/\s+/);
    var metaDescWords = metaDesc.toLowerCase().split(/\s+/);
    var ogInMeta = ogDescWords.filter(function(w) { return w.length > 4 && metaDescWords.indexOf(w) !== -1; }).length;
    var overlap = ogDescWords.length > 0 ? Math.round(ogInMeta / ogDescWords.length * 100) : 0;
    if (overlap > 80 && ogDescWords.length > 5) {
      issues.push({
        type: 'og_desc_same_as_meta_desc',
        message: 'og:description is nearly identical to meta description (' + overlap + '% overlap)',
        severity: 'notice',
        detail: 'Consider writing a more engaging, action-oriented description for social sharing.'
      });
    }
  }

  // ── og:image ────────────────────────────────────────────────────────────────
  if (ogImage === null) {
    issues.push({ type: 'missing_og_image', message: 'Missing og:image meta tag', severity: 'warning', detail: 'Without og:image, social platforms show a generic placeholder or scrape a random image.' });
  } else {
    // Absolute URL check
    if (ogImage.indexOf('http://') !== 0 && ogImage.indexOf('https://') !== 0) {
      issues.push({ type: 'relative_og_image', message: 'og:image is not an absolute URL', severity: 'warning', detail: 'Social platforms require absolute URLs. Current: "' + ogImage + '"' });
    }

    // HTTPS check
    if (ogImage.indexOf('http://') === 0) {
      issues.push({
        type: 'og_image_not_https',
        message: 'og:image uses HTTP instead of HTTPS',
        severity: 'notice',
        detail: 'Facebook and other platforms prefer HTTPS image URLs.\nCurrent: ' + ogImage
      });
    }

    // Image format check
    var imgExt = ogImage.toLowerCase().split('?')[0];
    imgExt = imgExt.substring(imgExt.lastIndexOf('.'));
    var validImgExts = { '.jpg':1, '.jpeg':1, '.png':1, '.gif':1, '.webp':1, '.bmp':1 };
    if (imgExt && !validImgExts[imgExt]) {
      issues.push({
        type: 'og_image_invalid_format',
        message: 'og:image may not be a supported image format (' + imgExt + ')',
        severity: 'notice',
        detail: 'Facebook supports JPG, PNG, GIF, WebP. Current: ' + ogImage
      });
    }

    // Dimensions check
    if (ogImageWidth !== null && ogImageHeight !== null) {
      var iW = parseInt(ogImageWidth, 10);
      var iH = parseInt(ogImageHeight, 10);
      if (isNaN(iW) || isNaN(iH)) {
        issues.push({ type: 'og_image_invalid_dimensions', message: 'og:image dimensions are not valid numbers', severity: 'notice', detail: 'Width: ' + ogImageWidth + ', Height: ' + ogImageHeight });
      } else {
        // Minimum 200x200
        if (iW < 200 || iH < 200) {
          issues.push({
            type: 'og_image_too_small',
            message: 'og:image dimensions too small (' + iW + '×' + iH + ' — minimum 200×200)',
            severity: 'warning',
            detail: 'Facebook requires minimum 200×200px. Recommended: 1200×630px.'
          });
        }

        // Recommended 1200x630
        if (iW < 1200 || iH < 630) {
          issues.push({
            type: 'og_image_not_recommended_size',
            message: 'og:image not recommended size (' + iW + '×' + iH + ' — recommended 1200×630)',
            severity: 'notice',
            detail: 'For best rendering on all devices, use 1200×630px (1.91:1 ratio).'
          });
        }

        // Aspect ratio check (1.91:1 ideal for Facebook)
        var ratio = iW / iH;
        var idealRatio = 1200 / 630; // ~1.91
        if (Math.abs(ratio - idealRatio) > 0.3) {
          issues.push({
            type: 'og_image_bad_aspect_ratio',
            message: 'og:image aspect ratio (' + ratio.toFixed(2) + ':1) differs from recommended 1.91:1',
            severity: 'notice',
            detail: 'Images with unusual aspect ratios may be cropped or letterboxed on social platforms.'
          });
        }

        // Square check for Instagram compatibility
        if (Math.abs(ratio - 1) > 0.1 && iW >= 1080 && iH >= 1080) {
          // Large but not square — fine, just info
        }
      }
    } else if (ogImageWidth === null || ogImageHeight === null) {
      issues.push({
        type: 'missing_og_image_dimensions',
        message: 'Missing og:image:width / og:image:height meta tags',
        severity: 'notice',
        detail: 'Specifying dimensions lets Facebook render the preview faster without downloading the image first.'
      });
    }

    // og:image:type check
    if (ogImageType !== null && ogImageType.indexOf('image/') !== 0) {
      issues.push({
        type: 'og_image_invalid_type',
        message: 'og:image:type should be a valid MIME type (e.g., image/jpeg)',
        severity: 'notice',
        detail: 'Current value: "' + ogImageType + '"'
      });
    }

    // og:image:secure_url — should match og:image for HTTPS
    if (ogImageSecure && ogImage && ogImage.indexOf('https://') === 0) {
      if (ogImageSecure === ogImage) {
        issues.push({
          type: 'og_image_secure_same_as_url',
          message: 'og:image:secure_url is identical to og:image (both HTTPS) — redundant',
          severity: 'notice',
          detail: 'og:image:secure_url is only needed when og:image uses HTTP.'
        });
      }
    }
  }

  // Multiple og:image
  if (ogImages.length > 1) {
    var validMultiImages = ogImages.filter(function(img) {
      return img.indexOf('http') === 0;
    });
    if (validMultiImages.length > 1) {
      issues.push({
        type: 'multiple_og_images',
        message: 'Multiple og:image tags found (' + validMultiImages.length + ')',
        severity: 'info',
        detail: 'Facebook supports multiple images for carousel-style previews.\n' + validMultiImages.slice(0, 3).join('\n')
      });
    }
  }

  // ── og:url ──────────────────────────────────────────────────────────────────
  if (ogUrl === null) {
    issues.push({ type: 'missing_og_url', message: 'Missing og:url meta tag', severity: 'notice' });
  } else {
    // Absolute URL check
    if (ogUrl.indexOf('http://') !== 0 && ogUrl.indexOf('https://') !== 0) {
      issues.push({ type: 'relative_og_url', message: 'og:url is not an absolute URL', severity: 'warning', detail: 'Current: "' + ogUrl + '"' });
    } else {
      // Normalize for comparison: strip fragment, trailing slash, and www
      var normalizeUrl = function(u) {
        return u.replace(/#.*$/, '').replace(/\/$/, '').replace(/^https?:\/\/www\./, 'https://');
      };
      var currentUrl = window.location.href.split('#')[0].replace(/\/$/, '').replace(/^https?:\/\/www\./, 'https://');
      var normalizedOgUrl = normalizeUrl(ogUrl);
      if (currentUrl !== normalizedOgUrl) {
        issues.push({
          type: 'og_url_mismatch',
          message: 'og:url does not match the current page URL',
          severity: 'notice',
          detail: 'og:url: ' + ogUrl + '\nCurrent: ' + window.location.href.split('#')[0]
        });
      }
    }

    // og:url vs canonical comparison
    if (canonicalUrl) {
      var normOg = ogUrl.replace(/#.*$/, '').replace(/\/$/, '');
      var normCanon = canonicalUrl.replace(/#.*$/, '').replace(/\/$/, '');
      if (normOg !== normCanon) {
        issues.push({
          type: 'og_url_vs_canonical_mismatch',
          message: 'og:url differs from canonical URL',
          severity: 'notice',
          detail: 'og:url: ' + ogUrl + '\ncanonical: ' + canonicalUrl
        });
      }
    }
  }

  // ── og:type ─────────────────────────────────────────────────────────────────
  if (ogType === null) {
    issues.push({ type: 'missing_og_type', message: 'Missing og:type meta tag', severity: 'notice' });
  } else {
    if (!VALID_OG_TYPES[ogType]) {
      issues.push({
        type: 'invalid_og_type',
        message: 'og:type has an unrecognized value: "' + ogType + '"',
        severity: 'notice',
        detail: 'Common valid values: article, website, product, profile, video.movie, event, organization.'
      });
    }

    // og:type = article but missing article namespace tags
    if (ogType === 'article') {
      var articleTagsPresent = 0;
      [artPublished, artModified, artAuthor, artSection].forEach(function(v) {
        if (v !== null) articleTagsPresent++;
      });
      if (articleTagsPresent < 2) {
        issues.push({
          type: 'article_type_missing_article_tags',
          message: 'og:type is "article" but article namespace tags are missing',
          severity: 'notice',
          detail: 'When using og:type="article", include article:published_time, article:modified_time, article:author, article:section.'
        });
      }
    }
  }

  // ── og:locale ───────────────────────────────────────────────────────────────
  if (ogLocale === null) {
    issues.push({
      type: 'missing_og_locale',
      message: 'Missing og:locale meta tag',
      severity: 'notice',
      detail: 'og:locale helps platforms display content in the correct language. Format: en_US, uk_UA, de_DE.'
    });
  } else {
    // Validate locale format (xx_XX)
    if (!/^[a-z]{2}_[A-Z]{2}$/i.test(ogLocale)) {
      issues.push({
        type: 'invalid_og_locale_format',
        message: 'og:locale has invalid format: "' + ogLocale + '"',
        severity: 'notice',
        detail: 'Expected format: language_COUNTRY (e.g., en_US, uk_UA, de_DE).'
      });
    }

    // Check against HTML lang attribute
    var htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (htmlLang && ogLocale) {
      var ogLang = ogLocale.split('_')[0].toLowerCase();
      var htmlLangShort = htmlLang.split('-')[0];
      if (ogLang !== htmlLangShort) {
        issues.push({
          type: 'og_locale_vs_html_lang_mismatch',
          message: 'og:locale language (' + ogLang + ') differs from <html lang="' + htmlLang + '">',
          severity: 'notice',
          detail: 'The primary language in og:locale should match the HTML lang attribute.'
        });
      }
    }
  }

  // og:locale:alternate — info
  if (ogLocaleAlt.length > 0) {
    issues.push({
      type: 'og_locale_alternate',
      message: 'og:locale:alternate present (' + ogLocaleAlt.length + ' locales)',
      severity: 'info',
      detail: 'Indicates the content is available in: ' + ogLocaleAlt.join(', ')
    });
  }

  // ── og:site_name ────────────────────────────────────────────────────────────
  if (ogSiteName === null) {
    issues.push({
      type: 'missing_og_site_name',
      message: 'Missing og:site_name meta tag',
      severity: 'notice',
      detail: 'og:site_name identifies the overall site name (e.g., "The New York Times").'
    });
  }

  // ── og:determiner ───────────────────────────────────────────────────────────
  if (ogDeterminer !== null && VALID_DETERMINERS.indexOf(ogDeterminer.toLowerCase()) === -1) {
    issues.push({
      type: 'invalid_og_determiner',
      message: 'og:determiner has invalid value: "' + ogDeterminer + '"',
      severity: 'notice',
      detail: 'Valid values: a, an, the, auto, none.'
    });
  }

  // ── og:video ────────────────────────────────────────────────────────────────
  if (ogVideo !== null) {
    if (ogVideo.indexOf('http://') !== 0 && ogVideo.indexOf('https://') !== 0) {
      issues.push({ type: 'relative_og_video', message: 'og:video is not an absolute URL', severity: 'warning', detail: ogVideo });
    }
    if (ogVideoWidth === null || ogVideoHeight === null) {
      issues.push({ type: 'missing_og_video_dimensions', message: 'og:video missing width/height', severity: 'notice' });
    }
    if (ogVideoType === null) {
      issues.push({ type: 'missing_og_video_type', message: 'og:video missing type (MIME)', severity: 'notice', detail: 'e.g., text/html, video/mp4, application/x-shockwave-flash' });
    }
    if (ogVideoType && ogVideoType.indexOf('video/') !== 0 && ogVideoType !== 'text/html' && ogVideoType.indexOf('application/') !== 0) {
      issues.push({ type: 'invalid_og_video_type', message: 'og:video:type has unexpected value: "' + ogVideoType + '"', severity: 'notice' });
    }
  }

  // ── og:audio ────────────────────────────────────────────────────────────────
  if (ogAudio !== null) {
    if (ogAudio.indexOf('http://') !== 0 && ogAudio.indexOf('https://') !== 0) {
      issues.push({ type: 'relative_og_audio', message: 'og:audio is not an absolute URL', severity: 'warning', detail: ogAudio });
    }
    if (ogAudioType && ogAudioType.indexOf('audio/') !== 0) {
      issues.push({ type: 'invalid_og_audio_type', message: 'og:audio:type should be an audio MIME type', severity: 'notice', detail: 'Current: "' + ogAudioType + '"' });
    }
  }

  // ── og:see_also ─────────────────────────────────────────────────────────────
  if (ogSeeAlso !== null) {
    if (ogSeeAlso.indexOf('http://') !== 0 && ogSeeAlso.indexOf('https://') !== 0) {
      issues.push({ type: 'relative_og_see_also', message: 'og:see_also is not an absolute URL', severity: 'notice', detail: ogSeeAlso });
    } else {
      issues.push({
        type: 'og_see_also_present',
        message: 'og:see_also present (links to authoritative entity)',
        severity: 'info',
        detail: ogSeeAlso
      });
    }
  }

  // ── fb:app_id / fb:admins ───────────────────────────────────────────────────
  if (fbAppId === null && fbAdmins === null) {
    issues.push({
      type: 'missing_fb_insights',
      message: 'Missing fb:app_id — Facebook Insights not available',
      severity: 'notice',
      detail: 'Add <meta property="fb:app_id" content="..."> to enable Facebook page insights for shared content.'
    });
  } else if (fbAppId !== null) {
    if (!/^\d+$/.test(fbAppId)) {
      issues.push({
        type: 'invalid_fb_app_id',
        message: 'fb:app_id should be a numeric ID',
        severity: 'notice',
        detail: 'Current: "' + fbAppId + '"'
      });
    }
  }

  // ── Article namespace ───────────────────────────────────────────────────────
  if (artPublished !== null) {
    var pubDate = new Date(artPublished);
    if (isNaN(pubDate.getTime())) {
      issues.push({
        type: 'invalid_article_published_time',
        message: 'article:published_time is not a valid ISO 8601 date',
        severity: 'notice',
        detail: 'Current: "' + artPublished + '". Expected format: 2024-01-15T10:30:00+00:00'
      });
    }
  }

  if (artModified !== null) {
    var modDate = new Date(artModified);
    if (isNaN(modDate.getTime())) {
      issues.push({
        type: 'invalid_article_modified_time',
        message: 'article:modified_time is not a valid ISO 8601 date',
        severity: 'notice',
        detail: 'Current: "' + artModified + '". Expected format: 2024-01-15T10:30:00+00:00'
      });
    } else if (artPublished) {
      var pubD = new Date(artPublished);
      if (!isNaN(pubD.getTime()) && modDate.getTime() < pubD.getTime()) {
        issues.push({
          type: 'article_modified_before_published',
          message: 'article:modified_time is before article:published_time',
          severity: 'notice',
          detail: 'Published: ' + artPublished + '\nModified: ' + artModified
        });
      }
    }
  }

  if (artAuthor !== null) {
    if (artAuthor.indexOf('http://') !== 0 && artAuthor.indexOf('https://') !== 0) {
      issues.push({
        type: 'article_author_not_url',
        message: 'article:author should be a URL to the author\'s Facebook profile or OG page',
        severity: 'notice',
        detail: 'Current: "' + artAuthor + '"'
      });
    }
  }

  // article:tag — info
  if (artTags.length > 0) {
    issues.push({
      type: 'article_tags',
      message: 'article:tag present (' + artTags.length + ' tags)',
      severity: 'info',
      detail: artTags.join(', ')
    });
  }

  // ── Social share buttons (optimized — check only common containers) ─────────
  var sharePatterns = ['facebook.com/sharer', 'twitter.com/intent/tweet', 'x.com/intent/tweet',
    'linkedin.com/shareArticle', 't.me/share', 'pinterest.com/pin/create',
    'wa.me/send', 'threads.net/intent/post', 'reddit.com/submit'];
  var hasShareButtons = false;
  try {
    // Check only likely share button locations (not all links on the page)
    var shareContainers = document.querySelectorAll('.share, .social, [class*="share"], [class*="social"], header, footer, aside, [role="complementary"]');
    Array.prototype.forEach.call(shareContainers, function(container) {
      if (hasShareButtons) return;
      var links = container.querySelectorAll('a[href]');
      Array.prototype.some.call(links, function(a) {
        var href = a.getAttribute('href') || '';
        if (sharePatterns.some(function(p) { return href.indexOf(p) !== -1; })) {
          hasShareButtons = true;
          return true;
        }
        return false;
      });
    });
  } catch(e) {}
  if (!hasShareButtons) {
    issues.push({ type: 'no_share_buttons', message: 'No social media share buttons found', severity: 'notice' });
  }

  // ── Social profile links ────────────────────────────────────────────────────
  var socialDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com',
    'youtube.com', 'tiktok.com', 'pinterest.com', 'threads.net', 'mastodon.social',
    'bluesky.social', 'telegram.org', 'whatsapp.com', 'reddit.com'];
  var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
  var hasSocialProfiles = false;
  try {
    var socialContainers = document.querySelectorAll('footer, header, [class*="social"], [class*="contact"], [role="contentinfo"]');
    Array.prototype.forEach.call(socialContainers, function(container) {
      if (hasSocialProfiles) return;
      var links = container.querySelectorAll('a[href]');
      Array.prototype.forEach.call(links, function(a) {
        var href = (a.getAttribute('href') || '').toLowerCase();
        socialDomains.some(function(d) {
          if (href.indexOf(d) === -1) return false;
          try {
            var u = new URL(href, window.location.href);
            var linkHost = u.hostname.toLowerCase().replace(/^www\./, '');
            // Allow subdomains of the social domain (e.g., www.facebook.com)
            if (linkHost === d || linkHost.indexOf('.' + d) !== -1) {
              // Exclude own domain
              if (linkHost !== currentHost && linkHost.indexOf(currentHost) === -1) {
                hasSocialProfiles = true;
                return true;
              }
            }
          } catch(e) {}
          return false;
        });
      });
    });
  } catch(e) {}
  if (!hasSocialProfiles) {
    issues.push({ type: 'no_social_profiles', message: 'No links to company social media profiles found', severity: 'notice' });
  }

  return { id: 'opengraph', name: 'Open Graph', issues: issues };
}
