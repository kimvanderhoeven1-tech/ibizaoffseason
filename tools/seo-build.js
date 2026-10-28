#!/usr/bin/env node
// SEO build for ibizaoffseason.com — runs on Vercel at every deploy (see vercel.json "buildCommand").
// Pure Node, no dependencies. Safe to run locally: `node tools/seo-build.js` (it rewrites the HTML in place
// and generates /event, /venue and /retreat pages; generated folders are git-ignored).
//
// What it does
//  1. Adds Open Graph / Twitter / og:image tags and sharper titles to every top-level page.
//  2. Pre-renders the agenda and the Open-in-Winter list as static HTML (crawlers see content without JS;
//     the page's own script replaces it on load exactly as before).
//  3. Writes one static page per dated event, per retreat and per venue, each with schema.org JSON-LD
//     (Event / LocalBusiness) and breadcrumbs, and links them from the lists.
//  4. Regenerates sitemap.xml with every page, lastmod = today.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://ibizaoffseason.com';
const OG_IMAGE = SITE + '/img/og-default.jpg';
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const readJson = f => JSON.parse(read(f));
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), s); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
const clip = (s, n = 158) => { s = String(s).trim(); return s.length <= n ? s : s.slice(0, n).replace(/\s\S*$/, '') + '…'; };
const json = o => JSON.stringify(o).replace(/</g, '\\u003c');

// "Today" in Ibiza, so past events are judged in local time.
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmtDate = iso => { const d = new Date(iso + 'T12:00:00Z'); return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const fmtShort = iso => { const d = new Date(iso + 'T12:00:00Z'); return `${d.getUTCDate()} ${MON[d.getUTCMonth()].slice(0, 3)}`; };
// Madrid UTC offset for a date (CET/CEST), for schema.org startDate.
function offset(iso) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset' }).formatToParts(new Date(iso + 'T12:00:00Z'));
  const tz = (parts.find(p => p.type === 'timeZoneName') || {}).value || 'GMT+1';
  const m = /GMT([+-]\d+)/.exec(tz); const h = m ? parseInt(m[1], 10) : 1;
  return (h >= 0 ? '+' : '-') + String(Math.abs(h)).padStart(2, '0') + ':00';
}
const isoDateTime = (date, time) => date + 'T' + (/^\d{2}:\d{2}$/.test(time || '') ? time : '00:00') + ':00' + offset(date);
function offers(price, url) {
  if (!price) return undefined;
  const p = String(price);
  if (/^free/i.test(p)) return { '@type': 'Offer', price: '0', priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url };
  const m = /€\s?([\d.,]+)/.exec(p);
  if (m) return { '@type': 'Offer', price: m[1].replace(/\./g, '').replace(',', '.'), priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url };
  return undefined;
}
const place = (venue, town) => ({ '@type': 'Place', name: venue || 'Ibiza', address: { '@type': 'PostalAddress', addressLocality: town || 'Ibiza', addressRegion: 'Balearic Islands', addressCountry: 'ES' } });
const breadcrumbs = items => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it[0], item: it[1] })) });

// ---------------------------------------------------------------- page shell (header/footer taken from agenda.html so the nav stays in sync)
const agendaSrc = read('agenda.html');
const svgDefs = (/<svg width="0"[\s\S]*?<\/svg>/.exec(agendaSrc) || [''])[0];
const header = (/<header class="site wrap">[\s\S]*?<\/header>/.exec(agendaSrc) || [''])[0].replace(/ aria-current="page"/g, '');
const footer = (/<footer class="site wrap">[\s\S]*?<\/footer>/.exec(agendaSrc) || [''])[0];
const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">`;
const tail = `<script>
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href')||'';if(!/^https?:\\/\\//i.test(h))return;try{var u=new URL(h);if(/(^|\\.)ibizaoffseason\\.com$/i.test(u.hostname))return;if(!u.searchParams.has('utm_source')){u.searchParams.set('utm_source','ibizaoffseason');u.searchParams.set('utm_medium','referral');a.href=u.toString();}}catch(err){}},true);
</script>
<script src="/season.js"></script>
<script defer src="/_vercel/insights/script.js"></script>`;

