var DEFAULT_PARAMS = {
  title_min: 10,
  title_max: 60,
  desc_min: 50,
  desc_max: 160,
  min_words: 300,
  keyword_density: 5,
  max_sentence_words: 25,
  max_heading_len: 120,
  min_h1_len: 10,
  max_h2: 10,
  ttfb_warning: 400,
  ttfb_critical: 800,
  dcl_warning: 3000,
  load_warning: 5000,
  max_scripts: 20,
  lcp_warning: 2500,
  lcp_critical: 4000,
  cls_warning: 10,
  cls_critical: 25,
  fcp_warning: 3000,
  max_links: 150,
  max_nofollow_pct: 30,
  max_external_links: 100,
  max_3p_domains: 10,
  heavy_script_kb: 100,
  heavy_image_kb: 100,
  min_internal_links: 3,
  max_url_depth: 4,
  max_external_links_without_nofollow: 10,
  max_footer_links: 20,
  bl_max_urls: 150,
  bl_timeout: 12,
  bl_concurrent: 6,
};

var PROFILES = {
  blog: {
    title_min: 30,
    title_max: 60,
    desc_min: 120,
    desc_max: 155,
    min_words: 800,
    keyword_density: 3,
    max_sentence_words: 20,
    max_h2: 15,
    min_internal_links: 5,
  },
  ecommerce: {
    title_min: 20,
    title_max: 55,
    desc_min: 80,
    desc_max: 160,
    min_words: 200,
    keyword_density: 4,
    max_h2: 8,
    min_internal_links: 3,
  },
  landing: {
    title_min: 15,
    title_max: 50,
    desc_min: 80,
    desc_max: 140,
    min_words: 150,
    keyword_density: 5,
    max_sentence_words: 30,
    max_h2: 6,
    min_internal_links: 2,
  },
};

function loadSettings() {
  chrome.storage.sync.get({ enabledCheckers: {}, seoParams: {}, showBadge: true }, function(data) {
    var enabled = data.enabledCheckers;
    CHECKERS.forEach(function(id) {
      var input = document.querySelector('[data-checker="' + id + '"]');
      if (input) input.checked = id in enabled ? enabled[id] : true;
    });

    var params = {};
    for (var k in DEFAULT_PARAMS) { params[k] = DEFAULT_PARAMS[k]; }
    var seoParamsData = data.seoParams;
    if (seoParamsData) { for (var k2 in seoParamsData) { params[k2] = seoParamsData[k2]; } }
    document.querySelectorAll('[data-param]').forEach(function(input) {
      var key = input.dataset.param;
      if (key in params) input.value = params[key];
    });

    var badgeInput = document.querySelector('[data-setting="showBadge"]');
    if (badgeInput) badgeInput.checked = data.showBadge !== false;
  });
}

function saveSettings(e) {
  e.preventDefault();
  var enabledCheckers = {};
  CHECKERS.forEach(function(id) {
    var input = document.querySelector('[data-checker="' + id + '"]');
    if (input) enabledCheckers[id] = input.checked;
  });

  var seoParams = {};
  document.querySelectorAll('[data-param]').forEach(function(input) {
    var key = input.dataset.param;
    var val = parseFloat(input.value);
    if (!isNaN(val) && val >= 0) seoParams[key] = val;
  });

  var badgeInput = document.querySelector('[data-setting="showBadge"]');
  var showBadge = badgeInput ? badgeInput.checked : true;

  chrome.storage.sync.set({ enabledCheckers: enabledCheckers, seoParams: seoParams, showBadge: showBadge }, function() {
    var msg = document.getElementById('save-confirmation');
    if (chrome.runtime.lastError) {
      msg.textContent = 'Save error: ' + chrome.runtime.lastError.message;
      msg.classList.remove('hidden');
      msg.style.color = '#c0392b';
      setTimeout(function() { msg.classList.add('hidden'); msg.style.color = ''; msg.textContent = ''; }, 4000);
      return;
    }
    msg.textContent = 'Saved!';
    msg.style.color = '';
    msg.classList.remove('hidden');
    setTimeout(function() { msg.classList.add('hidden'); }, 2000);
  });
}

function resetParams() {
  document.querySelectorAll('[data-param]').forEach(function(input) {
    var key = input.dataset.param;
    if (key in DEFAULT_PARAMS) input.value = DEFAULT_PARAMS[key];
  });
}

function updateClsPreview() {
  ['cls_warning', 'cls_critical'].forEach(function(key) {
    var input = document.querySelector('[data-param="' + key + '"]');
    if (!input) return;
    var unit = input.closest('.param-control').querySelector('.param-unit');
    if (unit) unit.textContent = '= ' + (parseFloat(input.value) / 100).toFixed(2);
  });
}

// ── Custom Security Files ──────────────────────────────────────────────────

function loadCustomSecurityFiles() {
  chrome.storage.local.get({ customSecurityFiles: [] }, function(data) {
    renderCustomFilesList(data.customSecurityFiles || []);
  });
}

function saveCustomSecurityFiles(files, cb) {
  chrome.storage.local.set({ customSecurityFiles: files }, cb || function() {});
}

