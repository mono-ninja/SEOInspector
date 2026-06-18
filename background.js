// Service worker — перевірка посилань та HTTP заголовків
// NOTE: background.js uses async/await and ES6 constructs (Set) because service
// workers always run in modern Chrome; ES5 is required only in content/popup scripts.

// ── Helpers ────────────────────────────────────────────────────────────────────

function fetchWithTimeout(url, options, timeoutMs) {
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
  var signal = controller.signal;
  var opts = Object.assign({}, options, { signal: signal });
  return fetch(url, opts).then(function(resp) {
    clearTimeout(timer);
    return resp;
  }).catch(function(err) {
    clearTimeout(timer);
    throw err;
  });
}

function fetchError(e) {
  return e.name === 'AbortError' ? 'timeout' : (e.message || 'fetch failed');
}

function isHttpUrl(url) {
  return typeof url === 'string' && (url.indexOf('http://') === 0 || url.indexOf('https://') === 0);
}

// ── Message handlers ──────────────────────────────────────────────────────────

async function handleCheckSensitiveFile(msg, sendResponse) {
  if (!isHttpUrl(msg.url)) {
    sendResponse({ ok: false, error: 'Invalid URL' });
    return;
  }
  var method = (msg.method || 'HEAD').toUpperCase();
  var options = { method: method, credentials: 'omit', cache: 'no-store', redirect: 'manual' };
  if (msg.body) {
    options.body = msg.body;
    options.headers = { 'Content-Type': msg.contentType || 'application/x-www-form-urlencoded' };
  }
  try {
    var resp = await fetchWithTimeout(msg.url, options, 8000);
    if (resp.type === 'opaqueredirect') {
      sendResponse({ ok: true, status: 301, headers: {}, text: '' });
      return;
    }
    var headers = {};
    resp.headers.forEach(function(v, k) { headers[k.toLowerCase()] = v; });
    var text = '';
    if (msg.readBody) {
      try {
        var buf = await resp.arrayBuffer();
        text = new TextDecoder().decode(new Uint8Array(buf).slice(0, 2048));
      } catch(e) {}
    }
    sendResponse({ ok: true, status: resp.status, headers: headers, text: text });
  } catch(err) {
    sendResponse({ ok: false, error: fetchError(err) });
  }
}

async function handleFetchHeaders(msg, sendResponse) {
  if (!isHttpUrl(msg.url)) {
    sendResponse({ ok: false, error: 'Invalid URL' });
    return;
  }
  try {
    var resp = await fetchWithTimeout(msg.url, { method: 'HEAD', credentials: 'omit', cache: 'no-store' }, 30000);
    var headers = {};
    resp.headers.forEach(function(value, name) { headers[name.toLowerCase()] = value; });
    sendResponse({ ok: true, status: resp.status, url: resp.url, headers: headers });
  } catch(err) {
    sendResponse({ ok: false, error: fetchError(err) });
  }
}

async function handleW3cValidate(msg, sendResponse) {
  if (!isHttpUrl(msg.url)) {
    sendResponse({ ok: false, error: 'Invalid URL' });
    return;
  }
  var w3cUrl = 'https://validator.w3.org/nu/?doc=' + encodeURIComponent(msg.url) + '&out=json';
  try {
    var resp = await fetchWithTimeout(w3cUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 SEOAudit/2.2 (Chrome extension)' }
    }, 30000);
    var json = await resp.json();
    sendResponse({ ok: resp.ok, status: resp.status, data: json });
  } catch(err) {
    sendResponse({ ok: false, error: fetchError(err) });
  }
}

