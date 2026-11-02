// Tidemark website: the home page's behaviour. Each block is independent and returns early if its markup isn't there.
// The page works without any of it: the text, links, plans, questions and policy are plain HTML.
(function () {
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  var EASE = 'cubic-bezier(.16,1,.3,1)';

  // ---- Hero: the opening, the jumping letters and the scroll-away ----
  var hero = document.querySelector('.hero');
  if (hero) {
    // "The scale jumps.": each letter sits a little off the line, like a day's reading, and shifts now and then.
    // Screen readers get the plain sentence; the letters are only drawn.
    var jump = hero.querySelector('.jump');
    var chars = [];
    if (jump) {
      var text = jump.textContent;
      jump.textContent = '';
      var sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = text;
      var drawn = document.createElement('span'); drawn.setAttribute('aria-hidden', 'true');
      text.split(' ').forEach(function (word, w) {
        if (w) drawn.appendChild(document.createTextNode(' '));
        var keep = document.createElement('span'); keep.style.whiteSpace = 'nowrap';   // a word never breaks between letters
        word.split('').forEach(function (c) {
          var s = document.createElement('span'); s.className = 'ch'; s.textContent = c;
          keep.appendChild(s); chars.push(s);
        });
        drawn.appendChild(keep);
      });
      jump.appendChild(sr); jump.appendChild(drawn);
    }
    function nudge(s) {
      var y = (Math.random() * 2 - 1) * 0.085, r = (Math.random() * 2 - 1) * 3.5;
      s.style.transform = 'translateY(' + y.toFixed(3) + 'em) rotate(' + r.toFixed(2) + 'deg)';
    }
    var heroSeen = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { heroSeen = es[0].isIntersecting; }).observe(hero);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      hero.classList.add('opened');
      setTimeout(function () { chars.forEach(nudge); }, still.matches ? 0 : 700);
    }); });
    if (!still.matches) setInterval(function () {
      if (!heroSeen || document.hidden || !chars.length) return;
      for (var k = 0; k < 3; k++) nudge(chars[Math.floor(Math.random() * chars.length)]);
    }, 1100);

    // Scrolling away: the words drift up and fade, and the menu gains its backing
    var copy = hero.querySelector('.hero-copy'), nav = document.querySelector('.nav'), ticking = false;
    function onScroll() {
      ticking = false;
      var y = window.scrollY, h = window.innerHeight;
      if (nav) nav.classList.toggle('solid', y > 40);
      if (still.matches || !copy || y > h * 1.2) return;
      copy.style.transform = 'translateY(' + (y * 0.32).toFixed(1) + 'px)';
      copy.style.opacity = Math.max(0, 1 - y / (h * 0.62)).toFixed(3);
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }

  // ---- Hero chart: sixty-odd days of weigh-ins landing as scattered dots while the trend draws one calm line through
  // them, with the plan dashed behind, the same chart as the app's Today screen. Drawn at the screen's own pixel
  // density, so it's sharp on any display. Pauses off screen; with reduced motion it's drawn once, finished. ----
  (function () {
    var canvas = hero && hero.querySelector('canvas');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');

    // The same made-up numbers on every visit: a steady loss, daily noise, and the odd salty-dinner spike
    var seed = 20261013;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var N = 64, weighs = [], trend = [], plan = [];
    for (var i = 0; i < N; i++) {
      var real = 92 - i * 0.085 - Math.sin(i / 9) * 0.25;
      var noise = (rnd() + rnd() + rnd() - 1.5) * 1.05 + (rnd() < 0.08 ? 1.5 : 0);
      weighs.push(real + noise);
      trend.push(i ? trend[i - 1] + 0.1 * (weighs[i] - trend[i - 1]) : 92);   // the app's moving average
      plan.push(92 - i * 0.1);
    }
    var lo = Math.min.apply(null, weighs.concat(plan)), hi = Math.max.apply(null, weighs.concat(plan));

    var W = 0, H = 0, dpr = 1, pts = null, base = null, born = [], t0 = 0, raf = 0, seen = true;
    var DELAY = 600, DRAW = 3400, POP = 520;

    function layout() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      var top = H * 0.62, bottom = H * 0.93, x0 = W * -0.02, x1 = W * 0.95;   // below the words; the end stays on screen
      var X = function (k) { return x0 + (x1 - x0) * k / (N - 1); };
      var Y = function (v) { return top + (bottom - top) * (hi - v) / (hi - lo); };
      pts = { w: weighs.map(function (v, k) { return [X(k), Y(v)]; }), t: trend.map(function (v, k) { return [X(k), Y(v)]; }),
              p: [[X(0), Y(plan[0])], [X(N - 1), Y(plan[N - 1])]], top: top, bottom: bottom };
      base = null;
    }
    var size = function () { return Math.max(1, Math.min(W, 1600) / 1440); };

    function trendPath(c, upto) {
      // A smooth curve through the trend, cut off part-way through a segment so it draws continuously
      var t = pts.t, n = Math.floor(upto), f = upto - n;
      c.beginPath(); c.moveTo(t[0][0], t[0][1]);
      for (var k = 1; k <= n && k < N; k++) {
        var mx = (t[k - 1][0] + t[k][0]) / 2, my = (t[k - 1][1] + t[k][1]) / 2;
        c.quadraticCurveTo(t[k - 1][0], t[k - 1][1], mx, my);
      }
      var a = t[Math.min(n, N - 1)], b = t[Math.min(n + 1, N - 1)];
      var end = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      c.lineTo(end[0], end[1]);
      return end;
    }

    function scene(c, now, upto, withHead) {
      var s = size();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      // Faint gridlines and the plan, dashed
      c.strokeStyle = 'rgba(242,238,246,.05)'; c.lineWidth = 1;
      for (var g = 0; g < 5; g++) { var gy = pts.top + (pts.bottom - pts.top) * g / 4; c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke(); }
      c.setLineDash([7 * s, 9 * s]); c.strokeStyle = 'rgba(201,191,214,.32)'; c.lineWidth = 1.6 * s;
      c.beginPath(); c.moveTo(pts.p[0][0], pts.p[0][1]); c.lineTo(pts.p[1][0], pts.p[1][1]); c.stroke(); c.setLineDash([]);
      // Weigh-ins: each lands with a small bounce, and for a moment a thin line shows how far it sits from the trend
      for (var k = 0; k < N; k++) {
        if (born[k] == null) continue;
        var age = now - born[k], q = Math.min(1, age / POP), w = pts.w[k], t = pts.t[k];
        var pop = q < 1 ? 1 + 2.2 * Math.pow(q - 1, 3) + 1.2 * Math.pow(q - 1, 2) : 1;   // ease out, with overshoot
        if (age < 1400) {
          c.strokeStyle = 'rgba(255,162,75,' + (0.5 * (1 - age / 1400)).toFixed(3) + ')'; c.lineWidth = 1.2 * s;
          c.beginPath(); c.moveTo(w[0], w[1]); c.lineTo(t[0], t[1]); c.stroke();
        }
        c.fillStyle = 'rgba(251,247,243,' + (0.62 * q).toFixed(3) + ')';
        c.beginPath(); c.arc(w[0], w[1], Math.max(0, 3.4 * s * pop), 0, Math.PI * 2); c.fill();
      }
      if (upto <= 0) return null;
      // The trend: a wide soft glow under a crisp line, amber to coral
      var grad = c.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, '#FFA24B'); grad.addColorStop(0.6, '#FF6B5E'); grad.addColorStop(1, '#FF6B5E');
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.save(); c.globalAlpha = 0.35; c.strokeStyle = grad; c.lineWidth = 14 * s; c.filter = 'blur(' + (10 * s).toFixed(1) + 'px)';
      trendPath(c, upto); c.stroke(); c.restore();
      c.strokeStyle = grad; c.lineWidth = 4 * s;
      var end = trendPath(c, upto); c.stroke();
      if (withHead) head(c, end, 0);
      return end;
    }
    function head(c, p, pulse) {
      var s = size();
      if (pulse > 0) {
        c.strokeStyle = 'rgba(255,107,94,' + (0.55 * (1 - pulse)).toFixed(3) + ')'; c.lineWidth = 2 * s;
        c.beginPath(); c.arc(p[0], p[1], (9 + 26 * pulse) * s, 0, Math.PI * 2); c.stroke();
      }
      c.fillStyle = '#FBF7F3'; c.beginPath(); c.arc(p[0], p[1], 9 * s, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#FF6B5E'; c.beginPath(); c.arc(p[0], p[1], 6 * s, 0, Math.PI * 2); c.fill();
    }

    function frame(now) {
      raf = 0;
      if (!pts) layout();
      var k = Math.min(1, Math.max(0, (now - t0 - DELAY) / DRAW));
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;   // ease in and out
      var upto = e * (N - 1);
      for (var d = 0; d < N; d++) if (born[d] == null && d <= upto + 0.5) born[d] = now;
      var settled = k >= 1 && now - born[N - 1] > 1400;
      if (!settled) { scene(ctx, now, upto, true); }
      else {
        // Finished: keep the drawn chart as a picture, and only redraw the light that runs along the line and the
        // pulse at its end over it
        if (!base) {
          base = document.createElement('canvas'); base.width = canvas.width; base.height = canvas.height;
          scene(base.getContext('2d'), now + 1e6, N - 1, false);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(base, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var cyc = ((now - t0) % 6000) / 6000, at = cyc * 1.25 * (N - 1);
        if (at < N - 1) {
          var a = pts.t[Math.floor(at)], b = pts.t[Math.min(N - 1, Math.floor(at) + 1)], f = at % 1;
          var x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, r = 70 * size();
          var glow = ctx.createRadialGradient(x, y, 0, x, y, r);
          glow.addColorStop(0, 'rgba(255,214,190,.55)'); glow.addColorStop(1, 'rgba(255,107,94,0)');
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = glow; ctx.fillRect(x - r, y - r, r * 2, r * 2);
          ctx.globalCompositeOperation = 'source-over';
        }
        head(ctx, pts.t[N - 1], ((now - t0) % 2400) / 2400);
      }
      if (seen && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function finished() {
      layout();
      for (var d = 0; d < N; d++) born[d] = -1e6;
      var end = scene(ctx, 0, N - 1, false);
      head(ctx, end, 0);
    }
    function start() { if (!raf && seen && !document.hidden && !still.matches) raf = requestAnimationFrame(frame); }

    if (still.matches) finished();
    else { t0 = performance.now(); start(); }
    var resized = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resized);
      resized = setTimeout(function () { if (still.matches) finished(); else { layout(); start(); } }, 120);
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; start(); }).observe(canvas);
    document.addEventListener('visibilitychange', start);
  })();

  // ---- Inside Tidemark: the phone shows the screen for whichever chapter is in the middle of the window ----
  (function () {
    var story = document.getElementById('inside');
    if (!story || !('IntersectionObserver' in window)) return;
    var shots = story.querySelectorAll('.phone img'), stage = story.querySelector('.stage');
    var chapters = story.querySelectorAll('.chapter');
    function show(ch) {
      var n = +ch.getAttribute('data-shot');
      chapters.forEach(function (c) { c.classList.toggle('on', c === ch); });
      shots.forEach(function (img, k) { img.classList.toggle('on', k === n); });
      stage.style.setProperty('--glow', ch.getAttribute('data-glow'));
    }
    show(chapters[0]);
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) show(e.target); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    chapters.forEach(function (c) { io.observe(c); });
  })();

  // ---- Reveals: sections rise into place the first time they come into view ----
  (function () {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  })();

  // ---- The film plays only while at least half of it is on screen, never by itself with reduced motion, and always
  // has a pause button ----
  (function () {
    var v = document.getElementById('film-video');
    if (!v) return;
    var paused = still.matches;          // the viewer's choice wins over scrolling
    v.removeAttribute('controls');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'film-btn';
    var play = '<svg viewBox="0 0 18 18" aria-hidden="true"><path fill="currentColor" d="M5 3.2v11.6a.8.8 0 0 0 1.2.7l9.3-5.8a.8.8 0 0 0 0-1.4L6.2 2.5A.8.8 0 0 0 5 3.2Z"/></svg>';
    var pause = '<svg viewBox="0 0 18 18" aria-hidden="true"><rect x="4" y="3" width="3.6" height="12" rx="1" fill="currentColor"/><rect x="10.4" y="3" width="3.6" height="12" rx="1" fill="currentColor"/></svg>';
    function show() { var on = !v.paused; b.innerHTML = on ? pause : play; b.setAttribute('aria-label', on ? 'Pause the film' : 'Play the film'); }
    v.parentNode.appendChild(b);
    v.addEventListener('play', show); v.addEventListener('pause', show); show();
    b.addEventListener('click', function () { if (v.paused) { paused = false; v.play(); } else { paused = true; v.pause(); } });
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !paused) { v.preload = 'auto'; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else if (!e.isIntersecting && !v.paused) v.pause();
      });
    }, { threshold: 0.5 }).observe(v);
  })();

  // ---- Pricing: the billing switch changes the Plus price (counting to it), and the outline glides to the chosen
  // plan, whose features show alongside. Without this script the form still works as radios and every plan's list shows. ----
  (function () {
    var form = document.getElementById('picker'); if (!form) return;
    var rows = form.querySelector('.rows'), glide = rows.querySelector('.glide');
    var panels = document.querySelectorAll('.plan .panel');
    function place() {
      var row = form.querySelector('input[name=plan]:checked').closest('.row');
      glide.style.transform = 'translateY(' + row.offsetTop + 'px)';
      glide.style.height = row.offsetHeight + 'px';
      var plan = row.querySelector('input').value;
      panels.forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-plan') === plan); });
    }
    function count(el, to) {
      var from = parseFloat(el.textContent) || 0;
      if (still.matches) { el.textContent = to.toFixed(2); return; }
      var t0 = performance.now(), dur = 450;
      (function step(t) {
        var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = (from + (to - from) * e).toFixed(2);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }
    function period() {
      var key = form.querySelector('input[name=period]:checked').value;
      form.classList.toggle('yearly', key === 'year');
      form.querySelectorAll('[data-month]').forEach(function (el) {
        var v = el.getAttribute('data-' + key);
        if (el.classList.contains('num')) count(el, parseFloat(v)); else el.textContent = v;
      });
      requestAnimationFrame(place);   // the Plus row can change height when its text does
    }
    form.addEventListener('change', function (e) { if (e.target.name === 'period') period(); else place(); });
    window.addEventListener('resize', place);
    place(); requestAnimationFrame(function () { form.classList.add('ready'); });
  })();

  // ---- FAQ: one answer open at a time, a gentle open and close, and a search that filters and highlights as you type.
  // Works without this script too: the questions are plain <details> elements. ----
  (function () {
    var list = document.getElementById('faq-list'); if (!list) return;
    var items = Array.prototype.slice.call(list.querySelectorAll('details'));
    var input = document.getElementById('faq-q'), box = input.parentNode, clear = box.querySelector('.faq-clear');
    var empty = list.parentNode.querySelector('.faq-empty');
    var parts = items.map(function (d) {
      var q = d.querySelector('summary span'), a = d.querySelector('.answer p');
      return { d: d, q: q, a: a, qHtml: q.innerHTML, aHtml: a.innerHTML };   // our own markup, kept to undo highlighting
    });
    function animate(d, open) {
      var panel = d.querySelector('.answer');
      if (still.matches || !panel.animate) { d.open = open; return; }
      if (open) d.open = true;
      var h = panel.scrollHeight;
      var anim = panel.animate(open ? [{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }]
                                    : [{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
                               { duration: open ? 420 : 260, easing: EASE });
      if (!open) anim.onfinish = function () { d.open = false; };
    }
    function show(d) {
      parts.forEach(function (p) { if (p.d !== d && p.d.open) animate(p.d, false); });
      animate(d, true);
    }
    items.forEach(function (d) {
      d.querySelector('summary').addEventListener('click', function (e) {
        e.preventDefault();
        if (d.open) animate(d, false); else show(d);
      });
    });
    // Highlight by splitting text nodes, never by writing what was typed into the page as HTML
    function mark(el, html, q) {
      el.innerHTML = html;
      if (!q) return;
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [], n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(function (node) {
        var text = node.nodeValue, lower = text.toLowerCase(), at = lower.indexOf(q);
        if (at < 0) return;
        var frag = document.createDocumentFragment(), from = 0;
        while (at >= 0) {
          frag.appendChild(document.createTextNode(text.slice(from, at)));
          var m = document.createElement('mark'); m.textContent = text.slice(at, at + q.length); frag.appendChild(m);
          from = at + q.length; at = lower.indexOf(q, from);
        }
        frag.appendChild(document.createTextNode(text.slice(from)));
        node.parentNode.replaceChild(frag, node);
      });
    }
    function search() {
      var q = input.value.trim().toLowerCase();
      box.classList.toggle('has-query', input.value.length > 0);
      var shown = [];
      parts.forEach(function (p) {
        mark(p.q, p.qHtml, ''); mark(p.a, p.aHtml, '');
        var hit = !q || (p.q.textContent + ' ' + p.a.textContent).toLowerCase().indexOf(q) >= 0;
        p.d.hidden = !hit;
        mark(p.q, p.qHtml, q); mark(p.a, p.aHtml, q);
        if (hit) shown.push(p.d);
      });
      empty.hidden = shown.length > 0;
      if (q) { if (!shown.some(function (d) { return d.open; }) && shown[0]) { parts.forEach(function (p) { p.d.open = false; }); shown[0].open = true; } }
      else parts.forEach(function (p) { p.d.open = false; });
    }
    input.addEventListener('input', search);
    clear.addEventListener('click', function () { input.value = ''; search(); input.focus(); });
  })();
})();
