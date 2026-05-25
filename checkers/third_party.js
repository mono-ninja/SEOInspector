// ── Known third-party service categories ──────────────────────────────────────
// Match hostname (lowercase, without www.) against these patterns.
var THIRD_PARTY_CATEGORIES = {
  analytics: [
    'google-analytics', 'googletagmanager', 'gstatic', 'googleanalytics',
    'analytics.google', 'hotjar', 'mixpanel', 'amplitude', 'segment',
    'heap.io', 'crazyegg', 'chartbeat', 'kissmetrics', 'woopra',
    'matomo', 'piwik', 'plausible', 'fathom', 'umami',
    'yandex.metrika', 'metrika.yandex', 'yandex.ru', 'mc.yandex',
    'appmetrica.yandex', 'roistat', 'vst', 'open.sber',
  ],
  ads: [
    'doubleclick', 'googlesyndication', 'googleads', 'googletagservices',
    'adservice.google', 'facebook.com/plugins', 'facebook.com/tr', 'fbcdn',
    'tiktok', 'pangle', 'unityads', 'applovin', 'ironsource',
    'rubicon', 'openx', 'rubiconproject', 'criteo', 'rubik',
    'adform', 'triplelift', 'pubmatic', 'sovrn', 'medianet',
    'ads.google', 'pagead', 'googlesyndication',
  ],
  chat: [
    'intercom', 'crisp.chat', 'tawk.to', 'livechat', 'zendesk',
    'drift.com', 'freshdesk', 'helpscout', 'olark', 'zendesk.com',
    'messengerchat', 'facebook.com/plugins', 'jivo', 'enquiry',
    'chat.sber', 'umy',
  ],
  maps: [
    'maps.google', 'googleapis.com/maps', 'google.com/maps',
    'mapbox', 'leaflet', 'openstreetmap', 'yandex.ru/map',
    '2gis', 'here.com', 'mapquest',
  ],
  video: [
    'youtube', 'youtu.be', 'vimeo', 'dailymotion', 'player.vimeo',
    'ytimg', 'googlevideo', 'facebook.com/video',
  ],
  fonts: [
    'fonts.googleapis', 'fonts.gstatic', 'use.typekit', 'typekit.net',
    'fastly.jsdelivr', 'fonts.fontawesome', 'maxcdn.bootstrapcdn',
    'cloudflare.com/cdn-cgi',
  ],
  payments: [
    'stripe', 'paypal', 'braintree', 'squareup', 'adyen', 'klarna',
    'liqpay', 'wayforpay', 'monobank', 'privatbank',
  ],
  tracking: [
    'pixel', 'beacon', 'tracking', 'convertro', 'impact', 'refersion',
    'affiliate', 'clickbank', 'shareasale', 'cj.com', 'impact.com',
    'tealium', 'satellite', 'ensight', 'bluekai', 'audience',
    'quantserve', 'scorecardresearch', 'omtrdc', 'demdex', 'criteo.net',
    'tiktok.com/pixel', 'facebook.com/tr', 'baidustatic', 'baidustatic',
  ],
  widgets: [
    'trustpilot', 'yotpo', 'bazaarvoice', 'reviews.io', 'stamped.io',
    'addthis', 'sharethis', 'addtoany', 'buffer', 'disqus', 'utteranc',
    'giscus', 'commento', 'crowd.aws', 'crowdin', 'widget',
    'reCAPTCHA', 'recaptcha.net', 'hcaptcha', 'cloudflare.com/cdn-cgi/challenge-platform',
  ],
  cdn: [
    'cloudfront.net', 'fastly.net', 'akamaized.net', 'akamai.net',
    'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare',
    'bunnycdn', 'bunny.net', 'digitaloceanspaces', 'r2.dev',
    'edgecast', 'keycdn', 'gcore', 'stackpath',
  ],
  email: [
    'mailchimp', 'sendinblue', 'convertkit', 'activecampaign',
    'aweber', 'getresponse', 'mailerlite', 'buttondown',
    'loops.so', 'beehiiv', 'substack',
  ],
  ecommerce: [
    'shopify', 'woocommerce', 'magento', 'bigcommerce', 'prestashop',
    'squarespace', 'wix.com', 'webflow', 'prestashop',
  ],
  social: [
    'twitter.com', 'platform.twitter', 'twimg.com', 'facebook.com/plugins',
    'fbcdn.net', 'instagram.com', 'pinterest.com', 'linkedin.com',
    'reddit.com', 'tumblr.com', 'tiktok.com', 'whatsapp.com',
    'telegram.org', 'vk.com', 'ok.ru',
  ],
};

