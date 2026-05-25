function runHeadersChecker(p) {
  var isHttps = window.location.href.indexOf('https://') === 0;

  return new Promise(function(resolve) {
    chrome.runtime.sendMessage({ action: 'fetchHeaders', url: window.location.href }, function(result) {
      if (chrome.runtime.lastError || !result || !result.ok) {
        resolve({ id: 'headers', name: 'HTTP Headers', issues: [] });
        return;
      }
      var issues = [];
      var raw = result.headers || {};

      // ── HTTPS ───────────────────────────────────────────────────────────────
      if (!isHttps) {
        issues.push({ type: 'no_https', message: 'Site is served over HTTP — HTTPS is a Google ranking signal', severity: 'critical' });
      }

      // ── Security headers ────────────────────────────────────────────────────
      if (isHttps) {
        [
          { key: 'content-security-policy',   label: 'Content-Security-Policy',   sev: 'warning' },
          { key: 'x-frame-options',            label: 'X-Frame-Options',           sev: 'warning' },
          { key: 'x-content-type-options',     label: 'X-Content-Type-Options',    sev: 'notice'  },
          { key: 'strict-transport-security',  label: 'HSTS',                      sev: 'warning' },
          { key: 'referrer-policy',            label: 'Referrer-Policy',           sev: 'notice'  },
          { key: 'permissions-policy',         label: 'Permissions-Policy',        sev: 'notice'  },
          { key: 'cross-origin-opener-policy', label: 'Cross-Origin-Opener-Policy',sev: 'notice'  },
          { key: 'cross-origin-embedder-policy','label': 'Cross-Origin-Embedder-Policy', sev: 'notice' },
        ].forEach(function(h) {
          if (!raw[h.key]) {
            issues.push({ type: 'missing_header_' + h.key.replace(/-/g, '_'), message: 'Missing header: ' + h.label, severity: h.sev });
          }
        });

        // HSTS quality
        var hsts = raw['strict-transport-security'] || '';
        if (hsts) {
          var maxAgeMatch = hsts.match(/max-age=(\d+)/i);
          if (maxAgeMatch && parseInt(maxAgeMatch[1], 10) < 31536000) {
            issues.push({ type: 'hsts_short_max_age', message: 'HSTS max-age is less than 1 year — recommended ≥ 31536000', severity: 'notice', detail: hsts });
          }
          if (hsts.toLowerCase().indexOf('includesubdomains') === -1) {
            issues.push({ type: 'hsts_no_subdomains', message: 'HSTS does not include includeSubDomains', severity: 'notice', detail: hsts });
          }
        }

        // CSP quality
        var csp = raw['content-security-policy'] || '';
        if (csp) {
          if (csp.indexOf("'unsafe-inline'") !== -1) {
            issues.push({ type: 'csp_unsafe_inline', message: "Content-Security-Policy contains 'unsafe-inline' — protection significantly weakened", severity: 'warning' });
          }
          if (csp.indexOf("'unsafe-eval'") !== -1) {
            issues.push({ type: 'csp_unsafe_eval', message: "Content-Security-Policy contains 'unsafe-eval' — protection significantly weakened", severity: 'warning' });
          }
        }
      }

      // ── Cache-Control ───────────────────────────────────────────────────────
      var cc = raw['cache-control'] || '';
      if (!cc) {
        issues.push({ type: 'no_cache_control', message: 'Missing Cache-Control header', severity: 'warning' });
      } else if (cc.indexOf('no-store') !== -1) {
        issues.push({ type: 'cache_no_store', message: 'Cache-Control: no-store — response is not cached', severity: 'notice', detail: cc });
      }

      // ETag / Last-Modified (conditional requests)
      if (cc && cc.indexOf('no-store') === -1 && !raw['etag'] && !raw['last-modified']) {
        issues.push({ type: 'no_cache_validator', message: 'Missing ETag or Last-Modified (conditional requests not supported)', severity: 'notice' });
      }

      // ── Compression ─────────────────────────────────────────────────────────
      var encoding = raw['content-encoding'] || '';
      var vary = raw['vary'] || '';
      if (!encoding && vary.toLowerCase().indexOf('accept-encoding') === -1) {
        issues.push({ type: 'no_compression', message: 'Response compression may not be enabled (missing Content-Encoding and Vary: Accept-Encoding)', severity: 'notice' });
      }
      if (encoding && encoding.toLowerCase().indexOf('br') === -1 && encoding.toLowerCase().indexOf('gzip') !== -1) {
        issues.push({ type: 'no_brotli', message: 'Server uses gzip instead of Brotli (br) — Brotli provides better compression', severity: 'notice', detail: 'Content-Encoding: ' + encoding });
      }

      // ── Version disclosure ──────────────────────────────────────────────────
      if (raw['x-powered-by']) {
        issues.push({ type: 'x_powered_by', message: 'X-Powered-By header reveals technology', severity: 'notice', detail: raw['x-powered-by'] });
      }
      if (raw['server'] && /\d+\.\d+/.test(raw['server'])) {
        issues.push({ type: 'server_version', message: 'Server header reveals software version', severity: 'notice', detail: raw['server'] });
      }

      // ── Canonical in Link header vs HTML canonical ──────────────────────────
      var linkHeader = raw['link'] || '';
      if (linkHeader) {
        var linkCanonMatch = linkHeader.match(/<([^>]+)>\s*;\s*rel\s*=\s*["']?canonical["']?/i);
        if (linkCanonMatch) {
          var headerCanon = linkCanonMatch[1].trim();
          var htmlCanonEl = document.querySelector('link[rel="canonical"]');
          var htmlCanon = htmlCanonEl ? (htmlCanonEl.getAttribute('href') || '').trim() : '';
          if (htmlCanon && headerCanon && htmlCanon !== headerCanon) {
            issues.push({
              type: 'canonical_header_mismatch',
              message: 'HTML canonical and Link: header canonical do not match',
              severity: 'warning',
              detail: 'HTML: ' + htmlCanon + '\nHeader: ' + headerCanon
            });
          }
        }
      }

      // ── HTTP Refresh redirect ───────────────────────────────────────────────
      var refreshHeader = raw['refresh'] || '';
      if (refreshHeader && /url=/i.test(refreshHeader)) {
        issues.push({ type: 'http_refresh_redirect', message: 'HTTP Refresh header redirects the page — use 301 instead', severity: 'warning', detail: 'Refresh: ' + refreshHeader });
      }

      resolve({ id: 'headers', name: 'HTTP Headers', issues: issues });
    });
  });
}
