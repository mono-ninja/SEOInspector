function runLocalizationChecker(p) {
  var issues = [];

  var htmlEl = document.documentElement;
  var langAttr = (htmlEl.getAttribute('lang') || '').trim();

  if (!langAttr) {
    issues.push({
      type: 'lang_missing',
      message: 'Відсутній атрибут lang у <html> — необхідний для локалізації та доступності',
      severity: 'warning'
    });
    return { id: 'localization', name: 'Localization', issues: issues };
  }

  var langBase = langAttr.split('-')[0].toLowerCase();

  // Validate BCP 47 format — includes private-use (x-...) and grandfathered (i-...) tags
  var validLangRe = /^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/;
  if (!validLangRe.test(langAttr)) {
    issues.push({
      type: 'invalid_html_lang',
      message: 'The lang attribute has an invalid format: "' + langAttr + '"',
      severity: 'notice'
    });
  }

  // RTL languages require dir="rtl" — check value, not just presence
  var rtlLangs = ['ar', 'he', 'fa', 'ur', 'yi', 'dv', 'ku', 'ps', 'sd', 'ug'];
  if (rtlLangs.indexOf(langBase) !== -1 && htmlEl.getAttribute('dir') !== 'rtl') {
    issues.push({
      type: 'missing_lang_dir',
      message: 'Language "' + langAttr + '" requires the dir="rtl" attribute on <html>',
      severity: 'notice'
    });
  }

  // Phone numbers: tel: links without international + — aggregated
  var badPhones = [];
  Array.prototype.slice.call(document.querySelectorAll('a[href^="tel:"]')).forEach(function(a) {
    var tel = (a.getAttribute('href') || '').replace(/^tel:/i, '').trim();
    if (tel && tel.charAt(0) !== '+') {
      badPhones.push(tel);
    }
  });
  if (badPhones.length > 0) {
    issues.push({
      type: 'phone_not_international',
      message: 'Phone numbers not in international format (' + badPhones.length + ')',
      severity: 'notice',
      detail: badPhones.slice(0, 5).join('\n') + (badPhones.length > 5 ? '\n...and ' + (badPhones.length - 5) + ' more' : '')
    });
  }

  // Lang vs content consistency — larger sample, ratio-based thresholds
  var bodyText = (document.body ? document.body.innerText : '').substring(0, 2000);
  var cyrillicCount = (bodyText.match(/[а-яёіїєґА-ЯЁІЇЄҐ]/g) || []).length;
  var latinCount = (bodyText.match(/[a-zA-Z]/g) || []).length;
  var cjkCount = (bodyText.match(/[　-鿿豈-﫿]/g) || []).length;
  var totalScript = cyrillicCount + latinCount + cjkCount;

  if (totalScript > 40) {
    var cyrillicLangs = ['ru', 'uk', 'be', 'bg', 'mk', 'sr', 'mn'];
    var latinLangs = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'cs', 'ro', 'sv', 'da', 'no', 'fi', 'hu', 'hr', 'sk', 'sl', 'lt', 'lv', 'et'];
    var cjkLangs = ['zh', 'ja', 'ko'];

    var cyrillicRatio = cyrillicCount / totalScript;
    var latinRatio = latinCount / totalScript;
    var cjkRatio = cjkCount / totalScript;

    if (latinLangs.indexOf(langBase) !== -1 && cyrillicRatio > 0.6) {
      issues.push({
        type: 'lang_consistency',
        message: 'Language conflict: lang="' + langAttr + '", but content appears to be Cyrillic',
        severity: 'warning'
      });
    } else if (cyrillicLangs.indexOf(langBase) !== -1 && latinRatio > 0.6) {
      issues.push({
        type: 'lang_consistency',
        message: 'Language conflict: lang="' + langAttr + '", but content appears to be Latin',
        severity: 'warning'
      });
    } else if (cjkLangs.indexOf(langBase) !== -1 && cjkRatio < 0.2 && (latinRatio > 0.5 || cyrillicRatio > 0.5)) {
      issues.push({
        type: 'lang_consistency',
        message: 'Language conflict: lang="' + langAttr + '", but content contains no CJK characters',
        severity: 'warning'
      });
    }
  }

  return { id: 'localization', name: 'Localization', issues: issues };
}
