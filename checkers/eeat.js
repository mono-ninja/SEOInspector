function runEeatChecker(p) {
  var issues = [];

  var allAnchors = Array.prototype.slice.call(document.querySelectorAll('a[href]'));
  var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');

  // Collect JSON-LD data once
  var ldData = [];
  Array.prototype.slice.call(document.querySelectorAll('script[type="application/ld+json"]')).forEach(function(s) {
    try { ldData.push(JSON.parse(s.textContent || '')); } catch(e) {}
  });

  // External authoritative citations
  var authDomains = [
    'wikipedia.org', '.gov', 'who.int', 'ncbi.nlm.nih.gov', 'pubmed.ncbi', 'doi.org',
    'researchgate.net', 'scholar.google', 'nature.com', 'sciencedirect.com',
    'reuters.com', 'gov.ua', 'rada.gov.ua', 'kmu.gov.ua',
    'europa.eu', 'un.org', 'worldbank.org', 'imf.org', 'bbc.com', 'ieee.org', 'webmd.com'
  ];
  var citations = allAnchors.filter(function(a) {
    var href = (a.getAttribute('href') || '').toLowerCase();
    try {
      var url = new URL(href);
      var host = url.hostname.toLowerCase();
      if (host === currentHost) return false;
      return authDomains.some(function(d) { return host.indexOf(d) !== -1; });
    } catch(e) { return false; }
  });

  // Author bio/page link (rel=author, /author/ path, or JSON-LD author.url)
  var ldAuthorUrl = null;
  ldData.some(function(d) {
    var nodes = Array.isArray(d['@graph']) ? d['@graph'] : [d];
    return nodes.some(function(n) {
      var author = n.author;
      if (!author) return false;
      var candidates = Array.isArray(author) ? author : [author];
      return candidates.some(function(a) {
        if (a && a.url) { ldAuthorUrl = a.url; return true; }
        return false;
      });
    });
  });
  var hasAuthorPageLink = !!ldAuthorUrl || allAnchors.some(function(a) {
    var href = (a.getAttribute('href') || '').toLowerCase();
    var rel = (a.getAttribute('rel') || '').toLowerCase();
    return rel.indexOf('author') !== -1 ||
           href.indexOf('/author/') !== -1 || href.indexOf('/authors/') !== -1 ||
           href.indexOf('/про-автора') !== -1;
  });

  // Professional credentials in body text (first 5000 chars to avoid scanning huge pages)
  var bodyText = document.body ? (document.body.textContent || '').substring(0, 5000) : '';
  var credentialPatterns = [
    /\bд\.м\.н\b|\bphd\b|\bд\.ф\.н\b|\bпрофесор\b|\bдоктор\b/i,
    /\bmd\b|\bcpa\b|\bmba\b|\bllm\b/i,
    /\bкандидат наук\b|\bдоктор наук\b/i
  ];
  var hasCredentials = credentialPatterns.some(function(re) { return re.test(bodyText); });

  // YMYL detection
  var ymylPatterns = [
    /\bмедицин|\bліку[єю]|\bдіагноз|\bсимптом|\bхвороб/i,
    /\bінвестиц|\bкредит\b|\bпозик|\bстрахув|\bфінансов/i,
    /\bюридич|\bзакон\b|\bправов|\bадвокат\b/i
  ];
  var isYMYL = ymylPatterns.some(function(re) { return re.test(bodyText); });

  // Social media links
  var socialDomains = ['twitter.com', 'x.com', 'linkedin.com', 'facebook.com', 'instagram.com', 'youtube.com'];
  var hasSocialLinks = allAnchors.some(function(a) {
    var href = (a.getAttribute('href') || '').toLowerCase();
    return socialDomains.some(function(d) { return href.indexOf(d) !== -1; });
  });

  // Privacy policy link
  var hasPrivacy = allAnchors.some(function(a) {
    var href = (a.getAttribute('href') || '').toLowerCase();
    var text = (a.textContent || '').toLowerCase();
    return href.indexOf('privacy') !== -1 || href.indexOf('конфіденц') !== -1 ||
           text.indexOf('privacy') !== -1 || text.indexOf('конфіденц') !== -1;
  });

  var wordCount = bodyText.trim().split(/\s+/).filter(function(w) { return w; }).length;

  issues.push({
    type: 'eeat_overview',
    message: 'E-E-A-T — Experience, Expertise, Authoritativeness, Trustworthiness',
    severity: 'info',
    detail: [
      'Authoritative citations ' + citations.length,
      'Social media links      ' + (hasSocialLinks ? '✓' : '✗'),
      'Author page link        ' + (hasAuthorPageLink ? '✓' : '✗'),
      'Credentials in text     ' + (hasCredentials ? '✓' : '✗'),
      'YMYL content            ' + (isYMYL ? 'detected' : 'not detected'),
      'Privacy Policy          ' + (hasPrivacy ? '✓' : '✗'),
    ].join('\n')
  });

  if (citations.length === 0 && wordCount > 400) {
    issues.push({
      type: 'no_authoritative_citations',
      message: 'No links to authoritative external sources',
      severity: 'notice',
      detail: 'Links to Wikipedia, scientific databases, government sites (.gov) confirm content credibility (E-E-A-T Expertise signal).'
    });
  }

  if (isYMYL && !hasCredentials) {
    issues.push({
      type: 'ymyl_no_credentials',
      message: 'YMYL content without author credentials',
      severity: 'warning',
      detail: 'Google applies elevated E-E-A-T requirements to medical, financial, and legal pages. Add information about the author\'s education/experience.'
    });
  }

  if (isYMYL && citations.length < 2) {
    issues.push({
      type: 'ymyl_insufficient_citations',
      message: 'YMYL page with insufficient authoritative primary sources',
      severity: 'warning',
      detail: 'For YMYL content, a minimum of 2–3 links to authoritative primary sources is recommended.'
    });
  }

  var hasAnyAuthor = !!document.querySelector('[itemprop="author"], [rel="author"], meta[name="author"], meta[property="article:author"]') ||
    ldData.some(function(d) {
      var nodes = Array.isArray(d['@graph']) ? d['@graph'] : [d];
      return nodes.some(function(n) { return !!n.author; });
    });
  if (hasAnyAuthor && !hasAuthorPageLink) {
    issues.push({
      type: 'author_no_bio_page',
      message: 'Author specified but no link to author bio page',
      severity: 'notice',
      detail: 'Add rel="author" or a link to the /author/ page. This confirms the author\'s identity (E-E-A-T Trustworthiness).'
    });
  }

  if (!hasSocialLinks) {
    issues.push({
      type: 'no_social_links',
      message: 'No social media links',
      severity: 'notice',
      detail: 'Links to LinkedIn, Twitter/X or other profiles confirm the identity of the company or author.'
    });
  }

  if (!hasPrivacy) {
    issues.push({
      type: 'missing_privacy_policy_eeat',
      message: 'Missing Privacy Policy link',
      severity: 'warning',
      detail: 'Privacy Policy is a GDPR requirement and a trust signal (Trustworthiness) for Google E-E-A-T.'
    });
  }

  // Organization / WebSite schema — basic E-E-A-T identity signal
  var orgTypes = ['Organization', 'Corporation', 'LocalBusiness', 'NGO', 'NewsMediaOrganization', 'WebSite'];
  var hasOrgSchema = ldData.some(function(d) {
    var nodes = Array.isArray(d['@graph']) ? d['@graph'] : [d];
    return nodes.some(function(n) {
      var types = Array.isArray(n['@type']) ? n['@type'] : [n['@type'] || ''];
      return types.some(function(t) { return orgTypes.indexOf(t) !== -1; });
    });
  });
  if (!hasOrgSchema) {
    issues.push({
      type: 'missing_org_schema',
      message: 'Missing Organization or WebSite schema markup',
      severity: 'notice',
      detail: 'Organization / WebSite JSON-LD establishes entity identity for Google\'s Knowledge Graph (E-E-A-T Authoritativeness).'
    });
  }

  // sameAs — connects entity to external profiles (Wikipedia, social, Wikidata)
  var hasSameAs = ldData.some(function(d) {
    var nodes = Array.isArray(d['@graph']) ? d['@graph'] : [d];
    return nodes.some(function(n) {
      return n.sameAs && (Array.isArray(n.sameAs) ? n.sameAs.length > 0 : !!n.sameAs);
    });
  });
  if (!hasSameAs && hasOrgSchema) {
    issues.push({
      type: 'missing_sameas',
      message: 'Organization schema missing sameAs links to external profiles',
      severity: 'notice',
      detail: 'sameAs links (Wikipedia, LinkedIn, social media URLs) help Google confirm entity identity via Knowledge Graph.'
    });
  }

  return { id: 'eeat', name: 'E-E-A-T', issues: issues };
}
