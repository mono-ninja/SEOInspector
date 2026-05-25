function runSecurityChecker(p) {
  var _EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  var issues = [];
  var isHttps = window.location.protocol === 'https:';

  // Info: security overview
  var _generator = document.querySelector('meta[name="generator"]');
  var _genVal = _generator ? (_generator.getAttribute('content') || '').trim() : '';
  var _currentHostname = window.location.hostname.toLowerCase();
  var _extScripts = Array.prototype.filter.call(
    document.querySelectorAll('script[src]'),
    function(s) {
      var src = s.getAttribute('src') || '';
      if (src.indexOf('http') !== 0) return false;
      try { return new URL(src).hostname.toLowerCase() !== _currentHostname; } catch(e) { return false; }
    }
  ).length;
  var _iframes = document.querySelectorAll('iframe').length;
  var _forms = document.querySelectorAll('form').length;

  var _preconnects = document.querySelectorAll('link[rel="dns-prefetch"], link[rel="preconnect"]').length;
  var _cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  var _referrerMeta = document.querySelector('meta[name="referrer"], meta[name="referrer-policy"]');
  var _xframeMeta = document.querySelector('meta[http-equiv="X-Frame-Options"]');

  var _infoLines = [
    'Protocol        ' + (isHttps ? 'HTTPS ✓' : 'HTTP — insecure'),
    'CSP meta        ' + (_cspMeta ? 'present' : 'absent'),
    'X-Frame-Options ' + (_xframeMeta ? _xframeMeta.getAttribute('content') : 'absent'),
    'Referrer-Policy ' + ((_referrerMeta && _referrerMeta.getAttribute('content')) || 'absent'),
    'Generator       ' + (_genVal || 'not specified'),
    'Ext. scripts    ' + _extScripts,
    'Iframes         ' + _iframes,
    'Forms           ' + _forms,
    'Preconnect/DNS  ' + _preconnects,
  ];
  issues.push({ type: 'security_overview', message: 'Security Overview', severity: 'info', detail: _infoLines.join('\n') });

  // Missing CSP meta
  if (!_cspMeta) {
    issues.push({
      type: 'no_csp_meta',
      message: 'No Content-Security-Policy meta tag found (also check HTTP headers)',
      severity: 'notice'
    });
  }

  // Missing referrer policy
  if (!_referrerMeta) {
    issues.push({
      type: 'no_referrer_policy',
      message: 'No Referrer-Policy meta tag found (also check HTTP headers)',
      severity: 'info'
    });
  }

  // Missing X-Frame-Options meta
  if (!_xframeMeta) {
    issues.push({
      type: 'no_xframe_meta',
      message: 'No X-Frame-Options meta tag found (also check HTTP headers)',
      severity: 'info'
    });
  }

  // Page served over HTTP
  if (!isHttps) {
    issues.push({ type: 'insecure_http', message: 'Page is served over insecure HTTP', severity: 'warning' });
  }

  // Mixed content on HTTPS pages
  if (isHttps) {
    var activeHttp = [];
    var passiveHttp = [];

    // Active mixed content: scripts, stylesheets, iframes, objects, embeds, source
    Array.prototype.slice.call(
      document.querySelectorAll('script[src], link[rel="stylesheet"][href], iframe[src], object[data], embed[src], source[src]')
    ).forEach(function(el) {
      var attr = (el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('data') || '').trim();
      if (attr.indexOf('http://') === 0) activeHttp.push(attr);
    });

    // Resource hints with HTTP
    Array.prototype.slice.call(
      document.querySelectorAll('link[rel="preload"][href], link[rel="prefetch"][href], link[rel="preload"][imagesrcset]')
    ).forEach(function(el) {
      var href = (el.getAttribute('href') || '').trim();
      if (href.indexOf('http://') === 0) activeHttp.push(href);
      var srcset = el.getAttribute('imagesrcset') || '';
      if (srcset.indexOf('http://') === 0) activeHttp.push(srcset.split(/\s+/)[0]);
    });

    // Passive mixed content: images, video, audio, source, picture source
    Array.prototype.slice.call(
      document.querySelectorAll('img[src], video[src], audio[src], source[src], picture source[src]')
    ).forEach(function(el) {
      var src = (el.getAttribute('src') || '').trim();
      if (src.indexOf('http://') === 0) passiveHttp.push(src);
      // Check srcset for images
      var srcset = el.getAttribute('srcset') || '';
      if (srcset.indexOf('http://') === 0) passiveHttp.push(srcset.split(/\s+/)[0]);
    });

    // Deduplicate
    activeHttp = activeHttp.filter(function(v, i, a) { return a.indexOf(v) === i; });
    passiveHttp = passiveHttp.filter(function(v, i, a) { return a.indexOf(v) === i; });

    if (activeHttp.length > 0) {
      issues.push({
        type: 'mixed_content_active',
        message: 'Active mixed content: HTTP resources on HTTPS page (' + activeHttp.length + ')',
        severity: 'warning',
        detail: activeHttp.slice(0, 3).join('\n')
      });
    }
    if (passiveHttp.length > 0) {
      issues.push({
        type: 'mixed_content_passive',
        message: 'Passive mixed content: HTTP images/media on HTTPS page (' + passiveHttp.length + ')',
        severity: 'notice',
        detail: passiveHttp.slice(0, 3).join('\n')
      });
    }
  }

  // Exposed email addresses in visible text
  var bodyText = '';
  if (document.body) {
    var SKIP_SEC = { SCRIPT:1, STYLE:1, NOSCRIPT:1, SVG:1 };
    var secParts = [];
    function secWalk(node) {
      if (node.nodeType === 1) {
        if (SKIP_SEC[node.nodeName.toUpperCase()]) return;
        for (var c = node.firstChild; c; c = c.nextSibling) secWalk(c);
      } else if (node.nodeType === 3) {
        var t = node.nodeValue || '';
        if (t) secParts.push(t);
      }
    }
    secWalk(document.body);
    bodyText = secParts.join('');
  }
  _EMAIL_RE.lastIndex = 0;
  var rawEmails = bodyText.match(_EMAIL_RE) || [];
  var ignoreDomains = ['example.com', 'example.org', 'example.net', 'test.com', 'sentry.io'];
  var ignoreSubstrings = ['youremail', 'your@', 'noreply@', 'no-reply@'];
  var realEmails = rawEmails.filter(function(e) {
    var lower = e.toLowerCase();
    var domain = lower.split('@')[1] || '';
    return !ignoreDomains.some(function(d) { return domain === d || domain.slice(-(d.length + 1)) === '.' + d; }) &&
           !ignoreSubstrings.some(function(s) { return lower.indexOf(s) !== -1; });
  });
  if (realEmails.length > 0) {
    issues.push({
      type: 'email_exposed',
      message: 'Email addresses found in plain text (' + realEmails.length + ')',
      severity: 'warning',
      detail: realEmails.slice(0, 3).join(', ')
    });
  }

  // CMS version disclosure via meta generator
  if (_generator) {
    var genContent = _generator.getAttribute('content') || '';
    if (/WordPress\s+\d|Joomla\s+\d|Drupal\s+\d|TYPO3\s+\d|Magento\s+\d/i.test(genContent)) {
      issues.push({
        type: 'cms_version_exposed',
        message: 'CMS version exposed via meta generator',
        severity: 'notice',
        detail: genContent
      });
    }
  }

  // Form actions: check for HTTP forms on HTTPS pages
  if (isHttps) {
    var httpForms = Array.prototype.filter.call(document.querySelectorAll('form[action]'), function(f) {
      var action = (f.getAttribute('action') || '').trim();
      return action.indexOf('http://') === 0;
    });
    if (httpForms.length > 0) {
      issues.push({
        type: 'form_http_action',
        message: 'Forms with action over insecure HTTP (' + httpForms.length + ')',
        severity: 'critical',
        detail: httpForms.map(function(f) { return f.getAttribute('action'); }).slice(0, 3).join('\n')
      });
    }
  }

  // Password forms on HTTP
  if (!isHttps) {
    var pwForms = document.querySelectorAll('input[type="password"]');
    if (pwForms.length > 0) {
      issues.push({
        type: 'password_on_http',
        message: 'Password field on HTTP page (transmitted in plain text)',
        severity: 'critical'
      });
    }
  }

  // target="_blank" without rel="noopener noreferrer" — reverse tabnapping
  var blankLinks = Array.prototype.filter.call(document.querySelectorAll('a[target="_blank"]'), function(a) {
    var rel = (a.getAttribute('rel') || '').toLowerCase();
    return rel.indexOf('noopener') === -1 && rel.indexOf('noreferrer') === -1;
  });
  if (blankLinks.length > 0) {
    issues.push({
      type: 'blank_noopener',
      message: 'Links with target="_blank" missing rel="noopener noreferrer" (' + blankLinks.length + ')',
      severity: 'warning',
      detail: blankLinks.slice(0, 3).map(function(a) { return (a.textContent || '').trim() || a.getAttribute('href'); }).join('\n')
    });
  }

  // javascript: URLs — XSS vector
  var jsUrls = Array.prototype.filter.call(document.querySelectorAll('a[href]'), function(a) {
    var href = (a.getAttribute('href') || '').trim();
    return href.indexOf('javascript:') === 0;
  });
  if (jsUrls.length > 0) {
    issues.push({
      type: 'javascript_url',
      message: 'javascript: URLs found (' + jsUrls.length + ') — potential XSS vector',
      severity: 'notice',
      detail: jsUrls.slice(0, 3).map(function(a) { return a.getAttribute('href'); }).join('\n')
    });
  }

  // Inline event handlers — XSS risk
  var EVENT_ATTRS = ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onchange', 'oninput', 'onkeydown', 'onkeyup', 'onmousedown'];
  var eventHandlerCount = 0;
  var eventHandlerExamples = [];
  var allElements = document.querySelectorAll(EVENT_ATTRS.map(function(a) { return '[' + a + ']'; }).join(','));
  allElements.forEach(function(el) {
    eventHandlerCount++;
    if (eventHandlerExamples.length < 3) {
      var attrName = null;
      for (var i = 0; i < EVENT_ATTRS.length; i++) {
        if (el.hasAttribute(EVENT_ATTRS[i])) {
          attrName = EVENT_ATTRS[i];
          break;
        }
      }
      if (attrName) {
        eventHandlerExamples.push(el.tagName.toLowerCase() + ' ' + attrName + '="..."');
      }
    }
  });
  if (eventHandlerCount > 0) {
    issues.push({
      type: 'inline_event_handlers',
      message: 'Inline event handlers found (' + eventHandlerCount + ') — XSS risk with user content',
      severity: 'notice',
      detail: eventHandlerExamples.join('\n')
    });
  }

  // Iframes without sandbox attribute
  var unsandboxedIframes = Array.prototype.filter.call(document.querySelectorAll('iframe'), function(iframe) {
    return !iframe.hasAttribute('sandbox');
  });
  if (unsandboxedIframes.length > 0) {
    issues.push({
      type: 'iframe_no_sandbox',
      message: 'Iframes without sandbox attribute (' + unsandboxedIframes.length + ')',
      severity: 'notice',
      detail: unsandboxedIframes.slice(0, 3).map(function(f) { return f.getAttribute('src') || '(no src)'; }).join('\n')
    });
  }

  // data: URI in script/src — code injection
  var dataScripts = Array.prototype.filter.call(document.querySelectorAll('script[src], iframe[src], object[data], embed[src]'), function(el) {
    var val = (el.getAttribute('src') || el.getAttribute('data') || '').trim();
    return val.indexOf('data:') === 0;
  });
  if (dataScripts.length > 0) {
    issues.push({
      type: 'data_uri_script',
      message: 'data: URI used in script/iframe sources (' + dataScripts.length + ') — code injection risk',
      severity: 'critical',
      detail: dataScripts.slice(0, 3).map(function(el) { return el.tagName.toLowerCase() + ': ' + ((el.getAttribute('src') || el.getAttribute('data') || '').slice(0, 80)); }).join('\n')
    });
  }

  // Meta refresh redirect to external/HTTP URL
  var metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
  if (metaRefresh) {
    var content = (metaRefresh.getAttribute('content') || '');
    var urlMatch = content.match(/URL=((?:http[^"]*|http[^']*|[^"'\s]+))/i);
    if (urlMatch) {
      var redirectUrl = urlMatch[1];
      if (redirectUrl.indexOf('http://') === 0) {
        issues.push({
          type: 'meta_refresh_http',
          message: 'Meta refresh redirects to HTTP URL',
          severity: 'warning',
          detail: redirectUrl
        });
      }
    }
  }

  // Protocol-relative URLs (//example.com)
  var protRelLinks = Array.prototype.filter.call(document.querySelectorAll('a[href], link[href], script[src], img[src]'), function(el) {
    var val = (el.getAttribute('href') || el.getAttribute('src') || '').trim();
    return val.indexOf('//') === 0;
  });
  if (protRelLinks.length > 0) {
    issues.push({
      type: 'protocol_relative_url',
      message: 'Protocol-relative URLs (//…) found (' + protRelLinks.length + ') — prefer explicit protocol',
      severity: 'notice',
      detail: protRelLinks.slice(0, 3).map(function(el) { return el.getAttribute('href') || el.getAttribute('src'); }).join('\n')
    });
  }

  // Leaked secrets: look for API key patterns in inline scripts
  var secretPatterns = [
    { re: /\bsk-(?:proj-|org-)?[A-Za-z0-9_\-]{20,}\b/, label: 'OpenAI API key' },
    { re: /\bAIza[0-9A-Za-z\-_]{35}\b/, label: 'Google API key' },
    { re: /\bAKIA[0-9A-Z]{16}\b/, label: 'AWS Access Key' },
    { re: /\bghp_[0-9a-zA-Z]{36}\b/, label: 'GitHub token' },
    { re: /\bxox[baprs]-[0-9]{12}-[0-9A-Za-z\-]+\b/, label: 'Slack token' },
    { re: /\bsk_live_[0-9a-zA-Z]{24,}\b/, label: 'Stripe live secret key' },
    { re: /\brk_live_[0-9a-zA-Z]{24,}\b/, label: 'Stripe restricted key' },
    { re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}/, label: 'JWT token' },
    { re: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/, label: 'Private key' },
    { re: /\bghs_[0-9a-zA-Z]{36}\b/, label: 'GitHub fine-grained token' },
    { re: /\bgp_[0-9a-zA-Z]{82}\b/, label: 'GitHub personal access token (classic)' },
    { re: /\bAPPKEY_[0-9a-zA-Z]{30,}\b/, label: 'App key pattern' },
  ];
  var inlineCode = '';
  var inlineScripts = document.querySelectorAll('script:not([src])');
  var maxCodeLen = 500000;
  var maxScriptCount = 200;
  for (var si = 0; si < inlineScripts.length && si < maxScriptCount && inlineCode.length < maxCodeLen; si++) {
    inlineCode += (inlineScripts[si].textContent || '') + '\n';
  }
  var leakedSecrets = [];
  secretPatterns.forEach(function(p) {
    if (p.re.test(inlineCode)) leakedSecrets.push(p.label);
  });
  if (leakedSecrets.length > 0) {
    issues.push({
      type: 'leaked_secrets',
      message: 'Possible secret key leak in inline scripts',
      severity: 'critical',
      detail: leakedSecrets.join(', ')
    });
  }

  // eval() / Function() / setTimeout(string) in inline code — code injection risk
  if (inlineCode.length > 0) {
    var dangerousCalls = [];
    if (/\beval\s*\(/.test(inlineCode)) dangerousCalls.push('eval()');
    if (/\bnew\s+Function\s*\(/.test(inlineCode)) dangerousCalls.push('new Function()');
    if (/\bset(?:Timeout|Interval)\s*\(\s*['"]/m.test(inlineCode) || /\bset(?:Timeout|Interval)\s*\(\s*`/m.test(inlineCode)) dangerousCalls.push('setTimeout/Interval(string)');
    if (/\bdocument\.write\s*\(/.test(inlineCode)) dangerousCalls.push('document.write()');
    if (/\binnerHTML\s*=/m.test(inlineCode)) dangerousCalls.push('innerHTML assignment');
    if (dangerousCalls.length > 0) {
      issues.push({
        type: 'dangerous_js_patterns',
        message: 'Dangerous JS patterns in inline scripts: ' + dangerousCalls.join(', '),
        severity: 'notice',
        detail: dangerousCalls.join('\n')
      });
    }
  }

  return { id: 'security', name: 'Security', issues: issues };
}