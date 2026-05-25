# SEOInspector — Real-time SEO Audit

> Chrome extension (Manifest V3) for instant SEO auditing of any webpage.  
> 47 built-in checkers · Core Web Vitals · Schema validation · Broken links · SERP preview

---

## Features

| Category | Checkers |
|---|---|
| On-page SEO | Title, meta description, canonical, robots, hreflang, pagination |
| Structure | Headings hierarchy, internal/external links, link equity, TOC |
| Rich results | Open Graph, Twitter Cards, JSON-LD schema, schema suggestions |
| Performance | Core Web Vitals (LCP, CLS, FCP, INP), resource hints, fonts, CSS |
| Content | Word count, keyword density, readability, NLP, E-E-A-T signals |
| Accessibility | ARIA roles, form labels, color contrast, skip links |
| Security | Mixed content, exposed emails, leaked API keys, security headers |
| Technical | JS SEO, PWA, tech stack, third-party scripts, URL params |
| Tools | HTTP headers, storage inspector, robots.txt viewer, sitemap explorer, redirect chain |
| Extras | Broken link checker (up to 150 URLs), audit history (last 50 audits), export to HTML/CSV/Markdown |

---

## Installation

### Option A — Chrome Web Store

Install directly from the Chrome Web Store *(link will be added after publication)*.

### Option B — Developer mode (unpacked)

Use this method to run the latest source code locally.

**Requirements:** Google Chrome 88+

1. Clone or download this repository:
   ```bash
   git clone https://github.com/<your-username>/SEOInspector.git
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **"Load unpacked"** and select the project folder (`SEOInspector/`)

5. The SEOInspector icon will appear in the Chrome toolbar

> After any code change, click the **reload** button on the extension card at `chrome://extensions`.

---

## Usage

1. Navigate to any webpage you want to audit
2. Click the **SEOInspector** icon in the toolbar
3. Click **"Аналіз"** (Analyze) — results appear within seconds
4. Switch between checker tabs in the sidebar
5. Click any issue to highlight the element on the page
6. Use the **Export** button for HTML/PDF/CSV/Markdown report

### Sidebar modes

- **Local** — 47 built-in checkers running entirely in your browser
- **DFS** — DataForSEO-powered panels (backlinks, keywords, SERP, domain stats, tech, AI)

---

## Options & Configuration

Open **Settings** via the gear icon or right-click the extension → "Options":

- Enable/disable individual checkers
- Adjust thresholds: title length, LCP/CLS/FCP limits, word count, max links, etc.
- Set DataForSEO API credentials for advanced panels
- Configure broken-link checker concurrency and timeout

Settings are stored in `chrome.storage.sync` and sync across your Chrome profile.

---

## Project Structure

```
SEOInspector/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker: API proxies, link checker
├── content.js             # Orchestrator injected into pages
├── checkers/              # 47 checker modules (one file per checker)
├── popup.html             # Extension popup
├── popup/
│   ├── app.js             # Entry point, event wiring
│   ├── analyze.js         # Run audit, loading state
│   ├── state.js           # Global popup state
│   ├── lib/
│   │   ├── constants.js   # CHECKER_TABS, SPECIAL_PANELS, etc.
│   │   └── utils.js       # Pure helper functions
│   ├── ui/
│   │   ├── render.js      # Score, results, badges rendering
│   │   └── panel-switch.js
│   └── panels/            # Special panels (broken links, storage, headers, …)
├── api/
│   ├── cache.js           # TTL cache backed by chrome.storage.local
│   └── dataforseo.js      # DataForSEO API wrapper
├── options.html / options.js / options.css
├── i18n.js                # Ukrainian UI strings
└── icons/
```

---


## Minimum Requirements

- Google Chrome 88+
- No internet connection required for local checkers