function shell({ title, desc, url, ld, body, noindex, current }) {
  const nav = current ? header.replace(`href="${current}"`, `href="${current}" aria-current="page"`) : header;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex,follow">\n' : ''}<meta property="og:site_name" content="Ibiza Offseason">
<meta property="og:locale" content="en_GB">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${OG_IMAGE}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${fonts}
${ld.map(o => `<script type="application/ld+json">${json(o)}</script>`).join('\n')}
<style>.detail{max-width:720px;padding:36px 0 40px}.detail h1{font-family:var(--serif);font-weight:500;font-size:clamp(34px,5vw,56px);line-height:1.05;letter-spacing:-.01em}.detail .when{font-family:var(--serif);font-style:italic;font-size:22px;color:var(--olive);margin-top:10px}.detail .where{font-size:15px;color:var(--ink-soft);margin-top:6px}.detail .desc{font-size:17px;line-height:1.6;margin-top:22px;color:var(--ink)}.detail .meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;align-items:center}.detail .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}.detail .btn{display:inline-block;padding:12px 18px;border-radius:12px;border:1.5px solid var(--ink);color:var(--ink);text-decoration:none;font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase}.detail .btn.primary{background:var(--ink);color:var(--sand-50)}.detail .note{background:var(--sand-100);border:1px solid var(--sand-200);border-radius:14px;padding:14px 16px;font-size:14px;color:var(--ink-soft);margin-top:22px}.crumbs{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);margin-top:28px}.crumbs a{color:inherit;text-decoration:none}.crumbs a:hover{text-decoration:underline}.detail .also{margin-top:40px}.detail .also h2{font-family:var(--serif);font-weight:500;font-size:26px;margin-bottom:12px}</style>
</head>
<body>
${svgDefs}

${nav}

<main class="wrap">
${body}
</main>

${footer}

${tail}
</body>
</html>
`;
}
const crumbs = items => `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([n, u], i) => (u ? `<a href="${u}">${esc(n)}</a>` : `<span>${esc(n)}</span>`)).join(' <span aria-hidden="true">›</span> ')}</nav>`;
const CAT = { sport: 'Sport', culture: 'Culture', music: 'Music', workshops: 'Workshops', kids: 'Kids & Family', island: 'Island life' };
const mapsUrl = (venue, town) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([venue, town, 'Ibiza'].filter(Boolean).join(', '));
const external = u => u && /^https?:\/\//i.test(u);

// ---------------------------------------------------------------- data
const events = readJson('data/events.json');
const places = readJson('data/places.json');
const retreats = readJson('data/retreats.json');
const sitemapUrls = [];
const addUrl = (loc, changefreq, priority) => sitemapUrls.push({ loc, changefreq, priority });

// ---------------------------------------------------------------- 1. event pages
const evSlugs = new Set();
const eventPages = [];
for (const e of events.events || []) {
  if (!e.date || !e.title) continue;
  let s = `${e.date}-${slug(e.title)}`; let n = 2; while (evSlugs.has(s)) s = `${e.date}-${slug(e.title)}-${n++}`; evSlugs.add(s);
  const url = `${SITE}/event/${s}`;
  const past = (e.end || e.date) < TODAY;
  const when = `${fmtDate(e.date)}${e.end ? ' – ' + fmtDate(e.end) : ''}${e.time ? ' · ' + e.time : ''}`;
  const whereTxt = [e.venue, e.town].filter(Boolean).join(', ');
  const title = `${e.title} — ${fmtShort(e.date)}, ${e.town || 'Ibiza'} | Ibiza Offseason`;
  const desc = (e.desc ? e.desc.replace(/\s+/g, ' ').slice(0, 150).replace(/\s\S*$/, '') + (e.desc.length > 150 ? '…' : '') : `${e.title} on ${fmtDate(e.date)} at ${whereTxt}.`) + ' Part of the Ibiza Offseason winter agenda.';
  const ld = {
    '@context': 'https://schema.org', '@type': 'Event', name: e.title, startDate: isoDateTime(e.date, e.time),
    ...(e.end ? { endDate: e.end } : {}), description: e.desc || undefined, image: [OG_IMAGE], url,
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: place(e.venue, e.town), offers: offers(e.price, external(e.url) ? e.url : url),
    ...(e.cat === 'music' ? { '@type': 'MusicEvent' } : e.cat === 'kids' ? { typicalAgeRange: '0-15' } : {})
  };
  const body = `${crumbs([['Home', '/'], ['Agenda', '/agenda'], [e.title, null]])}
