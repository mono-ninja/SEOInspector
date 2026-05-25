// ─── Redirect Chain Panel ─────────────────────────────────────────────────────

var rdPort = null;
if (!PopupState.rdState) {
  PopupState.rdState = { port: null };
}

function initRedirectChainPanel() {
  var panel = document.getElementById('redirect-chain-panel');
  if (panel.dataset.init) return;
  panel.dataset.init = '1';
  panel.innerHTML = '';
  renderRedirectChainPanel(panel);
}

function renderRedirectChainPanel(panel) {
  var wrap = document.createElement('div');
  wrap.className = 'rdchain-wrap';

  // Input row
  var inputRow = document.createElement('div');
  inputRow.className = 'rdchain-input-row';
  var input = document.createElement('input');
  input.type = 'url';
  input.className = 'rdchain-input';
  input.placeholder = 'https://example.com/old-path';
  input.value = PopupState.currentTabUrl || '';

  var checkBtn = document.createElement('button');
  checkBtn.className = 'rdchain-check-btn';
  checkBtn.textContent = T.t('redirect_chain.check');

  inputRow.appendChild(input);
  inputRow.appendChild(checkBtn);
  wrap.appendChild(inputRow);

  var resultWrap = document.createElement('div');
  resultWrap.className = 'rdchain-result';
  wrap.appendChild(resultWrap);

  checkBtn.addEventListener('click', function() {
    var url = input.value.trim();
    if (!url || (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0)) {
      resultWrap.innerHTML = '';
      var errDiv = document.createElement('div');
      errDiv.className = 'panel-error';
      errDiv.textContent = T.t('redirect_chain.invalid_url');
      resultWrap.appendChild(errDiv);
      return;
    }
    startRedirectCheck(url, checkBtn, resultWrap);
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') checkBtn.click();
  });

  panel.appendChild(wrap);
}

function startRedirectCheck(url, btn, resultWrap) {
  if (rdPort) { try { rdPort.disconnect(); } catch(e) {} rdPort = null; }

  btn.disabled = true;
  btn.textContent = T.t('popup.loading');
  resultWrap.innerHTML = '';

  var loadingEl = document.createElement('div');
  loadingEl.className = 'rdchain-loading';
  loadingEl.textContent = T.t('redirect_chain.checking');
  resultWrap.appendChild(loadingEl);

  rdPort = chrome.runtime.connect({ name: 'linkChecker' });

  rdPort.onMessage.addListener(function(msg) {
    if (msg.type !== 'done') return;
    rdPort.disconnect();
    rdPort = null;
    btn.disabled = false;
    btn.textContent = T.t('redirect_chain.check');
    resultWrap.innerHTML = '';
    if (msg.results && msg.results[0]) {
      renderRedirectResult(resultWrap, msg.results[0]);
    }
  });

  rdPort.onDisconnect.addListener(function() {
    rdPort = null;
    btn.disabled = false;
    btn.textContent = T.t('redirect_chain.check');
    if (resultWrap.querySelector('.rdchain-loading')) {
      resultWrap.innerHTML = '';
      var errDiv = document.createElement('div');
      errDiv.className = 'panel-error';
      errDiv.textContent = T.t('bl.connection_lost');
      resultWrap.appendChild(errDiv);
    }
  });

  rdPort.postMessage({
    action: 'checkLinks',
    urls: [url],
    timeout: 12000,
    concurrent: 1,
  });
}

function renderRedirectResult(container, result) {
  var chain = result.chain || [{ url: result.url, status: result.finalStatus }];

  var wrap = document.createElement('div');
  wrap.className = 'rdchain-result-wrap';

  var statusClass = 'rdchain-final-ok';
  if (result.finalStatus === 0) statusClass = 'rdchain-final-err';
  else if (result.finalStatus >= 400) statusClass = 'rdchain-final-err';
  else if (chain.length > 2) statusClass = 'rdchain-final-warn';

  chain.forEach(function(hop, i) {
    var hopEl = document.createElement('div');
    hopEl.className = 'rdchain-hop';

    if (i > 0) {
      var arrow = document.createElement('div');
      arrow.className = 'rdchain-arrow';
      arrow.textContent = '↓';
      wrap.appendChild(arrow);
    }

    var statusBadge = document.createElement('span');
    statusBadge.className = 'rdchain-status ' + hopStatusClass(hop.status);
    statusBadge.textContent = hop.status || (result.error === 'timeout' ? 'TIMEOUT' : 'ERR');

    var urlEl = document.createElement('span');
    urlEl.className = 'rdchain-url';
    urlEl.textContent = hop.url;
    urlEl.title = hop.url;

    hopEl.appendChild(statusBadge);
    hopEl.appendChild(urlEl);

    if (i === chain.length - 1) {
      hopEl.classList.add(statusClass);
    }
    wrap.appendChild(hopEl);
  });

  // Summary
  var summary = document.createElement('div');
  summary.className = 'rdchain-summary';
  if (chain.length === 1) {
    summary.textContent = T.t('redirect_chain.no_redirect');
    summary.classList.add('rdchain-summary-ok');
  } else if (result.finalStatus >= 400 || result.finalStatus === 0) {
    summary.textContent = T.t('redirect_chain.broken', { hops: chain.length - 1 });
    summary.classList.add('rdchain-summary-err');
  } else {
    summary.textContent = T.t('redirect_chain.hops', { hops: chain.length - 1 });
    summary.classList.add(chain.length > 3 ? 'rdchain-summary-warn' : 'rdchain-summary-ok');
  }
  wrap.appendChild(summary);

  if (result.error && result.error !== 'timeout') {
    var errEl = document.createElement('div');
    errEl.className = 'panel-error';
    errEl.textContent = result.error;
    wrap.appendChild(errEl);
  }

  container.appendChild(wrap);
}

function hopStatusClass(status) {
  if (!status || status === 0) return 'rdchain-st-err';
  if (status >= 300 && status < 400) return 'rdchain-st-redirect';
  if (status >= 400) return 'rdchain-st-err';
  return 'rdchain-st-ok';
}
