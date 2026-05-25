function runTechstackChecker(p) {
  var issues = [];

  var scripts = Array.prototype.slice.call(document.querySelectorAll('script'));
  var jsScripts = scripts.filter(function(s) {
    var t = (s.getAttribute('type') || '').toLowerCase();
    return !t || t === 'text/javascript' || t === 'module' || t === 'application/javascript';
  });
  var srcList = jsScripts.filter(function(s) { return !!s.src; }).map(function(s) { return s.src.toLowerCase(); });
  var hrefList = Array.prototype.slice.call(document.querySelectorAll('link[href]')).map(function(l) { return (l.getAttribute('href') || '').toLowerCase(); });
  var allSrc = srcList.concat(hrefList);
  var inline = '';
  var inlineScripts = jsScripts.filter(function(s) { return !s.src; });
  var maxInlineLen = 200000;
  for (var li = 0; li < inlineScripts.length && inline.length < maxInlineLen; li++) {
    inline += (inlineScripts[li].textContent || '') + '\n';
  }

  function src(str)  { return srcList.some(function(s) { return s.indexOf(str) !== -1; }); }
  function href(str) { return hrefList.some(function(s) { return s.indexOf(str) !== -1; }); }
  function anySrc(str) { return allSrc.some(function(s) { return s.indexOf(str) !== -1; }); }
  function win(prop) { try { return typeof window[prop] !== 'undefined'; } catch(e) { return false; } }
  function meta(name, val) {
    var el = document.querySelector('meta[name="' + name + '"]');
    if (!el) return false;
    var c = (el.getAttribute('content') || '').toLowerCase();
    return val ? c.indexOf(val.toLowerCase()) !== -1 : !!c;
  }
  function qs(sel) { try { return !!document.querySelector(sel); } catch(e) { return false; } }
  function css(str) {
    return Array.prototype.slice.call(document.styleSheets).some(function(s) {
      try { return s.href && s.href.toLowerCase().indexOf(str) !== -1; } catch(e) { return false; }
    });
  }

  // ── CMS ───────────────────────────────────────────────────────────────────
  var cms = null, cmsVersion = '';

  if (!cms && (meta('generator', 'wordpress') || win('wp') || src('wp-content/') || src('wp-includes/'))) {
    cms = 'WordPress';
    var wpMeta = document.querySelector('meta[name="generator"]');
    if (wpMeta) { var m = (wpMeta.getAttribute('content') || '').match(/WordPress\s*([\d.]+)/i); if (m) cmsVersion = m[1]; }
  }
  if (!cms && (meta('generator', 'drupal') || win('Drupal') || src('/drupal') || src('drupal.js'))) {
    cms = 'Drupal';
  }
  if (!cms && (meta('generator', 'joomla') || src('/media/system/js/') || src('joomla'))) {
    cms = 'Joomla';
  }
  if (!cms && (meta('generator', 'ghost') || src('ghost-sdk') || src('cdn.ghost.io'))) {
    cms = 'Ghost';
    var ghostMeta = document.querySelector('meta[name="generator"]');
    if (ghostMeta) { var gm = (ghostMeta.getAttribute('content') || '').match(/Ghost\s*([\d.]+)/i); if (gm) cmsVersion = gm[1]; }
  }
  if (!cms && (meta('generator', 'typo3') || src('typo3/') || win('TYPO3'))) {
    cms = 'TYPO3';
  }
  if (!cms && (win('Shopify') || src('cdn.shopify.com') || qs('meta[name="shopify-checkout-api-token"]'))) {
    cms = 'Shopify';
  }
  if (!cms && (win('wixBiSession') || src('static.wix.com') || qs('#WIX_ADS'))) {
    cms = 'Wix';
  }
  if (!cms && (src('static.squarespace.com') || src('.squarespace.com/'))) {
    cms = 'Squarespace';
  }
  if (!cms && (qs('[data-wf-domain]') || qs('[data-wf-site]') || src('webflow.com'))) {
    cms = 'Webflow';
  }
  if (!cms && (win('BCData') || src('cdn.bigcommerce.com'))) {
    cms = 'BigCommerce';
  }
  if (!cms && (src('skin/frontend/') || src('mage/') || win('Mage'))) {
    cms = 'Magento';
  }
  if (!cms && (src('prestashop') || win('prestashop'))) {
    cms = 'PrestaShop';
  }
  if (!cms && (win('OpenCart') || src('catalog/view/javascript'))) {
    cms = 'OpenCart';
  }
  if (!cms && (win('BX') || src('bitrix/js/') || src('bitrix/templates/'))) {
    cms = '1C-Bitrix';
  }
  if (!cms && (src('tildacdn.com') || src('tilda.ws') || win('t_sendForm') || qs('[data-tilda-page]'))) {
    cms = 'Tilda';
  }
  if (!cms && (win('_hsq') || src('hs-scripts.com') || qs('[data-hs-page]') || src('hubspot.com'))) {
    cms = 'HubSpot CMS';
  }

  if (cms) {
    issues.push({
      type: 'tech_cms',
      message: 'CMS: ' + cms + (cmsVersion ? ' ' + cmsVersion : ''),
      severity: 'info',
      detail: cms
    });
  }

  // ── Headless CMS ──────────────────────────────────────────────────────────
  if (win('__contentful') || src('contentful') || src('cdn.contentful.com')) {
    issues.push({ type: 'tech_headless_cms', message: 'Headless CMS: Contentful', severity: 'info' });
  }
  if (win('sanity') || src('sanity.io') || src('cdn.sanity.io')) {
    issues.push({ type: 'tech_headless_cms', message: 'Headless CMS: Sanity', severity: 'info' });
  }
  if (src('storyblok') || src('app.storyblok.com') || win('Storyblok')) {
    issues.push({ type: 'tech_headless_cms', message: 'Headless CMS: Storyblok', severity: 'info' });
  }
  if (src('strapi') || win('Strapi') || qs('meta[name="strapi"]')) {
    issues.push({ type: 'tech_headless_cms', message: 'Headless CMS: Strapi', severity: 'info' });
  }

  // WooCommerce (WordPress plugin)
  if (win('woocommerce') || src('woocommerce') || (document.body && document.body.className.indexOf('woocommerce') !== -1)) {
    issues.push({ type: 'tech_ecom', message: 'E-commerce: WooCommerce', severity: 'info' });
  }
  if (win('Snipcart') || src('snipcart.com')) {
    issues.push({ type: 'tech_ecom', message: 'E-commerce: Snipcart', severity: 'info' });
  }
  if (win('Shopware') || src('shopware')) {
    issues.push({ type: 'tech_ecom', message: 'E-commerce: Shopware', severity: 'info' });
  }

  // ── Meta-frameworks ───────────────────────────────────────────────────────
  var metaFw = null;

  if (!metaFw && (win('__NEXT_DATA__') || src('/_next/')))          metaFw = 'Next.js';
  if (!metaFw && (win('__NUXT__') || src('/_nuxt/')))               metaFw = 'Nuxt.js';
  if (!metaFw && (win('___gatsby') || src('/gatsby-')))             metaFw = 'Gatsby';
  if (!metaFw && (win('__remixContext') || src('/build/root-')))    metaFw = 'Remix';
  if (!metaFw && (qs('astro-island') || qs('[data-astro-cid]') || src('/_astro/'))) metaFw = 'Astro';
  if (!metaFw && src('/_app/immutable/'))                           metaFw = 'SvelteKit';
  if (!metaFw && (win('__QwikConsole') || src('/qwik/')))           metaFw = 'Qwik City';

  if (metaFw) {
    issues.push({ type: 'tech_metafw', message: 'Meta-framework: ' + metaFw, severity: 'info', detail: metaFw });
  }

  // ── JS Frameworks ─────────────────────────────────────────────────────────
  var framework = null;

  // React
  var hasReact = win('React') || qs('[data-reactroot]') || src('react.development') || src('react.production') || src('react-dom.');
  if (!hasReact) {
    var probe = document.querySelector('div,main,section,article');
    if (probe) {
      var keys = Object.keys(probe);
      var maxKeys = Math.min(keys.length, 50);
      for (var ki = 0; ki < maxKeys; ki++) {
        if (keys[ki].indexOf('__reactFiber') === 0 || keys[ki].indexOf('__reactInternalInstance') === 0) {
          hasReact = true;
          break;
        }
      }
    }
  }
  if (!framework && hasReact) framework = 'React';

  // Preact
  if (!framework && (win('preact') || src('preact') || qs('[data-preact]'))) framework = 'Preact';

  // Vue
  var hasVue = win('Vue') || src('vue.') || src('vue@') || src('vue2') || src('vue3') || src('vue.runtime');
  if (!hasVue) {
    var vueProbe = document.querySelector('[class]');
    if (vueProbe) {
      var vKeys = Object.keys(vueProbe);
      var maxVKeys = Math.min(vKeys.length, 50);
      for (var vki = 0; vki < maxVKeys; vki++) {
        if (vKeys[vki].indexOf('__vue') === 0) { hasVue = true; break; }
      }
    }
  }
  if (!hasVue) {
    var vueRoot = document.querySelector('[data-v-app]') || document.getElementById('app');
    if (vueRoot && vueRoot.__vue_app__) hasVue = true;
  }
  if (!framework && hasVue) framework = 'Vue';

  // Angular 2+
  var hasAngular = qs('[ng-version]') || src('angular.') || src('@angular/');
  // AngularJS 1.x
  var hasAngularJS = win('angular') || qs('[ng-app]') || qs('[data-ng-app]');
  if (!framework && hasAngular)   framework = 'Angular';
  if (!framework && hasAngularJS) framework = 'AngularJS';

  // Svelte
  var hasSvelte = src('svelte') || qs('[class*="svelte-"]');
  if (!framework && hasSvelte && metaFw !== 'SvelteKit') framework = 'Svelte';

  // Ember
  if (!framework && (win('Ember') || src('ember.'))) framework = 'Ember';

  // Solid.js
  if (!framework && (src('solid-js') || qs('[data-hk]'))) framework = 'Solid.js';

  // Lit
  if (!framework && (win('LitElement') || src('lit.') || src('@lit/') || qs('template[type="module"]'))) framework = 'Lit';

  // HTMX
  var hasHtmx = win('htmx') || src('htmx') || qs('[hx-get],[hx-post],[hx-boost]');
  // Stimulus
  var hasStimulus = win('Stimulus') || src('stimulus') || qs('[data-controller]');
  // Alpine.js
  var hasAlpine = win('Alpine') || src('alpine') || qs('[x-data]');

  if (framework) {
    issues.push({ type: 'tech_framework', message: 'JS Framework: ' + framework, severity: 'info', detail: framework });
  }
  if (hasAlpine)   issues.push({ type: 'tech_lib', message: 'JS: Alpine.js', severity: 'info' });
  if (hasHtmx)     issues.push({ type: 'tech_lib', message: 'JS: HTMX', severity: 'info' });
  if (hasStimulus) issues.push({ type: 'tech_lib', message: 'JS: Stimulus', severity: 'info' });

  // ── CSS Frameworks ────────────────────────────────────────────────────────
  var hasTailwind  = src('tailwind') || css('tailwind') || qs('[class*="tw-"]');
  var hasBootstrap = src('bootstrap') || css('bootstrap');
  var hasBulma     = src('bulma') || css('bulma');
  var hasFoundation= src('foundation.min') || src('foundation.css') || css('foundation');
  var hasUIkit     = src('uikit') || css('uikit') || win('UIkit');
  var hasMUI       = src('@mui/') || src('material-ui') || qs('[class*="MuiBox"]');
  var hasAntd      = src('antd') || css('antd') || qs('[class*="ant-btn"],[class*="ant-input"]');
  var hasChakra    = src('chakra-ui') || src('@chakra-ui/') || qs('[class*="chakra-"]');
  var hasRadix     = src('@radix-ui/') || src('radix-ui');
  var hasPico      = css('pico') || src('picocss') || src('pico.');

  if (hasTailwind)   issues.push({ type: 'tech_css', message: 'CSS: Tailwind CSS', severity: 'info' });
  if (hasBootstrap)  issues.push({ type: 'tech_css', message: 'CSS: Bootstrap', severity: 'info' });
  if (hasBulma)      issues.push({ type: 'tech_css', message: 'CSS: Bulma', severity: 'info' });
  if (hasFoundation) issues.push({ type: 'tech_css', message: 'CSS: Foundation', severity: 'info' });
  if (hasUIkit)      issues.push({ type: 'tech_css', message: 'CSS: UIkit', severity: 'info' });
  if (hasMUI)        issues.push({ type: 'tech_css', message: 'CSS: Material UI (MUI)', severity: 'info' });
  if (hasAntd)       issues.push({ type: 'tech_css', message: 'CSS: Ant Design', severity: 'info' });
  if (hasChakra)     issues.push({ type: 'tech_css', message: 'CSS: Chakra UI', severity: 'info' });
  if (hasRadix)      issues.push({ type: 'tech_css', message: 'CSS: Radix UI', severity: 'info' });
  if (hasPico)       issues.push({ type: 'tech_css', message: 'CSS: Pico CSS', severity: 'info' });

  // ── jQuery ────────────────────────────────────────────────────────────────
  var jqVersion = '';
  try {
    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.jquery) jqVersion = window.jQuery.fn.jquery;
    else if (window.$ && window.$.fn && window.$.fn.jquery) jqVersion = window.$.fn.jquery;
  } catch(e) {}
  if (!jqVersion && src('jquery')) jqVersion = '(detected)';
  if (jqVersion) {
    issues.push({ type: 'tech_jquery', message: 'jQuery ' + jqVersion, severity: 'info' });
  }

  // ── Notable JS libraries ──────────────────────────────────────────────────
  if (win('gsap') || win('TweenMax') || src('gsap') || src('greensock'))   issues.push({ type: 'tech_lib', message: 'JS: GSAP', severity: 'info' });
  if (win('THREE') || src('three.'))                                        issues.push({ type: 'tech_lib', message: 'JS: Three.js', severity: 'info' });
  if (win('d3') || src('d3.'))                                              issues.push({ type: 'tech_lib', message: 'JS: D3.js', severity: 'info' });
  if (win('Chart') || src('chart.'))                                        issues.push({ type: 'tech_lib', message: 'JS: Chart.js', severity: 'info' });
  if (win('Swiper') || src('swiper'))                                       issues.push({ type: 'tech_lib', message: 'JS: Swiper', severity: 'info' });
  if (win('L') || src('leaflet.'))                                          issues.push({ type: 'tech_lib', message: 'JS: Leaflet', severity: 'info' });
  if (win('videojs') || src('video.') || qs('video[preload]'))              issues.push({ type: 'tech_lib', message: 'JS: Video.js', severity: 'info' });
  if (src('plyr') || win('Plyr'))                                           issues.push({ type: 'tech_lib', message: 'JS: Plyr', severity: 'info' });
  if (src('jwplayer') || win('jwplayer'))                                   issues.push({ type: 'tech_lib', message: 'JS: JW Player', severity: 'info' });
  if (win('Lodash') || win('_') || src('lodash'))                           issues.push({ type: 'tech_lib', message: 'JS: Lodash', severity: 'info' });
  if (win('Moment') || win('moment') || src('moment.'))                     issues.push({ type: 'tech_lib', message: 'JS: Moment.js', severity: 'info' });
  if (src('axios') || win('axios'))                                         issues.push({ type: 'tech_lib', message: 'JS: Axios', severity: 'info' });
  if (src('marked.') || win('marked'))                                      issues.push({ type: 'tech_lib', message: 'JS: Marked (Markdown)', severity: 'info' });

  // ── Build tools / Bundlers ────────────────────────────────────────────────
  if (src('@vite/') || src('/vite.svg') || qs('script[type="module"][src*="@vite"]')) {
    issues.push({ type: 'tech_build', message: 'Bundler: Vite', severity: 'info' });
  }
  if (win('webpackChunk') || win('__webpack_require__') || inline.indexOf('__webpack_require__') !== -1) {
    issues.push({ type: 'tech_build', message: 'Bundler: Webpack', severity: 'info' });
  }
  if (src('esbuild') || src('es-module-shims')) {
    issues.push({ type: 'tech_build', message: 'Bundler: esbuild', severity: 'info' });
  }
  if (src('parcel') || src('@parcel/')) {
    issues.push({ type: 'tech_build', message: 'Bundler: Parcel', severity: 'info' });
  }

  // ── CDN ───────────────────────────────────────────────────────────────────
  var hasCloudflare = src('cloudflare') || src('cloudflareinsights') || src('cloudflareinsights.com') || qs('meta[name="cf-ray"]');
  if (!hasCloudflare) {
    try {
      var cfBadge = document.querySelector('#cf-q');
      if (cfBadge) hasCloudflare = true;
    } catch(e) {}
  }
  if (hasCloudflare) {
    issues.push({ type: 'tech_cdn', message: 'CDN: Cloudflare', severity: 'info' });
  }
  if (src('cloudfront.net')) {
    issues.push({ type: 'tech_cdn', message: 'CDN: Amazon CloudFront', severity: 'info' });
  }
  if (src('fastly') || src('fastly.net')) {
    issues.push({ type: 'tech_cdn', message: 'CDN: Fastly', severity: 'info' });
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  if (win('ga') || win('gaData') || anySrc('analytics.js') || anySrc('google-analytics.com')) {
    issues.push({ type: 'tech_analytics', message: 'Analytics: Google Analytics (UA)', severity: 'info' });
  }
  if (win('dataLayer') || anySrc('gtag.js') || anySrc('googletagmanager.com/gtag')) {
    issues.push({ type: 'tech_analytics', message: 'Analytics: Google Analytics 4', severity: 'info' });
  }
  if (win('fbq') || anySrc('facebook.com/plugins') || anySrc('connect.facebook.net')) {
    issues.push({ type: 'tech_analytics', message: 'Analytics: Facebook Pixel', severity: 'info' });
  }
  if (win('yandex_metrika') || anySrc('metrika.yandex') || anySrc('mc.yandex')) {
    issues.push({ type: 'tech_analytics', message: 'Analytics: Yandex Metrica', severity: 'info' });
  }
  if (win('hotjar') || win('hjvs') || anySrc('hotjar.com')) {
    issues.push({ type: 'tech_analytics', message: 'Analytics: Hotjar', severity: 'info' });
  }
  if (win('clarity') || anySrc('clarity.ms')) {
    issues.push({ type: 'tech_analytics', message: 'Analytics: Microsoft Clarity', severity: 'info' });
  }
  if (win('analytics') && anySrc('segment')) {
    issues.push({ type: 'tech_analytics', message: 'Analytics: Segment', severity: 'info' });
  }
  if (win('__tawkto') || anySrc('tawk.to')) {
    issues.push({ type: 'tech_analytics', message: 'Analytics: Tawk.to', severity: 'info' });
  }

  // ── Ads / Tag Managers ────────────────────────────────────────────────────
  if (win('googletag') || src('googletagservices.com') || src('pagead.')) {
    issues.push({ type: 'tech_ads', message: 'Ads: Google AdSense', severity: 'info' });
  }
  if (src('googletagmanager.com') || win('dataLayer')) {
    issues.push({ type: 'tech_ads', message: 'Tag Manager: Google Tag Manager', severity: 'info' });
  }
  if (src('doubleclick.net') || src('2mdn.net')) {
    issues.push({ type: 'tech_ads', message: 'Ads: Google DoubleClick', severity: 'info' });
  }

  // ── Chat / Support ────────────────────────────────────────────────────────
  if (win('Intercom') || src('intercom')) {
    issues.push({ type: 'tech_chat', message: 'Chat: Intercom', severity: 'info' });
  }
  if (win('Zendesk') || src('zendesk') || src('zopim')) {
    issues.push({ type: 'tech_chat', message: 'Chat: Zendesk', severity: 'info' });
  }
  if (win('__crisp') || src('crisp.chat') || src('client.crisp.chat')) {
    issues.push({ type: 'tech_chat', message: 'Chat: Crisp', severity: 'info' });
  }
  if (win('LiveChatWidget') || src('livechat')) {
    issues.push({ type: 'tech_chat', message: 'Chat: LiveChat', severity: 'info' });
  }
  if (win('Drift') || src('drift.com')) {
    issues.push({ type: 'tech_chat', message: 'Chat: Drift', severity: 'info' });
  }

  // ── Comments ──────────────────────────────────────────────────────────────
  if (win('DISQUS') || src('disqus') || qs('#disqus_thread')) {
    issues.push({ type: 'tech_comments', message: 'Comments: Disqus', severity: 'info' });
  }
  if (src('giscus.app') || qs('[data-repo]')) {
    issues.push({ type: 'tech_comments', message: 'Comments: Giscus', severity: 'info' });
  }

  // ── Payment ───────────────────────────────────────────────────────────────
  if (win('Stripe') || src('js.stripe.com')) {
    issues.push({ type: 'tech_payment', message: 'Payment: Stripe', severity: 'info' });
  }
  if (win('paypal') || src('paypal.com') || src('paypalobjects.com')) {
    issues.push({ type: 'tech_payment', message: 'Payment: PayPal', severity: 'info' });
  }
  if (win('Braintree') || src('braintree')) {
    issues.push({ type: 'tech_payment', message: 'Payment: Braintree', severity: 'info' });
  }

  // ── Fonts ─────────────────────────────────────────────────────────────────
  if (anySrc('fonts.googleapis.com') || anySrc('fonts.gstatic.com') || css('fonts.googleapis.com')) {
    issues.push({ type: 'tech_fonts', message: 'Fonts: Google Fonts', severity: 'info' });
  }
  if (anySrc('use.typekit.net') || win('Typekit')) {
    issues.push({ type: 'tech_fonts', message: 'Fonts: Adobe Fonts (Typekit)', severity: 'info' });
  }
  if (anySrc('fontshare.com') || css('fontshare.com')) {
    issues.push({ type: 'tech_fonts', message: 'Fonts: Fontshare', severity: 'info' });
  }

  // ── Maps ──────────────────────────────────────────────────────────────────
  if ((win('google') && win('maps')) || anySrc('maps.googleapis.com') || anySrc('maps.google.com')) {
    issues.push({ type: 'tech_maps', message: 'Maps: Google Maps', severity: 'info' });
  }
  if (win('mapboxgl') || anySrc('mapbox')) {
    issues.push({ type: 'tech_maps', message: 'Maps: Mapbox', severity: 'info' });
  }

  // ── PWA ───────────────────────────────────────────────────────────────────
  var hasManifest = !!document.querySelector('link[rel="manifest"]');
  var hasSW = false;
  try {
    if (inline.indexOf('serviceWorker') !== -1 && inline.indexOf('register') !== -1) {
      hasSW = true;
    }
  } catch(e) {}

  if (hasManifest || hasSW) {
    var pwaParts = [];
    if (hasManifest) pwaParts.push('manifest.json');
    if (hasSW) pwaParts.push('Service Worker');
    issues.push({ type: 'tech_pwa', message: 'PWA: ' + pwaParts.join(', '), severity: 'info' });
  }

  // ── CSR / SSR detection ──────────────────────────────────────────────────
  var isSsrFramework = win('__NEXT_DATA__') || win('__NUXT__') || src('/_app/immutable/');
  var isSpa = (hasReact || hasVue || hasAngular) && !isSsrFramework;

  if (isSpa) {
    issues.push({
      type: 'csr_no_ssr',
      message: 'SPA without SSR/SSG — content may not be indexed correctly',
      severity: 'warning',
      detail: 'Detected: ' + (framework || 'SPA framework') + '. Googlebot renders JS but with delay and limitations. Consider SSR, SSG or pre-rendering for SEO-critical pages.'
    });
  }

  // ── No tech detected ──────────────────────────────────────────────────────
  if (issues.length === 0) {
    issues.push({ type: 'tech_unknown', message: 'Tech stack not detected (static HTML or unknown framework)', severity: 'info' });
  }

  return { id: 'techstack', name: 'Tech Stack', issues: issues };
}