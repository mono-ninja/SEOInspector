var lastParams = {};

// Issue-type → function that returns matching DOM elements for highlight.
// Only add entries for issue types that set highlight:true in their checker.
var HIGHLIGHT_MAP = {
  // images
  missing_alt: function() {
    return Array.prototype.slice.call(document.querySelectorAll('img:not([alt])'));
  },
  empty_alt: function() {
    return Array.prototype.filter.call(document.querySelectorAll('img[alt=""]'), function(img) {
      var role = img.getAttribute('role') || '';
      return role !== 'presentation' && role !== 'none';
    });
  },
  missing_dimensions: function() {
    return Array.prototype.filter.call(document.querySelectorAll('img'), function(img) {
      if (img.hasAttribute('width') && img.hasAttribute('height')) return false;
      var ar = window.getComputedStyle(img).aspectRatio;
      return !ar || ar === 'auto';
    });
  },
  broken_images: function() {
    return Array.prototype.filter.call(document.querySelectorAll('img'), function(img) {
      var src = img.getAttribute('src') || '';
      if (!src || src === document.location.href) return false;
      return img.complete && img.naturalWidth === 0 && img.naturalHeight === 0;
    });
  },
  first_image_lazy: function() {
    var imgs = Array.prototype.filter.call(document.querySelectorAll('img'), function(img) {
      return (img.getAttribute('src') || '').indexOf('data:') !== 0;
    });
    return imgs.length > 0 ? [imgs[0]] : [];
  },
  missing_decoding_async: function() {
    return Array.prototype.filter.call(document.querySelectorAll('img'), function(img) {
      var src = img.getAttribute('src') || '';
      if (!src || src.indexOf('data:') === 0) return false;
      return img.getAttribute('decoding') !== 'async';
    });
  },
  lcp_image_no_fetchpriority: function() {
    var imgs = Array.prototype.filter.call(document.querySelectorAll('img'), function(img) {
      return (img.getAttribute('src') || '').indexOf('data:') !== 0;
    });
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].getAttribute('loading') !== 'lazy') {
        var fp = imgs[i].getAttribute('fetchpriority');
        if (!fp) return [imgs[i]];
      }
    }
    return [];
  },
  lcp_image_fetchpriority_low: function() {
    var imgs = Array.prototype.filter.call(document.querySelectorAll('img'), function(img) {
      return (img.getAttribute('src') || '').indexOf('data:') !== 0;
    });
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].getAttribute('loading') !== 'lazy') {
        if (imgs[i].getAttribute('fetchpriority') === 'low') return [imgs[i]];
      }
    }
    return [];
  },
  wrong_aspect_ratio: function() {
    return Array.prototype.filter.call(document.querySelectorAll('img'), function(img) {
      if (!img.hasAttribute('width') || !img.hasAttribute('height')) return false;
      var w = parseInt(img.getAttribute('width'), 10);
      var h = parseInt(img.getAttribute('height'), 10);
      if (!w || !h) return false;
      var attrRatio = w / h;
      var natW = img.naturalWidth;
      var natH = img.naturalHeight;
      if (!natW || !natH) return false;
      var realRatio = natW / natH;
      return Math.abs(attrRatio - realRatio) > 0.1;
    });
  },
  viewport_lazy_images: function() {
    return Array.prototype.filter.call(document.querySelectorAll('img[loading="lazy"]'), function(img) {
      try {
        var rect = img.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.left < window.innerWidth &&
               rect.bottom > 0 && rect.right > 0;
      } catch(e) { return false; }
    });
  },
  // accessibility
  invalid_aria_role: function() {
    var validRoles = {
      'alert':1,'alertdialog':1,'application':1,'article':1,'banner':1,'button':1,
      'cell':1,'checkbox':1,'columnheader':1,'combobox':1,'complementary':1,
      'contentinfo':1,'definition':1,'dialog':1,'directory':1,'document':1,
      'feed':1,'figure':1,'form':1,'grid':1,'gridcell':1,'group':1,'heading':1,
      'img':1,'link':1,'list':1,'listbox':1,'listitem':1,'log':1,'main':1,
      'marquee':1,'math':1,'menu':1,'menubar':1,'menuitem':1,'menuitemcheckbox':1,
      'menuitemradio':1,'navigation':1,'none':1,'note':1,'option':1,'presentation':1,
      'progressbar':1,'radio':1,'radiogroup':1,'region':1,'row':1,'rowgroup':1,
      'rowheader':1,'scrollbar':1,'search':1,'searchbox':1,'separator':1,
      'slider':1,'spinbutton':1,'status':1,'switch':1,'tab':1,'table':1,
      'tablist':1,'tabpanel':1,'term':1,'textbox':1,'timer':1,'toolbar':1,
      'tooltip':1,'tree':1,'treegrid':1,'treeitem':1
    };
    return Array.prototype.filter.call(document.querySelectorAll('[role]'), function(el) {
      return el.getAttribute('role').trim().toLowerCase().split(/\s+/).some(function(role) {
        return role && !validRoles[role];
      });
    });
  },
  unlabeled_inputs: function() {
    return Array.prototype.filter.call(
      document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select'),
      function(el) {
        var id = el.id;
        var hasLabel = false;
        if (id) {
          var escapedId = id.replace(/([[\]".'*:])/g, '\\$1');
          hasLabel = !!document.querySelector('label[for="' + escapedId + '"]');
        }
        if (!hasLabel && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')
            && !el.getAttribute('title') && !el.getAttribute('placeholder')) {
          var p = el.parentElement;
          while (p) { if (p.tagName === 'LABEL') { hasLabel = true; break; } p = p.parentElement; }
        }
        return !hasLabel;
      }
    );
  },
  no_accessible_text: function() {
    return Array.prototype.filter.call(document.querySelectorAll('button, a[href], [role="button"]:not(button)'), function(el) {
      if ((el.innerText || '').trim()) return false;
      if (el.getAttribute('aria-label')) return false;
      if (el.getAttribute('title')) return false;
      if (el.querySelector('img[alt]:not([alt=""])')) return false;
      if (el.querySelector('svg title')) return false;
      var labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        return !labelledBy.split(/\s+/).some(function(id) {
          var ref = document.getElementById(id);
          return ref && (ref.textContent || '').trim() !== '';
        });
      }
      return true;
    });
  },
  video_no_captions: function() {
    return Array.prototype.filter.call(document.querySelectorAll('video'), function(v) {
      return !v.querySelector('track[kind="captions"], track[kind="subtitles"]');
    });
  },
  iframe_no_title: function() {
    return Array.prototype.filter.call(document.querySelectorAll('iframe'), function(f) {
      return !(f.getAttribute('title') || '').trim();
    });
  },
  iframe_cross_origin_no_sandbox: function() {
    return Array.prototype.filter.call(document.querySelectorAll('iframe'), function(f) {
      var src = f.getAttribute('src') || '';
      if (!src || src.indexOf('javascript:') === 0) return false;
      try {
        var u = new URL(src, window.location.href);
        return u.hostname && u.hostname !== window.location.hostname && !f.hasAttribute('sandbox');
      } catch(e) { return false; }
    });
  },
  iframe_no_lazy_loading: function() {
    return Array.prototype.filter.call(document.querySelectorAll('iframe'), function(f) {
      return f.getAttribute('loading') !== 'lazy';
    });
  },
  video_no_poster: function() {
    return Array.prototype.slice.call(document.querySelectorAll('video:not([poster])'));
  },
  video_eager_preload: function() {
    return Array.prototype.filter.call(document.querySelectorAll('video'), function(v) {
      if (v.hasAttribute('autoplay')) return false;
      var p = v.getAttribute('preload');
      return p === 'auto' || p === null || p === '';
    });
  },
  // mobile
  font_size_too_small: function() {
    return Array.prototype.filter.call(document.querySelectorAll('p, li, td, th, span, div, a, label, button, input, textarea'), function(el) {
      if (!(el.textContent || '').trim()) return false;
      try {
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        var fs = parseFloat(style.fontSize);
        return !isNaN(fs) && fs >= 1 && fs < 14;
      } catch(e) { return false; }
    });
  },
  min_width_too_large: function() {
    return Array.prototype.filter.call(document.querySelectorAll('html, body'), function(el) {
      try {
        var cs = window.getComputedStyle(el);
        var mw = cs.minWidth;
        if (mw && mw !== '0px') {
          var px = parseInt(mw, 10);
          if (px > 600) return true;
        }
      } catch(e) {}
      return false;
    });
  },
  touch_target_too_small: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"]'), function(el) {
      try {
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.width < 48 || rect.height < 48);
      } catch(e) { return false; }
    });
  },
  double_tap_zoom_risk: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"]'), function(el) {
      try {
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.width < 32 || rect.height < 32);
      } catch(e) { return false; }
    });
  },
  intrusive_interstitial: function() {
    return Array.prototype.filter.call(document.querySelectorAll('dialog[open], [role="dialog"], .modal, .popup, .overlay, [class*="interstitial"]'), function(el) {
      if (!el.offsetParent && el.tagName !== 'DIALOG') return false;
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      var rect = el.getBoundingClientRect();
      var vpArea = window.innerWidth * window.innerHeight;
      var elArea = rect.width * rect.height;
      return vpArea > 0 && elArea / vpArea > 0.3;
    });
  },
  pagination_missing_aria_label: function() {
    return Array.prototype.filter.call(document.querySelectorAll('nav.pagination, nav[role="navigation"].pagination, .pagination, .pager, [class*="pagination"], [class*="pager"]'), function(nav) {
      return !nav.getAttribute('aria-label');
    });
  },
  blocking_scripts: function() {
    return Array.prototype.filter.call(document.querySelectorAll('head script[src]'), function(s) {
      return !s.hasAttribute('async') && !s.hasAttribute('defer') && s.getAttribute('type') !== 'module';
    });
  },
  // links
  empty_anchor_text: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      var text = (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim();
      var ariaLabel = (a.getAttribute('aria-label') || '').trim();
      return !text && !ariaLabel && !a.querySelector('img[alt]:not([alt=""])') && !a.querySelector('svg title');
    });
  },
  generic_anchor_text: function() {
    var genericSet = {
      'тут':1, 'тут.':1, 'тут!':1, 'тут…':1,
      'тиснути тут':1, 'натисніть тут':1, 'клікніть тут':1,
      'детальніше':1, 'більше':1, 'докладніше':1, 'дізнатися більше':1,
      'ще':1, 'далі':1, 'читати далі':1, 'перейти':1, 'дивитись':1, 'переглянути':1,
      'here':1, 'click here':1, 'read more':1, 'more':1, 'learn more':1,
      'details':1, 'info':1, 'link':1, 'this':1, 'continue':1,
      'find out more':1, 'view more':1, 'see more':1
    };
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      var text = (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return !!genericSet[text];
    });
  },
  external_nofollow_missing: function() {
    var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 || href.indexOf('javascript:') === 0) return false;
      try {
        var url = new URL(href, window.location.href);
        var host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (host === currentHost || !host) return false;
        var rel = (a.getAttribute('rel') || '').toLowerCase();
        return rel.indexOf('nofollow') === -1 && rel.indexOf('sponsored') === -1 && rel.indexOf('ugc') === -1;
      } catch(e) { return false; }
    });
  },
  blank_no_opener: function() {
    var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    return Array.prototype.filter.call(document.querySelectorAll('a[href][target="_blank"]'), function(a) {
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 || href.indexOf('javascript:') === 0) return false;
      try {
        var url = new URL(href, window.location.href);
        var host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (host === currentHost || !host) return false;
        var rel = (a.getAttribute('rel') || '').toLowerCase();
        return rel.indexOf('noopener') === -1 && rel.indexOf('noreferrer') === -1;
      } catch(e) { return false; }
    });
  },
  external_http_link: function() {
    var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    if (window.location.protocol !== 'https:') return [];
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 || href.indexOf('javascript:') === 0) return false;
      try {
        var url = new URL(href, window.location.href);
        var host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (host === currentHost || !host) return false;
        return url.protocol === 'http:';
      } catch(e) { return false; }
    });
  },
  external_empty_anchor: function() {
    var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 || href.indexOf('javascript:') === 0) return false;
      try {
        var url = new URL(href, window.location.href);
        var host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (host === currentHost || !host) return false;
        var text = (a.innerText || a.textContent || '').trim();
        var img = a.querySelector('img');
        var hasImgAlt = img && (img.getAttribute('alt') || '').trim();
        var hasAriaLabel = (a.getAttribute('aria-label') || '').trim();
        var hasSvgTitle = a.querySelector('svg title');
        return !text && !hasImgAlt && !hasAriaLabel && !hasSvgTitle;
      } catch(e) { return false; }
    });
  },
  http_links_on_https: function() {
    if (window.location.protocol !== 'https:') return [];
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      return (a.getAttribute('href') || '').indexOf('http://') === 0;
    });
  },
  too_many_nofollow: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return false;
      return (a.getAttribute('rel') || '').toLowerCase().indexOf('nofollow') !== -1;
    });
  },
  invalid_href: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      return /^javascript:/i.test((a.getAttribute('href') || '').trim());
    });
  },
  whitespace_href: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      var href = a.getAttribute('href') || '';
      return /^\s|\s$/.test(href) || /\s/.test(href.split('?')[0]);
    });
  },
  local_file_href: function() {
    return Array.prototype.slice.call(document.querySelectorAll('a[href^="file://"]'));
  },
  localhost_href: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      return /(?:localhost|127\.0\.0\.1)(?:[:/]|$)/.test(a.getAttribute('href') || '');
    });
  },
  invalid_tel_mailto: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]'), function(a) {
      var href = a.getAttribute('href') || '';
      if (/^tel:/i.test(href)) {
        var tel = href.replace(/^tel:/i, '');
        return !/^\+?[\d\s\-().]+$/.test(tel);
      }
      if (/^mailto:/i.test(href)) {
        var mail = href.replace(/^mailto:/i, '').split('?')[0];
        return mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
      }
      return false;
    });
  },
  broken_fragment: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a[href^="#"]:not([href="#"])'), function(a) {
      var href = a.getAttribute('href') || '';
      var fragId = href.substring(1);
      return !document.getElementById(fragId) && !document.querySelector('[name="' + fragId.replace(/["\\]/g, '\\$&') + '"]');
    });
  },
  onclick_navigation: function() {
    var result = [];
    var onclickEls = Array.prototype.slice.call(document.querySelectorAll('[onclick]'));
    onclickEls.forEach(function(el) {
      if (el.tagName === 'A') return;
      var oc = (el.getAttribute('onclick') || '');
      if (/location(?:\.href\s*=|\.assign|\.replace)/.test(oc) || /window\.open\(/.test(oc)) {
        result.push(el);
      }
    });
    return result;
  },
  // link_juice
  link_juice_external_no_nofollow: function() {
    var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 || href.indexOf('javascript:') === 0) return false;
      try {
        var url = new URL(href, window.location.href);
        var host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (host === currentHost || !host) return false;
        var rel = (a.getAttribute('rel') || '').toLowerCase();
        return rel.indexOf('nofollow') === -1 && rel.indexOf('sponsored') === -1 && rel.indexOf('ugc') === -1;
      } catch(e) { return false; }
    });
  },
  link_juice_footer_heavy: function() {
    return Array.prototype.filter.call(document.querySelectorAll('footer a[href], [role="contentinfo"] a[href]'), function(a) {
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return false;
      try {
        var url = new URL(href, window.location.href);
        var host = url.hostname.toLowerCase().replace(/^www\./, '');
        var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
        return host === currentHost || !host;
      } catch(e) { return false; }
    });
  },
  link_juice_ambiguous_anchor: function() {
    var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    var anchorMap = {};
    var anchors = Array.prototype.slice.call(document.querySelectorAll('a[href]'));
    anchors.forEach(function(a) {
      var href = (a.getAttribute('href') || '').trim();
      if (!href || href.charAt(0) === '#') return;
      try {
        var url = new URL(href, window.location.href);
        var host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (host !== currentHost) return;
        var text = (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!text) return;
        if (!anchorMap[text]) anchorMap[text] = {};
        anchorMap[text][url.pathname + url.search] = a;
      } catch(e) {}
    });
    var result = [];
    var keys = Object.keys(anchorMap);
    keys.forEach(function(k) {
      if (Object.keys(anchorMap[k]).length > 1) {
        var vals = Object.values(anchorMap[k]);
        result = result.concat(vals);
      }
    });
    return result;
  },
  link_juice_empty_anchor: function() {
    var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return false;
      try {
        var url = new URL(href, window.location.href);
        var host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (host !== currentHost && host) return false;
        var text = (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim();
        return !text && !a.querySelector('img[alt]:not([alt=""])') && !(a.getAttribute('aria-label') || '').trim() && !a.querySelector('svg title');
      } catch(e) { return false; }
    });
  },
  link_juice_js_only: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a[href="#"], a[href="javascript:void(0)"], a[href="javascript:;"]'), function(a) {
      return a.hasAttribute('onclick') || a.getAttribute('role') === 'button';
    });
  },
  link_juice_hidden: function() {
    var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return false;
      try {
        var url = new URL(href, window.location.href);
        var host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (host !== currentHost && host) return false;
        var cs = window.getComputedStyle(a);
        return cs.display === 'none' || cs.visibility === 'hidden' || (cs.opacity === '0' && !a.querySelector('img'));
      } catch(e) { return false; }
    });
  },
  link_juice_internal_blank_noopener: function() {
    var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    return Array.prototype.filter.call(document.querySelectorAll('a[href][target="_blank"]'), function(a) {
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return false;
      try {
        var url = new URL(href, window.location.href);
        var host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (host !== currentHost && host) return false;
        var rel = (a.getAttribute('rel') || '').toLowerCase();
        return rel.indexOf('noopener') === -1 && rel.indexOf('noreferrer') === -1;
      } catch(e) { return false; }
    });
  },
  link_juice_external_blank_noopener: function() {
    var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    return Array.prototype.filter.call(document.querySelectorAll('a[href][target="_blank"]'), function(a) {
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return false;
      try {
        var url = new URL(href, window.location.href);
        var host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (host === currentHost || !host) return false;
        var rel = (a.getAttribute('rel') || '').toLowerCase();
        return rel.indexOf('noopener') === -1 && rel.indexOf('noreferrer') === -1;
      } catch(e) { return false; }
    });
  },
  // headings
  multiple_h1: function() {
    return Array.prototype.filter.call(document.querySelectorAll('h1'), function(h) {
      return h.getAttribute('aria-hidden') !== 'true';
    });
  },
  empty_heading: function() {
    return Array.prototype.filter.call(document.querySelectorAll('h1,h2,h3,h4,h5,h6'), function(h) {
      if (h.getAttribute('aria-hidden') === 'true') return false;
      var style = window.getComputedStyle(h);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return (h.innerText || h.textContent || '').trim() === '';
    });
  },
  heading_too_long: function() {
    var maxLen = (lastParams && lastParams.max_heading_len) || 120;
    return Array.prototype.filter.call(document.querySelectorAll('h1,h2,h3,h4,h5,h6'), function(h) {
      return h.getAttribute('aria-hidden') !== 'true' && (h.innerText || '').trim().length > maxLen;
    });
  },
  h1_too_short: function() {
    var minLen = (lastParams && lastParams.min_h1_len) || 10;
    return Array.prototype.filter.call(document.querySelectorAll('h1'), function(h) {
      var t = (h.innerText || '').trim();
      return h.getAttribute('aria-hidden') !== 'true' && t.length > 0 && t.length < minLen;
    });
  },
  h1_wrong_container: function() {
    return Array.prototype.filter.call(document.querySelectorAll('h1'), function(h) {
      return h.getAttribute('aria-hidden') !== 'true' && !!h.closest('footer, nav, aside');
    });
  },
  // js_seo
  js_dead_links: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a'), function(a) {
      var href = a.getAttribute('href') || '';
      return href === '#' || href.toLowerCase() === 'javascript:void(0)';
    });
  },
  js_hash_routing: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
      var href = a.getAttribute('href') || '';
      return href.length > 1 && href.charAt(0) === '#';
    });
  },
  js_nosnippet: function() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-nosnippet]'));
  },
  js_hidden_content: function() {
    return Array.prototype.filter.call(
      document.querySelectorAll('div, section, article, main'),
      function(el) {
        try {
          var style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') {
            var text = (el.textContent || '').trim();
            return text.length > 200;
          }
        } catch(e) {}
        return false;
      }
    );
  },
  js_inline_handlers: function() {
    return Array.prototype.slice.call(document.querySelectorAll('[onclick], [onload], [onerror], [onmouseover], [onfocus], [onblur]'));
  },
  js_base_tag: function() {
    var base = document.querySelector('base[href]');
    return base ? [base] : [];
  },
  js_large_inline_data: function() {
    return Array.prototype.filter.call(document.querySelectorAll('script:not([src])'), function(s) {
      var content = s.textContent || '';
      var firstChar = content.trimLeft().charAt(0);
      return (firstChar === '{' || firstChar === '[') && content.length > 50000;
    });
  },
  js_large_head_scripts: function() {
    return Array.prototype.slice.call(document.querySelectorAll('head script:not([src])'));
  },
  js_empty_noscript: function() {
    return Array.prototype.filter.call(document.querySelectorAll('noscript'), function(ns) {
      return ns.textContent.trim() === '';
    });
  },
  js_no_noscript: function() {
    return document.body ? [document.body] : [];
  },

  // security
  mixed_content_active: function() {
    return Array.prototype.slice.call(
      document.querySelectorAll('script[src^="http://"], link[rel="stylesheet"][href^="http://"], iframe[src^="http://"], object[data^="http://"], embed[src^="http://"], source[src^="http://"]')
    );
  },
  mixed_content_passive: function() {
    return Array.prototype.slice.call(
      document.querySelectorAll('img[src^="http://"], video[src^="http://"], audio[src^="http://"], source[src^="http://"]')
    );
  },
  form_http_action: function() {
    return Array.prototype.slice.call(document.querySelectorAll('form[action^="http://"]'));
  },
  password_on_http: function() {
    return Array.prototype.slice.call(document.querySelectorAll('input[type="password"]'));
  },
  blank_noopener: function() {
    var els = [];
    Array.prototype.slice.call(document.querySelectorAll('a[target="_blank"]')).forEach(function(a) {
      var rel = (a.getAttribute('rel') || '').toLowerCase();
      if (rel.indexOf('noopener') === -1 && rel.indexOf('noreferrer') === -1) els.push(a);
    });
    return els;
  },
  javascript_url: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a[href^="javascript:"]'), function(a) {
      return a.getAttribute('href').indexOf('javascript:') === 0;
    });
  },
  inline_event_handlers: function() {
    return Array.prototype.slice.call(document.querySelectorAll('[onclick], [onerror], [onload], [onmouseover], [onfocus], [onblur], [onsubmit], [onchange], [oninput], [onkeydown], [onkeyup], [onmousedown]'));
  },
  iframe_no_sandbox: function() {
    return Array.prototype.filter.call(document.querySelectorAll('iframe'), function(f) {
      return !f.hasAttribute('sandbox');
    });
  },
  data_uri_script: function() {
    return Array.prototype.slice.call(document.querySelectorAll('script[src^="data:"], iframe[src^="data:"], object[data^="data:"], embed[src^="data:"]'));
  },
  meta_refresh_http: function() {
    var m = document.querySelector('meta[http-equiv="refresh"]');
    if (m && (m.getAttribute('content') || '').indexOf('http://') !== -1) return [m];
    return [];
  },
  protocol_relative_url: function() {
    return Array.prototype.filter.call(document.querySelectorAll('a[href], link[href], script[src], img[src]'), function(el) {
      var val = (el.getAttribute('href') || el.getAttribute('src') || '').trim();
      return val.indexOf('//') === 0;
    });
  },
  leaked_secrets: function() {
    return Array.prototype.slice.call(document.querySelectorAll('script:not([src])'));
  },
  dangerous_js_patterns: function() {
    return Array.prototype.slice.call(document.querySelectorAll('script:not([src])'));
  },
  email_exposed: function() {
    return document.body ? [document.body] : [];
  },
  cms_version_exposed: function() {
    return document.querySelectorAll('meta[name="generator"]');
  },
  no_csp_meta: function() {
    return document.head ? [document.head] : [];
  },
  no_referrer_policy: function() {
    return document.head ? [document.head] : [];
  },
  no_xframe_meta: function() {
    return document.head ? [document.head] : [];
  },
  security_overview: function() {
    return document.head ? [document.head] : [];
  },
  insecure_http: function() {
    return document.body ? [document.body] : [];
  },
  // semantics
  figure_no_figcaption: function() {
    return Array.prototype.filter.call(document.querySelectorAll('figure'), function(f) {
      return !f.querySelector('figcaption');
    });
  },
  time_no_datetime: function() {
    return Array.prototype.filter.call(document.querySelectorAll('time'), function(t) {
      return !t.getAttribute('datetime');
    });
  },
  blockquote_no_cite: function() {
    return Array.prototype.filter.call(document.querySelectorAll('blockquote'), function(bq) {
      return !bq.getAttribute('cite');
    });
  },
  abbr_no_title: function() {
    return Array.prototype.filter.call(document.querySelectorAll('abbr'), function(abbr) {
      return !abbr.getAttribute('title');
    });
  },
  details_no_summary: function() {
    return Array.prototype.filter.call(document.querySelectorAll('details'), function(d) {
      return !d.querySelector('summary');
    });
  },
  address_wrong_context: function() {
    return Array.prototype.filter.call(document.querySelectorAll('address'), function(addr) {
      var parent = addr.parentElement;
      return parent && parent.tagName !== 'MAIN' && parent.tagName !== 'ARTICLE' && parent.tagName !== 'SECTION' && parent.tagName !== 'BODY';
    });
  },
  // third_party
  third_party_blocking_scripts: function() {
    var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    return Array.prototype.filter.call(document.querySelectorAll('script[src]'), function(s) {
      var src = s.getAttribute('src') || '';
      try {
        var u = new URL(src, window.location.href);
        var host = u.hostname.toLowerCase().replace(/^www\./, '');
        return host && host !== currentHost && !s.hasAttribute('async') && !s.hasAttribute('defer') && s.getAttribute('type') !== 'module';
      } catch(e) { return false; }
    });
  },

  // techstack
  csr_no_ssr: function() {
    return document.body ? [document.body] : [];
  },
  tech_cms: function() {
    return document.head ? [document.head] : [];
  },
  tech_metafw: function() {
    return document.head ? [document.head] : [];
  },
  tech_framework: function() {
    return document.body ? [document.body] : [];
  },
  tech_lib: function() {
    return Array.prototype.slice.call(document.querySelectorAll('script[src]'));
  },
  tech_css: function() {
    return Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]'));
  },
  tech_jquery: function() {
    return Array.prototype.slice.call(document.querySelectorAll('script[src*="jquery"]'));
  },
  tech_build: function() {
    return Array.prototype.slice.call(document.querySelectorAll('script[src]'));
  },
  tech_cdn: function() {
    return document.head ? [document.head] : [];
  },
  tech_analytics: function() {
    return Array.prototype.slice.call(document.querySelectorAll('script[src*="analytics"], script[src*="gtag"], script[src*="metrika"], script[src*="hotjar"], script[src*="clarity"]'));
  },
  tech_ads: function() {
    return Array.prototype.slice.call(document.querySelectorAll('script[src*="googletagmanager"], script[src*="pagead"], script[src*="doubleclick"]'));
  },
  tech_chat: function() {
    return Array.prototype.slice.call(document.querySelectorAll('script[src*="intercom"], script[src*="zendesk"], script[src*="crisp"], script[src*="livechat"], script[src*="drift"]'));
  },
  tech_comments: function() {
    return Array.prototype.slice.call(document.querySelectorAll('script[src*="disqus"], script[src*="giscus"]'));
  },
  tech_payment: function() {
    return Array.prototype.slice.call(document.querySelectorAll('script[src*="stripe"], script[src*="paypal"], script[src*="braintree"]'));
  },
  tech_fonts: function() {
    return Array.prototype.slice.call(document.querySelectorAll('link[href*="fonts."], link[href*="typekit"], link[href*="fontshare"]'));
  },
  tech_maps: function() {
    return Array.prototype.slice.call(document.querySelectorAll('script[src*="maps."], script[src*="mapbox"]'));
  },
  tech_pwa: function() {
    return Array.prototype.slice.call(document.querySelectorAll('link[rel="manifest"]'));
  },
  tech_ecom: function() {
    return document.body ? [document.body] : [];
  },
  tech_headless_cms: function() {
    return document.head ? [document.head] : [];
  },
  tech_unknown: function() {
    return document.head ? [document.head] : [];
  },
};

