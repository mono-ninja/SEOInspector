function runAiVisibilityChecker(p) {
  var issues = [];

  // Collect JSON-LD data once
  var ldData = [];
  Array.prototype.slice.call(document.querySelectorAll('script[type="application/ld+json"]')).forEach(function(script) {
    try { ldData.push(JSON.parse(script.textContent || '')); } catch(e) {}
  });

  function schemaHas(key) {
    return ldData.some(function(d) {
      if (d[key]) return true;
      if (Array.isArray(d['@graph'])) return d['@graph'].some(function(n) { return !!n[key]; });
      return false;
    });
  }

  // Detect article-like page — includes Schema.org article types
  var ogType = document.querySelector('meta[property="og:type"]');
  var articleSchemaTypes = ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'ScholarlyArticle', 'Report'];
  function matchesArticleType(rawType) {
    var types = Array.isArray(rawType) ? rawType : [rawType || ''];
    return types.some(function(t) { return articleSchemaTypes.indexOf(t) !== -1; });
  }
  var isArticle = !!document.querySelector('article') ||
    (ogType && ogType.getAttribute('content') === 'article') ||
    !!document.querySelector('meta[property="article:published_time"]') ||
    ldData.some(function(d) {
      if (matchesArticleType(d['@type'])) return true;
      if (Array.isArray(d['@graph'])) return d['@graph'].some(function(n) { return matchesArticleType(n['@type']); });
      return false;
    });

  // ── Article-specific checks ──────────────────────────────────────────────────

  if (isArticle) {
    // Author (E-E-A-T signal)
    var authorMeta = document.querySelector(
      'meta[name="author"], meta[property="article:author"], [rel="author"], [itemprop="author"]'
    );
    if (!authorMeta && !schemaHas('author')) {
      issues.push({
        type: 'missing_author',
        message: 'Missing content author (E-E-A-T signal)',
        severity: 'notice'
      });
    }

    // Publish date
    var dateMeta = document.querySelector(
      'meta[property="article:published_time"], meta[name="date"], time[datetime], [itemprop="datePublished"]'
    );
    if (!dateMeta && !schemaHas('datePublished') && !schemaHas('dateModified')) {
      issues.push({
        type: 'missing_publish_date',
        message: 'Missing publication or update date for content',
        severity: 'notice'
      });
    }

    // Freshness: article older than 2 years without dateModified
    var pubDateStr = null;
    var pubEl = document.querySelector('meta[property="article:published_time"], [itemprop="datePublished"]');
    if (pubEl) {
      pubDateStr = pubEl.getAttribute('content') || pubEl.getAttribute('datetime') || pubEl.textContent || null;
    }
    if (!pubDateStr) {
      ldData.some(function(d) {
        if (d.datePublished) { pubDateStr = d.datePublished; return true; }
        if (Array.isArray(d['@graph'])) return d['@graph'].some(function(n) { if (n.datePublished) { pubDateStr = n.datePublished; return true; } return false; });
        return false;
      });
    }
    if (pubDateStr) {
      var pubDate = new Date(pubDateStr);
      if (!isNaN(pubDate.getTime())) {
        var ageMonths = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        var hasModified = !!document.querySelector('meta[property="article:modified_time"], [itemprop="dateModified"]') || schemaHas('dateModified');
        if (ageMonths > 24 && !hasModified) {
          issues.push({
            type: 'stale_content',
            message: 'Content has not been updated for more than 2 years — negative signal for AI ranking',
            severity: 'notice',
            detail: 'Publication date: ' + pubDate.toLocaleDateString('en-GB') + '. Add dateModified or update the content.'
          });
        }
      }
    }
  }

  // ── Site-wide E-E-A-T checks ─────────────────────────────────────────────────

  var allAnchors = Array.prototype.slice.call(document.querySelectorAll('a[href]'));

  var aboutKeywords = ['/about', '/about-us', '/about_us', '/про-нас', '/pro-nas'];
  var aboutTexts = ['about us', 'about', 'про нас', 'про компанію'];
  var hasAbout = allAnchors.some(function(a) {
    var href = (a.getAttribute('href') || '').toLowerCase();
    var text = (a.textContent || '').toLowerCase().trim();
    return aboutKeywords.some(function(k) { return href.indexOf(k) !== -1; }) ||
      aboutTexts.indexOf(text) !== -1;
  });
  if (!hasAbout) {
    issues.push({
      type: 'missing_about_link',
      message: 'Missing link to "About Us" page (E-E-A-T trust signal)',
      severity: 'notice'
    });
  }

  var contactKeywords = ['/contact', '/contacts', '/контакти', '/contact-us', '/зворотній-звязок'];
  var contactTexts = ['contact us', 'contacts', 'contact', 'контакти', "зв'язатися", 'зворотній зв\'язок'];
  var hasContact = allAnchors.some(function(a) {
    var href = (a.getAttribute('href') || '').toLowerCase();
    var text = (a.textContent || '').toLowerCase().trim();
    return contactKeywords.some(function(k) { return href.indexOf(k) !== -1; }) ||
      contactTexts.indexOf(text) !== -1;
  });
  if (!hasContact) {
    issues.push({
      type: 'missing_contact_link',
      message: 'Missing link to "Contacts" page (E-E-A-T trust signal)',
      severity: 'notice'
    });
  }

  // ── AI crawling / snippet checks ─────────────────────────────────────────────

  var robotsMeta = document.querySelector('meta[name="robots"]');
  var robotsContent = (robotsMeta ? robotsMeta.getAttribute('content') : '') || '';

  if (robotsContent.indexOf('noai') !== -1 || robotsContent.indexOf('noimageai') !== -1) {
    issues.push({
      type: 'ai_content_blocked',
      message: 'Content is blocked from AI training (noai / noimageai in meta robots)',
      severity: 'notice',
      detail: robotsContent
    });
  }

  if (robotsContent.indexOf('nosnippet') !== -1) {
    issues.push({
      type: 'ai_snippet_blocked',
      message: 'nosnippet blocks AI responses (SGE, Perplexity, ChatGPT)',
      severity: 'warning',
      detail: 'Content will not appear in AI-generated answers or Google rich snippets.'
    });
  }

  var maxSnippetMatch = robotsContent.match(/max-snippet:\s*(-?\d+)/);
  if (maxSnippetMatch) {
    var maxSnippetVal = parseInt(maxSnippetMatch[1], 10);
    if (maxSnippetVal === 0) {
      issues.push({
        type: 'max_snippet_zero',
        message: 'max-snippet:0 in meta robots completely disables snippets',
        severity: 'warning',
        detail: robotsContent
      });
    } else if (maxSnippetVal > 0 && maxSnippetVal < 50) {
      issues.push({
        type: 'max_snippet_short',
        message: 'max-snippet:' + maxSnippetVal + ' severely limits AI snippets (recommended ≥ 160)',
        severity: 'notice',
        detail: robotsContent
      });
    }
  }

  // AI crawler-specific meta blocking
  var aiCrawlers = [
    { name: 'GPTBot',           label: 'ChatGPT training (OpenAI)' },
    { name: 'ChatGPT-User',     label: 'ChatGPT browsing (OpenAI)' },
    { name: 'Google-Extended',  label: 'Google Gemini / AI Overviews' },
    { name: 'CCBot',            label: 'Common Crawl (AI training)' },
    { name: 'anthropic-ai',     label: 'Claude training (Anthropic)' },
    { name: 'ClaudeBot',        label: 'Claude browsing (Anthropic)' },
    { name: 'PerplexityBot',    label: 'Perplexity AI' },
    { name: 'Applebot-Extended', label: 'Apple Intelligence' },
    { name: 'Bytespider',       label: 'ByteDance / TikTok AI' }
  ];
  var blockedCrawlers = [];
  aiCrawlers.forEach(function(crawler) {
    var meta = document.querySelector('meta[name="' + crawler.name + '"]');
    if (meta) {
      var content = (meta.getAttribute('content') || '').toLowerCase();
      if (content.indexOf('noindex') !== -1 || content.indexOf('nofollow') !== -1 || content.indexOf('none') !== -1) {
        blockedCrawlers.push(crawler.label);
      }
    }
  });
  if (blockedCrawlers.length > 0) {
    issues.push({
      type: 'ai_crawler_blocked',
      message: 'AI crawlers blocked via meta tags (' + blockedCrawlers.length + ')',
      severity: 'notice',
      detail: blockedCrawlers.join(', ')
    });
  }

  // data-nosnippet coverage
  var nosnippetEls = Array.prototype.slice.call(document.querySelectorAll('[data-nosnippet]'));
  if (nosnippetEls.length > 0) {
    var blockedChars = nosnippetEls.reduce(function(sum, el) { return sum + (el.textContent || '').length; }, 0);
    var totalChars = (document.body ? document.body.textContent : '').length || 1;
    var pct = Math.round(blockedChars / totalChars * 100);
    if (pct > 20) {
      issues.push({
        type: 'data_nosnippet_high',
        message: 'A significant portion of content is hidden from AI snippets via data-nosnippet (~' + pct + '%)',
        severity: 'notice',
        detail: 'Found ' + nosnippetEls.length + ' elements with the data-nosnippet attribute.'
      });
    }
  }

  // E-E-A-T: Physical address — only relevant for local/service businesses
  var localBizTypes = ['LocalBusiness','Store','Restaurant','Hotel','MedicalOrganization','HealthAndBeautyBusiness',
    'FoodEstablishment','LodgingBusiness','AutomotiveBusiness','SportsActivityLocation','TouristAttraction'];
  var isLocalBiz = ldData.some(function(d) {
    var types = Array.isArray(d['@type']) ? d['@type'] : [d['@type'] || ''];
    if (types.some(function(t) { return localBizTypes.indexOf(t) !== -1; })) return true;
    if (Array.isArray(d['@graph'])) return d['@graph'].some(function(n) {
      var nt = Array.isArray(n['@type']) ? n['@type'] : [n['@type'] || ''];
      return nt.some(function(t) { return localBizTypes.indexOf(t) !== -1; });
    });
    return false;
  }) || !!document.querySelector('[itemtype*="LocalBusiness"]');
  if (isLocalBiz) {
    var hasAddress = !!document.querySelector('[itemtype*="PostalAddress"], [itemprop="address"]') ||
      ldData.some(function(d) {
        if (d.address) return true;
        if (Array.isArray(d['@graph'])) return d['@graph'].some(function(n) { return !!n.address; });
        return false;
      });
    if (!hasAddress) {
      var addrKeywords = ['вул.', 'просп.', 'бульв.', 'street', 'avenue', 'адреса', 'address'];
      var bodyText2 = document.body ? (document.body.innerText || '').toLowerCase() : '';
      hasAddress = addrKeywords.some(function(k) { return bodyText2.indexOf(k) !== -1; });
    }
    if (!hasAddress) {
      issues.push({ type: 'missing_physical_address', message: 'Missing physical address (E-E-A-T signal for local business)', severity: 'notice' });
    }
  }

  // E-E-A-T: Terms of Service link
  var tosKeywords = ['/terms', '/terms-of-service', '/terms-of-use', '/tos', '/умови', '/умови-використання'];
  var tosTexts = ['terms of service', 'terms of use', 'terms & conditions', 'умови використання', 'умови надання послуг'];
  var hasTos = allAnchors.some(function(a) {
    var href = (a.getAttribute('href') || '').toLowerCase();
    var text = (a.textContent || '').toLowerCase().trim();
    return tosKeywords.some(function(k) { return href.indexOf(k) !== -1; }) ||
      tosTexts.some(function(t) { return text.indexOf(t) !== -1; });
  });
  if (!hasTos) {
    issues.push({ type: 'missing_terms_of_service', message: 'Missing link to Terms of Service / Terms of Use', severity: 'notice' });
  }

  // E-E-A-T: Affiliate disclosure
  var affiliateLinks = allAnchors.filter(function(a) {
    var href = (a.getAttribute('href') || '');
    return /[?&](ref|aff|affiliate|partner|utm_source)=/i.test(href) || /\/go\/|\/out\/|\/recommend\//i.test(href);
  });
  if (affiliateLinks.length > 0) {
    var disclosureKeywords = ['affiliate', 'disclosure', 'sponsored', 'реклама', 'партнерськ', 'спонсор'];
    var bodyText3 = document.body ? (document.body.innerText || '').toLowerCase() : '';
    var hasDisclosure = disclosureKeywords.some(function(k) { return bodyText3.indexOf(k) !== -1; });
    if (!hasDisclosure) {
      issues.push({
        type: 'missing_affiliate_disclosure',
        message: 'Found affiliate links (' + affiliateLinks.length + ') without explicit disclosure',
        severity: 'notice',
        detail: 'The FTC requires disclosure of affiliate relationships. Add disclosure text.'
      });
    }
  }

  // ── AI Overview / SGE schema checks ─────────────────────────────────────────

  // FAQPage / QAPage — strongest signal for Google AI Overviews and SGE inclusion
  var hasFaq = ldData.some(function(d) {
    var types = Array.isArray(d['@type']) ? d['@type'] : [d['@type'] || ''];
    if (types.some(function(t) { return t === 'FAQPage' || t === 'QAPage'; })) return true;
    if (Array.isArray(d['@graph'])) return d['@graph'].some(function(n) {
      var nt = Array.isArray(n['@type']) ? n['@type'] : [n['@type'] || ''];
      return nt.some(function(t) { return t === 'FAQPage' || t === 'QAPage'; });
    });
    return false;
  });
  var hasQaContent = document.querySelectorAll('[itemprop="mainEntity"], details, .faq, .faq-item, [class*="faq"]').length > 0;
  if (!hasFaq && hasQaContent) {
    issues.push({
      type: 'missing_faq_schema',
      message: 'FAQ-like content found but no FAQPage schema markup',
      severity: 'notice',
      detail: 'FAQPage / QAPage JSON-LD is a primary signal for inclusion in Google AI Overviews and SGE.'
    });
  }

  // speakable schema — used by voice AI assistants (Google Assistant, Siri)
  var hasSpeakable = schemaHas('speakable') ||
    !!document.querySelector('[itemprop="speakable"]');
  if (!hasSpeakable && isArticle) {
    issues.push({
      type: 'missing_speakable',
      message: 'No speakable schema (used by voice AI assistants)',
      severity: 'notice',
      detail: 'SpeakableSpecification marks which sections of the article are suitable for text-to-speech.'
    });
  }

  // og:description for AI snippet quality
  var ogDesc = document.querySelector('meta[property="og:description"]');
  var metaDesc = document.querySelector('meta[name="description"]');
  if (!ogDesc && !metaDesc) {
    issues.push({
      type: 'missing_description_for_ai',
      message: 'Missing meta description and og:description — reduces AI snippet quality',
      severity: 'warning'
    });
  }

  return { id: 'ai_visibility', name: 'AI / E-E-A-T', issues: issues };
}
