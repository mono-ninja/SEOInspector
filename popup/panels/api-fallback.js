// ── API Fallback Panel ───────────────────────────────────────────────────────
// Shown when api/cache.js or api/dataforseo.js are missing (no DFS support).

function showApiFallback(panel) {
  panel.innerHTML = '';
  var wrap = document.createElement('div');
  wrap.className = 'panel-empty';
  wrap.style.textAlign = 'center';
  wrap.style.padding = '24px';

  var icon = document.createElement('div');
  icon.style.fontSize = '32px';
  icon.style.marginBottom = '8px';
  icon.textContent = '🔌';

  var msg = document.createElement('p');
  msg.style.fontSize = '13px';
  msg.style.color = 'hsl(var(--muted-foreground))';
  msg.style.marginBottom = '4px';
  msg.textContent = 'DataForSEO integration is not configured.';

  var hint = document.createElement('p');
  hint.style.fontSize = '11px';
  hint.style.color = 'hsl(var(--muted-foreground))';
  hint.textContent = 'Set your API credentials in Settings → DataForSEO to unlock backlinks, keywords, SERP analysis, and more.';

  wrap.appendChild(icon);
  wrap.appendChild(msg);
  wrap.appendChild(hint);
  panel.appendChild(wrap);
}