<article class="detail">
  <h1>${esc(e.title)}</h1>
  <p class="when">${esc(when)}</p>
  <p class="where"><a href="${mapsUrl(e.venue, e.town)}" target="_blank" rel="noopener">${esc(whereTxt)}</a></p>
  ${e.desc ? `<p class="desc">${esc(e.desc)}</p>` : ''}
  <div class="meta"><span class="tag ${esc(e.cat)}">${esc(CAT[e.cat] || e.cat || '')}</span>${e.local ? '<span class="tag loc" title="Only locals know">★ Local</span>' : ''}${e.price ? `<span class="price">${esc(e.price)}</span>` : ''}</div>
  ${past ? '<p class="note">This one has passed. The agenda always starts from today — see what\'s on now.</p>' : ''}
  <div class="actions">${e.url ? `<a class="btn primary" href="${esc(e.url)}"${external(e.url) ? ' target="_blank" rel="noopener"' : ''}>${/^mailto:/i.test(e.url) ? 'Email to book' : 'Details & tickets'}</a>` : ''}<a class="btn" href="/agenda">Full winter agenda</a></div>
  <section class="also"><h2>Also on this winter</h2><p>Retreats, trails, markets and the places that stay open: <a href="/retreats">Retreats</a> · <a href="/trails">Trails</a> · <a href="/markets">Markets</a> · <a href="/places">Open in Winter</a> · <a href="/#join">Get the weekly email</a>.</p></section>
</article>`;
  write(`event/${s}.html`, shell({ title, desc, url, ld: [ld, breadcrumbs([['Home', SITE + '/'], ['Agenda', SITE + '/agenda'], [e.title, url]])], body, noindex: past, current: '/agenda' }));
  eventPages.push({ e, url, past, ld });
  if (!past) addUrl(url, 'weekly', '0.6');
}

// ---------------------------------------------------------------- 2. retreat pages
const retreatPages = [];
const rtSlugs = new Set();
for (const r of retreats.retreats || []) {
  if (!r.start || !r.name) continue;
  let s = `${r.start}-${slug(r.name)}`; let n = 2; while (rtSlugs.has(s)) s = `${r.start}-${slug(r.name)}-${n++}`; rtSlugs.add(s);
  const url = `${SITE}/retreat/${s}`;
  const past = (r.end || r.start) < TODAY;
  const when = `${fmtDate(r.start)}${r.end ? ' – ' + fmtDate(r.end) : ''}`;
  const whereTxt = [r.venue, r.town].filter(Boolean).join(', ');
  const types = (r.types || []).join(', ');
  const title = `${r.name} — ${fmtShort(r.start)}${r.end ? '–' + fmtShort(r.end) : ''}, Ibiza | Ibiza Offseason`;
  const desc = clip(`${types ? types + ' retreat' : 'Retreat'} in Ibiza, ${when}${r.venue ? ' at ' + r.venue : ''}${r.price ? ', from ' + r.price : ''}. ${(r.desc || '').replace(/\s+/g, ' ')}`);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Event', name: r.name, startDate: r.start, endDate: r.end || r.start, description: r.desc || undefined, image: [OG_IMAGE], url,
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: place(r.venue, r.town), offers: offers(r.price, external(r.url) ? r.url : url),
    ...(r.organiser ? { organizer: { '@type': 'Organization', name: r.organiser } } : {}), ...(r.lang ? { inLanguage: r.lang } : {})
  };
  const body = `${crumbs([['Home', '/'], ['Retreats', '/retreats'], [r.name, null]])}
