// Multi-language stop words — defined outside to avoid recreation on each call
var NLP_STOP_WORDS = {
  // English
  'a':1,'an':1,'the':1,'and':1,'or':1,'but':1,'in':1,'on':1,'at':1,'to':1,'for':1,
  'of':1,'is':1,'it':1,'by':1,'be':1,'as':1,'are':1,'was':1,'were':1,'been':1,'has':1,
  'had':1,'have':1,'do':1,'did':1,'does':1,'will':1,'would':1,'could':1,'should':1,
  'may':1,'might':1,'shall':1,'can':1,'not':1,'no':1,'nor':1,'so':1,'if':1,'then':1,
  'than':1,'that':1,'this':1,'these':1,'those':1,'from':1,'with':1,'about':1,'into':1,
  'through':1,'during':1,'before':1,'after':1,'above':1,'below':1,'between':1,'out':1,
  'off':1,'over':1,'under':1,'again':1,'further':1,'here':1,'there':1,'when':1,'where':1,
  'why':1,'how':1,'all':1,'each':1,'every':1,'both':1,'few':1,'more':1,'most':1,'other':1,
  'some':1,'such':1,'only':1,'own':1,'same':1,'also':1,'just':1,'because':1,'until':1,
  'while':1,'your':1,'you':1,'he':1,'she':1,'we':1,'they':1,'me':1,'him':1,'her':1,'us':1,
  'them':1,'my':1,'his':1,'its':1,'our':1,'their':1,'what':1,'which':1,'who':1,'whom':1,
  'i':1,'am':1,'up':1,'down':1,'any':1,'very':1,'even':1,'new':1,'one':1,'two':1,
  // Ukrainian
  'і':1,'в':1,'а':1,'з':1,'я':1,'це':1,'на':1,'не':1,'що':1,'у':1,'як':1,'за':1,
  'але':1,'чи':1,'та':1,'від':1,'до':1,'для':1,'про':1,'при':1,'по':1,'уже':1,
  'так':1,'б':1,'ж':1,'но':1,'то':1,'ли':1,'бо':1,'той':1,'такий':1,
  'сам':1,'самий':1,'вже':1,'теж':1,'також':1,'тільки':1,'або':1,'якщо':1,
  'тому':1,'через':1,'після':1,'перед':1,'між':1,'над':1,'під':1,'свого':1,'його':1,
  'її':1,'наш':1,'наше':1,'наша':1,'вони':1,'вона':1,'він':1,'ми':1,'ти':1,
  'бути':1,'був':1,'була':1,'було':1,'буде':1,'є':1,'має':1,'може':1,'треба':1,
  'цього':1,'нього':1,'себе':1,'собі':1,'усіх':1,'всіх':1,'все':1,
  'де':1,'коли':1,'хто':1,'який':1,'яка':1,'яке':1,'які':1,'скільки':1,'ось':1,
  'от':1,'ну':1,'отже':1,'таким':1,'те':1,'се':1,
  // German
  'und':1,'oder':1,'aber':1,'der':1,'die':1,'das':1,'den':1,'dem':1,'des':1,
  'ein':1,'eine':1,'einer':1,'einem':1,'einen':1,'ist':1,'sind':1,'war':1,'wird':1,
  'nicht':1,'auch':1,'noch':1,'schon':1,'sehr':1,'nur':1,'mehr':1,'kein':1,
  'keine':1,'vom':1,'zum':1,'im':1,'an':1,'auf':1,'aus':1,'bei':1,'mit':1,
  'nach':1,'vor':1,'um':1,'von':1,'zu':1,'in':1,'ob':1,'wie':1,'was':1,
  // French
  'et':1,'ou':1,'mais':1,'le':1,'la':1,'les':1,'un':1,'une':1,'des':1,'du':1,
  'est':1,'sont':1,'au':1,'aux':1,'dans':1,'sur':1,'pour':1,'avec':1,
  'pas':1,'ne':1,'plus':1,'très':1,'bien':1,'tout':1,'tous':1,'toute':1,
  'cette':1,'ces':1,'ce':1,'il':1,'elle':1,'nous':1,'vous':1,'ils':1,'elles':1,
  'que':1,'qui':1,'comme':1,'si':1,'donc':1,'en':1,'par':1,'sans':1,'sous':1,
  // Spanish
  'y':1,'o':1,'pero':1,'el':1,'la':1,'los':1,'las':1,'un':1,'una':1,'es':1,
  'son':1,'de':1,'en':1,'con':1,'por':1,'para':1,'no':1,'más':1,'muy':1,
  'todo':1,'toda':1,'este':1,'esta':1,'ese':1,'esa':1,'su':1,'sus':1,
  'que':1,'como':1,'si':1,'cuando':1,'donde':1,'qué':1,'quién':1,'cuál':1,
  // Russian
  'и':1,'в':1,'во':1,'не':1,'как':1,'а':1,'у':1,'что':1,'он':1,'на':1,'я':1,
  'с':1,'со':1,'его':1,'все':1,'она':1,'так':1,'за':1,'то':1,'бы':1,'по':1,
  'но':1,'из':1,'да':1,'к':1,'еще':1,'только':1,'можно':1,'этот':1,'этой':1,
  'этих':1,'этом':1,'этого':1,'они':1,'мы':1,'вы':1,'ты':1,'ее':1,'ему':1,
  'ей':1,'мне':1,'меня':1,'себе':1,'себя':1,'о':1,'об':1,
  'для':1,'через':1,'после':1,'перед':1,'между':1,'над':1,'под':1,'около':1,
  'потому':1,'потом':1,'уже':1,'тоже':1,'также':1,'ли':1,'было':1,
  'был':1,'будет':1,'будут':1,'есть':1,'без':1,'при':1,'там':1,'сюда':1,
  'туда':1,'откуда':1,'куда':1,'где':1,'когда':1,'кто':1,'какой':1,'какая':1,
  'какое':1,'какие':1,'сколько':1,'сам':1,'самый':1,'самой':1,'своего':1,
  'своей':1,'свое':1,'своих':1,'своим':1,'своими':1,'своем':1
};