// Map of checker id → run function (sync or async/Promise)
var CHECKERS = [
  { id: 'seo',            fn: runSeoChecker },
  { id: 'headings',       fn: runHeadingsChecker },
  { id: 'images',         fn: runImagesChecker },
  { id: 'opengraph',      fn: runOpenGraphChecker },
  { id: 'schema',         fn: runSchemaChecker },
  { id: 'performance',    fn: runPerformanceChecker },
  { id: 'links',          fn: runLinksChecker },
  { id: 'accessibility',  fn: runAccessibilityChecker },
  { id: 'vitals',         fn: runVitalsChecker },
  { id: 'analytics',      fn: runAnalyticsChecker },
  { id: 'gdpr',           fn: runGdprChecker },
  { id: 'semantics',      fn: runSemanticsChecker },
  { id: 'favicon',        fn: runFaviconChecker },
  { id: 'hreflang',       fn: runHreflangChecker },
  { id: 'mobile',         fn: runMobileChecker },
  { id: 'localization',   fn: runLocalizationChecker },
  { id: 'external_links', fn: runExternalLinksChecker },
  { id: 'serp',           fn: runSerpChecker },
  { id: 'nlp',            fn: runNlpChecker },
  { id: 'ai_visibility',  fn: runAiVisibilityChecker },
  { id: 'schema_suggest', fn: runSchemaSuggestChecker },
  { id: 'robots',         fn: runRobotsChecker },
  { id: 'sitemap',        fn: runSitemapChecker },
  { id: 'js_seo',         fn: runJsSeoChecker },
  { id: 'security',       fn: runSecurityChecker },
  { id: 'ip_info',        fn: runIpInfoChecker },
  { id: 'third_party',    fn: runThirdPartyChecker },
  { id: 'resource_hints', fn: runResourceHintsChecker },
  { id: 'media',          fn: runMediaChecker },
  { id: 'storage',        fn: runStorageChecker },
  { id: 'headers',        fn: runHeadersChecker },
  { id: 'techstack',      fn: runTechstackChecker },
  { id: 'pagination',     fn: runPaginationChecker },
  { id: 'urlparams',      fn: runUrlParamsChecker },
  { id: 'pwa',             fn: runPwaChecker },
  { id: 'font_loading',    fn: runFontLoadingChecker },
  { id: 'twitter_cards',   fn: runTwitterCardsChecker },
  { id: 'content_quality', fn: runContentQualityChecker },
  { id: 'htmlval',         fn: runHtmlValChecker },
  { id: 'internal_links', fn: runInternalLinksChecker },
  { id: 'eeat',           fn: runEeatChecker },
  { id: 'toc',            fn: runTocChecker },
  { id: 'canonical',      fn: runCanonicalChecker },
  { id: 'link_juice',     fn: runLinkJuiceChecker },
  { id: 'international',  fn: runInternationalChecker },
  { id: 'css_audit',      fn: runCssAuditChecker },
];