<article class="detail">
  <h1>${esc(r.name)}</h1>
  <p class="when">${esc(when)}</p>
  <p class="where">${esc(whereTxt)}${r.organiser ? ' · by ' + esc(r.organiser) : ''}</p>
  ${r.desc ? `<p class="desc">${esc(r.desc)}</p>` : ''}
  <div class="meta">${(r.types || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}${r.lang ? `<span class="price">${esc(r.lang)}</span>` : ''}${r.price ? `<span class="price">from ${esc(r.price)} per person</span>` : ''}</div>
  ${past ? '<p class="note">This retreat has taken place. See the retreats still to come this winter.</p>' : ''}
  <div class="actions">${r.url ? `<a class="btn primary" href="${esc(r.url)}"${external(r.url) ? ' target="_blank" rel="noopener"' : ''}>Details &amp; booking</a>` : ''}<a class="btn" href="/retreats">All winter retreats</a></div>
  <section class="also"><h2>While you're on the island</h2><p>Winter is the quiet season: empty coves, village markets, drop-in yoga. See <a href="/wellness">Wellness</a>, <a href="/trails">Trails</a>, <a href="/beaches">Beaches</a> and what's <a href="/places">open in winter</a>.</p></section>
</article>`;
  write(`retreat/${s}.html`, shell({ title, desc, url, ld: [ld, breadcrumbs([['Home', SITE + '/'], ['Retreats', SITE + '/retreats'], [r.name, url]])], body, noindex: past, current: '/retreats' }));
  retreatPages.push({ r, url, past, ld });
  if (!past) addUrl(url, 'weekly', '0.6');
}

// ---------------------------------------------------------------- 3. venue pages
const TYPE = [['Stay', 'Hotel'], ['Eat', 'Restaurant'], ['Breakfast', 'CafeOrCoffeeShop'], ['Drink', 'BarOrPub'], ['Art', 'ArtGallery'], ['Market', 'LocalBusiness'], ['Wellness', 'HealthAndBeautyBusiness'], ['Music', 'MusicVenue']];
const venuePages = [];
const vnSlugs = new Set();
for (const p of places) {
  if (!p.name) continue;
  let s = p.id || slug(p.name); let n = 2; while (vnSlugs.has(s)) s = `${p.id || slug(p.name)}-${n++}`; vnSlugs.add(s);
  const url = `${SITE}/venue/${s}`;
  const tags = p.tags || [];
  const type = (TYPE.find(([t]) => tags.includes(t)) || [null, 'LocalBusiness'])[1];
  const title = `${p.name}, ${p.village} — open in winter | Ibiza Offseason`;
  const desc = clip(`${p.name} in ${p.village}, Ibiza${tags.length ? ' (' + tags.join(', ') + ')' : ''}. ${p.open ? p.open + '. ' : ''}${(p.desc || '').replace(/\s+/g, ' ')}`);
  const ld = { '@context': 'https://schema.org', '@type': type, name: p.name, description: p.desc || undefined, url: p.url || url, image: [OG_IMAGE], address: { '@type': 'PostalAddress', addressLocality: p.village, addressRegion: 'Balearic Islands', addressCountry: 'ES' }, ...(p.open ? { additionalProperty: { '@type': 'PropertyValue', name: 'Winter opening', value: p.open } } : {}) };
  // related events at this venue
  const here = eventPages.filter(x => !x.past && x.e.venue && (x.e.venue.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(x.e.venue.split(',')[0].toLowerCase()))).slice(0, 6);
  const body = `${crumbs([['Home', '/'], ['Open in Winter', '/places'], [p.village, '/places'], [p.name, null]])}
<article class="detail">
  <h1>${esc(p.name)}</h1>
  <p class="when">${esc(p.open || 'Open in winter')}</p>
  <p class="where"><a href="${mapsUrl(p.name, p.village)}" target="_blank" rel="noopener">${esc(p.village)}${p.area && p.area !== 'All' ? ' · ' + esc(p.area) + ' of the island' : ''}</a></p>
  ${p.desc ? `<p class="desc">${esc(p.desc)}</p>` : ''}
  ${p.now ? `<p class="note"><b>Now showing</b> ${esc(p.now)}</p>` : ''}
  ${p.ppp ? `<p class="note"><b>PPP</b> ${esc(p.ppp)} <a href="/ppp#apply">Ask for a table →</a></p>` : ''}
  <div class="meta">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}${p.local ? '<span class="tag loc" title="Only locals know">★ Local</span>' : ''}</div>
  <div class="actions">${p.url ? `<a class="btn primary" href="${esc(p.url)}" target="_blank" rel="noopener">Website</a>` : ''}<a class="btn" href="${mapsUrl(p.name, p.village)}" target="_blank" rel="noopener">Map</a><a class="btn" href="/places">All places open in winter</a></div>
  ${here.length ? `<section class="also"><h2>Coming up here</h2><div class="events">${here.map(x => `<div class="ev"><div class="t">${esc(fmtShort(x.e.date))}</div><div><h3><a href="${x.url.replace(SITE, '')}">${esc(x.e.title)}</a></h3>${x.e.desc ? `<p class="desc">${esc(x.e.desc.slice(0, 160))}${x.e.desc.length > 160 ? '…' : ''}</p>` : ''}</div></div>`).join('')}</div></section>` : ''}
  <section class="also"><h2>More in ${esc(p.village)} and around</h2><p>Every restaurant, bar, hotel and gallery open this winter, grouped by village: <a href="/places">Open in Winter</a>. Weekly markets: <a href="/markets">Markets</a>. Walks that end here: <a href="/trails">Trails</a>.</p></section>