// Transition words across languages
var NLP_TRANSITION_WORDS = {
  // English
  'however':1,'therefore':1,'moreover':1,'furthermore':1,'nevertheless':1,'meanwhile':1,
  'additionally':1,'consequently':1,'alternatively':1,'specifically':1,'particularly':1,
  'generally':1,'basically':1,'essentially':1,'actually':1,'obviously':1,'clearly':1,
  'indeed':1,'certainly':1,'absolutely':1,'definitely':1,'importantly':1,'interestingly':1,
  'surprisingly':1,'fortunately':1,'unfortunately':1,'similarly':1,'oppositely':1,
  'instead':1,'rather':1,'although':1,'though':1,'despite':1,'unless':1,'whereas':1,
  'while':1,'since':1,'because':1,'thus':1,'hence':1,'otherwise':1,'otherwise':1,
  'nonetheless':1,'notwithstanding':1,'accordingly':1,'subsequently':1,'previously':1,
  'first':1,'second':1,'third':1,'finally':1,'lastly':1,'next':1,'then':1,
  'in addition':1,'on the other hand':1,'in contrast':1,'in conclusion':1,
  // Ukrainian
  'проте':1,'тім':1,'однак':1,'втім':1,'все ж':1,'навіть':1,'також':1,'окрім':1,
  'зрештою':1,'наприклад':1,'зокрема':1,'зокрема':1,'особливо':1,'навіть':1,
  'завдяки':1,'попри':1,'незважаючи':1,'натомість':1,'відтак':1,'отже':1,
  'на думку':1,'загалом':1,'звичайно':1,'безумовно':1,'фактично':1,'фактично':1,
  'насправді':1,'на жаль':1,'на щастя':1,'по-перше':1,'по-друге':1,'по-третє':1,
  'нарешті':1,'зрештою':1,'надалі':1,'раніше':1,'після цього':1,'в результаті':1,
  'на противагу':1,'на відміну':1,'висновок':1,'підсумовуючи':1,'тобто':1,
  'іншими словами':1,'інакше':1,'з іншого боку':1,'з одного боку':1,
  // Russian
  'однако':1,'тем не менее':1,'кроме того':1,'более того':1,'кроме':1,
  'например':1,'в частности':1,'особенно':1,'благодаря':1,'несмотря':1,
  'вместо':1,'поэтому':1,'следовательно':1,'итого':1,'результате':1,
  'во-первых':1,'во-вторых':1,'в-третьих':1,'наконец':1,'в заключение':1,
  'другими словами':1,'иначе говоря':1,'с одной стороны':1,'с другой стороны':1,
  'фактически':1,'действительно':1,'безусловно':1,'конечно':1,'обычно':1,
  'к сожалению':1,'к счастью':1,'аналогично':1,'напротив':1,'в отличие':1,
  'впрочем':1,'между тем':1,'тем временем':1,'в итоге':1,'таким образом':1,
  'другими':1,'то есть':1,'иными словами':1,'подводя итоги':1,'обобщая':1
};

