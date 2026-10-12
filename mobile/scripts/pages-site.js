/* global __dirname */
// Builds the GitHub Pages site: the one-page website (site/index.html, with the privacy policy filled in from
// privacy.html) at the root, the privacy policy also at its own address (every app build links there), the owner's
// web test build of the app in /app, and the original web tracker in /classic.
// Usage: node scripts/pages-site.js <web-export-dir> <out-dir> <base-path, e.g. /Tracker> [site-url, for link previews]
// The web export must have been built with WEB_BASE_URL=<base-path>/app.
const fs = require('fs');
const path = require('path');

const [dist, out, base = '', siteUrl = ''] = process.argv.slice(2);
if (!dist || !out) { console.error('usage: node scripts/pages-site.js <web-export-dir> <out-dir> [base-path]'); process.exit(1); }
const repo = path.resolve(__dirname, '..', '..');
const mobile = path.resolve(__dirname, '..');

const app = path.join(out, 'app'), appBase = `${base}/app`;
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(dist, app, { recursive: true });

// Home Screen icon and standalone mode for the test build (iOS reads these from the page, not from a build setting)
fs.copyFileSync(path.join(mobile, 'assets', 'icon.png'), path.join(app, 'apple-touch-icon.png'));
fs.copyFileSync(path.join(mobile, 'assets', 'social.png'), path.join(out, 'social.png'));

// Title, description and link previews (iMessage, WhatsApp, search results). Previews need absolute addresses.
// Visit counting, off until a GoatCounter site code is set (repository variable GOATCOUNTER_CODE). GoatCounter sets no
// cookies and stores nothing on the visitor's device, so the site still needs no cookie banner. The owner's test build
// and the classic tracker are never counted.
const gcCode = (process.env.GOATCOUNTER_CODE || '').trim();
if (gcCode && !/^[a-z0-9-]{2,50}$/.test(gcCode)) throw new Error('GOATCOUNTER_CODE should be the site code only, e.g. tidemark');
const analytics = gcCode ? `<script data-goatcounter="https://${gcCode}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>` : '';
const esc = t => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const meta = ({ title, description, page, noindex }) => [
  `<meta name="description" content="${esc(description)}">`,
  noindex ? '<meta name="robots" content="noindex">' : '',
  siteUrl && !noindex ? `<link rel="canonical" href="${siteUrl}/${page}">` : '',
  '<meta property="og:type" content="website">', '<meta property="og:site_name" content="Tidemark">',
  `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(description)}">`,
  siteUrl ? `<meta property="og:url" content="${siteUrl}/${page}">` : '',
  siteUrl ? `<meta property="og:image" content="${siteUrl}/social.png">` : '',
  '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
  '<meta property="og:image:alt" content="Tidemark, a private weight tracker for iPhone. The scale jumps; your trend doesn’t.">',
  '<meta name="twitter:card" content="summary_large_image">',
  siteUrl ? `<meta name="twitter:image" content="${siteUrl}/social.png">` : '',
  analytics && !noindex ? analytics : '',
].filter(Boolean).join('');
// Breadcrumbs for search results (each page also shows them on the page itself)
const crumbs = (...trail) => siteUrl ? `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: trail.map(([name, page], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${siteUrl}/${page}` })),
})}</script>` : '';
const icons = `<link rel="icon" href="${base}/favicon.ico" sizes="any"><link rel="icon" href="${base}/icon.png" type="image/png">`
  + `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">`;