async function handleDnsLookup(msg, sendResponse) {
  if (!msg.hostname || typeof msg.hostname !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(msg.hostname)) {
    sendResponse({ ok: false, error: 'Invalid hostname' });
    return;
  }
  var ALLOWED_DNS_TYPES = { A: 1, AAAA: 1, TXT: 1, CNAME: 1, MX: 1, NS: 1, SOA: 1, CAA: 1, PTR: 1 };
  var type = ALLOWED_DNS_TYPES[msg.type] ? msg.type : 'A';
  try {
    var resp = await fetchWithTimeout(
      'https://dns.google/resolve?name=' + encodeURIComponent(msg.hostname) + '&type=' + type,
      { method: 'GET', credentials: 'omit', cache: 'no-store' },
      10000
    );
    var json = await resp.json();
    sendResponse({ ok: resp.ok, data: json });
  } catch(err) {
    sendResponse({ ok: false, error: fetchError(err) });
  }
}


// Per-tab badge: critical count (red) or warning count (orange); cleared when
// show=false or there is nothing to report. Per-tab text resets on navigation.
async function handleUpdateBadge(msg, sendResponse) {
  var critical = msg.critical || 0;
  var warning = msg.warning || 0;
  var text = '';
  if (msg.show !== false) {
    if (critical > 0) text = String(critical);
    else if (warning > 0) text = String(warning);
  }
  var textOpts = { text: text };
  if (msg.tabId) textOpts.tabId = msg.tabId;
  try {
    await chrome.action.setBadgeText(textOpts);
    if (text) {
      var colorOpts = { color: critical > 0 ? '#e74c3c' : '#f39c12' };
      if (msg.tabId) colorOpts.tabId = msg.tabId;
      await chrome.action.setBadgeBackgroundColor(colorOpts);
    }
  } catch(e) {} // tab may already be closed
  sendResponse({ ok: true });
}

async function handleFetchText(msg, sendResponse) {
  if (!isHttpUrl(msg.url)) {
    sendResponse({ ok: false, error: 'Invalid URL' });
    return;
  }
  try {
    var resp = await fetchWithTimeout(msg.url, {
      method: 'GET',
      headers: { 'Accept': 'text/plain,text/html,application/xml,*/*;q=0.8' },
      cache: 'no-store',
    }, 15000);
    var text = await resp.text();
    sendResponse({ ok: resp.ok, status: resp.status, text: text, size: text.length, contentType: resp.headers.get('content-type') || '' });
  } catch(err) {
    sendResponse({ ok: false, error: fetchError(err) });
  }
}

async function handleFetchRobots(msg, sendResponse) {
  var url = msg.url;
  if (!isHttpUrl(url)) {
    sendResponse({ ok: false, error: 'Invalid URL' });
    return;
  }
  try {
    var resp = await fetchWithTimeout(url, { method: 'GET', credentials: 'omit', cache: 'no-store' }, 10000);
    var text = await resp.text();
    sendResponse({ ok: resp.ok, status: resp.status, text: text });
  } catch(err) {
    sendResponse({ ok: false, error: fetchError(err) });
  }
}

var MESSAGE_HANDLERS = {
  checkSensitiveFile: handleCheckSensitiveFile,
  fetchHeaders:    handleFetchHeaders,
  fetchText:       handleFetchText,
  fetchRobots:     handleFetchRobots,
  w3cValidate:     handleW3cValidate,
  dnsLookup:       handleDnsLookup,
  updateBadge:     handleUpdateBadge,
};

// NOTE: onMessage listener must NOT be async — Chrome closes the message channel
// when the handler returns a Promise instead of boolean true.
// Handlers are async; we call them without awaiting and always return true.
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  var handler = MESSAGE_HANDLERS[msg.action];
  if (!handler) return false;
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: 'Unauthorized sender' });
    return true;
  }
  var responded = false;
  var safeSend = function(resp) {
    if (!responded) { responded = true; sendResponse(resp); }
  };
  try {
    handler(msg, safeSend);
  } catch(e) {
    safeSend({ ok: false, error: e.message || 'Internal error' });
  }
  return true;
});

// ── Broken links port ────────────────────────────────────────────────────────

