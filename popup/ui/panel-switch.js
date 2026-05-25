// ─── Panel Switching ──────────────────────────────────────────────────────────

function hideAllPanels() {
  PANEL_CONTAINER_IDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  var filterBar = document.getElementById('filter-bar');
  if (filterBar) filterBar.classList.add('hidden');
}

var PANEL_MAP = {
  broken_links:   'broken-links-panel',
  storage:        'storage-panel',
  headers:        'headers-panel',
  audit_history:  'audit-history-panel',
  og_preview:     'og-preview-panel',
  serp_preview:   'serp-preview-panel',
  sitemap:        'sitemap-panel',

  redirect_chain:  'redirect-chain-panel',
  security_files:  'security-files-panel',
};

function switchPanel(tab) {
  hideAllPanels();
  var panelId = PANEL_MAP[tab];
  if (!panelId) {
    var target = document.getElementById('results');
    target.classList.remove('hidden');
    target.classList.add('panel-animate');
    setTimeout(function() { target.classList.remove('panel-animate'); }, 200);
    var filterBar = document.getElementById('filter-bar');
    if (filterBar) filterBar.classList.remove('hidden');
    return;
  }
  var target = document.getElementById(panelId);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('panel-animate');
    setTimeout(function() { target.classList.remove('panel-animate'); }, 200);
  }
}