function runNlpChecker(p) {
  var issues = [];
  var params = p || {};
  var maxSentenceWords = params.max_sentence_words || 25;

  if (!document.body) return { id: 'nlp', name: 'NLP / Text', issues: [] };

  // ── Text extraction ─────────────────────────────────────────────────────────
  // Focus on main content area for more meaningful NLP analysis
  var text = '';
  var mainEl = document.querySelector('main, article, [role="main"]') || document.body;
  try {
    var SKIP_NLP = { SCRIPT:1, STYLE:1, NOSCRIPT:1, SVG:1, BUTTON:1, SELECT:1, OPTION:1 };
    var nlpParts = [];
    function nlpWalk(node) {
      if (node.nodeType === 1) {
        if (SKIP_NLP[node.nodeName.toUpperCase()]) return;
        for (var c = node.firstChild; c; c = c.nextSibling) nlpWalk(c);
      } else if (node.nodeType === 3) {
        var t = (node.nodeValue || '').trim();
        if (t) nlpParts.push(t);
      }
    }
    nlpWalk(mainEl);
    text = nlpParts.join(' ').replace(/\s+/g, ' ').trim();
  } catch(e) {
    text = (mainEl.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // Clean words — keep apostrophes and hyphens within words
  var words = text.split(/\s+/).filter(function(w) { return w.length > 1; });

  // Meaningful words (stop-word filtered, cleaned)
  var meaningfulWords = words.filter(function(w) {
    var lower = w.toLowerCase().replace(/[^a-zа-яіїєёäöüßàâçéèêëîïôùûüÿæœáéíóúñàáâãäåèéêëìíîïòóôõöùúûüýÿ'-]/gi, '');
    return lower.length > 3 && !NLP_STOP_WORDS[lower];
  });

  // Detect page language
  var pageLang = (document.documentElement.getAttribute('lang') || 'unknown').toLowerCase().substring(0, 2);

  // ── Sentences ───────────────────────────────────────────────────────────────
  var sentences = text.split(/[.!?…]+\s+/).filter(function(s) {
    return s.trim().split(/\s+/).length > 3;
  });

  // ── Frequency analysis (single words) ───────────────────────────────────────
  var freq = {};
  meaningfulWords.forEach(function(w) {
    var lower = w.toLowerCase().replace(/[^a-zа-яіїєёäöüßàâçéèêëîïôùûüÿæœáéíóúñàáâãäåèéêëìíîïòóôõöùúûüýÿ'-]/gi, '');
    if (lower) freq[lower] = (freq[lower] || 0) + 1;
  });
  var sortedWords = Object.keys(freq).sort(function(a, b) { return freq[b] - freq[a]; });
  var uniqueWords = sortedWords.length;

  // ── Bigrams / Trigrams ──────────────────────────────────────────────────────
  var bigrams = {};
  var trigrams = {};
  var cleanWords = words.map(function(w) {
    return w.toLowerCase().replace(/[^a-zа-яіїєёäöüßàâçéèêëîïôùûüÿæœáéíóúñàáâãäåèéêëìíîïòóôõöùúûüýÿ'-]/gi, '');
  }).filter(function(w) { return w.length > 2 && !NLP_STOP_WORDS[w]; });

  for (var bi = 0; bi < cleanWords.length - 1; bi++) {
    var bg = cleanWords[bi] + ' ' + cleanWords[bi + 1];
    bigrams[bg] = (bigrams[bg] || 0) + 1;
  }
  for (var ti = 0; ti < cleanWords.length - 2; ti++) {
    var tg = cleanWords[ti] + ' ' + cleanWords[ti + 1] + ' ' + cleanWords[ti + 2];
    trigrams[tg] = (trigrams[tg] || 0) + 1;
  }
  var topBigrams = Object.keys(bigrams).sort(function(a, b) { return bigrams[b] - bigrams[a]; }).slice(0, 5);
  var topTrigrams = Object.keys(trigrams).sort(function(a, b) { return trigrams[b] - trigrams[a]; }).slice(0, 5);

  // ── Readability indices (compute once, reuse) ───────────────────────────────
  var charsNoSpaces = text.replace(/\s+/g, '').length;
  var avgSentLen = sentences.length > 0 ? words.length / sentences.length : 0;
  var avgCharsPerWord = words.length > 0 ? charsNoSpaces / words.length : 0;

  var ari = null;
  var flesch = null;
  var gunningFog = null;

  if (sentences.length >= 3 && words.length >= 30) {
    // Automated Readability Index
    ari = 4.71 * avgCharsPerWord + 0.5 * avgSentLen - 21.43;
    ari = Math.round(ari * 10) / 10;

    // Flesch Reading Ease (English-oriented, but gives rough estimate)
    var syllableEst = 0;
    words.forEach(function(w) {
      var lw = w.toLowerCase().replace(/[^a-z]/g, '');
      if (lw.length <= 3) syllableEst++;
      else {
        var syl = lw.match(/[aeiouаеёіїюяэоуы]+/gi);
        syllableEst += syl ? syl.length : 1;
      }
    });
    flesch = 206.835 - 1.015 * avgSentLen - 84.6 * (syllableEst / words.length);
    flesch = Math.round(flesch * 10) / 10;

    // Gunning Fog Index — uses complex words (3+ syllables)
    var complexWords = 0;
    words.forEach(function(w) {
      var lw = w.toLowerCase().replace(/[^a-z]/g, '');
      if (lw.length > 3) {
        var syl = lw.match(/[aeiouаеёіїюяэоуы]+/gi);
        if (syl && syl.length >= 3) complexWords++;
      }
    });
    gunningFog = 0.4 * (avgSentLen + (complexWords / words.length * 100));
    gunningFog = Math.round(gunningFog * 10) / 10;
  }

  var ariGrade = '';
  if (ari !== null) {
    if (ari <= 6)       ariGrade = 'easy';
    else if (ari <= 10) ariGrade = 'moderate';
    else if (ari <= 14) ariGrade = 'difficult';
    else                ariGrade = 'very difficult';
  }

  var fleschGrade = '';
  if (flesch !== null) {
    if (flesch >= 90)      fleschGrade = 'very easy';
    else if (flesch >= 70) fleschGrade = 'easy';
    else if (flesch >= 50) fleschGrade = 'moderate';
    else if (flesch >= 30) fleschGrade = 'difficult';
    else                   fleschGrade = 'very difficult';
  }

  // ── Transition words ────────────────────────────────────────────────────────
  var transitionCount = 0;
  var textLower = text.toLowerCase();
  Object.keys(NLP_TRANSITION_WORDS).forEach(function(tw) {
    var re = new RegExp('\\b' + tw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    var matches = textLower.match(re);
    if (matches) transitionCount += matches.length;
  });

  // ── Question / exclamation sentences ────────────────────────────────────────
  var questionSentences = (text.match(/\?/g) || []).length;
  var exclamationSentences = (text.match(/!/g) || []).length;

  // ── Numbers and data presence ───────────────────────────────────────────────
  var numberMatches = text.match(/\b\d+[\d.,]*\b/g);
  var hasNumbers = numberMatches ? numberMatches.length : 0;
  var hasPercentages = (text.match(/%/g) || []).length;

  // ── All-caps words ──────────────────────────────────────────────────────────
  var allCapsWords = words.filter(function(w) {
    return w.length > 2 && w === w.toUpperCase() && w !== w.toLowerCase();
  });

  // ── URLs in content ─────────────────────────────────────────────────────────
  var urlMatches = text.match(/\bhttps?:\/\/[^\s]+/g);
  var contentUrls = urlMatches ? urlMatches.length : 0;

  // ── Inline formatting ───────────────────────────────────────────────────────
  var boldCount = mainEl.querySelectorAll('strong, b').length;
  var italicCount = mainEl.querySelectorAll('em, i').length;
  var linkCount = mainEl.querySelectorAll('a[href]').length;

  // ── Text structure elements ─────────────────────────────────────────────────
  var hasLists = !!mainEl.querySelector('ul, ol');
  var listCount = mainEl.querySelectorAll('ul, ol').length;
  var tableCount = mainEl.querySelectorAll('table').length;
  var blockquoteCount = mainEl.querySelectorAll('blockquote').length;

  // ── Paragraphs ──────────────────────────────────────────────────────────────
  var paragraphs = Array.prototype.slice.call(mainEl.querySelectorAll('p')).filter(function(p) {
    return (p.textContent || '').trim().length > 20;
  });
  var avgParaWords = paragraphs.length > 0
    ? Math.round(paragraphs.reduce(function(s, p) {
        return s + (p.textContent || '').trim().split(/\s+/).length;
      }, 0) / paragraphs.length)
    : 0;

  // ── Keyword extraction from title/H1 ────────────────────────────────────────
  var titleText = (document.title || '').trim().toLowerCase();
  var h1El = document.querySelector('h1');
  var h1Text = h1El ? (h1El.innerText || '').trim().toLowerCase() : '';
  var h2H3Els = Array.prototype.slice.call(mainEl.querySelectorAll('h2, h3'));

  // Get seed keywords from title (meaningful words > 3 chars)
  var titleKeywords = titleText.split(/\s+/).filter(function(w) {
    return w.length > 3 && !NLP_STOP_WORDS[w];
  });

  // Get seed keywords from H1
  var h1Keywords = h1Text.split(/\s+/).filter(function(w) {
    return w.length > 3 && !NLP_STOP_WORDS[w];
  });

  // Check keyword presence in first paragraph
  var firstParaText = '';
  if (paragraphs.length > 0) {
    firstParaText = (paragraphs[0].textContent || '').trim().toLowerCase();
  }

  // Check keyword presence in last paragraph (conclusion)
  var lastParaText = '';
  if (paragraphs.length > 0) {
    lastParaText = (paragraphs[paragraphs.length - 1].textContent || '').trim().toLowerCase();
  }

  // Check keyword presence in H2/H3 headings
  var h2h3Texts = h2H3Els.map(function(h) { return (h.innerText || '').trim().toLowerCase(); });

  // ── Passive voice detection (approximate, English) ──────────────────────────
  var passivePatterns = /\b(is|are|was|were|been|being|has been|have been|had been)\s+[a-zа-я]+\s*(ed|ing|nt|n|st|wn|pt|ld|t)\b/gi;
  var passiveMatches = text.match(passivePatterns);
  var passiveCount = passiveMatches ? passiveMatches.length : 0;

  // ── Text repetition — detect duplicate sentences ────────────────────────────
  var sentenceNorms = sentences.map(function(s) {
    return s.trim().toLowerCase().replace(/[^\wа-яіїєёäöüßàâçéèêëîïôùûüÿæœáéíóúñàáâãäåèéêëìíîïòóôõöùúûüýÿ\s]/g, '');
  }).filter(function(s) { return s.length > 20; });
  var dupSentences = [];
  var seenSentences = {};
  sentenceNorms.forEach(function(s) {
    if (seenSentences[s]) {
      dupSentences.push(s.substring(0, 80) + '…');
    } else {
      seenSentences[s] = true;
    }
  });

  // ── Lexical diversity ───────────────────────────────────────────────────────
  var lexicalDiversity = words.length > 0 ? (uniqueWords / meaningfulWords.length * 100).toFixed(1) : 0;

  // ═════════════════════════════════════════════════════════════════════════════
  // ── Issues ──────────────────────────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════════════════

  // Overview (always first)
  issues.push({
    type: 'nlp_stats',
    message: 'Text Statistics',
    severity: 'info',
    detail: [
      'Words                ' + words.length,
      'Meaningful words     ' + meaningfulWords.length,
      'Unique words         ' + uniqueWords,
      'Lexical diversity    ' + lexicalDiversity + '%',
      'Sentences            ' + sentences.length,
      'Paragraphs           ' + paragraphs.length,
      'Avg words/sentence   ' + (avgSentLen ? Math.round(avgSentLen) : '—'),
      'Avg words/paragraph  ' + (avgParaWords || '—'),
      'Readability (ARI)    ' + (ari !== null ? ari + ' — ' + ariGrade : '—'),
      'Flesch Reading Ease  ' + (flesch !== null ? flesch + ' — ' + fleschGrade : '—'),
      'Gunning Fog          ' + (gunningFog !== null ? gunningFog + (gunningFog > 15 ? ' — very complex' : gunningFog > 12 ? ' — complex' : gunningFog > 9 ? ' — standard' : ' — easy') : '—'),
      'Transition words     ' + transitionCount,
      'Question sentences   ' + questionSentences,
      'Exclamation marks    ' + exclamationSentences,
      'Numbers/data points  ' + hasNumbers + (hasPercentages ? ' (incl. ' + hasPercentages + ' %)' : ''),
      'Lists                ' + listCount,
      'Tables               ' + tableCount,
      'Blockquotes          ' + blockquoteCount,
      'Bold/italic          ' + boldCount + '/' + italicCount,
      'Internal links       ' + linkCount,
      'URLs in text         ' + contentUrls,
      'All-caps words       ' + allCapsWords.length,
      'Passive voice        ' + passiveCount + ' occurrences',
      'Duplicate sentences  ' + dupSentences.length,
      'Page language        ' + pageLang,
      'Top words            ' + (sortedWords.length > 0 ? sortedWords.slice(0, 5).map(function(w) { return w + ' ×' + freq[w]; }).join(', ') : '—'),
      'Top bigrams          ' + (topBigrams.length > 0 ? topBigrams.map(function(b) { return '"' + b + '" ×' + bigrams[b]; }).join(', ') : '—'),
      'Top trigrams         ' + (topTrigrams.length > 0 ? topTrigrams.map(function(t) { return '"' + t + '" ×' + trigrams[t]; }).join(', ') : '—')
    ].join('\n')
  });

  // ── Readability warnings ────────────────────────────────────────────────────
  if (ari !== null && ari > 14) {
    issues.push({
      type: 'low_readability',
      message: 'Low text readability (ARI = ' + ari + ')',
      severity: 'notice',
      detail: 'Automated Readability Index > 14 — text is at postgraduate level. Simplify sentences and use fewer complex words.'
    });
  }

  if (flesch !== null && flesch < 30) {
    issues.push({
      type: 'flesch_too_complex',
      message: 'Flesch Reading Ease very low (' + flesch + ') — text is very difficult to read',
      severity: 'notice',
      detail: 'Flesch score below 30 indicates graduate-level complexity. Aim for 60-80 for web content.'
    });
  }

  if (gunningFog !== null && gunningFog > 18) {
    issues.push({
      type: 'gunning_fog_high',
      message: 'Gunning Fog Index very high (' + gunningFog + ') — overly complex text',
      severity: 'notice',
      detail: 'Gunning Fog > 18 means college graduate reading level. Reduce complex words and sentence length.'
    });
  }

  // ── Sentence length ─────────────────────────────────────────────────────────
  if (sentences.length >= 5 && avgSentLen > maxSentenceWords) {
    issues.push({
      type: 'long_sentences',
      message: 'Average sentence length: ' + Math.round(avgSentLen) + ' words (recommended up to ' + maxSentenceWords + ')',
      severity: 'notice'
    });
  }

  // ── Paragraph length ────────────────────────────────────────────────────────
  var longParagraphs = paragraphs.filter(function(p) {
    return (p.textContent || '').trim().split(/\s+/).length > 150;
  });
  if (longParagraphs.length > 0) {
    issues.push({
      type: 'long_paragraphs',
      message: 'Long paragraphs (150+ words): ' + longParagraphs.length,
      severity: 'notice',
      detail: 'Long paragraphs are harder to read on web. Recommended 50–150 words per paragraph.'
    });
  }

  // ── Transition words density ────────────────────────────────────────────────
  if (words.length > 200 && transitionCount === 0) {
    issues.push({
      type: 'no_transition_words',
      message: 'No transition words found in ' + words.length + '-word text',
      severity: 'notice',
      detail: 'Transition words (however, therefore, moreover, etc.) improve text flow and readability.'
    });
  } else if (words.length > 500) {
    var transRatio = transitionCount / (words.length / 100);
    if (transRatio < 0.5) {
      issues.push({
        type: 'low_transition_words',
        message: 'Low transition word density (' + transitionCount + ' in ' + words.length + ' words)',
        severity: 'notice',
        detail: 'Aim for at least 1 transition word per 100 words for better text cohesion.'
      });
    }
  }

  // ── Question sentences ──────────────────────────────────────────────────────
  if (words.length > 300 && questionSentences === 0) {
    issues.push({
      type: 'no_questions',
      message: 'No question sentences in ' + words.length + '-word text',
      severity: 'notice',
      detail: 'Rhetorical questions engage readers and can match featured snippet patterns.'
    });
  }

  // ── Exclamation ratio ───────────────────────────────────────────────────────
  if (exclamationSentences > 0 && words.length > 0) {
    var exclRatio = exclamationSentences / words.length * 100;
    if (exclRatio > 0.5) {
      issues.push({
        type: 'too_many_exclamations',
        message: 'Excessive exclamation marks (' + exclamationSentences + ' — ' + exclRatio.toFixed(1) + '% of text)',
        severity: 'notice',
        detail: 'Too many exclamations can make content appear spammy or unprofessional.'
      });
    }
  }

  // ── All-caps words ──────────────────────────────────────────────────────────
  if (allCapsWords.length > 3) {
    issues.push({
      type: 'excessive_all_caps',
      message: 'All-caps words detected (' + allCapsWords.length + ')',
      severity: 'notice',
      detail: 'Excessive use of ALL-CAPS can appear unprofessional. Use sparingly for emphasis.\nExamples: ' + allCapsWords.slice(0, 5).join(', ')
    });
  }

  // ── Passive voice ───────────────────────────────────────────────────────────
  if (passiveCount > 0 && sentences.length > 0) {
    var passiveRatio = passiveCount / sentences.length * 100;
    if (passiveRatio > 25) {
      issues.push({
        type: 'high_passive_voice',
        message: 'High passive voice usage (' + passiveCount + ' instances, ~' + passiveRatio.toFixed(0) + '% of sentences)',
        severity: 'notice',
        detail: 'Excessive passive voice makes text harder to read. Prefer active voice where possible.'
      });
    }
  }

  // ── Duplicate sentences ─────────────────────────────────────────────────────
  if (dupSentences.length > 0) {
    issues.push({
      type: 'duplicate_sentences',
      message: 'Duplicate sentences detected (' + dupSentences.length + ')',
      severity: 'notice',
      detail: 'Repeated sentences may indicate copy-paste errors or low content quality.\n' + dupSentences.slice(0, 3).join('\n')
    });
  }

  // ── Lexical diversity ───────────────────────────────────────────────────────
  if (meaningfulWords.length > 50 && parseFloat(lexicalDiversity) < 30) {
    issues.push({
      type: 'low_lexical_diversity',
      message: 'Low lexical diversity (' + lexicalDiversity + '%)',
      severity: 'notice',
      detail: 'Below 30% unique-to-meaningful word ratio suggests repetitive content. Use synonyms and varied phrasing.'
    });
  }

  // ── Keyword presence: title words in body text ──────────────────────────────
  if (titleKeywords.length > 0 && words.length > 0) {
    var titleWordsInText = titleKeywords.filter(function(kw) {
      return textLower.indexOf(kw) !== -1;
    });
    if (titleWordsInText.length === 0 && titleKeywords.length >= 2) {
      issues.push({
        type: 'title_keywords_missing_in_text',
        message: 'Title keywords not found in body text',
        severity: 'warning',
        detail: 'Words from <title> should appear in the content. Title keywords: ' + titleKeywords.slice(0, 5).join(', ')
      });
    } else if (titleWordsInText.length < titleKeywords.length * 0.5 && titleKeywords.length >= 3) {
      issues.push({
        type: 'title_keywords_partial_match',
        message: 'Only ' + titleWordsInText.length + ' of ' + titleKeywords.length + ' title keywords found in text',
        severity: 'notice',
        detail: 'Missing: ' + titleKeywords.filter(function(kw) { return textLower.indexOf(kw) === -1; }).join(', ')
      });
    }
  }

  // ── Keyword presence: H1 words in body text ─────────────────────────────────
  if (h1Keywords.length > 0 && words.length > 0) {
    var h1WordsInText = h1Keywords.filter(function(kw) {
      return textLower.indexOf(kw) !== -1;
    });
    if (h1WordsInText.length === 0 && h1Keywords.length >= 2) {
      issues.push({
        type: 'h1_keywords_missing_in_text',
        message: 'H1 keywords not found in body text',
        severity: 'warning',
        detail: 'H1 topic words should be reflected in the content. H1 keywords: ' + h1Keywords.slice(0, 5).join(', ')
      });
    }
  }

  // ── Keyword presence: title vs H1 alignment ─────────────────────────────────
  if (titleKeywords.length > 0 && h1Keywords.length > 0) {
    var commonTitleH1 = titleKeywords.filter(function(kw) {
      return h1Keywords.indexOf(kw) !== -1;
    });
    if (commonTitleH1.length === 0 && titleKeywords.length >= 2 && h1Keywords.length >= 2) {
      issues.push({
        type: 'title_h1_no_overlap',
        message: 'Title and H1 share no meaningful keywords',
        severity: 'notice',
        detail: 'Title keywords: ' + titleKeywords.slice(0, 5).join(', ') + '\nH1 keywords: ' + h1Keywords.slice(0, 5).join(', ')
      });
    }
  }

  // ── Keyword in first paragraph ──────────────────────────────────────────────
  if (titleKeywords.length > 0 && firstParaText) {
    var firstParaHasKw = titleKeywords.some(function(kw) {
      return firstParaText.indexOf(kw) !== -1;
    });
    if (!firstParaHasKw) {
      issues.push({
        type: 'keyword_missing_first_paragraph',
        message: 'Primary keywords not in first paragraph',
        severity: 'notice',
        detail: 'Key topic words from title should appear early in the content.\nMissing: ' + titleKeywords.slice(0, 5).join(', ')
      });
    }
  }

  // ── Keyword in headings (H2/H3) ─────────────────────────────────────────────
  if (titleKeywords.length > 0 && h2H3Els.length > 0) {
    var headingHasKw = h2h3Texts.some(function(h) {
      return titleKeywords.some(function(kw) { return h.indexOf(kw) !== -1; });
    });
    if (!headingHasKw) {
      issues.push({
        type: 'keyword_missing_headings',
        message: 'Primary keywords not in any H2/H3 subheading',
        severity: 'notice',
        detail: 'Topic keywords should appear in subheadings for better structure and SEO.\nMissing from H2/H3: ' + titleKeywords.slice(0, 5).join(', ')
      });
    }
  }

  // ── Keyword in conclusion (last paragraph) ──────────────────────────────────
  if (titleKeywords.length > 0 && lastParaText && paragraphs.length >= 3) {
    var lastParaHasKw = titleKeywords.some(function(kw) {
      return lastParaText.indexOf(kw) !== -1;
    });
    if (!lastParaHasKw) {
      issues.push({
        type: 'keyword_missing_conclusion',
        message: 'Primary keywords not in concluding paragraph',
        severity: 'notice',
        detail: 'Key topic words should reinforce the conclusion.\nMissing: ' + titleKeywords.slice(0, 5).join(', ')
      });
    }
  }

  // ── Text structure: no lists in long content ────────────────────────────────
  if (!hasLists && words.length > 500) {
    issues.push({
      type: 'no_lists',
      message: 'Long content (' + words.length + ' words) without any lists (ul/ol)',
      severity: 'notice',
      detail: 'Lists improve scannability and can earn featured snippets.'
    });
  }

  // ── Text structure: no blockquotes ──────────────────────────────────────────
  if (blockquoteCount === 0 && words.length > 800) {
    issues.push({
      type: 'no_blockquotes',
      message: 'No blockquotes in ' + words.length + '-word text',
      severity: 'notice',
      detail: 'Blockquotes can enhance E-E-A-T by citing sources and experts.'
    });
  }

  // ── Text structure: low bold/italic usage ───────────────────────────────────
  if (words.length > 500 && boldCount === 0 && italicCount === 0) {
    issues.push({
      type: 'no_inline_emphasis',
      message: 'No bold or italic emphasis in ' + words.length + '-word text',
      severity: 'notice',
      detail: 'Strategic use of <strong> and <em> improves readability and highlights key points.'
    });
  }

  // ── Numbers and data ────────────────────────────────────────────────────────
  if (hasNumbers === 0 && words.length > 500) {
    issues.push({
      type: 'no_numbers_in_text',
      message: 'No numbers or data points in ' + words.length + '-word text',
      severity: 'notice',
      detail: 'Including statistics, percentages, and data improves credibility and E-E-A-T.'
    });
  }

  // ── URLs in content ─────────────────────────────────────────────────────────
  if (contentUrls === 0 && words.length > 500) {
    issues.push({
      type: 'no_source_urls',
      message: 'No source URLs in ' + words.length + '-word text',
      severity: 'notice',
      detail: 'Linking to authoritative sources improves E-E-A-T and reader trust.'
    });
  }

  return { id: 'nlp', name: 'NLP / Text', issues: issues };
}
