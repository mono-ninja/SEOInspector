function runContentQualityChecker(p) {
  var issues = [];
  var params = p || {};

  var body = document.body;
  if (!body) return { id: 'content_quality', name: 'Content Quality', issues: issues };

  // ── Text extraction ──────────────────────────────────────────────────────────
  // Skip decorative/nav/interactive elements and hidden nodes
  var skipTags = { SCRIPT:1, STYLE:1, NAV:1, HEADER:1, FOOTER:1, ASIDE:1, NOSCRIPT:1, BUTTON:1, SELECT:1, OPTION:1 };
  function visibleText(el) {
    if (!el || el.nodeType === 8) return '';
    if (el.nodeType === 3) return el.nodeValue || '';
    if (el.hidden) return '';
    if (el.style && el.style.display === 'none') return '';
    if (skipTags[el.tagName]) return '';
    return Array.prototype.map.call(el.childNodes, visibleText).join(' ');
  }

  var mainEl = document.querySelector('main, article, [role="main"]') || body;
  var rawText = visibleText(mainEl).replace(/\s+/g, ' ').trim();
  var words = rawText.length > 0 ? rawText.split(/\s+/).filter(function(w) { return w.length > 0; }) : [];
  var wordCount = words.length;

  // ── Paragraphs ───────────────────────────────────────────────────────────────
  var paragraphs = Array.prototype.slice.call(mainEl.querySelectorAll('p')).filter(function(p) {
    return (p.textContent || '').trim().length > 20;
  });
  var paraCount = paragraphs.length;
  var avgParaWords = paraCount > 0
    ? Math.round(paragraphs.reduce(function(s, p) {
        return s + (p.textContent || '').trim().split(/\s+/).length;
      }, 0) / paraCount)
    : 0;

  // ── Sentences — split on punctuation+whitespace to avoid splitting on URLs/decimals/abbreviations
  var sentences = rawText.split(/[.!?]+\s+/).filter(function(s) { return s.trim().split(/\s+/).length > 2; });
  var avgWordsPerSentence = sentences.length > 0 ? Math.round(wordCount / sentences.length) : 0;

  // ── Keyword density from H1 ──────────────────────────────────────────────────
  var h1El = document.querySelector('h1');
  var h1Text = h1El ? (h1El.innerText || '').trim().toLowerCase() : '';
  var stopWords = {
    // Ukrainian
    і:1, й:1, в:1, у:1, на:1, з:1, із:1, зі:1, до:1, що:1, як:1, та:1, не:1, це:1,
    для:1, по:1, від:1, при:1, за:1, або:1, але:1, якщо:1, які:1, який:1, яка:1,
    яке:1, вони:1, він:1, вона:1, воно:1, ми:1, ви:1, про:1, між:1, через:1,
    після:1, перед:1, під:1, над:1, без:1, серед:1, коли:1, де:1, тому:1, щоб:1,
    бо:1, тут:1, там:1, так:1, вже:1, ще:1, також:1, лише:1, дуже:1, більш:1,
    менш:1, може:1, ніж:1, цей:1, ця:1, той:1, та:1, його:1, її:1, їх:1, нас:1,
    вас:1, ним:1, ній:1, них:1, мій:1, твій:1, свій:1, своя:1, своє:1,
    // English
    the:1, and:1, for:1, are:1, with:1, that:1, this:1, from:1, have:1, will:1,
    but:1, not:1, was:1, has:1, been:1, its:1, can:1, one:1, you:1, your:1,
    our:1, their:1, how:1, what:1, when:1, where:1, which:1
  };
  var h1Words = h1Text.split(/\s+/).filter(function(w) { return w.length > 3 && !stopWords[w]; });
  // User-provided target keyword takes priority over the H1-derived seed
  var userKeyword = (params.target_keyword || '').trim().toLowerCase();
  var seedKeyword = userKeyword || h1Words.slice(0, 2).join(' ');
  var keywordSource = userKeyword ? 'target' : 'H1';
  var keywordDensity = 0;
  if (seedKeyword && wordCount > 0) {
    // Word-exact matching via word array — \b doesn't work for Cyrillic in JS RegExp
    var allWords = rawText.toLowerCase().match(/[a-zа-яёіїєґ']+/gi) || [];
    var kwParts = seedKeyword.split(/\s+/).filter(function(w) { return w.length > 0; });
    var matchCount = 0;
    if (kwParts.length > 0) {
      for (var wi = 0; wi <= allWords.length - kwParts.length; wi++) {
        var matched = true;
        for (var ki = 0; ki < kwParts.length; ki++) {
          if (allWords[wi + ki] !== kwParts[ki]) { matched = false; break; }
        }
        if (matched) matchCount++;
      }
    }
    keywordDensity = allWords.length > 0 ? Math.round((matchCount / allWords.length) * 1000) / 10 : 0;
  }

  // ── Date signals ─────────────────────────────────────────────────────────────
  var hasDateEl = !!document.querySelector('time[datetime]');
  var pubTimeMeta = document.querySelector('meta[property="article:published_time"]');
  var hasMetaDate = !!(
    pubTimeMeta ||
    document.querySelector('meta[property="article:modified_time"]') ||
    document.querySelector('meta[name="date"]')
  );
  var contentAgeYears = 0;
  if (pubTimeMeta) {
    var pubDate = new Date(pubTimeMeta.getAttribute('content') || '');
    if (!isNaN(pubDate.getTime())) {
      contentAgeYears = Math.floor((Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
    }
  }

  // ── Lists and media ───────────────────────────────────────────────────────────
  var hasLists = !!mainEl.querySelector('ul, ol');
  var contentMediaCount = mainEl.querySelectorAll('img, picture, video, figure').length;

  // ── Info overview ────────────────────────────────────────────────────────────
  issues.push({
    type: 'content_overview',
    message: 'Content quality — overview',
    severity: 'info',
    detail: [
      'Words in content     ' + wordCount,
      'Paragraphs           ' + paraCount,
      'Avg words/paragraph  ' + (avgParaWords || '—'),
      'Avg words/sentence   ' + (avgWordsPerSentence || '—'),
      'Lists (ul/ol)        ' + (hasLists ? '✓' : '—'),
      'Images/media         ' + (contentMediaCount > 0 ? contentMediaCount : '—'),
      'Keyword (' + keywordSource + ')     ' + (seedKeyword || '—'),
      'Keyword density      ' + (seedKeyword ? keywordDensity + '%' : '—'),
      'Publication date     ' + (!hasDateEl && !hasMetaDate ? '—' : contentAgeYears > 0 ? contentAgeYears + ' yr ago' : '✓'),
    ].join('\n')
  });

  // ── Checks ───────────────────────────────────────────────────────────────────

  // Placeholder text — check before thin content to avoid double-noise
  if (rawText.toLowerCase().indexOf('lorem ipsum') !== -1) {
    issues.push({
      type: 'placeholder_text',
      message: 'Placeholder text "Lorem ipsum" detected — replace with real content before publishing',
      severity: 'critical'
    });
  }

  // Thin content — uses params.min_words (default 300)
  var minWords = params.min_words || 300;
  if (wordCount > 0 && wordCount < minWords && paraCount > 0) {
    issues.push({
      type: 'thin_content',
      message: 'Thin content: ' + wordCount + ' words (threshold: ' + minWords + ') — may rank poorly',
      severity: wordCount < 100 ? 'warning' : 'notice'
    });
  }

  // Keyword stuffing — uses params.keyword_density (default 5)
  var maxDensity = params.keyword_density || 5;
  if (keywordDensity > maxDensity) {
    issues.push({
      type: 'keyword_stuffing',
      message: 'High keyword density for "' + seedKeyword + '" (' + keywordDensity + '%) — risk of over-optimization',
      severity: 'warning'
    });
  } else if (seedKeyword && keywordDensity < 0.3 && wordCount > 300) {
    issues.push({
      type: 'low_keyword_density',
      message: 'Low keyword density for "' + seedKeyword + '" (' + keywordDensity + '%) — H1 topic is weakly present in the text',
      severity: 'notice'
    });
  }

  // Long paragraphs
  var longParas = paragraphs.filter(function(p) {
    return (p.textContent || '').trim().split(/\s+/).length > 250;
  });
  if (longParas.length > 0) {
    issues.push({
      type: 'long_paragraphs',
      message: 'Paragraphs too long (' + longParas.length + ' items > 250 words) — poor readability',
      severity: 'notice'
    });
  }

  // Complex sentences — uses params.max_sentence_words (default 25)
  var maxSentWords = params.max_sentence_words || 25;
  if (avgWordsPerSentence > maxSentWords && sentences.length > 5) {
    issues.push({
      type: 'complex_sentences',
      message: 'Complex sentences: average ' + avgWordsPerSentence + ' words/sentence (threshold: ' + maxSentWords + ') — hard to read',
      severity: 'notice'
    });
  }

  // No lists in long content
  if (!hasLists && wordCount > 500) {
    issues.push({
      type: 'no_lists',
      message: 'Long content (' + wordCount + ' words) without any lists (ul/ol) — lists improve scannability',
      severity: 'notice'
    });
  }

  // No media in long content
  if (contentMediaCount === 0 && wordCount > 600) {
    issues.push({
      type: 'no_content_media',
      message: 'Long content (' + wordCount + ' words) without images or video — visuals improve engagement',
      severity: 'notice'
    });
  }

  // No date signal
  if (!hasDateEl && !hasMetaDate && wordCount > 400) {
    issues.push({
      type: 'no_date_signal',
      message: 'Missing publication date (<time datetime> or article:published_time) — important for news and blogs',
      severity: 'notice'
    });
  }

  // Stale content (article:published_time > 2 years old)
  if (contentAgeYears >= 2) {
    issues.push({
      type: 'stale_content',
      message: 'Content is ' + contentAgeYears + ' year' + (contentAgeYears !== 1 ? 's' : '') + ' old — consider updating for freshness',
      severity: 'notice'
    });
  }

  // Text-to-HTML ratio
  var htmlLength = (document.documentElement.outerHTML || '').length;
  var textLength = rawText.length;
  if (htmlLength > 0 && textLength / htmlLength < 0.1) {
    var ratio = Math.round(textLength / htmlLength * 100);
    issues.push({
      type: 'low_text_html_ratio',
      message: 'Low text-to-HTML ratio (' + ratio + '%) — too little content or too much code',
      severity: 'notice',
      detail: 'Recommended > 10%. Text: ' + textLength + ' chars, HTML: ' + htmlLength + ' chars.'
    });
  }

  // Meta tags in <body>
  var metaInBody = Array.prototype.filter.call(
    document.body ? document.body.querySelectorAll('meta') : [],
    function(m) { return !m.closest('head'); }
  );
  if (metaInBody.length > 0) {
    issues.push({
      type: 'meta_in_body',
      message: 'Meta tags found outside <head> (' + metaInBody.length + ')',
      severity: 'warning',
      detail: metaInBody.slice(0, 3).map(function(m) { return m.outerHTML.substring(0, 80); }).join('\n')
    });
  }

  return { id: 'content_quality', name: 'Content Quality', issues: issues };
}