const addHead = (file, tags, title) => {
  let h = fs.readFileSync(file, 'utf8');
  if (!h.includes('</head>')) throw new Error(`${file} has no </head>`);
  if (title) h = /<title>[^<]*<\/title>/.test(h) ? h.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`) : h.replace('</head>', `<title>${esc(title)}</title></head>`);
  fs.writeFileSync(file, h.replace('</head>', tags + '</head>'));
};
fs.writeFileSync(path.join(app, 'manifest.webmanifest'), JSON.stringify({
  name: 'Tidemark', short_name: 'Tidemark', start_url: `${appBase}/`, scope: `${appBase}/`, display: 'standalone',
  background_color: '#FBF7F3', theme_color: '#2A1E45',
  icons: [{ src: `${appBase}/apple-touch-icon.png`, sizes: '1024x1024', type: 'image/png' }],
}, null, 2));
// The web app is the owner's private test build, not a product: kept out of search results
const head = meta({ title: 'Tidemark · Test build', page: 'app/', noindex: true,
  description: 'A private weight tracker. Your trend weight, not the daily noise, with a plan, habits and measurements. No account, and your data stays on your phone.' }) + [
  `<link rel="apple-touch-icon" href="${appBase}/apple-touch-icon.png">`,
  `<link rel="manifest" href="${appBase}/manifest.webmanifest">`,
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Tidemark">',
  // The app draws under the status bar (it already pads for it); iOS then shows white status text on top of it
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="theme-color" content="#FBF7F3" media="(prefers-color-scheme: light)">',
  '<meta name="theme-color" content="#121019" media="(prefers-color-scheme: dark)">',
  // White status text needs a dark backing: dark mode already has the app's dark background, light mode gets a plum band
  '<style>@media (prefers-color-scheme: light){body::after{content:"";position:fixed;top:0;left:0;right:0;' +
    'height:env(safe-area-inset-top);background:#2A1E45;z-index:2147483647;pointer-events:none}}</style>',
  // Opened from the Home Screen, iOS makes 100% one status bar short of the screen (with black-translucent the page
  // starts under the status bar but its height doesn't grow to match), which left a white strip under the tab bar.
  // 100vh is the whole screen there; it stays standalone-only because in Safari 100vh runs under the toolbar.
  // The body takes the app's background too, so any gap that's left matches instead of showing white.
  '<style>body{background:#FBF7F3}@media (prefers-color-scheme: dark){body{background:#121019}}' +
    '@media (display-mode: standalone){html,body,#root{height:100vh}}</style>',
].join('');
const indexPath = path.join(app, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('</head>')) throw new Error('web export index.html has no </head>');
// viewport-fit=cover makes iOS report the notch and home-bar sizes, so the app's own safe-area padding applies
const viewport = /<meta name="viewport"[^>]*>/;
if (!viewport.test(html)) throw new Error('web export index.html has no viewport meta');
fs.writeFileSync(indexPath, html
  .replace(viewport, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />')
  .replace(/<title>[^<]*<\/title>/, '<title>Tidemark · Test build</title>')
  .replace('</head>', head + '</head>'));

// The website, with the policy's text set into its last section, so the two can never say different things
const NO_ANALYTICS = 'This website has no cookies, analytics or trackers.';
let policy = fs.readFileSync(path.join(repo, 'privacy.html'), 'utf8');
if (!policy.includes(NO_ANALYTICS)) throw new Error('privacy.html no longer says how the website counts visits');
// The policy says what the site really does: with counting on, it says so and what's recorded
if (analytics) policy = policy.replace(NO_ANALYTICS, 'This website sets no cookies and has no advertising or trackers. '
  + 'It counts visits with GoatCounter, which records the page, the site you came from, your browser, screen size and '
  + 'country. It uses no cookies, stores nothing on your device and doesn’t keep your IP address, so visitors can’t be '
  + 'identified or followed from site to site.');
const policyFile = path.join(out, 'privacy.html');
const body = policy.match(/<main>([\s\S]*)<\/main>/);
if (!body) throw new Error('privacy.html has no <main>');
const site = fs.readFileSync(path.join(repo, 'site', 'index.html'), 'utf8');
const slot = /<!-- PRIVACY:[^>]*-->/;
if (!slot.test(site)) throw new Error('site/index.html has no PRIVACY slot');
// On the page the policy is a card: its title and date as the header, the short version always shown, and each section
// a row that opens one at a time (privacy.html itself stays one open document, for anyone who wants it all at once)
const chevron = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const policyHtml = body[1].replace(/\s*<div class="eyebrow">[^<]*<\/div>/, '').replace(/<h1>[^<]*<\/h1>/, '');
const [policyIntro, ...policySections] = policyHtml.split('<h2>');
if (!policySections.length) throw new Error('privacy.html has no <h2> sections');
const policyBody = `<div class="policy-card">
  <div class="policy-head"><h2>How Tidemark handles your data</h2>${policyIntro.trim()}</div>
  ${policySections.map((sec, i) => {
    const end = sec.indexOf('</h2>');
    if (end < 0) throw new Error('privacy.html has an unclosed <h2>');
    return `<details name="policy"${i === 0 ? ' open' : ''}><summary><span>${sec.slice(0, end)}</span>${chevron}</summary>`
      + `<div class="policy-panel">${sec.slice(end + 5).trim()}</div></details>`;
  }).join('\n  ')}
</div>`;
fs.writeFileSync(path.join(out, 'index.html'), site.replace(slot, () => policyBody));
addHead(path.join(out, 'index.html'), meta({ title: 'Tidemark · The weight tracker that reads the trend', page: '',
  description: 'A private iPhone weight tracker. See your trend, not the daily noise, with a plan, habits and an optional medication log. No account; data stays on your phone.' })
  + `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization',
    name: 'YSB Ventures Ltd', url: siteUrl || undefined, email: 'yameen@ysbdesigns.uk', brand: { '@type': 'Brand', name: 'Tidemark' } })}</script>`);
for (const f of ['favicon.ico', 'apple-touch-icon.png', 'page.css'])
  fs.copyFileSync(path.join(repo, 'site', f), path.join(out, f));
fs.copyFileSync(path.join(repo, 'site', 'icon-128.png'), path.join(out, 'icon.png'));   // 128px: it's only ever shown small
fs.cpSync(path.join(repo, 'site', 'shots'), path.join(out, 'shots'), { recursive: true });
fs.cpSync(path.join(repo, 'site', 'film'), path.join(out, 'film'), { recursive: true });
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
for (const f of ['SpaceGrotesk_700Bold.ttf', 'SpaceGrotesk_500Medium.ttf', 'HankenGrotesk_400Regular.ttf', 'HankenGrotesk_600SemiBold.ttf', 'OFL-SpaceGrotesk.txt', 'OFL-HankenGrotesk.txt'])
  fs.copyFileSync(path.join(repo, 'fonts', f), path.join(out, 'fonts', f));
// The same fonts as WOFF2 (about a third of the size), which every current browser takes first
for (const f of fs.readdirSync(path.join(repo, 'site', 'fonts'))) fs.copyFileSync(path.join(repo, 'site', 'fonts', f), path.join(out, 'fonts', f));

// The privacy policy keeps its own address too; the original web tracker lives in /classic (it loads its own fonts)
fs.writeFileSync(policyFile, policy);
addHead(policyFile, meta({ title: 'Tidemark · Privacy policy', page: 'privacy.html',
  description: 'Tidemark collects no data. Everything you enter stays on your phone: no account, no server, no analytics, no ads.' })
  + icons + crumbs(['Tidemark', ''], ['Privacy policy', 'privacy.html']));

// The small pages: terms, the waitlist thank-you page, and the page GitHub Pages shows for any missing address
const page = (file, title, description, extra = '', noindex = false) => {
  fs.copyFileSync(path.join(repo, 'site', file), path.join(out, file));
  addHead(path.join(out, file), meta({ title, description, page: file, noindex }) + (file === '404.html' ? '' : icons) + extra);
};
page('terms.html', 'Tidemark · Terms and conditions',
  'The terms for the Tidemark website, waitlist and Tidemark Plus: not medical advice, subscriptions through Apple, and your consumer rights.',
  crumbs(['Tidemark', ''], ['Terms and conditions', 'terms.html']));
page('thanks.html', 'Tidemark · You’re nearly on the list', 'Check your inbox and confirm your email to join the Tidemark waitlist.', '', true);
page('404.html', 'Tidemark · Page not found', 'There’s nothing at this address.', '', true);
// Counted pages that aren't indexed: the thank-you page is how sign-ups show up in the visit counts
if (analytics) for (const f of ['thanks.html', '404.html']) addHead(path.join(out, f), analytics);

// Search engines: everything public is listed; the test build, classic tracker and thank-you page carry noindex instead
// of a robots.txt block, because a blocked page can't be read, so its noindex is never seen
const today = new Date().toISOString().slice(0, 10);
if (siteUrl) {
  fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
  fs.writeFileSync(path.join(out, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + ['', 'privacy.html', 'terms.html'].map(p => `  <url><loc>${siteUrl}/${p}</loc><lastmod>${today}</lastmod></url>\n`).join('')
    + '</urlset>\n');
}
fs.mkdirSync(path.join(out, 'classic'), { recursive: true });
fs.copyFileSync(path.join(repo, 'index.html'), path.join(out, 'classic', 'index.html'));
fs.cpSync(path.join(repo, 'fonts'), path.join(out, 'classic', 'fonts'), { recursive: true });
// The original tracker stays reachable for anyone still using it, but out of search results (the app is the real thing)
addHead(path.join(out, 'classic', 'index.html'), meta({ title: 'Tidemark Classic', page: 'classic/', noindex: true,
  description: 'The original web version of the tracker.' }), 'Tidemark Classic');
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`Pages site written to ${out}`);
