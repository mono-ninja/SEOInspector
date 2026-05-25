function runIpInfoChecker(p) {
  var hostname = window.location.hostname;
  var DKIM_SELECTORS = ['google', 'default', 'mail', 'dkim', 'k1', 'selector1', 'selector2'];

  function dnsLookup(host, type) {
    return new Promise(function(resolve) {
      chrome.runtime.sendMessage({ action: 'dnsLookup', hostname: host, type: type }, function(resp) {
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          resolve({ Answer: [], AD: false });
        } else {
          resolve(resp.data || { Answer: [], AD: false });
        }
      });
    });
  }

  function findTxt(answers, prefix) {
    var records = (answers || []).filter(function(r) { return r.type === 16; });
    for (var i = 0; i < records.length; i++) {
      var val = (records[i].data || '').replace(/^"|"$/g, '');
      if (val.indexOf(prefix) === 0) return val;
    }
    return null;
  }

  function analyzeSPF(spfRecord, issues) {
    if (!spfRecord) {
      issues.push({ type: 'spf_missing', message: 'SPF record is missing for the domain', severity: 'critical' });
      return;
    }
    issues.push({ type: 'spf_ok', message: 'SPF', severity: 'info', detail: spfRecord });
    if (/\+all\b/.test(spfRecord)) {
      issues.push({ type: 'spf_policy_open', message: 'SPF: +all policy — all senders are allowed', severity: 'warning', detail: spfRecord });
    } else if (/\?all\b/.test(spfRecord)) {
      issues.push({ type: 'spf_policy_open', message: 'SPF: ?all policy — neutral, does not protect against spoofing', severity: 'warning', detail: spfRecord });
    } else if (/~all\b/.test(spfRecord)) {
      issues.push({ type: 'spf_policy_softfail', message: 'SPF: ~all policy (softfail) — messages are not rejected', severity: 'notice', detail: spfRecord });
    }
    if (!/[+-?~]all\b/.test(spfRecord)) {
      issues.push({ type: 'spf_no_all', message: 'SPF: no "all" mechanism — record is incomplete (RFC 7208 §5.1)', severity: 'warning', detail: spfRecord });
    }
    // RFC 7208 §4.6.4: a, mx, include, ptr, exists, redirect each cost one DNS lookup; limit is 10
    var lookupCount =
      (spfRecord.match(/\binclude:/gi) || []).length +
      (spfRecord.match(/(?:^|\s)[+-?~]?a(?:[\s:/]|$)/gi) || []).length +
      (spfRecord.match(/(?:^|\s)[+-?~]?mx(?:[\s:/]|$)/gi) || []).length +
      (spfRecord.match(/\bptr\b/gi) || []).length +
      (spfRecord.match(/\bexists:/gi) || []).length +
      (spfRecord.match(/\bredirect=/gi) || []).length;
    if (lookupCount >= 10) {
      issues.push({ type: 'spf_too_many_lookups', message: 'SPF: DNS lookup count is ' + lookupCount + ' — at or over the 10-lookup limit (RFC 7208)', severity: 'warning', detail: spfRecord });
    }
  }

  function analyzeDMARC(dmarcRecord, issues) {
    if (!dmarcRecord) {
      issues.push({ type: 'dmarc_missing', message: 'DMARC record is missing', severity: 'critical' });
      return;
    }
    var pMatch = dmarcRecord.match(/\bp=([a-z]+)/i);
    var policy = pMatch ? pMatch[1].toLowerCase() : '';
    var spMatch = dmarcRecord.match(/\bsp=([a-z]+)/i);
    var spPolicy = spMatch ? spMatch[1].toLowerCase() : null;
    var ruaMatch = dmarcRecord.match(/\brua=([^\s;]+)/i);
    var rufMatch = dmarcRecord.match(/\bruf=([^\s;]+)/i);
    var detailLines = [dmarcRecord];
    if (ruaMatch) detailLines.push('rua: ' + ruaMatch[1]);
    if (rufMatch) detailLines.push('ruf: ' + rufMatch[1]);
    issues.push({ type: 'dmarc_ok', message: 'DMARC', severity: 'info', detail: detailLines.join('\n') });
    if (policy === 'none') {
      issues.push({ type: 'dmarc_policy_none', message: 'DMARC: p=none — monitoring only, no phishing protection', severity: 'critical', detail: dmarcRecord });
    } else if (policy === 'quarantine') {
      var pctMatch = dmarcRecord.match(/\bpct=(\d+)/);
      var pct = pctMatch ? parseInt(pctMatch[1], 10) : 100;
      if (pct < 100) {
        issues.push({ type: 'dmarc_policy_partial', message: 'DMARC: p=quarantine applies to only ' + pct + '% of messages', severity: 'warning', detail: dmarcRecord });
      }
    }
    if (spPolicy === 'none' && (policy === 'reject' || policy === 'quarantine')) {
      issues.push({ type: 'dmarc_sp_none', message: 'DMARC: sp=none while p=' + policy + ' — subdomains remain unprotected', severity: 'notice', detail: dmarcRecord });
    }
    if (dmarcRecord.indexOf('rua=') === -1) {
      issues.push({ type: 'dmarc_no_rua', message: 'DMARC: rua= tag is missing — aggregate reports are not received', severity: 'notice' });
    }
  }

  function parseDkimTags(val) {
    var tags = {};
    val.split(';').forEach(function(part) {
      var eq = part.indexOf('=');
      if (eq === -1) return;
      tags[part.substring(0, eq).trim()] = part.substring(eq + 1).trim();
    });
    return tags;
  }

  function analyzeDKIM(dkimResults, issues) {
    var found = [];
    for (var i = 0; i < dkimResults.length; i++) {
      var val = findTxt(dkimResults[i].Answer, 'v=DKIM1');
      if (val) found.push({ selector: DKIM_SELECTORS[i], value: val });
    }
    if (found.length === 0) {
      issues.push({ type: 'dkim_not_found', message: 'DKIM: no known selector found (' + DKIM_SELECTORS.join(', ') + ')', severity: 'warning' });
      return;
    }
    for (var j = 0; j < found.length; j++) {
      var tags = parseDkimTags(found[j].value);
      var keyType = tags.k || 'rsa';
      var pubKey = (tags.p || '').replace(/\s/g, '');
      var testFlags = (tags.t || '').split(':');
      var isTesting = testFlags.indexOf('y') !== -1;

      var keyInfo = keyType;
      if (keyType === 'rsa' && pubKey) {
        // base64 chars → approximate key bits: len * 6 / 8 bytes, × 8 bits ≈ len * 6
        var approxBits = Math.round(pubKey.replace(/=/g, '').length * 6 / 8) * 8;
        keyInfo += approxBits < 1800 ? ' (~1024-bit, deprecated)' : ' (~' + Math.round(approxBits / 256) * 256 + '-bit)';
      }

      issues.push({
        type: 'dkim_found',
        message: 'DKIM: found (' + found[j].selector + ')',
        severity: 'info',
        detail: [
          found[j].selector + '._domainkey.' + hostname,
          'k=' + keyInfo + (isTesting ? '  t=y (testing)' : ''),
        ].join('\n')
      });

      if (isTesting) {
        issues.push({
          type: 'dkim_testing_mode',
          message: 'DKIM selector "' + found[j].selector + '" is in testing mode (t=y) — receivers may ignore the signature',
          severity: 'notice'
        });
      }
      if (keyType === 'rsa' && pubKey && pubKey.replace(/=/g, '').length < 250) {
        issues.push({
          type: 'dkim_weak_key',
          message: 'DKIM selector "' + found[j].selector + '" appears to use a 1024-bit key — upgrade to 2048-bit (RFC 8301)',
          severity: 'warning'
        });
      }
    }
  }

  function analyzeMX(mxData, hasSPF, issues) {
    var answers = mxData.Answer || [];
    var mxRecords = answers.filter(function(r) { return r.type === 15; });
    if (mxRecords.length === 0) {
      if (hasSPF) {
        issues.push({ type: 'mx_missing_with_spf', message: 'No MX records but SPF is configured — possible misconfiguration', severity: 'warning' });
      }
      return;
    }
    var servers = mxRecords.map(function(r) {
      var parts = (r.data || '').split(' ');
      return { priority: parseInt(parts[0], 10) || 0, host: (parts[1] || '').replace(/\.$/, '') };
    }).sort(function(a, b) { return a.priority - b.priority; });
    var detail = servers.map(function(s) { return s.priority + '\t' + s.host; }).join('\n');
    issues.push({ type: 'mx_ok', message: 'MX (' + mxRecords.length + ' server' + (mxRecords.length > 1 ? 's' : '') + ')', severity: 'info', detail: detail });
    if (mxRecords.length === 1) {
      issues.push({ type: 'mx_single', message: 'Only one MX record — no mail server redundancy', severity: 'notice', detail: servers[0].host });
    }
  }

  function analyzeNS(nsData, issues) {
    var answers = nsData.Answer || [];
    var nsRecords = answers.filter(function(r) { return r.type === 2; });
    if (nsRecords.length === 0) return;
    var servers = nsRecords.map(function(r) { return (r.data || '').replace(/\.$/, ''); });
    issues.push({ type: 'ns_ok', message: 'NS (' + nsRecords.length + ' nameserver' + (nsRecords.length > 1 ? 's' : '') + ')', severity: 'info', detail: servers.join('\n') });
    if (nsRecords.length < 2) {
      issues.push({ type: 'ns_single', message: 'Only one nameserver — single point of DNS failure', severity: 'warning' });
      return;
    }
    var providers = servers.map(function(s) {
      var parts = s.split('.');
      return parts.length >= 2 ? parts.slice(-2).join('.') : s;
    });
    var unique = providers.filter(function(v, i, a) { return a.indexOf(v) === i; });
    if (unique.length === 1) {
      issues.push({ type: 'ns_single_provider', message: 'All nameservers from one provider — DNS single point of failure', severity: 'notice', detail: servers.join(', ') });
    }
  }

  function analyzeSOA(soaData, issues) {
    var answers = soaData.Answer || [];
    var soaRecord = null;
    for (var i = 0; i < answers.length; i++) {
      if (answers[i].type === 6) { soaRecord = answers[i]; break; }
    }
    if (!soaRecord) return;
    var parts = (soaRecord.data || '').split(' ');
    if (parts.length < 7) return;
    var ttl = soaRecord.TTL || 0;
    var rname = (parts[1] || '').replace(/\.$/, '');
    var rnameAt = rname.indexOf('.');
    var contact = rnameAt !== -1 ? rname.substring(0, rnameAt) + '@' + rname.substring(rnameAt + 1) : rname;
    var lines = [
      'Primary NS: ' + parts[0].replace(/\.$/, ''),
      'Contact:    ' + contact,
      'Serial:     ' + parts[2],
      'Refresh:    ' + parts[3] + 's',
      'Retry:      ' + parts[4] + 's',
      'Expire:     ' + parts[5] + 's',
      'Min TTL:    ' + parts[6] + 's',
    ];
    issues.push({ type: 'soa_ok', message: 'SOA', severity: 'info', detail: lines.join('\n') });
    if (ttl < 300) {
      issues.push({ type: 'soa_low_ttl', message: 'SOA TTL is very low (' + ttl + 's) — increased DNS query load', severity: 'notice' });
    } else if (ttl > 86400) {
      issues.push({ type: 'soa_high_ttl', message: 'SOA TTL is very high (' + ttl + 's) — slow DNS propagation on changes', severity: 'notice' });
    }
  }

  function analyzeCAA(caaData, issues) {
    var answers = caaData.Answer || [];
    var caaRecords = answers.filter(function(r) { return r.type === 257; });
    if (caaRecords.length === 0) {
      issues.push({ type: 'caa_missing', message: 'CAA record missing — any CA can issue SSL certificates for this domain', severity: 'warning' });
      return;
    }
    var detail = caaRecords.map(function(r) { return (r.data || '').replace(/"/g, ''); }).join('\n');
    issues.push({ type: 'caa_ok', message: 'CAA (' + caaRecords.length + ' record' + (caaRecords.length > 1 ? 's' : '') + ')', severity: 'info', detail: detail });
  }

  function analyzeBIMI(bimiData, issues) {
    var val = findTxt(bimiData.Answer, 'v=BIMI1');
    if (!val) return;
    issues.push({ type: 'bimi_ok', message: 'BIMI record found', severity: 'info', detail: val });
    if (val.indexOf('l=') === -1) {
      issues.push({ type: 'bimi_no_logo', message: 'BIMI: l= tag missing — no logo URI defined', severity: 'notice' });
    } else if (val.indexOf('a=') === -1) {
      issues.push({ type: 'bimi_no_vmc', message: 'BIMI: a= (VMC) tag missing — logo will not display in Gmail without a Verified Mark Certificate', severity: 'notice' });
    }
  }

  function analyzeMTASTS(mtaStsData, issues) {
    var val = findTxt(mtaStsData.Answer, 'v=STSv1');
    if (!val) {
      issues.push({ type: 'mta_sts_missing', message: 'MTA-STS not configured — email in transit unprotected from downgrade attacks', severity: 'notice' });
      return;
    }
    issues.push({ type: 'mta_sts_ok', message: 'MTA-STS record found', severity: 'info', detail: val });
  }

  function analyzeTLSRPT(tlsrptData, issues) {
    var val = findTxt(tlsrptData.Answer, 'v=TLSRPTv1');
    if (!val) {
      issues.push({ type: 'tlsrpt_missing', message: 'TLSRPT not configured — TLS connection failures are not reported (RFC 8460)', severity: 'notice' });
      return;
    }
    issues.push({ type: 'tlsrpt_ok', message: 'TLSRPT record found', severity: 'info', detail: val });
  }

  function analyzeDNSSEC(aData, issues) {
    if (aData.AD === true) {
      issues.push({ type: 'dnssec_ok', message: 'DNSSEC enabled and validated', severity: 'info' });
    } else {
      issues.push({ type: 'dnssec_missing', message: 'DNSSEC not enabled — DNS responses are not cryptographically signed', severity: 'notice' });
    }
  }

  function analyzePTR(ptrData, ip, issues) {
    var answers = ptrData.Answer || [];
    var ptrRecords = answers.filter(function(r) { return r.type === 12; });
    if (ptrRecords.length === 0) {
      issues.push({ type: 'ptr_missing', message: 'No reverse DNS (PTR) record for ' + ip, severity: 'notice' });
      return;
    }
    var ptrHost = (ptrRecords[0].data || '').replace(/\.$/, '');
    issues.push({ type: 'ptr_ok', message: 'Reverse DNS (PTR): ' + ptrHost, severity: 'info', detail: ip + ' → ' + ptrHost });
    var hostParts = hostname.split('.').slice(-2).join('.');
    var ptrParts = ptrHost.split('.').slice(-2).join('.');
    if (hostParts !== ptrParts) {
      issues.push({ type: 'ptr_mismatch', message: 'PTR record does not match domain — may affect email deliverability', severity: 'notice', detail: ip + ' → ' + ptrHost });
    }
  }

  var dkimPromises = DKIM_SELECTORS.map(function(s) {
    return dnsLookup(s + '._domainkey.' + hostname, 'TXT');
  });

  return Promise.all([
    dnsLookup(hostname, 'A'),                         // 0
    dnsLookup(hostname, 'AAAA'),                      // 1
    dnsLookup(hostname, 'TXT'),                       // 2  SPF
    dnsLookup('_dmarc.' + hostname, 'TXT'),           // 3  DMARC
    dnsLookup(hostname, 'MX'),                        // 4
    dnsLookup(hostname, 'NS'),                        // 5
    dnsLookup(hostname, 'SOA'),                       // 6
    dnsLookup(hostname, 'CAA'),                       // 7
    dnsLookup('_bimi.' + hostname, 'TXT'),            // 8
    dnsLookup('_mta-sts.' + hostname, 'TXT'),         // 9
    dnsLookup('_smtp._tls.' + hostname, 'TXT'),       // 10  TLSRPT
  ].concat(dkimPromises))                             // 11+
    .then(function(results) {
      var issues = [];
      var aRecords    = (results[0].Answer || []).filter(function(r) { return r.type === 1; });
      var aaaaRecords = (results[1].Answer || []).filter(function(r) { return r.type === 28; });

      if (aRecords.length === 0) {
        issues.push({ type: 'ip_no_a_record', message: 'DNS: no A record found for ' + hostname, severity: 'critical' });
        return { id: 'ip_info', name: 'IP / DNS', issues: issues };
      }

      var ipv4List = aRecords.map(function(r) { return r.data; });
      var ipv6List = aaaaRecords.map(function(r) { return r.data; });
      var infoLines = [
        'Host         ' + hostname,
        'IPv4 (' + aRecords.length + ')   ' + ipv4List.join(', '),
        'TTL          ' + aRecords[0].TTL + 's',
        'IPv6 (' + aaaaRecords.length + ')   ' + (ipv6List.length ? ipv6List.join(', ') : 'not supported'),
        'DNS source   dns.google (public DoH)',
      ];
      issues.push({ type: 'dns_overview', message: 'DNS / IP', severity: 'info', detail: infoLines.join('\n') });

      if (aRecords.length === 1) {
        issues.push({ type: 'ip_single_a', message: 'Only one A record — DNS redundancy is missing', severity: 'notice', detail: ipv4List[0] });
      }
      if (aaaaRecords.length === 0) {
        issues.push({ type: 'ip_no_ipv6', message: 'IPv6 not supported (no AAAA records)', severity: 'notice' });
      }

      var spfRecord = findTxt(results[2].Answer, 'v=spf1');
      analyzeSPF(spfRecord, issues);
      analyzeDMARC(findTxt(results[3].Answer, 'v=DMARC1'), issues);
      analyzeMX(results[4], !!spfRecord, issues);
      analyzeNS(results[5], issues);
      analyzeSOA(results[6], issues);
      analyzeCAA(results[7], issues);
      analyzeBIMI(results[8], issues);
      analyzeMTASTS(results[9], issues);
      analyzeTLSRPT(results[10], issues);
      analyzeDNSSEC(results[0], issues);
      analyzeDKIM(results.slice(11), issues);

      var firstIp = ipv4List[0];
      var ptrHost = firstIp.split('.').reverse().join('.') + '.in-addr.arpa';
      return dnsLookup(ptrHost, 'PTR').then(function(ptrData) {
        analyzePTR(ptrData, firstIp, issues);
        return { id: 'ip_info', name: 'IP / DNS', issues: issues };
      }).catch(function() {
        return { id: 'ip_info', name: 'IP / DNS', issues: issues };
      });
    })
    .catch(function() {
      return { id: 'ip_info', name: 'IP / DNS', issues: [] };
    });
}
