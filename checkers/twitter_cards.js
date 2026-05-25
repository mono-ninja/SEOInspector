function runTwitterCardsChecker(p) {
  var issues = [];

  function getMeta(name) {
    var el = document.querySelector('meta[name="' + name + '"]') ||
             document.querySelector('meta[property="' + name + '"]');
    return el ? (el.getAttribute('content') || '') : null;
  }

  function getAllMeta(name) {
    var els = document.querySelectorAll('meta[name="' + name + '"], meta[property="' + name + '"]');
    var contents = [];
    Array.prototype.forEach.call(els, function(el) {
      var c = el.getAttribute('content');
      if (c) contents.push(c);
    });
    return contents;
  }

  var card        = getMeta('twitter:card');
  var title       = getMeta('twitter:title');
  var description = getMeta('twitter:description');
  var image       = getMeta('twitter:image');
  var imageAlt    = getMeta('twitter:image:alt');
  var site        = getMeta('twitter:site');
  var creator     = getMeta('twitter:creator');
  var twitterUrl  = getMeta('twitter:url');

  // Player card fields
  var player      = getMeta('twitter:player');
  var playerStream = getMeta('twitter:player:stream');
  var playerWidth  = getMeta('twitter:player:width');
  var playerHeight = getMeta('twitter:player:height');

  // App card fields
  var appNameiOS  = getMeta('twitter:app:name:iphone');
  var appNameiPad = getMeta('twitter:app:name:ipad');
  var appNameAndroid = getMeta('twitter:app:name:googleplay');
  var appIdiOS    = getMeta('twitter:app:id:iphone');
  var appIdiPad   = getMeta('twitter:app:id:ipad');
  var appIdAndroid = getMeta('twitter:app:id:googleplay');

  // Fallbacks from OG
  var ogTitle     = getMeta('og:title');
  var ogDesc      = getMeta('og:description');
  var ogImage     = getMeta('og:image');

  var htmlTitle   = (document.title || '').trim();
  var canonicalEl = document.querySelector('link[rel="canonical"]');
  var canonicalUrl = canonicalEl ? (canonicalEl.getAttribute('href') || '') : null;

  var validCards = { summary: 1, summary_large_image: 1, app: 1, player: 1 };

  // ── Overview ────────────────────────────────────────────────────────────────
  var effectiveTitle = title !== null ? title : ogTitle !== null ? '(og:title) ' + ogTitle : '—';
  var effectiveDesc  = description !== null ? description : ogDesc !== null ? '(og:desc) ' + ogDesc : '—';
  var effectiveImage = image !== null ? image : ogImage !== null ? '(og:image) ' + ogImage : '—';

  issues.push({
    type: 'twitter_overview',
    message: 'Twitter / X Cards — overview',
    severity: 'info',
    detail: [
      'twitter:card        ' + (card || '—'),
      'twitter:title       ' + effectiveTitle,
      'twitter:description ' + effectiveDesc,
      'twitter:image       ' + effectiveImage,
      'twitter:image:alt   ' + (imageAlt || '—'),
      'twitter:site        ' + (site || '—'),
      'twitter:creator     ' + (creator || '—'),
      'twitter:url         ' + (twitterUrl || '—'),
    ].join('\n')
  });

  // ── Card type ───────────────────────────────────────────────────────────────
  if (card === null) {
    issues.push({
      type: 'missing_twitter_card',
      message: 'Missing twitter:card meta tag — X/Twitter will not be able to render a post card',
      severity: 'warning'
    });
  } else if (!validCards[card]) {
    issues.push({
      type: 'invalid_twitter_card',
      message: 'Unknown twitter:card type: "' + card + '"',
      severity: 'warning',
      detail: 'Valid values: summary, summary_large_image, app, player'
    });
  }

  // ── twitter:title ───────────────────────────────────────────────────────────
  var effectiveTitleVal = title !== null ? title : ogTitle;
  if (effectiveTitleVal === null) {
    issues.push({
      type: 'missing_twitter_title',
      message: 'Missing twitter:title and og:title — X will have no card title',
      severity: 'notice'
    });
  } else {
    if (effectiveTitleVal.length > 70) {
      issues.push({
        type: 'twitter_title_long',
        message: 'twitter:title is too long (' + effectiveTitleVal.length + ' chars) — X may truncate at ~70',
        severity: 'notice',
        detail: 'Value: "' + effectiveTitleVal + '"'
      });
    }
    if (effectiveTitleVal.length < 10) {
      issues.push({
        type: 'twitter_title_short',
        message: 'twitter:title is very short (' + effectiveTitleVal.length + ' chars)',
        severity: 'notice',
        detail: 'Value: "' + effectiveTitleVal + '"'
      });
    }
  }

  // twitter:title vs og:title mismatch
  if (title !== null && ogTitle !== null && title !== ogTitle) {
    issues.push({
      type: 'twitter_og_title_mismatch',
      message: 'twitter:title differs from og:title',
      severity: 'notice',
      detail: 'twitter:title: "' + title + '"\nog:title: "' + ogTitle + '"'
    });
  }

  // ── twitter:description ─────────────────────────────────────────────────────
  var effectiveDescVal = description !== null ? description : ogDesc;
  if (effectiveDescVal === null) {
    issues.push({
      type: 'missing_twitter_description',
      message: 'Missing twitter:description and og:description',
      severity: 'notice'
    });
  } else {
    if (effectiveDescVal.length > 200) {
      issues.push({
        type: 'twitter_description_long',
        message: 'twitter:description is too long (' + effectiveDescVal.length + ' chars) — X may truncate at ~200',
        severity: 'notice',
        detail: 'Value: "' + effectiveDescVal.substring(0, 100) + '…"'
      });
    }
    if (effectiveDescVal.length < 20) {
      issues.push({
        type: 'twitter_description_short',
        message: 'twitter:description is very short (' + effectiveDescVal.length + ' chars)',
        severity: 'notice',
        detail: 'Value: "' + effectiveDescVal + '"'
      });
    }
  }

  // twitter:description vs og:description mismatch
  if (description !== null && ogDesc !== null && description !== ogDesc) {
    issues.push({
      type: 'twitter_og_description_mismatch',
      message: 'twitter:description differs from og:description',
      severity: 'notice',
      detail: 'twitter:description: "' + description + '"\nog:description: "' + ogDesc + '"'
    });
  }

  // ── twitter:image ───────────────────────────────────────────────────────────
  var effectiveImageVal = image !== null ? image : ogImage;
  if (effectiveImageVal === null) {
    issues.push({
      type: 'missing_twitter_image',
      message: 'Missing twitter:image and og:image — card will have no image',
      severity: 'notice'
    });
  } else {
    // Absolute URL
    if (effectiveImageVal.indexOf('http') !== 0) {
      issues.push({
        type: 'twitter_image_relative',
        message: 'twitter:image / og:image — relative URL (X requires an absolute URL)',
        severity: 'warning',
        detail: effectiveImageVal
      });
    }

    // HTTPS
    if (effectiveImageVal.indexOf('http://') === 0) {
      issues.push({
        type: 'twitter_image_not_https',
        message: 'twitter:image uses HTTP instead of HTTPS',
        severity: 'notice',
        detail: 'X recommends HTTPS image URLs.\nCurrent: ' + effectiveImageVal
      });
    }

    // Image format (Twitter only supports JPG and PNG)
    var imgPath = effectiveImageVal.toLowerCase().split('?')[0];
    var imgExt = imgPath.substring(imgPath.lastIndexOf('.'));
    var validImgExts = { '.jpg': 1, '.jpeg': 1, '.png': 1 };
    if (imgExt && !validImgExts[imgExt]) {
      issues.push({
        type: 'twitter_image_invalid_format',
        message: 'twitter:image may not be a supported format (' + imgExt + ')',
        severity: 'notice',
        detail: 'X only supports JPG and PNG. WebP, GIF, SVG will not render.\nCurrent: ' + effectiveImageVal
      });
    }

    // File size warning (Twitter max 5 MB)
    var imgFilename = imgPath.split('/').pop();
    if (imgFilename && imgFilename.indexOf('large') !== -1) {
      // heuristic: can't check actual size from meta tag
    }

    // summary_large_image without explicit twitter:image
    if (card === 'summary_large_image' && image === null && ogImage !== null) {
      issues.push({
        type: 'twitter_large_image_no_explicit',
        message: 'summary_large_image is using og:image as fallback — recommended to set twitter:image explicitly (min. 1200×628 px)',
        severity: 'notice'
      });
    }
  }

  // ── twitter:image:alt ───────────────────────────────────────────────────────
  if (effectiveImageVal !== null && imageAlt === null) {
    issues.push({
      type: 'missing_twitter_image_alt',
      message: 'Missing twitter:image:alt — card image has no accessible description',
      severity: 'notice',
      detail: 'twitter:image:alt provides alt text for the card image, improving accessibility for screen readers.'
    });
  } else if (imageAlt !== null) {
    if (imageAlt.length > 200) {
      issues.push({
        type: 'twitter_image_alt_long',
        message: 'twitter:image:alt is too long (' + imageAlt.length + ' chars, max 200)',
        severity: 'notice',
        detail: 'Value: "' + imageAlt.substring(0, 80) + '…"'
      });
    }
    if (imageAlt.length < 5) {
      issues.push({
        type: 'twitter_image_alt_short',
        message: 'twitter:image:alt is very short (' + imageAlt.length + ' chars)',
        severity: 'notice',
        detail: 'Value: "' + imageAlt + '"'
      });
    }
  }

  // ── twitter:site ────────────────────────────────────────────────────────────
  if (site === null) {
    issues.push({
      type: 'missing_twitter_site',
      message: 'Missing twitter:site (account @handle) — card attribution in X',
      severity: 'notice'
    });
  } else {
    if (site.charAt(0) !== '@') {
      issues.push({
        type: 'twitter_site_no_at',
        message: 'twitter:site must start with @ (current value: "' + site + '")',
        severity: 'notice'
      });
    }
  }

  // ── twitter:creator ─────────────────────────────────────────────────────────
  if (creator !== null) {
    if (creator.charAt(0) !== '@') {
      issues.push({
        type: 'twitter_creator_no_at',
        message: 'twitter:creator must start with @ (current value: "' + creator + '")',
        severity: 'notice'
      });
    }
  }

  // ── twitter:url ─────────────────────────────────────────────────────────────
  if (twitterUrl === null) {
    issues.push({
      type: 'missing_twitter_url',
      message: 'Missing twitter:url — recommended for canonical URL in X cards',
      severity: 'notice'
    });
  } else {
    if (twitterUrl.indexOf('http') !== 0) {
      issues.push({
        type: 'twitter_url_relative',
        message: 'twitter:url is not an absolute URL',
        severity: 'warning',
        detail: 'Current: "' + twitterUrl + '"'
      });
    } else if (canonicalUrl) {
      var normTw = twitterUrl.replace(/#.*$/, '').replace(/\/$/, '');
      var normCanon = canonicalUrl.replace(/#.*$/, '').replace(/\/$/, '');
      if (normTw !== normCanon) {
        issues.push({
          type: 'twitter_url_vs_canonical_mismatch',
          message: 'twitter:url differs from canonical URL',
          severity: 'notice',
          detail: 'twitter:url: ' + twitterUrl + '\ncanonical: ' + canonicalUrl
        });
      }
    }
  }

  // ── Player card validation ──────────────────────────────────────────────────
  if (card === 'player') {
    if (player === null) {
      issues.push({
        type: 'player_missing_player_url',
        message: 'twitter:card is "player" but twitter:player is missing',
        severity: 'warning',
        detail: 'twitter:player must contain an absolute URL to an HTTPS page with an autoplaying video.'
      });
    } else {
      if (player.indexOf('https://') !== 0) {
        issues.push({
          type: 'player_not_https',
          message: 'twitter:player must be an HTTPS URL',
          severity: 'warning',
          detail: 'Current: ' + player
        });
      }
    }

    if (playerWidth === null || playerHeight === null) {
      issues.push({
        type: 'player_missing_dimensions',
        message: 'twitter:player missing width/height',
        severity: 'warning',
        detail: 'Required for player cards: twitter:player:width and twitter:player:height.'
      });
    } else {
      var pW = parseInt(playerWidth, 10);
      var pH = parseInt(playerHeight, 10);
      if (pW < 240 || pH < 120) {
        issues.push({
          type: 'player_dimensions_too_small',
          message: 'twitter:player dimensions too small (' + pW + '×' + pH + ' — minimum 240×120)',
          severity: 'warning'
        });
      }
    }

    if (playerStream && playerStream.indexOf('https://') !== 0) {
      issues.push({
        type: 'player_stream_not_https',
        message: 'twitter:player:stream must be an HTTPS URL',
        severity: 'warning',
        detail: 'Current: ' + playerStream
      });
    }
  }

  // ── App card validation ─────────────────────────────────────────────────────
  if (card === 'app') {
    var hasAnyApp = !!(appNameiOS || appNameiPad || appNameAndroid);
    if (!hasAnyApp) {
      issues.push({
        type: 'app_missing_names',
        message: 'twitter:card is "app" but no twitter:app:name:* tags found',
        severity: 'warning',
        detail: 'At least one of: twitter:app:name:iphone, twitter:app:name:ipad, twitter:app:name:googleplay'
      });
    }

    if (appNameiOS && !appIdiOS) {
      issues.push({
        type: 'app_ios_missing_id',
        message: 'twitter:app:name:iphone is set but twitter:app:id:iphone is missing',
        severity: 'warning'
      });
    }
    if (appNameiPad && !appIdiPad) {
      issues.push({
        type: 'app_ipad_missing_id',
        message: 'twitter:app:name:ipad is set but twitter:app:id:ipad is missing',
        severity: 'warning'
      });
    }
    if (appNameAndroid && !appIdAndroid) {
      issues.push({
        type: 'app_android_missing_id',
        message: 'twitter:app:name:googleplay is set but twitter:app:id:googleplay is missing',
        severity: 'warning'
      });
    }
  }

  return { id: 'twitter_cards', name: 'Twitter / X', issues: issues };
}