// Guard: register listeners only once per content script context.
// Without this guard, on-demand re-injection (chrome.scripting.executeScript)
// would add duplicate listeners on subsequent popup opens.
if (!window.__seoaudit_registered) {
  window.__seoaudit_registered = true;

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (sender.id !== chrome.runtime.id) return false;

  if (msg.action === 'analyze') {
    var enabled = msg.enabledCheckers || {};
    var active = CHECKERS.filter(function(c) { return enabled[c.id] !== false; });

    var params = msg.params || {};
    lastParams = params;
    var responded = false;
    var safeSend = function(resp) {
      if (!responded) { responded = true; sendResponse(resp); }
    };
    Promise.all(active.map(function(c) {
      try {
        var result = c.fn(params);
        if (result && typeof result.then === 'function') {
          return result.catch(function() { return { id: c.id, name: c.id, issues: [] }; });
        }
        return Promise.resolve(result);
      } catch(e) {
        return Promise.resolve({ id: c.id, name: c.id, issues: [] });
      }
    })).then(function(results) {
      safeSend(results);
    }).catch(function() {
      safeSend([]);
    });

    return true;
  }

  if (msg.action === 'getLinks') {
    var seen = {};
    var links = [];
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function(a) {
      var href = a.href;
      if (!href) return;
      if (href.indexOf('http://') !== 0 && href.indexOf('https://') !== 0) return;
      href = href.split('#')[0];
      if (!href || seen[href]) return;
      seen[href] = true;
      links.push({ url: href, anchor: (a.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 80) });
    });
    sendResponse(links);
    return true;
  }

  if (msg.action === 'highlightLink') {
    Array.prototype.forEach.call(document.querySelectorAll('a.__ninjaseo-bl-hl'), function(el) {
      el.classList.remove('__ninjaseo-bl-hl');
      el.style.outline = '';
      el.style.outlineOffset = '';
    });
    if (msg.url) {
      var firstFound = null;
      Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function(a) {
        if (a.href.split('#')[0] === msg.url) {
          a.classList.add('__ninjaseo-bl-hl');
          a.style.outline = '3px solid #e53935';
          a.style.outlineOffset = '2px';
          if (!firstFound) firstFound = a;
        }
      });
      if (firstFound) firstFound.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.action === 'getStorage') {
    var cookieArr = [];
    var cookieStr = document.cookie || '';
    if (cookieStr) {
      var cookieParts = cookieStr.split(';');
      for (var ci = 0; ci < cookieParts.length; ci++) {
        var c = cookieParts[ci];
        var idx = c.indexOf('=');
        if (idx < 0) continue;
        cookieArr.push({ name: c.substring(0, idx).trim(), value: c.substring(idx + 1).trim() });
      }
    }

    var lsItems = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var lk = localStorage.key(i) || '';
        var lv = localStorage.getItem(lk) || '';
        lsItems.push({ key: lk, value: lv.length > 10240 ? lv.substring(0, 10240) + '…[truncated]' : lv, size: lk.length + lv.length });
      }
    } catch(e) {}

    var ssItems = [];
    try {
      for (var j = 0; j < sessionStorage.length; j++) {
        var sk = sessionStorage.key(j) || '';
        var sv = sessionStorage.getItem(sk) || '';
        ssItems.push({ key: sk, value: sv.length > 10240 ? sv.substring(0, 10240) + '…[truncated]' : sv, size: sk.length + sv.length });
      }
    } catch(e) {}

    sendResponse({ cookies: cookieArr, localStorage: lsItems, sessionStorage: ssItems });
    return true;
  }

  if (msg.action === 'checkKeywordPresence') {
    var kw = (msg.keyword || '').toLowerCase().trim();
    var text = document.body ? (document.body.innerText || document.body.textContent || '').toLowerCase() : '';
    sendResponse({ found: kw.length > 0 && text.indexOf(kw) !== -1 });
    return true;
  }

  if (msg.action === 'highlightElements') {
    Array.prototype.forEach.call(document.querySelectorAll('.ninjaseo-hl'), function(el) {
      el.classList.remove('ninjaseo-hl');
    });
    if (!document.getElementById('ninjaseo-hl-style')) {
      var style = document.createElement('style');
      style.id = 'ninjaseo-hl-style';
      style.textContent = '.ninjaseo-hl{outline:3px solid #ff6b35!important;outline-offset:3px!important;box-shadow:0 0 0 6px rgba(255,107,53,.18)!important;}';
      document.head.appendChild(style);
    }
    var finder = HIGHLIGHT_MAP[msg.issueType];
    var elements = finder ? finder() : [];
    Array.prototype.forEach.call(elements, function(el) { el.classList.add('ninjaseo-hl'); });
    if (elements.length > 0) {
      elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    sendResponse({ count: elements.length });
    return true;
  }

  if (msg.action === 'clearHighlight') {
    Array.prototype.forEach.call(document.querySelectorAll('.ninjaseo-hl'), function(el) {
      el.classList.remove('ninjaseo-hl');
    });
    var hlStyle = document.getElementById('ninjaseo-hl-style');
    if (hlStyle) hlStyle.remove();
    sendResponse({ ok: true });
    return true;
  }

  if (msg.action === 'clearStorage') {
    try {
      if (msg.type === 'localStorage') localStorage.clear();
      else if (msg.type === 'sessionStorage') sessionStorage.clear();
      sendResponse({ ok: true });
    } catch(e) {
      sendResponse({ ok: false, error: e.message });
    }
    return true;
  }

  if (msg.action === 'deleteStorageKey') {
    try {
      if (msg.type === 'localStorage') localStorage.removeItem(msg.key);
      else if (msg.type === 'sessionStorage') sessionStorage.removeItem(msg.key);
      sendResponse({ ok: true });
    } catch(e) {
      sendResponse({ ok: false, error: e.message });
    }
    return true;
  }

  if (msg.action === 'setStorageKey') {
    try {
      if (msg.type === 'localStorage') localStorage.setItem(msg.key, msg.value);
      else if (msg.type === 'sessionStorage') sessionStorage.setItem(msg.key, msg.value);
      sendResponse({ ok: true });
    } catch(e) {
      sendResponse({ ok: false, error: e.message });
    }
    return true;
  }

  if (msg.action === 'extractKeywords') {
    if (!document.body) { sendResponse([]); return true; }
    var text = (document.body.textContent || '').toLowerCase();
    var tokens = text.split(/[^a-zЀ-ӿ]+/);
    var freq = {};
    for (var ti = 0; ti < tokens.length; ti++) {
      var w = tokens[ti];
      if (w.length <= 3) continue;
      freq[w] = (freq[w] || 0) + 1;
    }
    var STOP = { the:1,and:1,that:1,this:1,with:1,from:1,have:1,will:1,are:1,for:1,not:1,you:1,all:1,
      can:1,has:1,was:1,but:1,they:1,been:1,more:1,also:1,into:1,than:1,then:1,when:1,what:1,your:1,
      'що':1,'для':1,'або':1,'але':1,'яка':1,'який':1,'яке':1,'вони':1,'його':1,'якщо':1,'також':1,
      'буде':1,'цього':1,'після':1,'через':1,'свого':1,'тому':1,'тільки':1,'може':1,'нього':1 };
    var words = [];
    Object.keys(freq).forEach(function(kw) { if (!STOP[kw] && freq[kw] > 1) words.push(kw); });
    words.sort(function(a, b) { return freq[b] - freq[a]; });
    var result = [];
    for (var wi = 0; wi < Math.min(words.length, 30); wi++) {
      result.push({ word: words[wi], count: freq[words[wi]] });
    }
    sendResponse(result);
    return true;
  }

  if (msg.action === 'getPageMeta') {
    function metaName(name) {
      var el = document.querySelector('meta[name="' + name + '"]');
      return el ? (el.getAttribute('content') || '') : '';
    }
    function metaOg(prop) {
      var el = document.querySelector('meta[property="og:' + prop + '"]');
      return el ? (el.getAttribute('content') || '') : '';
    }
    function metaTwitter(name) {
      var el = document.querySelector('meta[name="twitter:' + name + '"]') ||
               document.querySelector('meta[property="twitter:' + name + '"]');
      return el ? (el.getAttribute('content') || '') : '';
    }
    var canonEl = document.querySelector('link[rel="canonical"]');
    var favicon = '';
    var favEl = document.querySelector('link[rel~="icon"]');
    if (favEl) favicon = favEl.getAttribute('href') || '';

    var publishedDate = '';
    var dateSelectors = [
      { s: 'time[datetime]', a: 'datetime' },
      { s: 'time[pubdate]', a: 'datetime' },
      { s: 'meta[itemprop="datePublished"]', a: 'content' },
      { s: 'meta[name="publication_date"]', a: 'content' },
    ];
    for (var di = 0; di < dateSelectors.length; di++) {
      var de = document.querySelector(dateSelectors[di].s);
      if (de) { publishedDate = de.getAttribute(dateSelectors[di].a) || ''; if (publishedDate) break; }
    }
    if (!publishedDate) {
      try {
        var ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (var ldi = 0; ldi < ldScripts.length; ldi++) {
          try {
            var ldData = JSON.parse(ldScripts[ldi].textContent || '');
            function findPubDate(obj) {
              if (!obj || typeof obj !== 'object') return '';
              if (obj.datePublished) return obj.datePublished;
              if (Array.isArray(obj['@graph'])) {
                for (var gi = 0; gi < obj['@graph'].length; gi++) { var r = findPubDate(obj['@graph'][gi]); if (r) return r; }
              }
              return '';
            }
            publishedDate = findPubDate(ldData);
            if (publishedDate) break;
          } catch(e) {}
        }
      } catch(e) {}
    }

    sendResponse({
      url:              window.location.href,
      title:            document.title || '',
      description:      metaName('description'),
      canonical:        canonEl ? (canonEl.getAttribute('href') || '') : '',
      favicon:          favicon,
      ogTitle:          metaOg('title'),
      ogDescription:    metaOg('description'),
      ogImage:          metaOg('image'),
      ogUrl:            metaOg('url'),
      ogSiteName:       metaOg('site_name'),
      ogType:           metaOg('type'),
      ogLocale:         metaOg('locale'),
      twitterCard:      metaTwitter('card'),
      twitterTitle:     metaTwitter('title'),
      twitterDescription: metaTwitter('description'),
      twitterImage:     metaTwitter('image'),
      twitterSite:      metaTwitter('site'),
      twitterCreator:   metaTwitter('creator'),
      publishedDate:    publishedDate,
    });
    return true;
  }
});

// Cleanup highlight styles on page unload / visibility change
(function() {
  function cleanup() {
    Array.prototype.forEach.call(document.querySelectorAll('.ninjaseo-hl'), function(el) {
      el.classList.remove('ninjaseo-hl');
    });
    var s = document.getElementById('ninjaseo-hl-style');
    if (s) s.remove();
    Array.prototype.forEach.call(document.querySelectorAll('a.__ninjaseo-bl-hl'), function(el) {
      el.classList.remove('__ninjaseo-bl-hl');
      el.style.outline = '';
      el.style.outlineOffset = '';
    });
  }
  window.addEventListener('visibilitychange', function() {
    if (document.hidden) cleanup();
  });
  window.addEventListener('beforeunload', cleanup);
})();

} // end window.__seoaudit_registered guard
