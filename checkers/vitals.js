function runVitalsChecker(p) {
  var params = p || {};
  var lcpWarning  = params.lcp_warning  || 2500;
  var lcpCritical = params.lcp_critical || 4000;
  var clsWarning  = params.cls_warning  !== undefined ? params.cls_warning / 100 : 0.1;
  var clsCritical = params.cls_critical !== undefined ? params.cls_critical / 100 : 0.25;
  var fcpWarning  = params.fcp_warning  || 1800;
  var fcpCritical = params.fcp_critical || 3000;
  var inpWarning  = params.inp_warning  || 200;
  var inpCritical = params.inp_critical || 500;

  return new Promise(function(resolve) {
    var issues = [];
    var lcpValue = null;
    var lcpElement = null;
    var clsValue = 0;
    var clsHasData = false;
    var observers = [];

    // LCP — only via PerformanceObserver with buffered: true
    try {
      var lcpObs = new PerformanceObserver(function(list) {
        var entries = list.getEntries();
        if (entries.length > 0) {
          lcpValue = entries[entries.length - 1].startTime;
          lcpElement = entries[entries.length - 1].element;
        }
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
      observers.push(lcpObs);
    } catch(e) {}

    // CLS — only via PerformanceObserver with buffered: true
    try {
      var clsObs = new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(entry) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            clsHasData = true;
          }
        });
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });
      observers.push(clsObs);
    } catch(e) {}

    // FCP — available via getEntriesByType('paint'), synchronously
    var fcpValue = null;
    try {
      performance.getEntriesByType('paint').forEach(function(entry) {
        if (entry.name === 'first-contentful-paint') fcpValue = entry.startTime;
      });
    } catch(e) {}

    // INP — Interaction to Next Paint via PerformanceObserver (buffered events)
    var inpValue = null;
    try {
      var inpObs = new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(entry) {
          if (inpValue === null || entry.duration > inpValue) inpValue = entry.duration;
        });
      });
      inpObs.observe({ type: 'event', buffered: true, durationThreshold: 16 });
      observers.push(inpObs);
    } catch(e) {}

    // Buffered PerformanceObserver callbacks fire asynchronously; 1000 ms gives
    // them time to complete even on slow devices or mid-load pages.
    setTimeout(function() {
      observers.forEach(function(obs) { try { obs.disconnect(); } catch(e) {} });

      var hasData = false;
      var infoLines = [];

      // Navigation type context
      var navType = '';
      try {
        var nav = performance.getEntriesByType('navigation')[0];
        if (nav) navType = nav.type;
      } catch(e) {}

      if (lcpValue !== null) {
        hasData = true;
        var lcpDetail = 'LCP: ' + Math.round(lcpValue) + ' мс';
        if (lcpElement) {
          try {
            var desc = lcpElement.outerHTML ? lcpElement.outerHTML.substring(0, 120) : lcpElement.tagName;
            lcpDetail += '\nЕлемент: ' + desc;
          } catch(e) {}
        }
        if (lcpValue > lcpCritical) {
          issues.push({ type: 'poor_lcp', message: 'LCP (Largest Contentful Paint) — дуже поганий показник', severity: 'critical', detail: lcpDetail + '. Порог: до ' + lcpWarning + ' мс.' });
        } else if (lcpValue > lcpWarning) {
          issues.push({ type: 'moderate_lcp', message: 'LCP (Largest Contentful Paint) — потребує покращення', severity: 'warning', detail: lcpDetail + '. Порог: до ' + lcpWarning + ' мс.' });
        }
        infoLines.push('LCP  ' + Math.round(lcpValue) + ' мс  ' + (lcpValue > lcpCritical ? '✗' : lcpValue > lcpWarning ? '⚠' : '✓'));
      }

      if (clsHasData) {
        hasData = true;
        var cls = Math.round(clsValue * 1000) / 1000;
        if (cls > clsCritical) {
          issues.push({ type: 'poor_cls', message: 'CLS (Cumulative Layout Shift) — дуже високий', severity: 'critical', detail: 'CLS: ' + cls + '. Порог: до ' + clsWarning + '.' });
        } else if (cls > clsWarning) {
          issues.push({ type: 'moderate_cls', message: 'CLS (Cumulative Layout Shift) — потребує покращення', severity: 'warning', detail: 'CLS: ' + cls + '. Порог: до ' + clsWarning + '.' });
        }
        infoLines.push('CLS  ' + cls + '  ' + (cls > clsCritical ? '✗' : cls > clsWarning ? '⚠' : '✓'));
      }

      if (fcpValue !== null) {
        hasData = true;
        if (fcpValue > fcpCritical) {
          issues.push({ type: 'poor_fcp', message: 'FCP (First Contentful Paint) — дуже повільний', severity: 'critical', detail: 'FCP: ' + Math.round(fcpValue) + ' мс. Порог: до ' + fcpWarning + ' мс.' });
        } else if (fcpValue > fcpWarning) {
          issues.push({ type: 'moderate_fcp', message: 'FCP (First Contentful Paint) — потребує покращення', severity: 'warning', detail: 'FCP: ' + Math.round(fcpValue) + ' мс. Порог: до ' + fcpWarning + ' мс.' });
        }
        infoLines.push('FCP  ' + Math.round(fcpValue) + ' мс  ' + (fcpValue > fcpCritical ? '✗' : fcpValue > fcpWarning ? '⚠' : '✓'));
      }

      // INP results
      if (inpValue !== null) {
        hasData = true;
        if (inpValue > inpCritical) {
          issues.push({ type: 'poor_inp', message: 'INP (Interaction to Next Paint) — дуже повільний', severity: 'critical', detail: 'INP: ' + Math.round(inpValue) + ' мс. Порог: до ' + inpWarning + ' мс.' });
        } else if (inpValue > inpWarning) {
          issues.push({ type: 'moderate_inp', message: 'INP (Interaction to Next Paint) — потребує покращення', severity: 'warning', detail: 'INP: ' + Math.round(inpValue) + ' мс. Порог: до ' + inpWarning + ' мс.' });
        }
        infoLines.push('INP  ' + Math.round(inpValue) + ' мс  ' + (inpValue > inpCritical ? '✗' : inpValue > inpWarning ? '⚠' : '✓'));
      }

      if (infoLines.length > 0) {
        var overviewDetail = 'Core Web Vitals' + (navType && navType !== 'navigate' ? ' (навігація: ' + navType + ')' : '');
        issues.push({ type: 'vitals_overview', message: overviewDetail, severity: 'info', detail: infoLines.join('\n') });
      }

      if (!hasData) {
        issues.push({ type: 'no_vitals_data', message: 'Дані Core Web Vitals доступні лише після повного завантаження сторінки', severity: 'notice' });
      }

      resolve({ id: 'vitals', name: 'Core Web Vitals', issues: issues });
    }, 1000);
  });
}