function categorizeHost(host) {
  var h = host.toLowerCase().replace(/^www\./, '');
  var cats = [];
  Object.keys(THIRD_PARTY_CATEGORIES).forEach(function(cat) {
    THIRD_PARTY_CATEGORIES[cat].forEach(function(pattern) {
      if (h.indexOf(pattern) !== -1) {
        cats.push(cat);
      }
    });
  });
  return cats.length > 0 ? cats : ['other'];
}

function runThirdPartyChecker(p) {
  var issues = [];
  var params = p || {};
  var max3pDomains = params.max_3p_domains || 10;
  var heavyScriptKb = params.heavy_script_kb || 100;

  var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');

  // ── Collect resource timing data ────────────────────────────────────────────
  var resourceEntries = [];
  try { resourceEntries = performance.getEntriesByType('resource'); } catch(e) {}

  if (!resourceEntries || resourceEntries.length === 0) {
    return { id: 'third_party', name: 'Third-party Resources', issues: issues };
  }

  var domainData = {};
  var totalThirdPartyBytes = 0;
  var totalPageBytes = 0;
  var heavyScripts = [];
  var thirdPartyScripts = [];
  var thirdPartyCSS = [];

  resourceEntries.forEach(function(entry) {
    try {
      var url = new URL(entry.name);
      var host = url.hostname.toLowerCase().replace(/^www\./, '');
      var transfer = entry.transferSize || 0;
      totalPageBytes += transfer;

      if (!host || host === currentHost) return;

      totalThirdPartyBytes += transfer;

      if (!domainData[host]) {
        domainData[host] = {
          count: 0,
          bytes: 0,
          categories: categorizeHost(host),
          scripts: [],
          css: [],
        };
      }
      domainData[host].count++;
      domainData[host].bytes += transfer;

      var pathLower = entry.name.toLowerCase().split('?')[0];
      var isScript = entry.initiatorType === 'script' || pathLower.slice(-3) === '.js' || pathLower.slice(-4) === '.mjs';
      var isCSS = entry.initiatorType === 'link' && (pathLower.slice(-4) === '.css' || pathLower.indexOf('.css?') !== -1);

      if (isScript) {
        domainData[host].scripts.push(entry.name);
        thirdPartyScripts.push({ host: host, name: entry.name, transfer: transfer });
        if (transfer > heavyScriptKb * 1024) {
          heavyScripts.push({ host: host, name: entry.name.split('/').pop().split('?')[0], size: Math.round(transfer / 1024) });
        }
      }
      if (isCSS) {
        domainData[host].css.push(entry.name);
        thirdPartyCSS.push({ host: host, name: entry.name, transfer: transfer });
      }
    } catch(e) {}
  });

  var domains = Object.keys(domainData);
  var domainCount = domains.length;

  // ── Domain count warnings ───────────────────────────────────────────────────
  var warnThreshold = max3pDomains;
  var noticeThreshold = Math.floor(max3pDomains / 2);

  if (domainCount > warnThreshold) {
    var topDomains = domains
      .sort(function(a, b) { return domainData[b].bytes - domainData[a].bytes; })
      .slice(0, 6);
    issues.push({
      type: 'too_many_third_party_domains',
      message: 'Too many third-party domains: ' + domainCount + ' (recommended up to ' + warnThreshold + ')',
      severity: 'warning',
      detail: 'Top by weight: ' + topDomains.map(function(d) {
        return d + ' (' + Math.round(domainData[d].bytes / 1024) + ' KB)';
      }).join(', ')
    });
  } else if (domainCount > noticeThreshold) {
    issues.push({
      type: 'many_third_party_domains',
      message: 'Elevated number of third-party domains: ' + domainCount,
      severity: 'notice',
      detail: domains.sort(function(a, b) { return domainData[b].bytes - domainData[a].bytes; }).join(', ')
    });
  }

  // ── Third-party weight percentage ───────────────────────────────────────────
  if (totalPageBytes > 0 && totalThirdPartyBytes > 0) {
    var pct3p = Math.round(totalThirdPartyBytes / totalPageBytes * 100);
    if (pct3p > 50) {
      issues.push({
        type: 'third_party_weight_high',
        message: 'Third-party resources account for ' + pct3p + '% of page weight (' + Math.round(totalThirdPartyBytes / 1024) + ' KB of ' + Math.round(totalPageBytes / 1024) + ' KB)',
        severity: 'warning',
        detail: 'Over half the page weight comes from external services. Consider deferring or removing non-essential scripts.'
      });
    } else if (pct3p > 25) {
      issues.push({
        type: 'third_party_weight_moderate',
        message: 'Third-party resources account for ' + pct3p + '% of page weight (' + Math.round(totalThirdPartyBytes / 1024) + ' KB)',
        severity: 'notice'
      });
    }
  }

  // ── Heavy third-party scripts ───────────────────────────────────────────────
  if (heavyScripts.length > 0) {
    heavyScripts.sort(function(a, b) { return b.size - a.size; });
    issues.push({
      type: 'heavy_third_party_scripts',
      message: 'Heavy third-party scripts (> ' + heavyScriptKb + ' KB): ' + heavyScripts.length,
      severity: 'warning',
      detail: heavyScripts.map(function(s) { return s.host + ' — ' + s.name + ' (' + s.size + ' KB)'; }).join('\n')
    });
  }

  // ── 3rd-party scripts without async/defer (DOM scan) ────────────────────────
  var blocking3pScripts = [];
  Array.prototype.slice.call(document.querySelectorAll('script[src]')).forEach(function(s) {
    var src = s.getAttribute('src') || '';
    try {
      var u = new URL(src, window.location.href);
      var host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (host && host !== currentHost) {
        if (!s.hasAttribute('async') && !s.hasAttribute('defer') && s.getAttribute('type') !== 'module') {
          blocking3pScripts.push(host + ' — ' + src.split('/').pop().split('?')[0]);
        }
      }
    } catch(e) {}
  });
  if (blocking3pScripts.length > 0) {
    issues.push({
      type: 'third_party_blocking_scripts',
      message: 'Third-party scripts blocking render (' + blocking3pScripts.length + ')',
      severity: 'warning',
      detail: blocking3pScripts.join('\n'),
      highlight: true
    });
  }

  // ── 3rd-party CSS (render-blocking) ─────────────────────────────────────────
  if (thirdPartyCSS.length > 0) {
    var cssBytes = 0;
    thirdPartyCSS.forEach(function(c) { cssBytes += c.transfer; });
    issues.push({
      type: 'third_party_css',
      message: 'Third-party CSS resources (' + thirdPartyCSS.length + ', ' + Math.round(cssBytes / 1024) + ' KB)',
      severity: 'notice',
      detail: thirdPartyCSS.map(function(c) { return c.host + ' — ' + Math.round(c.transfer / 1024) + ' KB'; }).join('\n')
    });
  }

  // ── 3rd-party iframes ───────────────────────────────────────────────────────
  var thirdPartyIframes = [];
  var iframesNoLazy = [];
  Array.prototype.slice.call(document.querySelectorAll('iframe[src]')).forEach(function(iframe) {
    var src = iframe.getAttribute('src') || '';
    try {
      var u = new URL(src, window.location.href);
      var host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (host && host !== currentHost) {
        thirdPartyIframes.push({ host: host, src: src, categories: categorizeHost(host) });
        if (iframe.getAttribute('loading') !== 'lazy') {
          iframesNoLazy.push(host);
        }
      }
    } catch(e) {}
  });
  if (thirdPartyIframes.length > 0) {
    issues.push({
      type: 'third_party_iframes',
      message: 'Third-party iframes (' + thirdPartyIframes.length + ')',
      severity: 'notice',
      detail: thirdPartyIframes.map(function(f) { return f.host + ' [' + f.categories.join(', ') + ']'; }).join('\n')
    });
  }
  if (iframesNoLazy.length > 0) {
    issues.push({
      type: 'iframe_no_lazy',
      message: 'Third-party iframes without loading="lazy" (' + iframesNoLazy.length + ')',
      severity: 'notice',
      detail: iframesNoLazy.join(', ')
    });
  }

  // ── Known trackers / pixels ─────────────────────────────────────────────────
  var trackers = [];
  domains.forEach(function(host) {
    var cats = domainData[host].categories;
    if (cats.indexOf('tracking') !== -1 || cats.indexOf('ads') !== -1) {
      trackers.push(host + ' [' + cats.join(', ') + ']');
    }
  });
  if (trackers.length > 0) {
    issues.push({
      type: 'tracking_pixels_detected',
      message: 'Tracking / ad pixels detected (' + trackers.length + ')',
      severity: 'notice',
      detail: trackers.join('\n')
    });
  }

  // ── Too many requests ───────────────────────────────────────────────────────
  var totalThirdPartyRequests = 0;
  domains.forEach(function(d) { totalThirdPartyRequests += domainData[d].count; });
  if (totalThirdPartyRequests > 40) {
    issues.push({
      type: 'too_many_third_party_requests',
      message: 'Too many requests to third-party services: ' + totalThirdPartyRequests,
      severity: 'notice'
    });
  }

  // ── Category breakdown (info) ───────────────────────────────────────────────
  var categoryMap = {};
  domains.forEach(function(host) {
    domainData[host].categories.forEach(function(cat) {
      if (!categoryMap[cat]) categoryMap[cat] = [];
      categoryMap[cat].push(host);
    });
  });
  var catSummary = Object.keys(categoryMap).sort().map(function(cat) {
    var hosts = categoryMap[cat];
    var bytes = 0;
    hosts.forEach(function(h) { bytes += domainData[h].bytes; });
    return cat + ': ' + hosts.length + ' domain' + (hosts.length > 1 ? 's' : '') + ' (' + Math.round(bytes / 1024) + ' KB)';
  }).join('\n');

  // ── Full domain list (info) ─────────────────────────────────────────────────
  var sortedDomains = domains.slice().sort(function(a, b) { return domainData[b].bytes - domainData[a].bytes; });
  issues.push({
    type: 'third_party_domains',
    message: 'Third-party domains (' + domainCount + ')',
    severity: 'info',
    detail: sortedDomains.slice(0, 20).map(function(d) {
      var bd = domainData[d];
      return d + '  ×' + bd.count + '  ' + Math.round(bd.bytes / 1024) + ' KB  [' + bd.categories.join(', ') + ']';
    }).join('\n')
      + (sortedDomains.length > 20 ? '\n...and ' + (sortedDomains.length - 20) + ' more' : '')
  });

  if (catSummary) {
    issues.push({
      type: 'third_party_categories',
      message: 'Third-party categories',
      severity: 'info',
      detail: catSummary
    });
  }

  return { id: 'third_party', name: 'Third-party Resources', issues: issues };
}
