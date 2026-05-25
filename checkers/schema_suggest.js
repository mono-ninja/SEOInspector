function runSchemaSuggestChecker(p) {
  var issues = [];

  // ── Collect existing schema types ───────────────────────────────────────────
  var existingTypes = [];
  Array.prototype.slice.call(document.querySelectorAll('script[type="application/ld+json"]')).forEach(function(script) {
    try {
      var data = JSON.parse(script.textContent || '');
      function collect(node) {
        if (!node || typeof node !== 'object') return;
        if (node['@type']) {
          var t = node['@type'];
          existingTypes = existingTypes.concat(Array.isArray(t) ? t : [t]);
        }
        if (Array.isArray(node['@graph'])) node['@graph'].forEach(collect);
      }
      collect(data);
    } catch(e) {}
  });

  // Also collect microdata types
  Array.prototype.forEach.call(document.querySelectorAll('[itemscope][itemtype]'), function(el) {
    var type = el.getAttribute('itemtype') || '';
    if (type) {
      var typeName = type.split('/').pop();
      if (typeName) existingTypes.push(typeName);
    }
  });

  function hasType() {
    for (var i = 0; i < arguments.length; i++) {
      if (existingTypes.indexOf(arguments[i]) !== -1) return true;
    }
    return false;
  }

  // ── Page signals ────────────────────────────────────────────────────────────
  var htmlText = (document.documentElement.textContent || '').toLowerCase().substring(0, 50000);
  var htmlOuter = (document.documentElement.outerHTML || '').toLowerCase().substring(0, 50000);
  var ogType = document.querySelector('meta[property="og:type"]');
  var ogTypeVal = ogType ? ogType.getAttribute('content') : '';
  var currentPath = (window.location.pathname || '').toLowerCase();
  var title = (document.title || '').toLowerCase();

  // Helper: check if any class/data attribute matches patterns
  function hasAttrPattern(patterns) {
    for (var pi = 0; pi < patterns.length; pi++) {
      if (htmlOuter.indexOf(patterns[pi]) !== -1) return true;
    }
    return false;
  }

  // ── Article / BlogPosting ───────────────────────────────────────────────────
  var isArticle = !!document.querySelector('article') ||
    ogTypeVal === 'article' ||
    currentPath.indexOf('/blog') !== -1 ||
    currentPath.indexOf('/post') !== -1 ||
    currentPath.indexOf('/article') !== -1 ||
    currentPath.indexOf('/news') !== -1;
  if (isArticle && !hasType('Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'ScholarlyArticle')) {
    issues.push({
      type: 'suggest_article_schema',
      message: 'Recommended: add Article or BlogPosting schema',
      severity: 'notice',
      detail: 'Detected article/blog signals: ' + (document.querySelector('article') ? '<article> tag' : '') + (ogTypeVal === 'article' ? ' og:type="article"' : '') + (currentPath.indexOf('/blog') !== -1 ? ' /blog/ in URL' : '')
    });
  }

  // ── Product / e-commerce ────────────────────────────────────────────────────
  var isProduct = hasAttrPattern(['add-to-cart', 'addtocart', 'data-product-id', 'product-item', 'product-card']) ||
    (htmlText.indexOf('buy now') !== -1 || htmlText.indexOf('купити') !== -1 || htmlText.indexOf('add to cart') !== -1) &&
    (htmlText.indexOf('price') !== -1 || htmlText.indexOf('ціна') !== -1);
  if (isProduct && !hasType('Product', 'Offer', 'AggregateOffer')) {
    issues.push({
      type: 'suggest_product_schema',
      message: 'Recommended: add Product schema (with Offer and AggregateRating)',
      severity: 'notice',
      detail: 'Detected e-commerce signals: cart buttons, pricing, buy actions'
    });
  }

  // ── FAQ ─────────────────────────────────────────────────────────────────────
  var isFaq = htmlText.indexOf('faq') !== -1 || htmlText.indexOf('frequently asked') !== -1 ||
    htmlText.indexOf('поширені питання') !== -1 || htmlText.indexOf('common questions') !== -1 ||
    htmlText.indexOf('questions and answers') !== -1 ||
    currentPath.indexOf('/faq') !== -1 ||
    !!document.querySelector('[itemtype*="FAQPage"]');
  if (isFaq && !hasType('FAQPage', 'QAPage')) {
    issues.push({
      type: 'suggest_faq_schema',
      message: 'Recommended: add FAQPage schema',
      severity: 'notice',
      detail: 'Detected FAQ content. FAQPage schema can earn rich results in SERP.'
    });
  }

  // ── LocalBusiness ───────────────────────────────────────────────────────────
  var hasAddress = !!document.querySelector('address') ||
    htmlText.indexOf('google.com/maps') !== -1 ||
    htmlText.indexOf('openstreetmap') !== -1 ||
    htmlText.indexOf('maps.apple.com') !== -1 ||
    currentPath.indexOf('/contact') !== -1 ||
    currentPath.indexOf('/contacts') !== -1 ||
    currentPath.indexOf('/office') !== -1;
  if (hasAddress && !hasType('LocalBusiness', 'Organization', 'Restaurant', 'Store', 'Dentist', 'VeterinaryCare')) {
    issues.push({
      type: 'suggest_localbusiness_schema',
      message: 'Recommended: add LocalBusiness or Organization schema',
      severity: 'notice',
      detail: 'Detected address or map. LocalBusiness schema helps with Google Maps and local SEO.'
    });
  }

  // ── Event ───────────────────────────────────────────────────────────────────
  var isEvent = (htmlText.indexOf('event') !== -1 || htmlText.indexOf('подія') !== -1 || htmlText.indexOf('концерт') !== -1) &&
    (htmlText.indexOf('register') !== -1 || htmlText.indexOf('ticket') !== -1 || htmlText.indexOf('квитки') !== -1 || htmlText.indexOf('buy ticket') !== -1 || htmlText.indexOf('registration') !== -1) ||
    currentPath.indexOf('/event') !== -1 || currentPath.indexOf('/events') !== -1;
  if (isEvent && !hasType('Event')) {
    issues.push({
      type: 'suggest_event_schema',
      message: 'Recommended: add Event schema',
      severity: 'notice',
      detail: 'Detected event content with registration/tickets. Event schema enables rich results.'
    });
  }

  // ── HowTo ───────────────────────────────────────────────────────────────────
  var isHowTo = (htmlText.indexOf('how to') !== -1 || htmlText.indexOf('як ') !== -1 || htmlText.indexOf('step by step') !== -1 || htmlText.indexOf('крок за кроком') !== -1) &&
    !!document.querySelector('ol li') && !hasType('HowTo');
  if (isHowTo) {
    issues.push({
      type: 'suggest_howto_schema',
      message: 'Recommended: add HowTo schema',
      severity: 'notice',
      detail: 'Detected instructional content with numbered steps. HowTo schema earns rich results.'
    });
  }

  // ── Recipe ──────────────────────────────────────────────────────────────────
  var isRecipe = (htmlText.indexOf('ingredient') !== -1 || htmlText.indexOf('інгредієнт') !== -1 || htmlText.indexOf('ingredients') !== -1) &&
    (htmlText.indexOf('cook') !== -1 || htmlText.indexOf('garnir') !== -1 || htmlText.indexOf('recipe') !== -1 || htmlText.indexOf('рецепт') !== -1) ||
    currentPath.indexOf('/recipe') !== -1 || currentPath.indexOf('/recipes') !== -1;
  if (isRecipe && !hasType('Recipe')) {
    issues.push({
      type: 'suggest_recipe_schema',
      message: 'Recommended: add Recipe schema',
      severity: 'notice',
      detail: 'Detected recipe content. Recipe schema enables rich results with cooking time, calories, etc.'
    });
  }

  // ── JobPosting ──────────────────────────────────────────────────────────────
  var isJob = (htmlText.indexOf('job description') !== -1 || htmlText.indexOf('vacancy') !== -1 || htmlText.indexOf('вакансія') !== -1 || htmlText.indexOf('career') !== -1 || htmlText.indexOf('apply for this') !== -1) &&
    (htmlText.indexOf('salary') !== -1 || htmlText.indexOf('зарплата') !== -1 || htmlText.indexOf('requirements') !== -1 || htmlText.indexOf('вимоги') !== -1) ||
    currentPath.indexOf('/job') !== -1 || currentPath.indexOf('/jobs') !== -1 || currentPath.indexOf('/career') !== -1 || currentPath.indexOf('/careers') !== -1;
  if (isJob && !hasType('JobPosting')) {
    issues.push({
      type: 'suggest_jobposting_schema',
      message: 'Recommended: add JobPosting schema',
      severity: 'notice',
      detail: 'Detected job posting content. JobPosting schema enables Google for Jobs rich results.'
    });
  }

  // ── SoftwareApplication ─────────────────────────────────────────────────────
  var isSoftware = (htmlText.indexOf('download') !== -1 || htmlText.indexOf('завантажити') !== -1) &&
    (htmlText.indexOf('software') !== -1 || htmlText.indexOf('application') !== -1 || htmlText.indexOf('app') !== -1 || htmlText.indexOf('program') !== -1) ||
    hasAttrPattern(['data-app-id', 'software-download', 'app-install']) ||
    currentPath.indexOf('/software') !== -1 || currentPath.indexOf('/app') !== -1;
  if (isSoftware && !hasType('SoftwareApplication', 'MobileApplication', 'WebApplication')) {
    issues.push({
      type: 'suggest_software_schema',
      message: 'Recommended: add SoftwareApplication schema',
      severity: 'notice',
      detail: 'Detected software/app content. SoftwareApplication schema enables rich results.'
    });
  }

  // ── Book / Movie / Podcast ──────────────────────────────────────────────────
  var isBook = (htmlText.indexOf('isbn') !== -1 || htmlText.indexOf('author') !== -1 || htmlText.indexOf('автор') !== -1) &&
    (htmlText.indexOf('book') !== -1 || htmlText.indexOf('книга') !== -1 || htmlText.indexOf('chapter') !== -1) ||
    currentPath.indexOf('/book') !== -1 || currentPath.indexOf('/books') !== -1;
  if (isBook && !hasType('Book', 'BookSeries')) {
    issues.push({
      type: 'suggest_book_schema',
      message: 'Recommended: add Book schema',
      severity: 'notice',
      detail: 'Detected book content. Book schema enables rich results in Google Books.'
    });
  }

  var isMovie = htmlText.indexOf('movie') !== -1 || htmlText.indexOf('film') !== -1 || htmlText.indexOf('фільм') !== -1 ||
    htmlText.indexOf('director') !== -1 || htmlText.indexOf('режисер') !== -1 ||
    htmlText.indexOf('trailer') !== -1 ||
    currentPath.indexOf('/movie') !== -1 || currentPath.indexOf('/movies') !== -1;
  if (isMovie && !hasType('Movie', 'TVSeries', 'Episode', 'DramaSeries')) {
    issues.push({
      type: 'suggest_movie_schema',
      message: 'Recommended: add Movie or TVSeries schema',
      severity: 'notice',
      detail: 'Detected movie/film content. Movie schema enables rich results with cast, rating, etc.'
    });
  }

  var isPodcast = htmlText.indexOf('podcast') !== -1 || htmlText.indexOf('episode') !== -1 || htmlText.indexOf('season') !== -1 ||
    htmlText.indexOf('rss feed') !== -1 || htmlText.indexOf('subscribe') !== -1 ||
    currentPath.indexOf('/podcast') !== -1;
  if (isPodcast && !hasType('PodcastSeries', 'PodcastEpisode', 'PodcastSeason', 'AudioObject')) {
    issues.push({
      type: 'suggest_podcast_schema',
      message: 'Recommended: add PodcastSeries schema',
      severity: 'notice',
      detail: 'Detected podcast content. Podcast schema enables rich results in Google Podcasts.'
    });
  }

  // ── Dataset ─────────────────────────────────────────────────────────────────
  var isDataset = htmlText.indexOf('dataset') !== -1 || htmlText.indexOf('data download') !== -1 ||
    hasAttrPattern(['data-dataset', 'dataset-download']) ||
    currentPath.indexOf('/dataset') !== -1 || currentPath.indexOf('/data') !== -1;
  if (isDataset && !hasType('Dataset', 'DataCatalog')) {
    issues.push({
      type: 'suggest_dataset_schema',
      message: 'Recommended: add Dataset schema',
      severity: 'notice',
      detail: 'Detected dataset content. Dataset schema enables Google Dataset Search results.'
    });
  }

  // ── Course ──────────────────────────────────────────────────────────────────
  var isCourse = (htmlText.indexOf('course') !== -1 || htmlText.indexOf('курс') !== -1 || htmlText.indexOf('lesson') !== -1 || htmlText.indexOf('урок') !== -1) &&
    (htmlText.indexOf('enroll') !== -1 || htmlText.indexOf('registration') !== -1 || htmlText.indexOf('curriculum') !== -1 || htmlText.indexOf('syllabus') !== -1) ||
    currentPath.indexOf('/course') !== -1 || currentPath.indexOf('/courses') !== -1;
  if (isCourse && !hasType('Course', 'CourseInstance')) {
    issues.push({
      type: 'suggest_course_schema',
      message: 'Recommended: add Course schema',
      severity: 'notice',
      detail: 'Detected course/educational content. Course schema enables rich results.'
    });
  }

  // ── RealEstate ──────────────────────────────────────────────────────────────
  var isRealEstate = (htmlText.indexOf('property') !== -1 || htmlText.indexOf('apartment') !== -1 || htmlText.indexOf('kvartira') !== -1 || htmlText.indexOf('house') !== -1 || htmlText.indexOf('realestate') !== -1) &&
    (htmlText.indexOf('sqm') !== -1 || htmlText.indexOf('square meters') !== -1 || htmlText.indexOf('bedroom') !== -1 || htmlText.indexOf('bathroom') !== -1) ||
    currentPath.indexOf('/property') !== -1 || currentPath.indexOf('/real-estate') !== -1;
  if (isRealEstate && !hasType('House', 'Apartment', 'SingleFamily Residence', 'RealEstate')) {
    issues.push({
      type: 'suggest_realestate_schema',
      message: 'Recommended: add House or Apartment schema',
      severity: 'notice',
      detail: 'Detected real estate content. Property schema enables rich results.'
    });
  }

  // ── Restaurant / Menu ───────────────────────────────────────────────────────
  var isRestaurant = (htmlText.indexOf('menu') !== -1 || htmlText.indexOf('меню') !== -1 || htmlText.indexOf('dish') !== -1 || htmlText.indexOf('stew') !== -1) &&
    (htmlText.indexOf('restaurant') !== -1 || htmlText.indexOf('cafe') !== -1 || htmlText.indexOf('кухня') !== -1 || htmlText.indexOf('cuisine') !== -1) ||
    currentPath.indexOf('/menu') !== -1 || currentPath.indexOf('/restaurant') !== -1;
  if (isRestaurant && !hasType('Restaurant', 'Menu', 'MenuItem')) {
    issues.push({
      type: 'suggest_restaurant_schema',
      message: 'Recommended: add Restaurant or Menu schema',
      severity: 'notice',
      detail: 'Detected restaurant/menu content. Restaurant schema enables rich results.'
    });
  }

  // ── WebSite / Speakable ─────────────────────────────────────────────────────
  if (!hasType('WebSite', 'WebPage', 'Organization', 'LocalBusiness')) {
    issues.push({
      type: 'suggest_website_schema',
      message: 'Recommended: add WebSite or Organization schema',
      severity: 'notice',
      detail: 'Every site should have at minimum a WebSite or Organization schema for basic identity.'
    });
  }

  // ── BreadcrumbList ──────────────────────────────────────────────────────────
  var hasBreadcrumbs = !!document.querySelector('.breadcrumb, .breadcrumbs, [class*="breadcrumb"], nav[aria-label*="breadcrumb"]') ||
    htmlText.indexOf('breadcrumbs') !== -1;
  if (hasBreadcrumbs && !hasType('BreadcrumbList')) {
    issues.push({
      type: 'suggest_breadcrumb_schema',
      message: 'Recommended: add BreadcrumbList schema',
      severity: 'notice',
      detail: 'Detected breadcrumb navigation. BreadcrumbList schema shows path in SERP.'
    });
  }

  // ── Overview ────────────────────────────────────────────────────────────────
  issues.unshift({
    type: 'schema_suggest_overview',
    message: 'Schema suggestions — ' + existingTypes.length + ' existing type' + (existingTypes.length !== 1 ? 's' : '') + ', ' + issues.length + ' suggestion' + (issues.length !== 1 ? 's' : ''),
    severity: 'info',
    detail: [
      'Existing types    ' + (existingTypes.length > 0 ? existingTypes.join(', ') : 'none'),
      'Page URL path     ' + currentPath,
      'og:type           ' + (ogTypeVal || 'not set'),
      'Page title        ' + (title || 'not set'),
    ].join('\n')
  });

  return { id: 'schema_suggest', name: 'Schema Suggestions', issues: issues };
}