function renderCustomFilesList(files) {
  var container = document.getElementById('custom-files-list');
  if (!container) return;
  container.innerHTML = '';

  if (files.length === 0) {
    var empty = document.createElement('p');
    empty.className = 'cf-empty';
    empty.textContent = 'No custom files added yet.';
    container.appendChild(empty);
    return;
  }

  files.forEach(function(f, idx) {
    var row = document.createElement('div');
    row.className = 'cf-entry';

    var info = document.createElement('div');
    info.className = 'cf-entry-info';

    var badge = document.createElement('span');
    badge.className = 'cf-method-badge cf-method-' + (f.method || 'HEAD').toLowerCase();
    badge.textContent = f.method || 'HEAD';
    info.appendChild(badge);

    var sevBadge = document.createElement('span');
    sevBadge.className = 'cf-sev-badge cf-sev-' + (f.severity || 'warning');
    sevBadge.textContent = f.severity || 'warning';
    info.appendChild(sevBadge);

    var path = document.createElement('span');
    path.className = 'cf-entry-path';
    path.textContent = f.label ? f.label + ' (' + f.path + ')' : f.path;
    info.appendChild(path);

    row.appendChild(info);

    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn-cf-delete';
    del.textContent = 'Remove';
    (function(i) {
      del.addEventListener('click', function() {
        chrome.storage.local.get({ customSecurityFiles: [] }, function(data) {
          var updated = (data.customSecurityFiles || []).filter(function(_, j) { return j !== i; });
          saveCustomSecurityFiles(updated, function() { renderCustomFilesList(updated); });
        });
      });
    })(idx);
    row.appendChild(del);

    container.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
  loadCustomSecurityFiles();
  document.getElementById('options-form').addEventListener('submit', saveSettings);

  document.getElementById('btn-reset-params').addEventListener('click', function() {
    resetParams();
    updateClsPreview();
  });

  ['cls_warning', 'cls_critical'].forEach(function(key) {
    var input = document.querySelector('[data-param="' + key + '"]');
    if (input) input.addEventListener('input', updateClsPreview);
  });

  updateClsPreview();

  // Custom security files
  var cfMethod = document.getElementById('cf-method');
  var cfBodyRow = document.getElementById('cf-body-row');
  if (cfMethod && cfBodyRow) {
    cfMethod.addEventListener('change', function() {
      cfBodyRow.style.display = cfMethod.value === 'POST' ? '' : 'none';
    });
  }

  var btnAdd = document.getElementById('btn-add-custom-file');
  if (btnAdd) {
    btnAdd.addEventListener('click', function() {
      var pathEl = document.getElementById('cf-path');
      var path = (pathEl && pathEl.value.trim()) || '';
      if (!path) { pathEl && pathEl.focus(); return; }
      if (path.charAt(0) !== '/') path = '/' + path;

      var method   = (document.getElementById('cf-method') && document.getElementById('cf-method').value) || 'HEAD';
      var severity = (document.getElementById('cf-severity') && document.getElementById('cf-severity').value) || 'warning';
      var label    = (document.getElementById('cf-label') && document.getElementById('cf-label').value.trim()) || '';
      var desc     = (document.getElementById('cf-desc') && document.getElementById('cf-desc').value.trim()) || '';
      var body     = (method === 'POST' && document.getElementById('cf-body') && document.getElementById('cf-body').value.trim()) || '';
      var ct       = (method === 'POST' && document.getElementById('cf-content-type') && document.getElementById('cf-content-type').value.trim()) || '';

      var entry = { path: path, method: method, severity: severity };
      if (label) entry.label = label;
      if (desc)  entry.desc  = desc;
      if (body)  entry.body  = body;
      if (ct)    entry.contentType = ct;

      chrome.storage.local.get({ customSecurityFiles: [] }, function(data) {
        var updated = (data.customSecurityFiles || []).concat([entry]);
        saveCustomSecurityFiles(updated, function() {
          renderCustomFilesList(updated);
          pathEl.value = '';
          var lbl = document.getElementById('cf-label'); if (lbl) lbl.value = '';
          var dsc = document.getElementById('cf-desc');  if (dsc) dsc.value = '';
          var bdy = document.getElementById('cf-body');  if (bdy) bdy.value = '';
        });
      });
    });
  }

  // Profile buttons
  document.querySelectorAll('.profile-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var profile = PROFILES[btn.dataset.profile];
      if (!profile) return;
      document.querySelectorAll('.profile-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('[data-param]').forEach(function(input) {
        var key = input.dataset.param;
        if (key in profile) {
          input.value = profile[key];
        }
      });
      updateClsPreview();
    });
  });

  // Check for version changes — show reload notice
  var currentVersion = chrome.runtime.getManifest().version;
  chrome.storage.local.get('seoinspector_version', function(data) {
    var storedVersion = data.seoinspector_version;
    if (storedVersion && storedVersion !== currentVersion) {
      var notice = document.createElement('div');
      notice.style.cssText = 'background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 20px;margin:16px 0;font-size:13px;color:#92400e;';
      notice.textContent = 'Extension updated! Reload in chrome://extensions for all features to work.';
      var main = document.querySelector('.content');
      if (main) main.insertBefore(notice, main.firstChild);
    }
    chrome.storage.local.set({ seoinspector_version: currentVersion });
  });
});