</article>`;
  write(`venue/${s}.html`, shell({ title, desc, url, ld: [ld, breadcrumbs([['Home', SITE + '/'], ['Open in Winter', SITE + '/places'], [p.name, url]])], body, current: '/places' }));
  venuePages.push({ p, url, slug: s, ld });
  addUrl(url, 'weekly', '0.6');
}

// ---------------------------------------------------------------- 4. head upgrades + pre-rendered lists on the top-level pages
const TITLES = {
  'index.html': 'Ibiza Off Season: What\'s On in Ibiza in Winter | Ibiza Offseason',
  'agenda.html': 'What\'s On in Ibiza This Week & This Winter — Agenda | Ibiza Offseason',
  'places.html': 'Open in Winter: Restaurants, Bars & Hotels Open in Ibiza in Winter',
  'retreats.html': 'Retreats in Ibiza This Winter — Yoga, Breathwork & Wellness (Nov–Mar)',
  'trails.html': 'Hiking, Cycling & Running Trails in Ibiza — Winter Routes | Ibiza Offseason',
  'beaches.html': 'Ibiza Beaches in Winter: Sheltered Coves & Beach Bars Still Open',
  'wellness.html': 'Yoga, Pilates, Spas & Saunas in Ibiza in Winter | Ibiza Offseason',
  'courses.html': 'Spanish Lessons & Courses in Ibiza This Winter | Ibiza Offseason',
  'helping-hands.html': 'Nannies, Chefs & Property Management in Ibiza — Helping Hands | Ibiza Offseason',
  'markets.html': 'Ibiza Markets in Winter: Hippy, Farmers\' & Christmas Markets | Ibiza Offseason',
  'winter-table.html': 'Ibiza Winter Food: Calçotades, Bunyols, Hierbas & Where to Eat Them',
  'ppp.html': 'PPP — Professional Party People Places | Ibiza Offseason',
  'ppp-plus.html': 'PPP+ for Concierges & Hosts | Ibiza Offseason',
  'submit.html': 'Submit an Event, Place or Retreat | Ibiza Offseason',
  'enviar.html': 'Enviar un evento, local o retiro | Ibiza Offseason',
  'enviar-ca.html': 'Enviar un esdeveniment, local o retir | Ibiza Offseason',
  'ibiza-in-november.html': 'Ibiza in November: Weather, Things to Do & What\'s Open (2026 Guide)',
  'ibiza-in-december.html': 'Ibiza in December: Christmas, Weather & What\'s Open (2026 Guide)'
};
const H1_LD = { // extra JSON-LD per page
  'agenda.html': [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'What\'s on in Ibiza this winter', url: SITE + '/agenda', numberOfItems: eventPages.filter(x => !x.past).length, itemListElement: eventPages.filter(x => !x.past).slice(0, 60).map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: x.url, name: x.e.title })) },
    ...eventPages.filter(x => !x.past).slice(0, 40).map(x => x.ld)],
  'retreats.html': [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Retreats in Ibiza this winter', url: SITE + '/retreats', numberOfItems: retreatPages.filter(x => !x.past).length, itemListElement: retreatPages.filter(x => !x.past).map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: x.url, name: x.r.name })) },
    ...retreatPages.filter(x => !x.past).map(x => x.ld)],
  'places.html': [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Open in winter: places on Ibiza', url: SITE + '/places', numberOfItems: venuePages.length, itemListElement: venuePages.map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: x.url, name: x.p.name })) }]
};

function prerenderAgenda() {
  const up = eventPages.filter(x => !x.past).sort((a, b) => a.e.date.localeCompare(b.e.date) || String(a.e.time || '').localeCompare(String(b.e.time || '')));
  const days = new Map(); for (const x of up) { if (!days.has(x.e.date)) days.set(x.e.date, []); days.get(x.e.date).push(x); }
  let html = '<section class="week"><h2>Coming up</h2>';
  for (const [day, xs] of days) {
    const d = new Date(day + 'T12:00:00Z');
    html += `<div class="day"><div class="date"><b>${d.getUTCDate()}</b><span>${DOW[d.getUTCDay()]}</span><em>${MON[d.getUTCMonth()]}</em></div><div class="events">${xs.map(x => `<div class="ev"><div class="t">${esc(x.e.time || '')}</div><div><h3><a href="${x.url.replace(SITE, '')}">${esc(x.e.title)}</a></h3><div class="where">${esc(x.e.venue)}${x.e.town ? ', ' + esc(x.e.town) : ''}</div>${x.e.desc ? `<p class="desc">${esc(x.e.desc)}</p>` : ''}<div class="meta"><span class="tag ${esc(x.e.cat)}">${esc(CAT[x.e.cat] || x.e.cat || '')}</span>${x.e.price ? `<span class="price">${esc(x.e.price)}</span>` : ''}</div></div></div>`).join('')}</div></div>`;
  }
  return html + '</section>';
}
function prerenderPlaces() {
  const vill = new Map(); for (const x of venuePages) { if (!vill.has(x.p.village)) vill.set(x.p.village, []); vill.get(x.p.village).push(x); }
  let html = '';
  for (const [v, xs] of vill) html += `<section class="month"><h2>${esc(v)}<small>${xs.length} place${xs.length === 1 ? '' : 's'}</small></h2><div class="events">${xs.map(x => `<div class="ev"><div class="t">${esc(x.p.open || '')}</div><div><h3><a href="/venue/${x.slug}">${esc(x.p.name)}</a></h3><div class="where">${(x.p.tags || []).map(esc).join(' · ')}</div>${x.p.desc ? `<p class="desc">${esc(x.p.desc)}</p>` : ''}</div></div>`).join('')}</div></section>`;
  return html;
}
function prerenderMonth(month) {
  return () => {
    const up = eventPages.filter(x => !x.past && x.e.date.startsWith(month)).sort((a, b) => a.e.date.localeCompare(b.e.date) || String(a.e.time || '').localeCompare(String(b.e.time || '')));
    const days = new Map(); for (const x of up) { if (!days.has(x.e.date)) days.set(x.e.date, []); days.get(x.e.date).push(x); }
    let html = '';
    for (const [day, xs] of days) {
      const d = new Date(day + 'T12:00:00Z');
      html += `<div class="day"><div class="date"><b>${d.getUTCDate()}</b><span>${DOW[d.getUTCDay()].slice(0, 3)}</span><em>${MON[d.getUTCMonth()]}</em></div><div class="events">${xs.map(x => `<div class="ev"><div class="t">${esc(x.e.time || '')}</div><div><h3><a href="${x.url.replace(SITE, '')}">${esc(x.e.title)}</a></h3><div class="where">${esc(x.e.venue)}${x.e.town ? ', ' + esc(x.e.town) : ''}</div>${x.e.desc ? `<p class="desc">${esc(x.e.desc)}</p>` : ''}<div class="meta"><span class="tag ${esc(x.e.cat)}">${esc(CAT[x.e.cat] || x.e.cat || '')}</span>${x.e.price ? `<span class="price">${esc(x.e.price)}</span>` : ''}</div></div></div>`).join('')}</div></div>`;
    }
    return html;
  };
}
// Personal picks ("Handpicked") for the month guides, from data/picks.json. First names only — site rule.
const picks = fs.existsSync(path.join(ROOT, 'data/picks.json')) ? readJson('data/picks.json').picks || [] : [];
function renderPicks(month) {
  const xs = picks.filter(p => p.month === month);
  if (!xs.length) return '';
  return xs.map(p => {
    const link = p.link ? `<a href="${esc(p.link)}">${esc(p.title)}</a>` : esc(p.title);
    return `<div class="hp"><div class="who"><span class="av">${esc((p.by || '?')[0])}</span><span>${esc(p.by)}'s pick</span></div><h3>${link}</h3><p>${esc(p.text)}</p></div>`;
  }).join('');
}
const PRERENDER = { 'agenda.html': prerenderAgenda, 'places.html': prerenderPlaces, 'ibiza-in-november.html': prerenderMonth('2026-11'), 'ibiza-in-december.html': prerenderMonth('2026-12') };

