// QRbeam: removes tracking parameters and shortens well-known URLs
// before they are shown on screen. Pure function, no network access.
// Exposed as globalThis.QRbeamClean(url) -> string.
(() => {
  // Dropped on every site.
  const DROP = new Set([
    'fbclid', 'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid',
    'twclid', 'ttclid', 'igshid', 'igsh', 'li_fat_id', 'epik', 'scid', 'rdt_cid',
    'mc_cid', 'mc_eid', '_hsenc', '_hsmi', 'hsCtaTracking', 'mkt_tok',
    '_ga', '_gl', '_kx', 'vero_id', 'vero_conv', 'wickedid', 'rb_clickid',
    's_cid', 'sc_cid', 'ref_src', 'ref_url', 'srsltid', 'oly_anon_id', 'oly_enc_id',
    'ncid', 'cmpid', 'icid', 'ga_source', 'ga_medium', 'ga_campaign', 'ga_content', 'ga_term',
    'trk', 'trkCampaign', 'sr_share', 'utm', 'at_medium', 'at_campaign', 'wt_mc', 'wt_zmc',
  ]);
  // Dropped on every site when the parameter name starts with one of these.
  const DROP_PREFIX = ['utm_', 'pk_', 'mtm_', 'matomo_', 'pd_rd_', 'pf_rd_', 'hsa_', 'at_custom'];
  // Dropped only on the given hosts.
  const PER_HOST = [
    { hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'], keys: ['si', 'feature', 'pp', 'ab_channel', 'embeds_referring_euri', 'source_ve_path'] },
    { hosts: ['spotify.com'], keys: ['si', 'context', 'nd', 'dlsi'] },
    { hosts: ['instagram.com', 'threads.net'], keys: ['igsh', 'img_index'] },
    { hosts: ['x.com', 'twitter.com'], keys: ['s', 't', 'ref_src'] },
    { hosts: ['linkedin.com'], keys: ['trackingId', 'refId', 'lipi', 'trk', 'midToken', 'midSig'] },
    { hosts: ['reddit.com'], keys: ['share_id', 'ref', 'ref_source', 'rdt'] },
    { hosts: ['tiktok.com'], keys: ['is_from_webapp', 'sender_device', 'is_copy_url', 'web_id', '_r', '_t'] },
    { hosts: ['ebay.de', 'ebay.com', 'ebay.co.uk', 'ebay.at', 'ebay.ch', 'ebay.fr', 'ebay.it', 'ebay.es'], keys: ['_trkparms', '_trksid', 'hash', 'amdata', 'mkcid', 'mkrid', 'campid', 'toolid', 'customid', 'mkevt', 'itmmeta'] },
    { hosts: ['aliexpress.com'], keys: ['spm', 'scm', 'pvid', 'algo_pvid', 'algo_exp_id', 'gatewayAdapt', '_randl_shipto', 'sourceType', 'aff_fcid', 'aff_fsk', 'aff_platform', 'aff_trace_key', 'terminal_id'] },
    { hosts: AMAZON_HOSTS(), keys: ['ref', 'ref_', 'crid', 'qid', 'sprefix', 'sr', 'th', 'psc', 'tag', 'linkCode', 'linkId', 'content-id', '_encoding', 'dib', 'dib_tag', 'smid', 'spIA', 'social_share', 'starsLeft', 'skipTwisterOG', 'ascsubtag', 'creative', 'creativeASIN'] },
  ];

  function AMAZON_HOSTS() {
    return ['amazon.com', 'amazon.de', 'amazon.co.uk', 'amazon.fr', 'amazon.it', 'amazon.es', 'amazon.nl',
      'amazon.se', 'amazon.pl', 'amazon.com.be', 'amazon.at', 'amazon.ca', 'amazon.com.mx', 'amazon.com.br',
      'amazon.co.jp', 'amazon.in', 'amazon.com.au', 'amazon.com.tr', 'amazon.ae', 'amazon.sa', 'amazon.sg', 'amazon.eg'];
  }

  const onHost = (host, base) => host === base || host.endsWith('.' + base);
  const onAny = (host, list) => list.some((b) => onHost(host, b));

  function youtube(u, host) {
    if (!onAny(host, ['youtube.com', 'youtu.be', 'youtube-nocookie.com'])) return null;
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(?:shorts|live|embed|v)\/([\w-]{11})(?:\/|$)/);
      if (m) id = m[1];
    }
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    const out = new URL('https://youtu.be/' + id);
    const t = u.searchParams.get('t') || u.searchParams.get('start');
    if (t) out.searchParams.set('t', t);
    for (const k of ['list', 'index']) {
      const v = u.searchParams.get(k);
      if (v) out.searchParams.set(k, v);
    }
    return out.href;
  }

  function amazon(u, host) {
    if (!onAny(host, AMAZON_HOSTS())) return null;
    const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?:[/?]|$)/i);
    if (!m) return null;
    return u.origin + '/dp/' + m[1].toUpperCase();
  }

  function clean(raw) {
    let u;
    try { u = new URL(raw); } catch { return raw; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return u.href;
    const host = u.hostname.toLowerCase().replace(/^www\./, '');

    const special = youtube(u, host) || amazon(u, host);
    if (special) return special;

    const extra = new Set();
    for (const rule of PER_HOST) if (onAny(host, rule.hosts)) rule.keys.forEach((k) => extra.add(k));

    for (const key of [...u.searchParams.keys()]) {
      if (DROP.has(key) || extra.has(key) || DROP_PREFIX.some((p) => key.startsWith(p))) {
        u.searchParams.delete(key);
      }
    }
    if ([...u.searchParams.keys()].length === 0) u.search = '';
    return u.href;
  }

  globalThis.QRbeamClean = clean;
})();