var MAX_HOPS = 10;

var LINK_CHECK_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

chrome.runtime.onConnect.addListener(function(port) {
  if (port.name !== 'linkChecker') return;

  var checking = false;
  port.onMessage.addListener(function(msg) {
    if (msg.action !== 'checkLinks') return;
    if (checking) return;
    checking = true;
    var timeout = msg.timeout || 12000;
    var concurrent = Math.min(msg.concurrent || 6, 50);
    runChecks(msg.urls, port, timeout, concurrent);
  });
  port.onDisconnect.addListener(function() {
    checking = false;
  });
});

async function runChecks(urls, port, timeout, concurrent) {
  var results = [];
  var total = urls.length;
  var checked = 0;

  for (var i = 0; i < urls.length; i += concurrent) {
    var batch = urls.slice(i, i + concurrent);
    var batchResults = await Promise.all(batch.map(function(url) { return checkUrl(url, timeout); }));
    Array.prototype.push.apply(results, batchResults);
    checked += batchResults.length;

    try {
      port.postMessage({ type: 'progress', checked: checked, total: total });
    } catch (e) {
      return;
    }
  }

  try {
    port.postMessage({ type: 'done', results: results });
  } catch (e) {
    console.warn('[linkChecker] failed to send done message:', e.message);
  }
}

async function checkUrl(originalUrl, timeout) {
  var chain = [];
  var current = originalUrl;
  var visited = new Set();

  for (var hop = 0; hop < MAX_HOPS; hop++) {
    if (visited.has(current)) {
      chain.push({ url: current, status: 0, location: '', error: 'redirect loop' });
      break;
    }
    visited.add(current);

    var entry = await fetchOne(current, timeout);
    chain.push(entry);

    if (entry.error) break;

    if (entry.status >= 300 && entry.status < 400) {
      var location = entry.location;
      if (!location) break;
      try {
        current = new URL(location, current).href;
      } catch (e) {
        break;
      }
    } else {
      break;
    }
  }

  var last = chain[chain.length - 1] || {};
  return {
    url: originalUrl,
    chain: chain,
    finalStatus: last.status || 0,
    finalUrl: last.url || originalUrl,
    error: last.error || null
  };
}

async function fetchOne(url, timeout) {
  var result = await doRequest(url, 'HEAD', timeout);
  if (result.status === 405 || result.status === 501) {
    result = await doRequest(url, 'GET', timeout);
  }
  if (result.error === 'opaque-redirect') {
    result = await doRequestFollow(url, timeout);
  }
  return result;
}

async function doRequest(url, method, timeout) {
  try {
    var resp = await fetchWithTimeout(url, {
      method: method,
      redirect: 'manual',
      cache: 'no-store',
      credentials: 'omit',
      headers: LINK_CHECK_HEADERS,
    }, timeout || 12000);

    if (resp.type === 'opaqueredirect') {
      return { url: url, status: 0, location: '', error: 'opaque-redirect' };
    }

    return {
      url: url,
      status: resp.status,
      location: resp.headers.get('location') || ''
    };
  } catch (e) {
    return {
      url: url,
      status: 0,
      location: '',
      error: fetchError(e)
    };
  }
}

async function doRequestFollow(url, timeout) {
  var t = timeout || 12000;
  var opts = { redirect: 'follow', cache: 'no-store', credentials: 'omit', headers: LINK_CHECK_HEADERS };
  try {
    var resp = await fetchWithTimeout(url, Object.assign({ method: 'HEAD' }, opts), t);

    if (resp.status === 405 || resp.status === 501) {
      resp = await fetchWithTimeout(url, Object.assign({ method: 'GET' }, opts), t);
    }

    return {
      url: resp.url || url,
      status: resp.status,
      location: ''
    };
  } catch (e) {
    return {
      url: url,
      status: 0,
      location: '',
      error: fetchError(e)
    };
  }
}