for (const file of Object.keys(TITLES)) {
  if (!fs.existsSync(path.join(ROOT, file))) continue;
  let html = read(file);
  const title = TITLES[file];
  const pageUrl = file === 'index.html' ? SITE + '/' : SITE + '/' + file.replace(/\.html$/, '');
  const descM = /<meta name="description" content="([^"]*)">/.exec(html); const desc = descM ? descM[1] : '';
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${desc}">`);
  if (!/og:type/.test(html)) html = html.replace(/<meta property="og:url"/, '<meta property="og:type" content="website">\n<meta property="og:url"');
  const extra = `<meta property="og:site_name" content="Ibiza Offseason">
<meta property="og:locale" content="en_GB">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${OG_IMAGE}">
${(H1_LD[file] || []).map(o => `<script type="application/ld+json">${json(o)}</script>`).join('\n')}
`;
  html = html.replace(/<link rel="canonical"[^>]*>\n?/, m => m + extra);
  if (!/<meta property="og:url"/.test(html)) html = html.replace(/<link rel="canonical"[^>]*>/, m => m + `\n<meta property="og:url" content="${pageUrl}">`);
  if (PRERENDER[file]) html = html.replace(/<div class="nov-events" id="nov-list"><\/div>|<div class="month-events" id="month-list"><\/div>|<div id="list"><\/div>/, m => m.replace('></div>', `>${PRERENDER[file]()}</div>`));
  html = html.replace(/<div class="handpicked" id="picks" data-month="(\d{4}-\d{2})"><\/div>/, (m, mo) => m.replace('></div>', `>${renderPicks(mo)}</div>`));
  write(file, html);
}

