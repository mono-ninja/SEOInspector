function runSitemapChecker(p) {
  var origin = window.location.origin;
  var isHttps = window.location.protocol === 'https:';

  function normPageUrl(u) {
    return (u || '').split('#')[0].replace(/\/$/, '');
  }
  var currentUrlNorm = normPageUrl(window.location.href);

  function bgFetch(url) {
    return new Promise(function(resolve) {
      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, 12000);
      chrome.runtime.sendMessage({ action: 'fetchText', url: url }, function(resp) {
        clearTimeout(timer);
        void chrome.runtime.lastError;
        resolve(resp && resp.ok ? resp : { ok: false, status: resp && resp.status || 0, text: '', size: resp && resp.size || 0 });
      });
    });
  }

  function parseXml(text) {
    try {
      var doc = new DOMParser().parseFromString(text, 'text/xml');
      if (doc.querySelector('parsererror')) return null;
      return doc;
    } catch(e) { return null; }
  }

  function extractSitemapUrls(robotsText) {
    var urls = [];
    (robotsText || '').split('\n').forEach(function(line) {
      var m = line.match(/^\s*sitemap\s*:\s*(.+)/i);
      if (m) urls.push(m[1].trim());
    });
    return urls;
  }

  function analyzeDoc(doc) {
    var indexTags = doc.getElementsByTagName('sitemap');
    if (indexTags.length > 0) {
      var indexUrls = [];
      for (var i = 0; i < indexTags.length; i++) {
        var locEl = indexTags[i].getElementsByTagName('loc')[0];
        if (locEl) indexUrls.push(locEl.textContent.trim());
      }
      return { isIndex: true, indexUrls: indexUrls };
    }

    var urlTags = doc.getElementsByTagName('url');
    var total = urlTags.length;
    var lastmods = [], priorities = [];
    var wrongDomain = 0, invalidUrl = 0, httpOnHttps = 0, duplicates = 0;
    var hasImages = doc.getElementsByTagName('image:loc').length > 0;
    var hasVideos = doc.getElementsByTagName('video:loc').length > 0;
    var seenUrls = {};
    var hasCurrentUrl = false;

    for (var j = 0; j < urlTags.length; j++) {
      var ut = urlTags[j];
      var locEl2 = ut.getElementsByTagName('loc')[0];
      var lmEl   = ut.getElementsByTagName('lastmod')[0];
      var prEl   = ut.getElementsByTagName('priority')[0];

      if (locEl2) {
        var rawLoc = locEl2.textContent.trim();
        if (normPageUrl(rawLoc) === currentUrlNorm) hasCurrentUrl = true;
        try {
          var parsed = new URL(rawLoc);
          if (parsed.origin !== origin) wrongDomain++;
          if (isHttps && parsed.protocol === 'http:') httpOnHttps++;
          if (seenUrls[rawLoc]) duplicates++;
          else seenUrls[rawLoc] = true;
        } catch(e) {
          invalidUrl++;
        }
      }

      if (lmEl) {
        var d = new Date(lmEl.textContent.trim());
        if (!isNaN(d.getTime())) lastmods.push(d.getTime());
      }
      if (prEl) {
        var v = parseFloat(prEl.textContent.trim());
        if (!isNaN(v)) priorities.push(v);
      }
    }
    return { isIndex: false, total: total, lastmods: lastmods, priorities: priorities, wrongDomain: wrongDomain, invalidUrl: invalidUrl, httpOnHttps: httpOnHttps, duplicates: duplicates, hasImages: hasImages, hasVideos: hasVideos, hasCurrentUrl: hasCurrentUrl };
  }

  // «Чи є поточний URL у sitemap» — для index перевіряємо лише завантажені
  // дочірні sitemap, тому при частковому покритті повідомлення обережне.
  function addCurrentUrlIssue(issues, found, checkedCount, totalCount) {
    if (found) {
      issues.push({ type: 'url_in_sitemap', message: 'Поточна сторінка присутня в sitemap ✓', severity: 'info', detail: currentUrlNorm });
    } else {
      var partial = totalCount > checkedCount;
      issues.push({
        type: 'url_not_in_sitemap',
        message: partial
          ? 'Поточну сторінку не знайдено в перевірених sitemap (' + checkedCount + ' з ' + totalCount + ')'
          : 'Поточної сторінки немає в sitemap',
        severity: 'notice',
        detail: 'URL: ' + currentUrlNorm + (partial ? '\nПеревірено лише частину файлів sitemap index — сторінка може бути в інших.' : '\nСторінки поза sitemap індексуються повільніше та вважаються менш пріоритетними.')
      });
    }
  }

  function analyzeLastmods(lastmods, total, now, issues) {
    if (lastmods.length === 0) {
      issues.push({ type: 'sitemap_no_lastmod', message: 'У sitemap немає дат <lastmod> — Google не може оцінити свіжість контенту', severity: 'notice' });
      return;
    }
    var missing = total - lastmods.length;
    if (missing > 0) {
      issues.push({ type: 'sitemap_partial_lastmod', message: 'У sitemap: ' + missing + ' з ' + total + ' URL не мають <lastmod>', severity: 'notice' });
    }

    var newest = Math.max.apply(null, lastmods);
    var oldest = Math.min.apply(null, lastmods);
    var MS = 86400000;
    var newestDays = Math.round((now - newest) / MS);
    var oldestDays = Math.round((now - oldest) / MS);
    issues.push({
      type: 'sitemap_lastmod_range',
      message: 'Діапазон lastmod у sitemap',
      severity: 'info',
      detail: 'Найновіший: ' + new Date(newest).toISOString().slice(0, 10) + ' (' + newestDays + ' дн. тому)\nНайстаріший: ' + new Date(oldest).toISOString().slice(0, 10) + ' (' + oldestDays + ' дн. тому)'
    });

    var allSame = lastmods.length > 5 && lastmods.every(function(d) { return d === lastmods[0]; });
    if (allSame) {
      issues.push({ type: 'sitemap_fake_lastmod', message: 'Усі дати <lastmod> однакові — ймовірно автогенерація, Google може їх ігнорувати', severity: 'warning' });
    }
    if (newest > now) {
      issues.push({ type: 'sitemap_future_lastmod', message: 'Sitemap містить майбутні дати <lastmod>', severity: 'warning' });
    }
    if (newestDays > 365) {
      issues.push({ type: 'sitemap_stale', message: 'Найновіший <lastmod> старіший року — слабкий сигнал свіжості контенту', severity: 'notice' });
    }
  }

  function analyzePriorities(priorities, issues) {
    if (priorities.length < 5) return;
    var allOne = priorities.every(function(pr) { return pr === 1.0; });
    if (allOne) {
      issues.push({ type: 'sitemap_fake_priority', message: 'Усі URL мають priority=1.0 — Google ігнорує однакові пріоритети', severity: 'notice' });
    }
  }

  function buildIssues(sitemapUrl, data, childStats, xmlSize) {
    var issues = [];
    var now = Date.now();

    var totalUrls, allLastmods, allPriorities, hasImages, hasVideos;

    if (data.isIndex) {
      totalUrls = 0; allLastmods = []; allPriorities = []; hasImages = false; hasVideos = false;
      childStats.forEach(function(cs) {
        if (!cs || cs.isIndex) return;
        totalUrls    += cs.total || 0;
        allLastmods   = allLastmods.concat(cs.lastmods || []);
        allPriorities = allPriorities.concat(cs.priorities || []);
        if (cs.hasImages) hasImages = true;
        if (cs.hasVideos) hasVideos = true;
      });
      var infoLines = [
        'Тип            Sitemap index',
        'Дитячі sitemap ' + data.indexUrls.length,
        'Усього URL     ' + totalUrls,
      ];
      if (hasImages) infoLines.push('Image sitemap  так');
      if (hasVideos) infoLines.push('Video sitemap  так');
      issues.push({ type: 'sitemap_overview', message: 'Sitemap', severity: 'info', detail: infoLines.join('\n') });
      var foundInChild = childStats.some(function(cs) { return cs && cs.hasCurrentUrl; });
      var checkedChildren = childStats.filter(function(cs) { return !!cs; }).length;
      addCurrentUrlIssue(issues, foundInChild, checkedChildren, data.indexUrls.length);
      if (totalUrls > 45000) {
        issues.push({ type: 'sitemap_too_large', message: 'Понад 45 000 URL — наближається до ліміту 50 000 на файл', severity: 'warning' });
      }
      analyzeLastmods(allLastmods, totalUrls, now, issues);
      analyzePriorities(allPriorities, issues);
    } else {
      var infoLines2 = [
        'Тип            Sitemap',
        'URL            ' + sitemapUrl,
        'Усього URL     ' + data.total,
      ];
      if (xmlSize) infoLines2.push('Розмір         ' + Math.round(xmlSize / 1024) + ' KB');
      if (data.hasImages) infoLines2.push('Image sitemap  так');
      if (data.hasVideos) infoLines2.push('Video sitemap  так');
      issues.push({ type: 'sitemap_overview', message: 'Sitemap', severity: 'info', detail: infoLines2.join('\n') });

      if (data.total === 0) {
        issues.push({ type: 'sitemap_empty', message: 'Sitemap порожній — не знайдено записів <url>', severity: 'warning' });
        return issues;
      }
      addCurrentUrlIssue(issues, data.hasCurrentUrl, 1, 1);
      if (data.total > 45000) {
        issues.push({ type: 'sitemap_too_large', message: 'Понад 45 000 URL — наближається до ліміту 50 000 на файл', severity: 'warning' });
      }
      if (data.wrongDomain > 0) {
        issues.push({ type: 'sitemap_wrong_domain', message: 'Sitemap містить URL з іншого домену (' + data.wrongDomain + ')', severity: 'warning' });
      }
      if (data.invalidUrl > 0) {
        issues.push({ type: 'sitemap_invalid_url', message: 'Sitemap містить невалідні URL (' + data.invalidUrl + ')', severity: 'warning' });
      }
      if (data.httpOnHttps > 0) {
        issues.push({ type: 'sitemap_http_on_https', message: 'Sitemap містить http:// URL на https-сайті (' + data.httpOnHttps + ')', severity: 'warning' });
      }
      if (data.duplicates > 0) {
        issues.push({ type: 'sitemap_duplicates', message: 'Sitemap містить дублікати URL (' + data.duplicates + ')', severity: 'warning' });
      }
      if (xmlSize && xmlSize > 50 * 1024 * 1024) {
        issues.push({ type: 'sitemap_file_too_large', message: 'Sitemap занадто великий (' + Math.round(xmlSize / 1024 / 1024) + ' MB) — ліміт Google: 50 MB стиснутого', severity: 'warning' });
      }

      // Compare with <link rel="sitemap"> in HTML
      var htmlSitemap = document.querySelector('link[rel="sitemap"]');
      if (htmlSitemap) {
        var htmlHref = htmlSitemap.getAttribute('href') || '';
        try {
          var resolved = new URL(htmlHref, origin).href;
          var sitemapResolved = new URL(sitemapUrl).href;
          if (resolved !== sitemapResolved) {
            issues.push({
              type: 'sitemap_html_mismatch',
              message: 'URL sitemap не збігається з <link rel="sitemap">',
              severity: 'notice',
              detail: 'Знайдений: ' + sitemapUrl + '\nУ HTML: ' + htmlHref
            });
          }
        } catch(e) {}
      }

      analyzeLastmods(data.lastmods, data.total, now, issues);
      analyzePriorities(data.priorities, issues);
    }
    return issues;
  }

  return bgFetch(origin + '/robots.txt').then(function(resp) {
    var urls = resp.ok ? extractSitemapUrls(resp.text) : [];
    return urls.length > 0 ? urls[0] : (origin + '/sitemap.xml');
  }).then(function(sitemapUrl) {
    return bgFetch(sitemapUrl).then(function(resp) {
      var issues = [];
      if (!resp.ok) {
        var sev = resp.status === 404 ? 'warning' : 'notice';
        var msg = resp.status === 404
          ? 'Sitemap не знайдено (404): ' + sitemapUrl
          : 'Не вдалося завантажити sitemap (HTTP ' + (resp.status || '?') + ')';
        issues.push({ type: 'sitemap_not_found', message: msg, severity: sev });
        return { id: 'sitemap', name: 'Sitemap', issues: issues };
      }

      var doc = parseXml(resp.text);
      if (!doc) {
        issues.push({ type: 'sitemap_invalid_xml', message: 'Sitemap містить некоректний XML', severity: 'critical' });
        return { id: 'sitemap', name: 'Sitemap', issues: issues };
      }

      var xmlSize = resp.text ? resp.text.length * 2 : 0;
      var data = analyzeDoc(doc);
      if (!data.isIndex) {
        return { id: 'sitemap', name: 'Sitemap', issues: buildIssues(sitemapUrl, data, [], xmlSize) };
      }

      var toFetch = data.indexUrls.slice(0, 3);
      return Promise.all(toFetch.map(function(u) {
        return bgFetch(u).then(function(r) {
          if (!r.ok) return null;
          var d = parseXml(r.text);
          return d ? analyzeDoc(d) : null;
        });
      })).then(function(childStats) {
        return { id: 'sitemap', name: 'Sitemap', issues: buildIssues(sitemapUrl, data, childStats, xmlSize) };
      });
    });
  }).catch(function() {
    return { id: 'sitemap', name: 'Sitemap', issues: [] };
  });
}
