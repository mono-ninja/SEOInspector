function runRobotsChecker(p) {
  var robotsUrl = window.location.origin + '/robots.txt';
  var currentPath = window.location.pathname || '/';

  return new Promise(function(resolve) {
    var issues = [];
  var resolved = false;
  function safeResolve() {
    if (!resolved) { resolved = true; resolve({ id: 'robots', name: 'Robots.txt', issues: issues }); }
  }

    // ── Fetch robots.txt via background SW, fallback to direct fetch ───────────
    function fetchRobots() {
      var tryBackground = function() {
        chrome.runtime.sendMessage({ action: 'fetchRobots', url: robotsUrl }, function(resp) {
          var lastError = chrome.runtime.lastError;
          if (lastError || !resp || resp.error) {
            tryDirect();
          } else {
            processRobots(resp.status, resp.text || '', resp.headers || {});
          }
        });
      };

      var tryDirect = function() {
        var controller = new AbortController();
        var abortTimer = setTimeout(function() { controller.abort(); }, 8000);
        fetch(robotsUrl, { method: 'GET', credentials: 'omit', cache: 'no-store', signal: controller.signal })
          .then(function(r) {
            clearTimeout(abortTimer);
            return r.text().then(function(txt) {
              var headers = {};
              r.headers.forEach(function(v, k) { headers[k.toLowerCase()] = v; });
              processRobots(r.status, txt, headers);
            });
          })
          .catch(function(err) {
            clearTimeout(abortTimer);
            issues.push({
              type: 'robots_fetch_error',
              message: 'Failed to load robots.txt',
              severity: 'notice',
              detail: (err && err.message) || ''
            });
            safeResolve();
          });
      };

      tryBackground();
    }

    // ── Fetch llms.txt ────────────────────────────────────────────────────────
    function fetchLlms() {
      var llmsUrl = window.location.origin + '/llms.txt';
      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, 5000);

      fetch(llmsUrl, { method: 'GET', credentials: 'omit', cache: 'no-store', signal: controller.signal })
        .then(function(r) {
          clearTimeout(timer);
          if (r.ok) {
            issues.push({ type: 'llms_txt_found', message: 'llms.txt found', severity: 'info' });
          } else {
            issues.push({ type: 'llms_txt_missing', message: 'Missing llms.txt — recommended for AI crawler optimization', severity: 'notice' });
          }
          safeResolve();
        })
        .catch(function() {
          clearTimeout(timer);
          issues.push({ type: 'llms_txt_missing', message: 'Missing llms.txt — recommended for AI crawler optimization', severity: 'notice' });
          safeResolve();
        });
    }

    // ── Main processing ───────────────────────────────────────────────────────
    function processRobots(status, text, headers) {
      var ok = (status >= 200 && status < 300);

      if (status === 404) {
        issues.push({ type: 'robots_missing', message: 'robots.txt not found (404)', severity: 'warning' });
        fetchLlms();
        return;
      }
      if (!ok) {
        issues.push({ type: 'robots_error', message: 'Failed to load robots.txt (HTTP ' + status + ')', severity: 'notice' });
        fetchLlms();
        return;
      }

      // ── File size check (Google ignores > 500KB) ────────────────────────────
      var fileSizeBytes = text.length * 2; // UTF-8 approx
      var contentLength = headers['content-length'];
      if (contentLength) {
        fileSizeBytes = parseInt(contentLength, 10);
      }
      if (fileSizeBytes > 500 * 1024) {
        issues.push({
          type: 'robots_file_too_large',
          message: 'robots.txt exceeds 500 KB (' + Math.round(fileSizeBytes / 1024) + ' KB) — Google will ignore it',
          severity: 'warning',
          detail: 'Google limits robots.txt to 500 KB. Large files may be truncated.'
        });
      }

      // ── MIME type check ─────────────────────────────────────────────────────
      var contentType = (headers['content-type'] || '').toLowerCase();
      if (contentType && contentType.indexOf('text/plain') === -1 && contentType.indexOf('text/') === -1) {
        issues.push({
          type: 'robots_wrong_mime',
          message: 'robots.txt served with unexpected Content-Type: ' + contentType,
          severity: 'notice',
          detail: 'Should be text/plain. Some crawlers may not process non-text responses.'
        });
      }

      // ── Parse robots.txt ────────────────────────────────────────────────────
      var lines = text.split('\n');
      var directives = [];
      var currentAgent = null;
      var agentBlocks = {}; // agent -> { disallow: [], allow: [], crawlDelay: null, host: null }
      var sitemapUrls = [];
      var unknownDirectives = [];
      var commentLines = 0;
      var emptyLines = 0;

      lines.forEach(function(line) {
        var trimmed = line.trim();
        if (!trimmed) { emptyLines++; return; }
        if (trimmed.charAt(0) === '#') { commentLines++; return; }

        var colonIdx = trimmed.indexOf(':');
        if (colonIdx < 0) {
          unknownDirectives.push(trimmed.substring(0, 60));
          return;
        }

        var directive = trimmed.substring(0, colonIdx).toLowerCase().trim();
        var value = trimmed.substring(colonIdx + 1).trim();

        directives.push({ directive: directive, value: value, agent: currentAgent });

        if (directive === 'user-agent') {
          currentAgent = value.trim().toLowerCase();
          if (!agentBlocks[currentAgent]) {
            agentBlocks[currentAgent] = { disallow: [], allow: [], crawlDelay: null, host: null };
          }
        } else if (currentAgent) {
          var block = agentBlocks[currentAgent];
          if (directive === 'disallow') {
            if (value) block.disallow.push(value);
          } else if (directive === 'allow') {
            block.allow.push(value);
          } else if (directive === 'crawl-delay') {
            block.crawlDelay = value;
          } else if (directive === 'host') {
            block.host = value;
          }
        } else if (directive === 'sitemap') {
          sitemapUrls.push(value);
        }
      });

      // ── Check for disallowed current page (with wildcard support) ────────────
      function pathMatches(pattern, path) {
        if (!pattern) return false;
        if (pattern === path) return true;
        // Handle $ anchor — exact prefix match only
        if (pattern.charAt(pattern.length - 1) === '$') {
          return pattern.substring(0, pattern.length - 1) === path;
        }
        // Handle * wildcard — convert to regex
        if (pattern.indexOf('*') !== -1) {
          var reStr = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
          var re = new RegExp('^' + reStr);
          return re.test(path);
        }
        // Simple prefix match: pattern must match start of path, optionally followed by '/'
        return path === pattern || path.indexOf(pattern) === 0 && (path.length === pattern.length || path.charAt(pattern.length) === '/');
      }

      function isPageDisallowed(path) {
        // Check most specific match wins (Google rule)
        var agents = ['googlebot', '*'];
        var bestMatch = null;
        var bestMatchLen = -1;

        agents.forEach(function(agent) {
          var block = agentBlocks[agent];
          if (!block) return;

          // Check disallow rules
          block.disallow.forEach(function(pattern) {
            if (!pattern) return; // empty disallow means allow all
            if (pathMatches(pattern, path)) {
              var specificity = pattern.replace(/\*/g, '').length;
              if (specificity > bestMatchLen) {
                bestMatchLen = specificity;
                bestMatch = { agent: agent, type: 'disallow', pattern: pattern };
              }
            }
          });

          // Check allow rules (allow overrides disallow for same specificity)
          block.allow.forEach(function(pattern) {
            if (pathMatches(pattern, path)) {
              var specificity = pattern.replace(/\*/g, '').length;
              if (specificity >= bestMatchLen) {
                bestMatchLen = specificity;
                bestMatch = { agent: agent, type: 'allow', pattern: pattern };
              }
            }
          });
        });

        return bestMatch && bestMatch.type === 'disallow';
      }

      var pageBlocked = isPageDisallowed(currentPath);

      // Check if entire site is blocked
      var blockAllAgents = [];
      Object.keys(agentBlocks).forEach(function(agent) {
        var block = agentBlocks[agent];
        if (block.disallow.indexOf('/') !== -1) {
          // Check if there's an allow / that overrides
          var hasAllowAll = block.allow.indexOf('/') !== -1;
          if (!hasAllowAll) {
            blockAllAgents.push(agent);
          }
        }
      });
      var blocksEntireSite = blockAllAgents.indexOf('*') !== -1;

      // Get disallow/allow for overview
      var starBlock = agentBlocks['*'] || { disallow: [], allow: [] };
      var gbBlock = agentBlocks['googlebot'] || { disallow: [], allow: [] };

      // ── Overview ────────────────────────────────────────────────────────────
      var allAgents = Object.keys(agentBlocks);
      var overviewLines = [
        'Status           HTTP ' + status,
        'Size             ' + Math.round(fileSizeBytes / 1024 * 10) / 10 + ' KB',
        'Lines            ' + lines.length + ' (' + commentLines + ' comments)',
        'User-agents      ' + (allAgents.length > 0 ? allAgents.join(', ') : 'none'),
        'Sitemap          ' + (sitemapUrls.length > 0 ? sitemapUrls.join(', ') : 'not set'),
        'Blocks site      ' + (blocksEntireSite ? 'yes — ' + blockAllAgents.join(', ') + ' ⚠' : 'no'),
        'Current page     ' + (pageBlocked ? 'BLOCKED ⚠' : 'allowed'),
      ];

      if (starBlock.disallow.length > 0) {
        overviewLines.push('');
        overviewLines.push('Disallow * (' + starBlock.disallow.length + '):');
        starBlock.disallow.forEach(function(p) { overviewLines.push('  ' + p); });
      }
      if (gbBlock.disallow.length > 0 && (gbBlock !== starBlock || JSON.stringify(gbBlock.disallow) !== JSON.stringify(starBlock.disallow))) {
        overviewLines.push('');
        overviewLines.push('Disallow Googlebot (' + gbBlock.disallow.length + '):');
        gbBlock.disallow.forEach(function(p) { overviewLines.push('  ' + p); });
      }

      issues.push({
        type: 'robots_overview',
        message: 'robots.txt — ' + (blocksEntireSite ? 'SITE BLOCKED' : 'OK'),
        severity: 'info',
        detail: overviewLines.join('\n'),
        sitemapUrls: sitemapUrls
      });

      // ── Entire site blocked ─────────────────────────────────────────────────
      if (blocksEntireSite) {
        issues.push({
          type: 'robots_blocks_all',
          message: 'robots.txt blocks the entire site (Disallow: / for ' + blockAllAgents.join(', ') + ')',
          severity: 'critical',
          detail: 'This prevents all search engines from indexing your site.'
        });
      }

      // ── Current page blocked ────────────────────────────────────────────────
      if (pageBlocked && !blocksEntireSite) {
        issues.push({
          type: 'page_disallowed',
          message: 'Current page is blocked in robots.txt',
          severity: 'critical',
          detail: 'Path: ' + currentPath
        });
      }

      // ── Double blocking check (robots.txt + noindex meta) ───────────────────
      if (pageBlocked || blocksEntireSite) {
        var robotsMeta = document.querySelector('meta[name="robots"]');
        var robotsContent = robotsMeta ? (robotsMeta.getAttribute('content') || '').toLowerCase() : '';
        if (robotsContent.indexOf('noindex') !== -1) {
          issues.push({
            type: 'indexability_double_block',
            message: 'Page blocked via both robots.txt and noindex meta — redundant',
            severity: 'notice',
            detail: 'Note: robots.txt blocks crawling, noindex blocks indexing. They serve different purposes.'
          });
        }
      }

      // ── Noindex meta tag on current page ────────────────────────────────────
      var noindexMeta = document.querySelector('meta[name="robots"][content*="noindex"], meta[name="googlebot"][content*="noindex"]');
      if (noindexMeta && !pageBlocked) {
        issues.push({
          type: 'page_noindex_meta',
          message: 'Current page has noindex meta tag',
          severity: 'notice',
          detail: 'This page will not appear in search results. Content: ' + noindexMeta.getAttribute('content')
        });
      }

      // ── Sitemap checks ──────────────────────────────────────────────────────
      if (sitemapUrls.length === 0) {
        issues.push({
          type: 'robots_no_sitemap',
          message: 'robots.txt does not contain a Sitemap directive',
          severity: 'notice',
          detail: 'Add Sitemap: https://yoursite.com/sitemap.xml to help crawlers find your sitemap.'
        });
      } else {
        sitemapUrls.forEach(function(url) {
          // Must be absolute URL
          if (url.indexOf('http') !== 0) {
            issues.push({
              type: 'robots_sitemap_relative',
              message: 'Sitemap URL is not absolute: ' + url,
              severity: 'warning',
              detail: 'Sitemap URLs must be absolute (start with http:// or https://).'
            });
          } else {
            try {
              var sitemapUrl = new URL(url);
              if (sitemapUrl.hostname.toLowerCase().replace(/^www\./, '') !== window.location.hostname.toLowerCase().replace(/^www\./, '')) {
                issues.push({
                  type: 'robots_sitemap_external',
                  message: 'Sitemap points to external domain: ' + url,
                  severity: 'notice'
                });
              }
            } catch(e) {
              issues.push({
                type: 'robots_sitemap_invalid',
                message: 'Invalid Sitemap URL: ' + url,
                severity: 'warning'
              });
            }
          }
        });
      }

      // ── Compare robots.txt sitemap with HTML link ───────────────────────────
      if (sitemapUrls.length > 0) {
        var htmlSitemap = document.querySelector('link[rel="sitemap"]');
        if (htmlSitemap) {
          var htmlSitemapHref = htmlSitemap.getAttribute('href') || '';
          var matches = sitemapUrls.some(function(su) {
            try { return new URL(su).href === new URL(htmlSitemapHref, window.location.href).href; } catch(e) { return false; }
          });
          if (!matches) {
            issues.push({
              type: 'robots_sitemap_mismatch_html',
              message: 'Sitemap in robots.txt differs from <link rel="sitemap">',
              severity: 'notice',
              detail: 'robots.txt: ' + sitemapUrls[0] + '\nHTML: ' + htmlSitemapHref
            });
          }
        }
      }

      // ── Common sensitive paths — should be disallowed ───────────────────────
      var sensitivePaths = ['/admin', '/wp-admin', '/wp-login', '/login', '/private', '/tmp', '/temp', '/backup', '/config', '/.env', '/phpmyadmin'];
      if (agentBlocks['*']) {
        var unprotectedSensitive = sensitivePaths.filter(function(sp) {
          return !starBlock.disallow.some(function(d) {
            return d === sp || sp.indexOf(d) === 0 || d.indexOf(sp) === 0 || d.indexOf('*') !== -1;
          });
        });
        if (unprotectedSensitive.length > 0) {
          issues.push({
            type: 'robots_sensitive_paths_exposed',
            message: 'Sensitive paths not disallowed (' + unprotectedSensitive.length + ')',
            severity: 'notice',
            detail: 'Consider disallowing: ' + unprotectedSensitive.join(', ') + '\nNote: robots.txt only guides polite crawlers — it does not block access.'
          });
        }
      }

      // ── Crawl-delay directive ───────────────────────────────────────────────
      Object.keys(agentBlocks).forEach(function(agent) {
        var block = agentBlocks[agent];
        if (block.crawlDelay) {
          var delay = parseFloat(block.crawlDelay);
          if (isNaN(delay) || delay < 0) {
            issues.push({
              type: 'robots_invalid_crawl_delay',
              message: 'Invalid Crawl-delay for ' + agent + ': ' + block.crawlDelay,
              severity: 'notice',
              detail: 'Crawl-delay must be a positive number (seconds).'
            });
          } else if (delay > 10) {
            issues.push({
              type: 'robots_high_crawl_delay',
              message: 'High Crawl-delay for ' + agent + ': ' + delay + 's',
              severity: 'notice',
              detail: 'Very high crawl delays can significantly slow down indexing. Recommended: 1-5 seconds.'
            });
          } else {
            issues.push({
              type: 'robots_crawl_delay',
              message: 'Crawl-delay set for ' + agent + ': ' + delay + 's',
              severity: 'info',
              detail: 'Used by Bing and Yandex. Google ignores this directive.'
            });
          }
        }
      });

      // ── Host directive ──────────────────────────────────────────────────────
      Object.keys(agentBlocks).forEach(function(agent) {
        var block = agentBlocks[agent];
        if (block.host) {
          issues.push({
            type: 'robots_host_directive',
            message: 'Host directive set for ' + agent + ': ' + block.host,
            severity: 'info',
            detail: 'The Host directive suggests preferred canonical domain. Mainly used by Yandex. Google does not recognize this.'
          });
        }
      });

      // ── Unknown directives (syntax errors) ──────────────────────────────────
      if (unknownDirectives.length > 0) {
        issues.push({
          type: 'robots_unknown_directives',
          message: 'Unknown or malformed directives (' + unknownDirectives.length + ')',
          severity: 'notice',
          detail: 'These lines may cause parsing errors:\n' + unknownDirectives.slice(0, 5).join('\n')
        });
      }

      // ── Duplicate user-agent blocks ─────────────────────────────────────────
      var agentLineCounts = {};
      lines.forEach(function(line) {
        var trimmed = line.trim().toLowerCase();
        if (trimmed.indexOf('user-agent:') === 0) {
          var ua = trimmed.replace('user-agent:', '').trim();
          agentLineCounts[ua] = (agentLineCounts[ua] || 0) + 1;
        }
      });
      var duplicateAgents = [];
      Object.keys(agentLineCounts).forEach(function(ua) {
        if (agentLineCounts[ua] > 1) duplicateAgents.push(ua + ' (' + agentLineCounts[ua] + ' blocks)');
      });
      if (duplicateAgents.length > 0) {
        issues.push({
          type: 'robots_duplicate_agents',
          message: 'Duplicate user-agent blocks (' + duplicateAgents.length + ')',
          severity: 'notice',
          detail: 'Multiple blocks for the same agent may cause confusion:\n' + duplicateAgents.join('\n')
        });
      }

      // ── Google-specific directives ──────────────────────────────────────────
      var hasGooglebot = !!agentBlocks['googlebot'];
      var hasAdsbot = !!(agentBlocks['adsbot-google'] || agentBlocks['adsbot-google-mobile']);
      var hasMediapartners = !!agentBlocks['mediapartners-google'];

      if (!hasAdsbot && hasGooglebot) {
        issues.push({
          type: 'robots_no_adsbot',
          message: 'No rules for AdsBot-Google',
          severity: 'notice',
          detail: 'AdsBot-Google crawls for Ads reporting. If you block Googlebot, AdsBot may also be affected.'
        });
      }

      // ── Noimageindex directive ──────────────────────────────────────────────
      var noimageindexFound = false;
      directives.forEach(function(d) {
        if (d.directive === 'noimageindex') noimageindexFound = true;
      });
      if (noimageindexFound) {
        issues.push({
          type: 'robots_noimageindex',
          message: 'Noimageindex directive found — images will be excluded from Google Image Search',
          severity: 'notice',
          detail: 'This is intentional but may reduce image search traffic.'
        });
      }

      // ── X-Robots-Tag in response headers ────────────────────────────────────
      var xRobotsTag = headers['x-robots-tag'];
      if (xRobotsTag) {
        var xrtLower = xRobotsTag.toLowerCase();
        if (xrtLower.indexOf('noindex') !== -1) {
          issues.push({
            type: 'robots_xrobots_noindex',
            message: 'X-Robots-Tag header contains noindex',
            severity: 'warning',
            detail: 'The robots.txt response itself has X-Robots-Tag: ' + xRobotsTag + '. This is unusual.'
          });
        }
        issues.push({
          type: 'robots_xrobots_tag',
          message: 'X-Robots-Tag on robots.txt: ' + xRobotsTag,
          severity: 'info'
        });
      }

      // ── Continue with llms.txt check ────────────────────────────────────────
      fetchLlms();
    }

    // Start the chain
    fetchRobots();
  });
}