// ---------------------------------------------------------------- 5. sitemap
const statics = [['/', 'daily', '1.0'], ['/agenda', 'daily', '0.9'], ['/places', 'weekly', '0.9'], ['/retreats', 'weekly', '0.9'], ['/trails', 'weekly', '0.8'], ['/beaches', 'weekly', '0.8'], ['/markets', 'weekly', '0.8'], ['/wellness', 'weekly', '0.8'], ['/courses', 'weekly', '0.7'], ['/helping-hands', 'weekly', '0.7'], ['/winter-table', 'weekly', '0.7'], ['/ibiza-in-november', 'weekly', '0.9'], ['/ibiza-in-december', 'weekly', '0.9'], ['/ppp', 'monthly', '0.5'], ['/ppp-plus', 'monthly', '0.3'], ['/submit', 'monthly', '0.5'], ['/enviar', 'monthly', '0.4'], ['/enviar-ca', 'monthly', '0.4']];
const all = [...statics.map(([p, c, pr]) => ({ loc: SITE + p, changefreq: c, priority: pr })), ...sitemapUrls];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${all.map(u => `  <url><loc>${u.loc}</loc><lastmod>${TODAY}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}\n</urlset>\n`);

console.log(`seo-build ${TODAY}: ${eventPages.length} event pages (${eventPages.filter(x => !x.past).length} upcoming), ${retreatPages.length} retreat pages, ${venuePages.length} venue pages, sitemap ${all.length} urls`);
