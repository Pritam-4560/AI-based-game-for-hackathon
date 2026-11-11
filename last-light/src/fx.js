// fx.js - particles, damage numbers, shake, projectiles, overlays.
// One global: FX. All world positions are in tile units (tile (x,y) centre = x+0.5, y+0.5).
// Pixel-art: everything is snapped to an "art pixel" grid of 16 per tile.
const FX = (function () {
  "use strict";

  var ART = 16; // art pixels per tile
  var reduced = false;
  try {
    var mq = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq) {
      reduced = !!mq.matches;
      var onCh = function (e) { reduced = !!e.matches; };
      if (mq.addEventListener) mq.addEventListener("change", onCh);
      else if (mq.addListener) mq.addListener(onCh);
    }
  } catch (e) { /* ignore */ }

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------------------------------------------------------------- palettes
  var PAL = {
    ember: ["#fff6c0", "#ffd84a", "#ff9a2a", "#e8501e", "#9c2a1a"],
    fire: ["#ffffff", "#fff1a0", "#ffb53a", "#ff6a1e", "#c02a12"],
    smoke: ["#5a5560", "#4a4652", "#3a3742", "#2c2a33"],
    blood: ["#d8243a", "#b0182c", "#8a1022", "#6a0c1a"],
    gold: ["#ffffff", "#fff3a0", "#ffd84a", "#f0a828"],
    spark: ["#ffffff", "#e8f4ff", "#9fd8ff", "#5aa0ff"],
    zap: ["#ffffff", "#d8f0ff", "#8fd0ff", "#7a7aff"],
    arrow: ["#d8c8a0", "#a08868", "#6a5a48"],
    bolt: ["#ffffff", "#e8b0ff", "#b45cff", "#7a2ad8", "#4a1a8a"],
    magic: ["#ffffff", "#b8fff0", "#4ae8d0", "#2a9ad8", "#2a4ab0"]
  };
  var palCache = {};
  // Build a 4-step palette from a single css colour: white-ish -> colour -> darker.
  function palFor(color) {
    if (!color) color = "#ffffff";
    if (PAL[color]) return PAL[color];
    var p = palCache[color];
    if (p) return p;
    var rgb = parseColor(color);
    if (!rgb) { p = [color]; }
    else {
      p = [mix(rgb, [255, 255, 255], 0.55), css(rgb), mix(rgb, [0, 0, 0], 0.25), mix(rgb, [0, 0, 0], 0.5)];
    }
    palCache[color] = p;
    return p;
  }
  function parseColor(c) {
    if (typeof c !== "string") return null;
    var m;
    if (c[0] === "#") {
      if (c.length === 4) return [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16)];
      if (c.length >= 7) return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)];
      return null;
    }
    m = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(c);
    if (m) return [+m[1], +m[2], +m[3]];
    return null;
  }
  function css(rgb) { return "rgb(" + (rgb[0] | 0) + "," + (rgb[1] | 0) + "," + (rgb[2] | 0) + ")"; }
  function mix(a, b, t) { return css([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }

  // ---------------------------------------------------------------- particle pool
  var MAXP = 2400;
  var P = new Array(MAXP);
  for (var i = 0; i < MAXP; i++) {
    P[i] = { x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 0, max: 1, size: 1, grow: 0,
      pal: null, add: false, shape: 0, floor: 1e9, ph: 0, alpha: 1 };
  }
  var np = 0;
  // shape: 0 square, 1 plus/twinkle, 2 smoke (soft square, normal blend), 3 droplet (stretches with speed)
  function spawn(x, y, vx, vy, life, size, pal, add, shape) {
    var p;
    if (np >= MAXP) { p = P[(Math.random() * MAXP) | 0]; } // recycle a random one
    else p = P[np++];
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.g = 0; p.drag = 0;
    p.life = life; p.max = life; p.size = size; p.grow = 0;
    p.pal = pal; p.add = add; p.shape = shape || 0; p.floor = 1e9; p.ph = Math.random() * 6.283; p.alpha = 1;
    return p;
  }

  // ---------------------------------------------------------------- other effect lists
  var texts = [];     // floating text
  var rings = [];     // expanding rings / flash disks
  var beams = [];     // level-up columns
  var bolts = [];     // lightning
  var projs = [];     // projectiles
  var sprites = {};
  var trauma = 0, shX = 0, shY = 0, shT = 0;
  var hurt = 0, flash = 0, flashColor = "#ffffff";
  var clock = 0;

  // ---------------------------------------------------------------- public: emitters
  function burst(x, y, color, opts) {
    opts = opts || {};
    var count = opts.count != null ? opts.count : 14;
    var speed = opts.speed != null ? opts.speed : 1;
    var life = opts.life != null ? opts.life : 500;
    var size = opts.size != null ? opts.size : 1;
    var grav = opts.gravity || 0;
    var glow = !!opts.glow;
    var pal = palFor(color);
    for (var i = 0; i < count; i++) {
      var a = Math.random() * 6.283;
      var s = speed * rnd(1.5, 5.5);
      var p = spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * rnd(0.6, 1.15),
        size * (Math.random() < 0.3 ? 2 : 1.5), pal, glow, 0);
      p.drag = 3.5; p.g = grav * 14;
    }
    if (glow) ring(x, y, 0.35 * Math.max(0.6, speed), color, { dur: 160, width: 1, fill: true, add: true });
  }

  function blood(x, y) {
    var pal = PAL.blood;
    var n = 12 + ((Math.random() * 6) | 0);
    for (var i = 0; i < n; i++) {
      var a = rnd(-Math.PI, 0); // upward hemisphere
      var s = rnd(1.5, 4.5);
      var p = spawn(x + rnd(-0.1, 0.1), y + rnd(-0.15, 0.05), Math.cos(a) * s, Math.sin(a) * s - 1,
        rnd(500, 900), Math.random() < 0.35 ? 2 : 1, pal, false, 3);
      p.g = 20; p.drag = 0.8; p.floor = y + rnd(0.15, 0.45);
    }
  }

  function sparkle(x, y, color) {
    var pal = palFor(color || "#fff3a0");
    for (var i = 0; i < 12; i++) {
      var p = spawn(x + rnd(-0.4, 0.4), y + rnd(-0.3, 0.4), rnd(-0.3, 0.3), rnd(-2.2, -0.8),
        rnd(500, 1000), Math.random() < 0.4 ? 2 : 1, pal, true, 1);
      p.drag = 1.2;
    }
    for (var j = 0; j < 8; j++) {
      var q = spawn(x + rnd(-0.3, 0.3), y + rnd(-0.2, 0.3), rnd(-0.4, 0.4), rnd(-1.5, -0.5),
        rnd(300, 600), 1, pal, true, 0);
      q.drag = 1;
    }
  }

  function ring(x, y, radius, color, o) {
    o = o || {};
    rings.push({ x: x, y: y, r: radius || 1, t: 0, dur: o.dur || 450, pal: palFor(color || "#ffffff"),
      width: o.width || 2, fill: !!o.fill, add: o.add !== false, r0: o.r0 || 0 });
  }

  function publicRing(x, y, radius, color) {
    ring(x, y, radius, color, { dur: 480, width: 2 });
    ring(x, y, radius * 0.7, color, { dur: 380, width: 1 });
    var pal = palFor(color || "#ffffff");
    var n = Math.min(40, 10 + ((radius * 8) | 0));
    for (var i = 0; i < n; i++) {
      var a = (i / n) * 6.283;
      var s = radius * rnd(1.6, 2.4);
      var p = spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(300, 500), 1, pal, true, 0);
      p.drag = 2.5;
    }
  }

  function explosion(x, y, r) {
    r = r || 1.5;
    ring(x, y, r, "ember", { dur: 280, fill: true });          // orange fireball body
    ring(x, y, r * 0.55, "fire", { dur: 140, fill: true });    // white-hot core
    ring(x, y, r, "ember", { dur: 380, width: 3 });            // shock ring
    ring(x, y, r * 1.15, "fire", { dur: 460, width: 1 });
    var n = Math.min(160, (30 + r * 28) | 0);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283;
      var s = r * rnd(1.5, 6);
      var p = spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(350, 800), Math.random() < 0.3 ? 2 : 1,
        PAL.ember, true, 0);
      p.drag = 3; p.g = -1;
    }
    var m = Math.min(60, (8 + r * 8) | 0);
    for (var k = 0; k < m; k++) {
      var a2 = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r * 0.8;
      var q = spawn(x + Math.cos(a2) * d, y + Math.sin(a2) * d, rnd(-0.3, 0.3), rnd(-1.0, -0.3),
        rnd(700, 1300), rnd(2, 4), PAL.smoke, false, 2);
      q.grow = 2.5; q.drag = 0.8; q.alpha = 0.5;
    }
  }

  // lightning: pre-jagged point list, re-jagged every ~45 ms
  function jag(b) {
    var n = b.n, dx = b.tx - b.fx, dy = b.ty - b.fy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var amp = Math.min(0.6, 0.12 + len * 0.05);
    var off = 0;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      if (i === 0 || i === n) off = 0;
      else off = clamp(off + rnd(-amp, amp), -amp * 1.6, amp * 1.6) * (1 - Math.pow(Math.abs(t * 2 - 1), 4) * 0.7);
      b.pts[i * 2] = b.fx + dx * t + nx * off;
      b.pts[i * 2 + 1] = b.fy + dy * t + ny * off;
    }
    // a short fork
    b.fork = Math.random() < 0.8 ? 1 + ((Math.random() * (n - 2)) | 0) : -1;
    b.fa = Math.atan2(dy, dx) + (Math.random() < 0.5 ? -1 : 1) * rnd(0.5, 1.0);
    b.fl = rnd(0.5, 1.2);
  }
  function lightning(fx, fy, tx, ty) {
    var dx = tx - fx, dy = ty - fy, len = Math.sqrt(dx * dx + dy * dy);
    var n = clamp(Math.ceil(len * 2.5), 4, 40);
    var b = { fx: fx, fy: fy, tx: tx, ty: ty, n: n, pts: new Float32Array((n + 1) * 2), t: 0, dur: 260, rj: 0,
      fork: -1, fa: 0, fl: 0 };
    jag(b);
    bolts.push(b);
    ring(tx, ty, 0.9, "#5ab0ff", { dur: 200, fill: true });
    ring(tx, ty, 1.2, "zap", { dur: 300, width: 1 });
    for (var i = 0; i < 26; i++) {
      var a = Math.random() * 6.283, s = rnd(2, 7);
      var p = spawn(tx, ty, Math.cos(a) * s, Math.sin(a) * s, rnd(200, 450), Math.random() < 0.3 ? 2 : 1, PAL.zap, true, 0);
      p.drag = 4; p.g = 6;
    }
    flash = Math.max(flash, 0.35); flashColor = "#d8ecff";
  }

  function damageNumber(x, y, text, color) {
    text = String(text);
    var big = text.length > 4;
    // stack numbers that appear on the same tile at the same time
    var stack = 0;
    for (var i = 0; i < texts.length; i++) {
      var o = texts[i];
      if (o.t < 250 && Math.abs(o.x0 - x) < 0.6 && Math.abs(o.y0 - y) < 0.6) stack++;
    }
    texts.push({ x0: x, y0: y, x: x + rnd(-0.15, 0.15), y: y - 0.25 - stack * 0.35, vx: rnd(-0.35, 0.35),
      text: text, color: color || "#ffffff", t: 0, dur: big ? 1500 : 950, big: big });
  }

  function levelUp(x, y) {
    beams.push({ x: x, y: y, t: 0, dur: 1100 });
    ring(x, y, 1.6, "gold", { dur: 600, width: 2 });
    ring(x, y, 0.9, "gold", { dur: 300, fill: true });
    for (var i = 0; i < 40; i++) {
      var p = spawn(x + rnd(-0.45, 0.45), y + rnd(-0.2, 0.4), rnd(-0.4, 0.4), rnd(-5, -1.5),
        rnd(600, 1200), Math.random() < 0.4 ? 2 : 1, PAL.gold, true, Math.random() < 0.5 ? 1 : 0);
      p.drag = 1.4;
    }
    flash = Math.max(flash, 0.75); flashColor = "#fff8e0";
  }

  function hurtFlash() { hurt = 1; }

  function shake(s) {
    if (reduced) return;
    trauma = Math.min(1, trauma + clamp(s == null ? 0.3 : s, 0, 1));
  }
  var shOut = { x: 0, y: 0 };
  function shakeOffset() { shOut.x = shX; shOut.y = shY; return shOut; }

  // ---------------------------------------------------------------- projectiles
  function projectile(fx, fy, tx, ty, kind, onArrive) {
    var dx = tx - fx, dy = ty - fy, d = Math.sqrt(dx * dx + dy * dy);
    var dur = clamp(110 + d * 18, 120, 250);
    if (kind === "fireball") dur = clamp(dur * 1.15, 140, 260);
    projs.push({ fx: fx, fy: fy, tx: tx, ty: ty, kind: kind || "magic", t: 0, dur: dur, ang: Math.atan2(dy, dx),
      cb: typeof onArrive === "function" ? onArrive : null, done: false, x: fx, y: fy, em: 0 });
  }
  function fire(cb) {
    if (!cb) return;
    try { cb(); } catch (e) { setTimeout(function () { throw e; }, 0); }
  }
  function impact(p) {
    var x = p.tx, y = p.ty;
    switch (p.kind) {
      case "arrow":
        for (var i = 0; i < 6; i++) {
          var a = p.ang + Math.PI + rnd(-1, 1), s = rnd(1, 3);
          var q = spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(150, 300), 1, PAL.arrow, false, 0);
          q.drag = 4;
        }
        break;
      case "bolt":
        burst(x, y, "bolt", { count: 14, speed: 1, life: 380, glow: true });
        break;
      case "fireball":
        burst(x, y, "fire", { count: 16, speed: 1.1, life: 420, glow: true });
        break;
      default:
        burst(x, y, "magic", { count: 14, speed: 1, life: 380, glow: true });
    }
  }
  function busy() {
    for (var i = 0; i < projs.length; i++) if (!projs[i].done) return true;
    return false;
  }

  // ---------------------------------------------------------------- update
  var arrived = [];
  function update(dtMs) {
    var dt = +dtMs;
    if (!(dt > 0)) dt = 0;
    if (dt > 50) dt = 50;
    var s = dt / 1000;
    clock += dt;

    // particles
    for (var i = np - 1; i >= 0; i--) {
      var p = P[i];
      p.life -= dt;
      if (p.life <= 0) {
        np--;
        if (i !== np) { var tmp = P[np]; P[np] = p; P[i] = tmp; }
        continue;
      }
      if (p.drag) { var k = Math.max(0, 1 - p.drag * s); p.vx *= k; p.vy *= k; }
      p.vy += p.g * s;
      p.x += p.vx * s; p.y += p.vy * s;
      if (p.y > p.floor) { p.y = p.floor; p.vx = 0; p.vy = 0; p.g = 0; p.shape = 0; }
      if (p.grow) p.size += p.grow * s;
    }

    // projectiles
    for (var j = 0; j < projs.length; j++) {
      var pr = projs[j];
      if (pr.done) continue;
      pr.t += dt;
      var t = Math.min(1, pr.t / pr.dur);
      var ox = pr.x, oy = pr.y;
      pr.x = pr.fx + (pr.tx - pr.fx) * t;
      pr.y = pr.fy + (pr.ty - pr.fy) * t;
      emitTrail(pr, ox, oy, dt);
      if (t >= 1) { pr.done = true; impact(pr); arrived.push(pr); }
    }
    if (arrived.length) {
      // remove finished ones first, then run callbacks (they may add new projectiles or call clear)
      var w = 0;
      for (var m = 0; m < projs.length; m++) if (!projs[m].done) projs[w++] = projs[m];
      projs.length = w;
      var list = arrived; arrived = [];
      for (var a = 0; a < list.length; a++) { var cb = list[a].cb; list[a].cb = null; fire(cb); }
    }

    // rings, beams, bolts, texts
    stepList(rings, dt);
    stepList(beams, dt);
    for (var b = bolts.length - 1; b >= 0; b--) {
      var bo = bolts[b];
      bo.t += dt; bo.rj += dt;
      if (bo.t >= bo.dur) { bolts.splice(b, 1); continue; }
      if (bo.rj > 45) { bo.rj = 0; jag(bo); }
    }
    for (var q = texts.length - 1; q >= 0; q--) {
      var tx = texts[q];
      tx.t += dt;
      if (tx.t >= tx.dur) { texts.splice(q, 1); continue; }
      tx.x += tx.vx * s * (1 - tx.t / tx.dur);
    }

    // shake: trauma^2 scaled jitter, changes ~ every 16ms
    if (trauma > 0) {
      trauma = Math.max(0, trauma - s * 2.2);
      shT += dt;
      if (shT >= 16) {
        shT = 0;
        var amt = trauma * trauma * 12; // CSS px
        shX = Math.round(rnd(-1, 1) * amt);
        shY = Math.round(rnd(-1, 1) * amt);
      }
      if (trauma === 0) { shX = 0; shY = 0; }
    } else { shX = 0; shY = 0; }

    if (hurt > 0) hurt = Math.max(0, hurt - s * 2.4);
    if (flash > 0) flash = Math.max(0, flash - s * 2.6);
  }
  function stepList(arr, dt) {
    for (var i = arr.length - 1; i >= 0; i--) {
      arr[i].t += dt;
      if (arr[i].t >= arr[i].dur) arr.splice(i, 1);
    }
  }

  function emitTrail(pr, ox, oy, dt) {
    pr.em += dt;
    var step = pr.kind === "arrow" ? 22 : 9;
    while (pr.em >= step) {
      pr.em -= step;
      var f = Math.random();
      var x = ox + (pr.x - ox) * f, y = oy + (pr.y - oy) * f;
      var p;
      switch (pr.kind) {
        case "arrow":
          p = spawn(x, y, 0, 0, 140, 1, PAL.arrow, false, 0);
          break;
        case "fireball":
          p = spawn(x + rnd(-0.08, 0.08), y + rnd(-0.08, 0.08), rnd(-0.5, 0.5), rnd(-1.2, -0.2), rnd(220, 420),
            Math.random() < 0.5 ? 2 : 1.5, PAL.fire, true, 0);
          p.drag = 2;
          if (Math.random() < 0.3) {
            p = spawn(x, y, rnd(-0.2, 0.2), rnd(-0.8, -0.3), rnd(400, 700), 2, PAL.smoke, false, 2);
            p.grow = 3; p.alpha = 0.5;
          }
          break;
        case "bolt":
          p = spawn(x + rnd(-0.06, 0.06), y + rnd(-0.06, 0.06), rnd(-0.4, 0.4), rnd(-0.4, 0.4), rnd(180, 320),
            1.5, PAL.bolt, true, Math.random() < 0.3 ? 1 : 0);
          break;
        default:
          p = spawn(x + rnd(-0.1, 0.1), y + rnd(-0.1, 0.1), rnd(-0.5, 0.5), rnd(-0.5, 0.5), rnd(200, 380),
            Math.random() < 0.5 ? 1.5 : 1, PAL.magic, true, Math.random() < 0.4 ? 1 : 0);
      }
    }
  }

  // ---------------------------------------------------------------- drawing helpers
  var V_ox = 0, V_oy = 0, V_cs = 16, V_ap = 1; // current view (ap = device px per art pixel)
  function setView(view) {
    V_ox = view.ox || 0; V_oy = view.oy || 0; V_cs = view.cs || 16; V_ap = V_cs / ART;
  }
  // snapped screen coords of an art-pixel cell containing world point
  function sx(x) { return Math.round(V_ox + Math.floor(x * ART) * V_ap); }
  function sy(y) { return Math.round(V_oy + Math.floor(y * ART) * V_ap); }
  function px(ctx, x, y, n) { // square of n art px centred on world point
    var sz = Math.max(1, Math.round(n * V_ap));
    var h = (n * 0.5) / ART;
    ctx.fillRect(sx(x - h), sy(y - h), sz, sz);
  }

  function drawParticles(ctx, additive) {
    for (var i = 0; i < np; i++) {
      var p = P[i];
      if (p.add !== additive) continue;
      var t = p.life / p.max; // 1 -> 0
      var pal = p.pal;
      var ci = Math.min(pal.length - 1, ((1 - t) * pal.length) | 0);
      ctx.fillStyle = pal[ci];
      var a = t < 0.35 ? t / 0.35 : 1;
      var size = p.size;
      if (p.shape === 2) { // smoke
        ctx.globalAlpha = a * p.alpha;
        px(ctx, p.x, p.y, Math.round(size));
        continue;
      }
      if (p.shape !== 0 || additive) size = size * (0.5 + 0.5 * t);
      if (p.shape === 1) { // twinkle plus
        var tw = 0.55 + 0.45 * Math.sin(p.ph + clock * 0.025);
        ctx.globalAlpha = a * tw;
        var arm = Math.max(1, Math.round(size));
        var u = 1 / ART;
        px(ctx, p.x, p.y, arm);
        if (tw > 0.5) {
          px(ctx, p.x - u * arm, p.y, arm); px(ctx, p.x + u * arm, p.y, arm);
          px(ctx, p.x, p.y - u * arm, arm); px(ctx, p.x, p.y + u * arm, arm);
        }
        continue;
      }
      ctx.globalAlpha = a;
      var n = Math.max(1, Math.round(size));
      if (p.shape === 3) { // droplet: draw a short streak along velocity
        px(ctx, p.x, p.y, n);
        var sp = Math.abs(p.vx) + Math.abs(p.vy);
        if (sp > 2) px(ctx, p.x - p.vx * 0.012, p.y - p.vy * 0.012, n);
      } else px(ctx, p.x, p.y, n);
    }
    ctx.globalAlpha = 1;
  }

  // crisp pixel ring / disk
  function drawRing(ctx, r) {
    var t = r.t / r.dur;
    var e = 1 - Math.pow(1 - t, 3); // ease-out
    var rad = r.r0 + (r.r - r.r0) * e;
    var pal = r.pal;
    var R = rad * ART; // art px
    if (r.fill) {
      ctx.fillStyle = pal[Math.min(pal.length - 1, (pal.length > 2 ? 1 : 0) + ((t * 2) | 0))]; // saturated, fade by alpha
      ctx.globalAlpha = (1 - t) * 0.85;
      R = r.r * ART * (0.55 + 0.45 * e);
      var Ri = Math.ceil(R);
      var cx = Math.floor(r.x * ART), cy = Math.floor(r.y * ART);
      for (var dy = -Ri; dy <= Ri; dy++) {
        var hw = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)));
        if (hw <= 0 && dy !== 0) continue;
        ctx.fillRect(Math.round(V_ox + (cx - hw) * V_ap), Math.round(V_oy + (cy + dy) * V_ap),
          Math.round((hw * 2 + 1) * V_ap), Math.max(1, Math.round(V_ap)));
      }
      return;
    }
    ctx.fillStyle = pal[Math.min(pal.length - 1, (t * 2.5) | 0)];
    ctx.globalAlpha = 1 - t * t;
    var w = Math.max(1, Math.round(r.width * (1 - t * 0.6)));
    var steps = Math.max(8, Math.ceil(6.283 * R * 1.1));
    var sz = Math.max(1, Math.round(V_ap * w));
    var cxw = Math.floor(r.x * ART) + 0.5, cyw = Math.floor(r.y * ART) + 0.5;
    for (var i = 0; i < steps; i++) {
      var a = (i / steps) * 6.283;
      var ax = Math.floor(cxw + Math.cos(a) * R - w * 0.5);
      var ay = Math.floor(cyw + Math.sin(a) * R - w * 0.5);
      ctx.fillRect(Math.round(V_ox + ax * V_ap), Math.round(V_oy + ay * V_ap), sz, sz);
    }
  }

  // rasterised line in art pixels
  function line(ctx, x0, y0, x1, y1, w) {
    var dx = x1 - x0, dy = y1 - y0;
    var n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * ART));
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      px(ctx, x0 + dx * t, y0 + dy * t, w);
    }
  }

  function drawBolt(ctx, b) {
    var t = b.t / b.dur;
    var flick = (((b.t / 30) | 0) % 3 === 2) ? 0.35 : 1;
    var a = (1 - t * t) * flick;
    var pts = b.pts, n = b.n;
    // outer glow
    ctx.globalAlpha = a * 0.55; ctx.fillStyle = "#6a6aff";
    for (var i = 0; i < n; i++) line(ctx, pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3], 4);
    ctx.globalAlpha = a; ctx.fillStyle = "#9fd8ff";
    for (i = 0; i < n; i++) line(ctx, pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3], 2);
    ctx.fillStyle = "#ffffff";
    for (i = 0; i < n; i++) line(ctx, pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3], 1);
    if (b.fork > 0) {
      var fx = pts[b.fork * 2], fy = pts[b.fork * 2 + 1];
      var mx = fx + Math.cos(b.fa) * b.fl * 0.5 + rnd(-0.1, 0.1), my = fy + Math.sin(b.fa) * b.fl * 0.5 + rnd(-0.1, 0.1);
      var ex = fx + Math.cos(b.fa) * b.fl, ey = fy + Math.sin(b.fa) * b.fl;
      ctx.globalAlpha = a * 0.8; ctx.fillStyle = "#9fd8ff";
      line(ctx, fx, fy, mx, my, 1); line(ctx, mx, my, ex, ey, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawBeam(ctx, b) {
    var t = b.t / b.dur;
    var a = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    var wArt = Math.round(16 * (t < 0.15 ? 0.4 + 4 * t : 1 - 0.7 * (t - 0.15)));
    var top = b.y - 6, bottom = b.y + 0.35;
    var cx = Math.floor(b.x * ART);
    var x0, wpx;
    var yTop = Math.round(V_oy + top * ART * V_ap), yBot = Math.round(V_oy + bottom * ART * V_ap);
    // three nested columns
    var layers = [[1.0, "#f0a828", 0.6], [0.6, "#ffd84a", 0.85], [0.28, "#ffffff", 1]];
    for (var i = 0; i < 3; i++) {
      var lw = Math.max(1, Math.round(wArt * layers[i][0]));
      x0 = Math.round(V_ox + (cx - (lw >> 1)) * V_ap);
      wpx = Math.round(lw * V_ap);
      ctx.fillStyle = layers[i][1];
      // fade towards the top in 6 bands
      for (var k = 0; k < 6; k++) {
        var y0 = yTop + ((yBot - yTop) * k / 6) | 0, y1 = yTop + ((yBot - yTop) * (k + 1) / 6) | 0;
        ctx.globalAlpha = a * layers[i][2] * Math.min(1, (k + 1.5) / 5);
        ctx.fillRect(x0, y0, wpx, y1 - y0);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawProjectile(ctx, p) {
    var x = p.x, y = p.y, spr;
    if (p.kind === "arrow" || p.kind === "bolt") {
      spr = sprites[p.kind];
      if (spr && spr.length !== undefined && typeof spr !== "string") spr = spr[((clock / 90) | 0) % spr.length];
      if (spr && spr.width) {
        var wd = spr.width * V_ap, ht = spr.height * V_ap;
        var scx = V_ox + x * V_cs, scy = V_oy + y * V_cs;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (p.kind === "bolt") {
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = "#b45cff";
          ringDisk(ctx, x, y, 6);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.translate(Math.round(scx), Math.round(scy));
        ctx.rotate(p.ang);
        ctx.drawImage(spr, Math.round(-wd / 2), Math.round(-ht / 2), Math.round(wd), Math.round(ht));
        ctx.restore();
        return;
      }
    }
    var ca = Math.cos(p.ang), sa = Math.sin(p.ang), u = 1 / ART;
    switch (p.kind) {
      case "arrow": {
        // shaft
        ctx.fillStyle = "#1a1a24";
        line(ctx, x - ca * 6 * u, y - sa * 6 * u, x + ca * 5 * u, y + sa * 5 * u, 2);
        ctx.fillStyle = "#a07a4a";
        line(ctx, x - ca * 5 * u, y - sa * 5 * u, x + ca * 4 * u, y + sa * 4 * u, 1);
        ctx.fillStyle = "#e8e8f0"; // head
        px(ctx, x + ca * 5 * u, y + sa * 5 * u, 2);
        ctx.fillStyle = "#ffffff";
        px(ctx, x - ca * 6 * u - sa * u, y - sa * 6 * u + ca * u, 1); // fletching
        px(ctx, x - ca * 6 * u + sa * u, y - sa * 6 * u - ca * u, 1);
        break;
      }
      case "fireball": {
        ctx.globalCompositeOperation = "lighter";
        var pul = 1 + 0.15 * Math.sin(clock * 0.05);
        ctx.globalAlpha = 0.3; ctx.fillStyle = "#ff6a1e"; ringDisk(ctx, x, y, 8 * pul);
        ctx.globalAlpha = 0.9; ctx.fillStyle = "#ffb53a"; ringDisk(ctx, x, y, 4.5 * pul);
        ctx.globalAlpha = 1; ctx.fillStyle = "#fff6c0"; ringDisk(ctx, x + ca * u, y + sa * u, 2.5);
        ctx.globalCompositeOperation = "source-over";
        break;
      }
      case "bolt": {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.35; ctx.fillStyle = "#7a2ad8"; ringDisk(ctx, x, y, 6);
        ctx.globalAlpha = 1; ctx.fillStyle = "#b45cff";
        line(ctx, x - ca * 5 * u, y - sa * 5 * u, x + ca * 3 * u, y + sa * 3 * u, 3);
        ctx.fillStyle = "#ffffff"; px(ctx, x + ca * 2 * u, y + sa * 2 * u, 2);
        ctx.globalCompositeOperation = "source-over";
        break;
      }
      default: {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.35; ctx.fillStyle = "#2a9ad8"; ringDisk(ctx, x, y, 6);
        ctx.globalAlpha = 1; ctx.fillStyle = "#4ae8d0"; ringDisk(ctx, x, y, 3);
        ctx.fillStyle = "#ffffff";
        var spin = clock * 0.02;
        px(ctx, x, y, 2);
        px(ctx, x + Math.cos(spin) * 4 * u, y + Math.sin(spin) * 4 * u, 1);
        px(ctx, x - Math.cos(spin) * 4 * u, y - Math.sin(spin) * 4 * u, 1);
        ctx.globalCompositeOperation = "source-over";
      }
    }
    ctx.globalAlpha = 1;
  }
  // filled pixel disk, radius in art px
  function ringDisk(ctx, x, y, R) {
    var Ri = Math.ceil(R), cx = Math.floor(x * ART), cy = Math.floor(y * ART);
    var h = Math.max(1, Math.round(V_ap));
    for (var dy = -Ri; dy <= Ri; dy++) {
      var hw = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)));
      if (hw <= 0 && Math.abs(dy) > 0) continue;
      ctx.fillRect(Math.round(V_ox + (cx - hw) * V_ap), Math.round(V_oy + (cy + dy) * V_ap), Math.round((hw * 2 + 1) * V_ap), h);
    }
  }

  var FONT = '"Press Start 2P", "Silkscreen", "VT323", ui-monospace, Menlo, Consolas, monospace';
  var OUT = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, 2], [1, 2], [-1, 2]];
  function drawTexts(ctx, view) {
    if (!texts.length) return;
    var dpr = view.dpr || 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var i = 0; i < texts.length; i++) {
      var o = texts[i];
      var t = o.t / o.dur;
      var base = Math.max(11 * dpr, V_cs * (o.big ? 0.42 : 0.55));
      var pop = t < 0.08 ? 1.5 - (t / 0.08) * 0.5 : 1; // pop in
      var fs = Math.round(base * pop);
      ctx.font = "bold " + fs + "px " + FONT;
      var rise = 1 - Math.pow(1 - Math.min(1, t * 1.6), 3);
      var yy = o.y - rise * (o.big ? 1.0 : 0.85);
      var X = Math.round(V_ox + o.x * V_cs), Y = Math.round(V_oy + yy * V_cs);
      ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      var ow = Math.max(1, Math.round(fs / 9));
      ctx.fillStyle = "#14101c";
      for (var k = 0; k < OUT.length; k++) ctx.fillText(o.text, X + OUT[k][0] * ow, Y + OUT[k][1] * ow);
      ctx.fillStyle = o.color;
      ctx.fillText(o.text, X, Y);
      // top highlight flash on spawn
      if (t < 0.1) { ctx.globalAlpha = 1 - t / 0.1; ctx.fillStyle = "#ffffff"; ctx.fillText(o.text, X, Y); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- public: draw
  function draw(ctx, view) {
    setView(view);
    var prevComp = ctx.globalCompositeOperation;
    var prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    // 1. normal-blend stuff: smoke, blood, debris
    ctx.globalCompositeOperation = "source-over";
    drawParticles(ctx, false);
    // 2. additive: rings, beams, glow particles, lightning
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < beams.length; i++) drawBeam(ctx, beams[i]);
    for (i = 0; i < rings.length; i++) { if (rings[i].add) drawRing(ctx, rings[i]); }
    drawParticles(ctx, true);
    for (i = 0; i < bolts.length; i++) drawBolt(ctx, bolts[i]);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    for (i = 0; i < rings.length; i++) { if (!rings[i].add) drawRing(ctx, rings[i]); }
    ctx.globalAlpha = 1;
    // 3. projectiles on top
    for (i = 0; i < projs.length; i++) if (!projs[i].done) drawProjectile(ctx, projs[i]);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    // 4. floating text above everything world-space
    drawTexts(ctx, view);
    ctx.globalCompositeOperation = prevComp;
    ctx.imageSmoothingEnabled = prevSmooth;
  }

  function drawOverlay(ctx, view, w, h) {
    if (hurt <= 0 && flash <= 0) return;
    var prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "source-over";
    if (hurt > 0) {
      // stepped (banded) red vignette: pixel-friendly, no gradients or blur
      var a = hurt * (reduced ? 0.45 : 1);
      var band = Math.max(4, Math.round(Math.min(w, h) * 0.035));
      var bands = 6;
      for (var i = 0; i < bands; i++) {
        var f = 1 - i / bands;
        ctx.globalAlpha = a * f * f * 0.55;
        ctx.fillStyle = i < 2 ? "#ff1a2e" : "#d0102a";
        var o = i * band;
        ctx.fillRect(o, o, w - 2 * o, band);              // top
        ctx.fillRect(o, h - o - band, w - 2 * o, band);   // bottom
        ctx.fillRect(o, o + band, band, h - 2 * o - 2 * band);        // left
        ctx.fillRect(w - o - band, o + band, band, h - 2 * o - 2 * band); // right
      }
    }
    if (flash > 0) {
      ctx.globalAlpha = Math.min(1, flash * flash) * (reduced ? 0.25 : 0.7);
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }

  function clear() {
    var pending = [];
    for (var i = 0; i < projs.length; i++) if (projs[i].cb) { pending.push(projs[i].cb); projs[i].cb = null; projs[i].done = true; }
    projs.length = 0;
    np = 0;
    texts.length = 0; rings.length = 0; beams.length = 0; bolts.length = 0;
    trauma = 0; shX = 0; shY = 0; hurt = 0; flash = 0;
    for (var j = 0; j < pending.length; j++) fire(pending[j]);
  }

  function setSprites(map) {
    sprites = {};
    if (!map) return;
    for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) {
      var v = map[k];
      if (!v) continue;
      sprites[k] = Array.isArray(v) ? v.filter(Boolean) : v;
      if (Array.isArray(sprites[k]) && !sprites[k].length) delete sprites[k];
    }
  }

  return {
    update: update,
    draw: draw,
    drawOverlay: drawOverlay,
    shake: shake,
    shakeOffset: shakeOffset,
    damageNumber: damageNumber,
    burst: burst,
    blood: blood,
    sparkle: sparkle,
    projectile: projectile,
    explosion: explosion,
    lightning: lightning,
    ring: publicRing,
    hurtFlash: hurtFlash,
    levelUp: levelUp,
    clear: clear,
    busy: busy,
    setSprites: setSprites,
    _count: function () { return { particles: np, texts: texts.length, rings: rings.length, projectiles: projs.length }; }
  };
})();
