// ─── Shared State ──────────────────────────────────────────────────────────────

var PopupState = {
  currentTab: 'all',
  currentSeverity: 'all',
  lastResults: null,
  currentTabId: null,
  currentTabUrl: '',
  currentTabTitle: '',
  currentParams: {},

  brokenLinksChecked: false,
  storageLoaded: false,
  headersLoaded: false,
  ogPreviewLoaded: false,
  serpPreviewLoaded: false,
  robotsTxtLoaded: false,
  sitemapLoaded: false,

  brokenLinksPort: null,
  blAnchorMap: {},
  blTargetMode: 'page',
  blLimit: 100,

  activeHlBtn: null,

  panelGen: {},

  w3cState: null,

  rdState: null,
  activeContentTab: 'quick-wins',
  expandedQuickWin: null,

  targetKeyword: '',
  mutedTypes: {},
  showMuted: false,
};
