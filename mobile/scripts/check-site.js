// Checks the assembled website before it's published, and fails the deploy if anything is wrong:
//   - every internal link and file reference points at something that exists, including #anchors on the target page
//   - every image has alt text (alt="" is allowed: it marks a decorative image)
//   - every page has a title, a meta description and a viewport; indexable pages have a canonical address
//   - nothing that looks like a secret key has ended up in the public files
// The owner's test build (/app) is the app's own export and isn't checked here. External links aren't fetched (they'd
// make the deploy depend on other people's servers); run with --external to check them by hand.
// Usage: node scripts/check-site.js <site-dir> [--external]
const fs = require('fs');
const path = require('path');

const [root, flag] = process.argv.slice(2);
if (!root) { console.error('usage: node scripts/check-site.js <site-dir> [--external]'); process.exit(1); }
const problems = [], external = new Set();
const fail = (file, text) => problems.push(`${path.relative(root, file)}: ${text}`);

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
  const p = path.join(dir, d.name);
  if (d.isDirectory()) return p === path.join(root, 'app') ? [] : walk(p);
  return [p];
});
const files = walk(root);
const pages = files.filter(f => f.endsWith('.html'));
const ids = new Map(pages.map(f => [f, new Set([...fs.readFileSync(f, 'utf8').matchAll(/\sid="([^"]+)"/g)].map(m => m[1]))]));

for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
  if (!/<title>[^<]{5,}<\/title>/.test(html)) fail(file, 'no <title>');
  if (!/<meta name="description" content="[^"]{20,}"/.test(html)) fail(file, 'no meta description');
  if (!/<meta name="viewport"/.test(html)) fail(file, 'no viewport meta (it won’t fit a phone)');
  if (!noindex && !/<link rel="canonical"/.test(html)) fail(file, 'indexable page with no canonical address');

  for (const img of html.match(/<img\b[^>]*>/g) || []) {
    if (!/\salt="/.test(img)) fail(file, `image with no alt text: ${img.slice(0, 80)}`);
  }

  // href and src on elements, and poster on video. Skips JSON-LD and inline scripts' contents.
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, s => (s.match(/<script\b[^>]*>/) || [''])[0]);
  for (const m of markup.matchAll(/\s(?:href|src|poster)="([^"]*)"/g)) {
    const ref = m[1].replace(/&amp;/g, '&');
    if (!ref) { fail(file, 'empty link'); continue; }
    if (/^(mailto:|tel:|data:)/.test(ref)) continue;
    if (/^https?:\/\//.test(ref)) {
      if (!/^https:\/\/tidemark\.ysbdesigns\.uk\//.test(ref)) external.add(ref);
      if (ref.startsWith('http://')) fail(file, `insecure http:// link: ${ref}`);
      continue;
    }
    const [p, hash] = ref.split('#');
    const target = !p ? file
      : p.startsWith('/') ? path.join(root, p)
      : path.resolve(path.dirname(file), p);
    const resolved = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, 'index.html') : target;
    if (!fs.existsSync(resolved)) { fail(file, `broken link: ${ref}`); continue; }
    if (hash && resolved.endsWith('.html') && ids.has(resolved) && !ids.get(resolved).has(hash)) fail(file, `link to a missing #${hash}: ${ref}`);
  }
}

// Secrets: anything shaped like a live key or token in a public text file
const SECRET = /(sk_live_[0-9a-zA-Z]{10,}|rk_live_[0-9a-zA-Z]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|ghp_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{30,}|xox[abp]-[0-9A-Za-z-]{10,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|api[_-]?key["'\s:=]+[0-9A-Za-z]{24,})/;
for (const file of files.filter(f => /\.(html|js|css|txt|xml|json|webmanifest)$/.test(f))) {
  const hit = fs.readFileSync(file, 'utf8').match(SECRET);
  if (hit) fail(file, `looks like a secret: ${hit[0].slice(0, 12)}…`);
}

(async () => {
  if (flag === '--external') {
    for (const url of external) {
      try {
        const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(20000) });
        console.log(`${r.ok ? 'ok ' : 'BAD'} ${r.status} ${url}`);
        if (!r.ok) problems.push(`external link answers ${r.status}: ${url}`);
      } catch (e) { console.log(`?   ${url} (${e.message})`); }
    }
  }
  if (problems.length) { console.error(problems.map(p => `✗ ${p}`).join('\n')); process.exit(1); }
  console.log(`Site check passed: ${pages.length} pages, ${files.length} files, ${external.size} external links${flag === '--external' ? ' checked' : ' (not fetched)'}`);
})();
