// art_items.js - procedural pixel art: pickups, projectiles, icons, floor tiles, props.
// Everything is drawn into small char/CSS-colour grids, then rendered 1:1 to canvases.
// Solid pixels get an automatic 1px outline (#484241) on transparent neighbours (inside the canvas);
// 'rgba(...)' cells and digit palette chars (flame/glow/blood) never generate outline.
const ARTI = (() => {
  const OUT = '#484241';
  const PAL = {
    o: OUT, k: '#2a2630', w: '#f2f2f0',
    g: '#a6c95a', G: '#76a043', h: '#4f7432',
    s: '#9be57f', S: '#5cbf55', z: '#368a46', Z: '#256a38',
    b: '#c08a5c', B: '#94603f', n: '#5e3b2a',
    p: '#a77cc8', P: '#7a4f9c', u: '#4f3070', U: '#2b1a3c',
    l: '#dcdae4', m: '#b0adbd', M: '#827f90', d: '#5c5966',
    r: '#f25050', R: '#b83a40', x: '#7c1f2c', X: '#531624',
    y: '#ffe27a', Y: '#e5ad35', a: '#a8692a',
    c: '#8fd4ff', C: '#4a8ee0', v: '#2c56a8',
    i: '#b4ff6a', I: '#4fd04a', j: '#2e8c3a',
    t: '#f6e8c4', T: '#dcc08e', A: '#a8885a',
    W: '#d7d4c0', V: '#a29f8c',
    H: '#98a0b8', J: '#737a92', K: '#545a72', D: '#3c4156', N: '#b4bdd6',
    O: '#ff8a24', F: '#ffd04a', Q: '#2c3042',
    '1': '#fff7c0', '2': '#ffd04a', '3': '#ff8a24', '4': '#d0421e',
    '8': '#5a121c', '9': '#7e1c26', '0': '#9a2a30',
  };
  const NOOUT = new Set('1234567890+*'.split(''));

  // ---- grid toolkit -------------------------------------------------------
  function mk(w, h) {
    const c = [];
    for (let y = 0; y < h; y++) c.push(new Array(w).fill('.'));
    return { w, h, c };
  }
  function p(g, x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.c[y][x] = c; }
  function get(g, x, y) { return (x >= 0 && y >= 0 && x < g.w && y < g.h) ? g.c[y][x] : '.'; }
  function rect(g, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p(g, x + i, y + j, c); }
  function line(g, x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) p(g, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c);
  }
  // fn(x,y,dx,dy,d) -> colour or null, for pixels inside the ellipse
  function disc(g, cx, cy, rx, ry, fn) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry, d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 1) { const c = fn(x, y, dx, dy, d); if (c) p(g, x, y, c); }
      }
  }
  function stamp(g, rows, ox, oy, map) {
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { let ch = r[i]; if (ch === '.') continue; if (map && map[ch]) ch = map[ch]; p(g, ox + i, oy + j, ch); } });
  }
  function stampGrid(g, s, ox, oy) {
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) if (s.c[j][i] !== '.') p(g, ox + i, oy + j, s.c[j][i]);
  }
  function rot90(s) {
    const r = mk(s.h, s.w);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) r.c[x][s.h - 1 - y] = s.c[y][x];
    return r;
  }
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const solid = c => c !== '.' && !NOOUT.has(c) && !String(c).startsWith('rgba');

  function draw(g, opt) {
    opt = opt || {};
    const cv = document.createElement('canvas');
    cv.width = g.w; cv.height = g.h;
    const cx = cv.getContext('2d');
    const cells = g.c.map(r => r.slice());
    if (opt.outline !== false) {
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        if (g.c[y][x] !== '.') continue;
        if (solid(get(g, x - 1, y)) || solid(get(g, x + 1, y)) || solid(get(g, x, y - 1)) || solid(get(g, x, y + 1))) cells[y][x] = 'o';
      }
    }
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const c = cells[y][x];
      if (c === '.') continue;
      cx.fillStyle = PAL[c] || c;
      cx.fillRect(x, y, 1, 1);
    }
    return cv;
  }
  const O0 = { outline: false };
  function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const rgba = (r, g, b, a) => 'rgba(' + r + ',' + g + ',' + b + ',' + Math.max(0, Math.min(1, a)).toFixed(2) + ')';

  // ---- flame (digit palette, no outline) ----------------------------------
  function flame(g, cx, baseY, h, wmax, sway, seed) {
    const r = rng(seed || 1);
    for (let y = baseY; y > baseY - h; y--) {
      const t = (baseY - y) / h;
      const hw = wmax * Math.pow(1 - t, 0.75);
      const c0 = cx + sway * t * t;
      for (let x = Math.floor(c0 - hw - 1); x <= Math.ceil(c0 + hw + 1); x++) {
        const off = Math.abs(x - c0);
        if (off > hw + 0.15) continue;
        const d = off / Math.max(hw, 0.6);
        let c = '3';
        if (t < 0.4 && d < 0.5) c = '1';
        else if (t < 0.75 && d < 0.6) c = '2';
        else if (d > 0.82 || t > 0.8) c = r() < 0.5 ? '4' : '3';
        p(g, x, y, c);
      }
    }
  }

  // ---- GEMS ---------------------------------------------------------------
  function gem(size, shape, cols, frame) {
    const g = mk(size, size);
    const cx = (size - 1) / 2, cy = (size - 1) / 2, r = (size - 2) / 2;
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      const u = (x - cx) / r, v = (y - cy) / r;
      let inside;
      if (shape === 'dia') inside = Math.abs(u) + Math.abs(v) <= 1.12;
      else if (shape === 'hex') inside = Math.abs(u) <= 1 && Math.abs(v) <= 1 && Math.abs(u) + Math.abs(v) <= 1.6;
      else inside = Math.abs(u) * 1.15 + Math.abs(v) <= 1.12;
      if (!inside) continue;
      let c;
      if (v < -0.15 && u < 0.15) c = cols.l;
      else if (v < -0.15) c = cols.m;
      else if (u < -0.05) c = cols.m;
      else c = cols.d;
      if (Math.abs(u) < 0.2 && v < 0.1 && v > -0.9) c = cols.l;   // vertical top facet
      if (v > 0.75 || u > 0.75 + 0.0 && v > 0) c = cols.d;
      p(g, x, y, c);
    }
    // facet lines
    if (size >= 9) {
      const fl = cols.f;
      p(g, cx, cy + 1, fl);
      for (let i = 0; i < 3; i++) { p(g, cx - 1 - i * 0, cy - 1 + 0, cols.l); }
    }
    // highlight + sparkle
    const hx = Math.round(cx - r * 0.35), hy = Math.round(cy - r * 0.45);
    p(g, hx, hy, 'w');
    if (size >= 9) p(g, hx + 1, hy, cols.h);
    if (frame === 1) {
      p(g, hx, hy, cols.h);
      p(g, hx + 1, hy + 1, 'w');
      const sx = size - 2, sy = 1;
      const sp = 'rgba(255,255,255,0.95)';
      p(g, sx, sy, sp);
      p(g, sx - 1, sy, 'rgba(255,255,255,0.55)'); p(g, sx + 1, sy, 'rgba(255,255,255,0.55)');
      p(g, sx, sy - 1, 'rgba(255,255,255,0.55)'); p(g, sx, sy + 1, 'rgba(255,255,255,0.55)');
    }
    return draw(g);
  }
  const GEMB = { h: '#e8fbff', l: '#9ee4ff', m: '#4aa8f0', d: '#2a5fc4', f: '#d0f2ff' };
  const GEMG = { h: '#eaffd8', l: '#b4ff6a', m: '#4fd04a', d: '#238a3c', f: '#e2ffc0' };
  const GEMR = { h: '#ffe0e0', l: '#ff8a8a', m: '#e83a46', d: '#8c1a2c', f: '#ffc0c0' };

  // ---- COIN ---------------------------------------------------------------
  function coin(frame) {
    const g = mk(8, 8);
    const hws = [2.9, 1.9, 0.9, 1.9];
    const hw = hws[frame];
    for (let y = 1; y <= 6; y++) {
      const dy = (y - 3.5) / 3;
      const w = hw * Math.sqrt(Math.max(0, 1 - dy * dy)) + 0.3;
      for (let x = Math.ceil(3.5 - w); x <= Math.floor(3.5 + w); x++) {
        let c = 'y';
        const edgeL = x === Math.ceil(3.5 - w), edgeR = x === Math.floor(3.5 + w);
        if (edgeR || y === 6) c = 'a'; else if (edgeL || y === 1) c = 'Y';
        else if (hw > 2 && x === 3 && y === 3) c = 'Y';   // emboss
        else if (hw > 2 && x === 4 && y === 4) c = 'Y';
        else if (x < 3.5 && y < 3.5) c = 'y';
        p(g, x, y, c);
      }
    }
    if (hw > 2.5) { p(g, 2, 2, 'w'); }
    if (hw > 1.5 && hw < 2.5) { p(g, 3 - (frame === 3 ? 0 : 0), 2, 'w'); }
    if (frame === 2) { for (let y = 2; y <= 5; y++) { p(g, 3, y, 'Y'); p(g, 4, y, 'a'); } }
    return draw(g);
  }

  // ---- ROAST --------------------------------------------------------------
  function roast() {
    const g = mk(12, 10);
    stamp(g, [
      '..bbbbB...',
      '.bbbaBBBB.',
      'bbaaBBBBBn',
      'bbaBBBBBnn',
      'bBBBBBBBnn',
      '.BBBBBBnn.',
      '..nBBnnn.W',
      '....nn..WT',
      '.......WWV',
    ], 1, 1);
    // bone knob end + shaft
    p(g, 8, 8, 'W'); p(g, 10, 8, 'W');
    // highlights on the glaze
    p(g, 3, 2, 'y'); p(g, 4, 2, 'T'); p(g, 3, 3, 'T');
    return draw(g);
  }

  // ---- MAGNET -------------------------------------------------------------
  function magnetGrid() {
    const g = mk(10, 10);
    const cx = 4.5, cy = 5;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      const leg = (x <= 2 || x >= 7) && y <= 5;
      const arc = y >= 5 && d <= 4.9 && d >= 2.3;
      const inHole = x >= 3 && x <= 6 && y <= 5 && d < 2.4;
      if ((leg || arc) && !inHole && !(y >= 5 && d > 4.9)) {
        let c;
        const left = x < cx;
        if (y <= 2) c = (x <= 2 ? (x === 0 ? 'l' : 'm') : (x === 7 ? 'm' : 'M'));       // silver tips
        else c = left ? (x <= 1 || d > 4 ? 'r' : 'R') : (d > 4 || x >= 8 ? 'x' : 'R');
        if (y > 2 && left && (x === 0 || (y > 5 && d > 3.9 && dx < -1.5))) c = 'r';
        p(g, x, y, c);
      }
    }
    p(g, 0, 3, 'w'); p(g, 0, 4, 'r'); p(g, 1, 7, 'r');
    p(g, 0, 0, 'w');
    return g;
  }
  function magnet() { const g = mk(12, 12); stampGrid(g, magnetGrid(), 1, 1); return draw(g); }

  // ---- BOMB ---------------------------------------------------------------
  function bomb(frame) {
    const g = mk(12, 12);
    const cx = 5.5, cy = 7;
    disc(g, cx, cy, 4.1, 3.9, (x, y, dx, dy, d) => {
      const lx = dx + 0.35, ly = dy + 0.35;
      const l = Math.sqrt(lx * lx + ly * ly);
      if (l < 0.28) return '#cfcfe0';
      if (dx < -0.2 && dy < -0.2 && d > 0.45 && d < 0.85) return '#6e6a7d';
      if (d > 0.72 && dx + dy > 0.4) return '#1c1822';
      return dx + dy > 0.15 ? '#2a2630' : '#3b3745';
    });
    p(g, 3, 5, '#e8e8f4'); p(g, 4, 4, '#9a96ab');
    // cap
    rect(g, 5, 2, 3, 1, 'M'); rect(g, 5, 3, 3, 1, 'd');
    // fuse
    p(g, 7, 2, 'A'); p(g, 8, 1, 'A'); p(g, 8, 0, 'T');
    if (frame === 0) { p(g, 9, 0, '1'); p(g, 9, 1, '2'); p(g, 10, 1, '3'); p(g, 8, 0, '2'); p(g, 10, 0, '4'); }
    else { p(g, 9, 1, '1'); p(g, 9, 0, '2'); p(g, 10, 0, '3'); p(g, 10, 1, '2'); p(g, 8, 0, '3'); p(g, 11, 1, '4'); }
    return draw(g);
  }

  // ---- CHEST --------------------------------------------------------------
  function chest(open) {
    const g = mk(16, 14);
    const X = 1;
    if (!open) {
      // lid
      rect(g, X + 1, 1, 12, 1, 'B');
      rect(g, X, 2, 14, 4, 'B');
      rect(g, X + 1, 1, 12, 1, 'b');
      rect(g, X, 2, 14, 1, 'b');
      for (let x = 0; x < 14; x++) p(g, X + x, 5, 'n');
      p(g, X, 5, 'B');
      // body
      rect(g, X, 6, 14, 6, 'B');
      rect(g, X, 6, 14, 1, 'b');
      rect(g, X + 13, 6, 1, 6, 'n');
      rect(g, X, 11, 14, 1, 'n');
      // wood grain
      for (let x = 3; x < 12; x += 3) { p(g, X + x, 8, 'n'); p(g, X + x + 1, 9, 'n'); }
      // gold bands
      for (const bx of [X + 2, X + 10]) { rect(g, bx, 1, 2, 11, 'Y'); rect(g, bx, 1, 1, 11, 'y'); }
      rect(g, X + 1, 5, 12, 1, 'Y'); rect(g, X + 1, 5, 12, 1, 'Y');
      for (let x = 1; x < 13; x++) p(g, X + x, 5, x < 6 ? 'y' : 'Y');
      // corner studs
      p(g, X, 2, 'Y'); p(g, X + 13, 2, 'a'); p(g, X, 11, 'Y'); p(g, X + 13, 11, 'a');
      // lock
      rect(g, X + 6, 4, 2, 4, 'y'); rect(g, X + 5, 5, 4, 2, 'y'); rect(g, X + 8, 5, 1, 2, 'Y');
      rect(g, X + 5, 7, 4, 1, 'Y');
      p(g, X + 6, 6, 'k'); p(g, X + 7, 6, 'k'); p(g, X + 7, 7, 'k');
      p(g, X + 5, 5, 'w');
      // sparkle
      p(g, X + 3, 2, 'w');
    } else {
      // raised lid (seen from the front, back panel)
      rect(g, X + 1, 0, 12, 1, 'b');
      rect(g, X, 1, 14, 3, 'B');
      rect(g, X + 1, 3, 12, 1, 'n');
      rect(g, X + 1, 0, 12, 1, 'b'); rect(g, X, 1, 14, 1, 'b');
      rect(g, X + 13, 1, 1, 3, 'n');
      for (const bx of [X + 2, X + 10]) { rect(g, bx, 0, 2, 4, 'Y'); rect(g, bx, 0, 1, 4, 'y'); }
      // interior + gold hoard
      rect(g, X + 1, 4, 12, 3, 'n');
      rect(g, X + 1, 4, 12, 1, 'a');
      stamp(g, ['..yyY.yyyy.Y..', '.yyyyyyyyyyyy.'], X, 4);
      p(g, X + 4, 4, 'w'); p(g, X + 8, 4, 'w'); p(g, X + 6, 3, 'y');
      for (let x = 2; x < 12; x += 2) p(g, X + x, 6, 'Y');
      // front face
      rect(g, X, 7, 14, 5, 'B');
      rect(g, X, 7, 14, 1, 'Y'); for (let x = 0; x < 14; x++) p(g, X + x, 7, x < 7 ? 'y' : 'Y');
      rect(g, X + 13, 8, 1, 4, 'n');
      rect(g, X, 11, 14, 1, 'n');
      for (let x = 3; x < 12; x += 3) p(g, X + x, 9, 'n');
      for (const bx of [X + 2, X + 10]) { rect(g, bx, 7, 2, 5, 'Y'); rect(g, bx, 7, 1, 5, 'y'); }
      rect(g, X + 6, 8, 2, 2, 'y'); p(g, X + 7, 9, 'Y'); p(g, X + 6, 8, 'w');
      // sparkles
      p(g, X + 1, 3, 'rgba(255,255,255,0.9)'); p(g, X + 12, 4, 'rgba(255,255,255,0.9)');
    }
    return draw(g);
  }

  // ---- PROJECTILES --------------------------------------------------------
  function knife() {
    const g = mk(10, 4);
    stamp(g, ['nBYwlllw', 'nBYmmmM.'], 1, 1);
    return draw(g);
  }
  function orb(frame) {
    const g = mk(8, 8);
    const cx = 3.5, cy = 3.5, pul = frame ? 0.35 : 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const d = Math.hypot(x - cx, y - cy) - pul * 0.6;
      let c = null;
      if (d < 1.0) c = '#ffffff';
      else if (d < 1.9) c = '#c4f8ff';
      else if (d < 2.6 + pul) c = '#74b8ff';
      else if (d < 3.3 + pul) c = 'rgba(150,100,255,0.75)';
      else if (d < 4.2) c = 'rgba(120,80,255,0.28)';
      if (c) p(g, x, y, c);
    }
    if (frame) { p(g, 6, 1, 'rgba(255,255,255,0.8)'); p(g, 1, 6, 'rgba(200,240,255,0.8)'); }
    else { p(g, 1, 1, 'rgba(255,255,255,0.7)'); p(g, 6, 6, 'rgba(200,240,255,0.7)'); }
    return draw(g, O0);
  }
  function axeBase() {
    const g = mk(12, 12);
    // handle (top-right head, bottom-left grip)
    for (let t = 0; t <= 8; t++) { p(g, 1 + t, 10 - t, 'B'); }
    for (let t = 0; t <= 6; t++) { p(g, 1 + t, 11 - t, 'n'); }
    p(g, 0, 11, 'n'); p(g, 1, 10, 'a'); p(g, 2, 9, 'b');
    // head: crescent
    disc(g, 8, 3.6, 4.2, 4.0, (x, y, dx, dy, d) => {
      const hole = Math.hypot(x - 5.6, y - 6.4);
      if (hole < 3.1) return null;
      if (d > 0.75 && dx + dy < 0.4) return 'w';
      if (d > 0.7) return 'l';
      if (hole < 3.9) return 'M';
      return dx + dy < -0.1 ? 'l' : 'm';
    });
    // handle over the head hub
    p(g, 7, 4, 'B'); p(g, 8, 3, 'B'); p(g, 6, 5, 'B');
    p(g, 8, 4, 'Y'); p(g, 7, 5, 'Y');
    return g;
  }
  function axe(frame) {
    let s = axeBase();
    for (let i = 0; i < frame; i++) s = rot90(s);
    const g = mk(14, 14);
    stampGrid(g, s, 1, 1);
    return draw(g);
  }
  const SKULL_ROWS = [
    '..tttt..',
    '.ttttttT',
    'tttttttT',
    'tkkttkkT',
    'tkittkiT',
    '.ttkkTT.',
    '..tttT..',
    '..tTtT..',
  ];
  function skull(frame) {
    const g = mk(10, 10);
    const rows = SKULL_ROWS.slice();
    if (frame === 1) { rows[3] = 'tkkttkkT'; rows[4] = 'tkIttkIT'; rows[7] = '..t.tT..'; }
    stamp(g, rows, 1, 1);
    // glow pixels in the outline ring
    const gl = frame ? 'rgba(150,255,120,0.55)' : 'rgba(150,255,120,0.4)';
    p(g, 0, 4, gl); p(g, 9, 4, gl); p(g, 4, 0, gl); p(g, 5, 0, gl); p(g, 4, 9, gl);
    p(g, 2, 4 + 1, 'i'); p(g, 6, 4 + 1, 'i');
    return draw(g);
  }
  function fireball(frame) {
    const g = mk(12, 12);
    const r = rng(11 + frame * 7);
    const cx = 7.2, cy = 5.5;
    const wob = [0, 0.5, -0.4][frame];
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const u = x - cx, v = y - (cy + (u < 0 ? wob * (-u) / 4 : 0));
      const dd = u < 0 ? Math.hypot(u / 2.3, v * 1.25) : Math.hypot(u, v);
      const jit = (r() - 0.5) * 0.9;
      const d = dd * 1.0 + jit * (dd > 2 ? 1 : 0.2);
      let c = null;
      if (d < 1.2) c = '1';
      else if (d < 2.3) c = '2';
      else if (d < 3.3) c = '3';
      else if (d < 3.9) c = '4';
      if (c) p(g, x, y, c);
    }
    // embers
    p(g, 1 + frame, 5 + (frame % 2 ? 2 : -2), 'rgba(255,140,40,0.8)');
    p(g, 0 + frame * 2, 4 + frame, 'rgba(255,200,80,0.6)');
    return draw(g, O0);
  }
  function slash(frame) {
    const g = mk(28, 28);
    const A = { x: 10.5, y: 13.5, r: 13.2 };
    const B = [{ x: 3.5, r: 12.4 }, { x: 5.8, r: 12.6 }, { x: 8.0, r: 12.8 }][frame];
    const mul = [1, 0.7, 0.4][frame];
    for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
      const da = A.r - Math.hypot(x - A.x, y - A.y);
      const db = Math.hypot(x - B.x, y - A.y) - B.r;
      const depth = Math.min(da, db);
      if (depth < 0) continue;
      let c;
      if (depth > 2.6) c = rgba(255, 255, 255, 0.95 * mul);
      else if (depth > 1.4) c = rgba(225, 250, 255, 0.85 * mul);
      else if (depth > 0.6) c = rgba(150, 225, 255, 0.65 * mul);
      else c = rgba(100, 190, 255, 0.4 * mul);
      p(g, x, y, c);
    }
    // speed ticks
    if (frame < 2) { p(g, 3, 8 + frame * 2, rgba(180, 235, 255, 0.5)); p(g, 3, 19 - frame * 2, rgba(180, 235, 255, 0.5)); }
    return draw(g, O0);
  }
  function spark(frame) {
    const g = mk(16, 16);
    const c = 7.5;
    const lens = [3.2, 6.6, 7.2][frame];
    const al = [1, 0.9, 0.5][frame];
    const W = rgba(255, 255, 255, al), Cy = rgba(170, 240, 255, al), Bl = rgba(90, 190, 255, al * 0.85);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n + (frame * 0.2);
      const L = lens * (i % 2 ? 0.6 : 1);
      const kink = frame >= 1 ? (i % 2 ? 1.3 : -1.3) : 0;
      const mx = c + Math.cos(a) * L * 0.5 - Math.sin(a) * kink, my = c + Math.sin(a) * L * 0.5 + Math.cos(a) * kink;
      const ex = c + Math.cos(a) * L, ey = c + Math.sin(a) * L;
      const sx = c + Math.cos(a) * 2, sy = c + Math.sin(a) * 2;
      line(g, sx, sy, mx, my, Cy);
      line(g, mx, my, ex, ey, frame === 2 ? Bl : Bl);
      p(g, ex, ey, frame === 0 ? Cy : Bl);
    }
    const rr = [1.6, 2.2, 1.2][frame];
    disc(g, c, c, rr, rr, (x, y, dx, dy, d) => d < 0.55 ? W : Cy);
    p(g, 7, 7, W); p(g, 8, 8, W); p(g, 7, 8, W); p(g, 8, 7, W);
    return draw(g, O0);
  }
  function ringFrost() {
    const S = 64, cv = newCanvas(S, S), cx = cv.getContext('2d');
    const r = rng(77);
    const noise = [];
    for (let i = 0; i < 360; i++) noise.push(r());
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x - 31.5, dy = y - 31.5, d = Math.hypot(dx, dy);
      let a = 0, col = [160, 220, 255];
      if (d < 28.5) a = 0.07 + 0.08 * Math.pow(d / 28.5, 3);   // faint inner fill, denser toward the rim
      if (d >= 25.5 && d < 28.5) a = 0.1 + 0.14 * (d - 25.5) / 3;
      let ang = Math.atan2(dy, dx); if (ang < 0) ang += Math.PI * 2;
      const nz = noise[Math.floor(ang / (Math.PI * 2) * 359)];
      const th = 0.3 + 0.35 * nz;
      if (d >= 29 - th * 2 && d <= 31 - th) { a = 0.78 + 0.18 * nz; col = [215, 245, 255]; }
      else if (d > 31 - th && d <= 31.6) { a = 0.35; col = [120, 200, 255]; }
      else if (d >= 28.4 && d < 29 - th * 2) { a = 0.4; col = [130, 205, 255]; }
      if (a <= 0) continue;
      cx.fillStyle = rgba(col[0], col[1], col[2], a);
      cx.fillRect(x, y, 1, 1);
    }
    // frost crystals on the rim
    const ca = [0.2, 1.1, 2.0, 3.0, 4.0, 5.2];
    cx.fillStyle = 'rgba(255,255,255,0.95)';
    for (const a of ca) {
      const px = Math.round(31.5 + Math.cos(a) * 30), py = Math.round(31.5 + Math.sin(a) * 30);
      cx.fillRect(px, py, 1, 1);
      cx.fillRect(px - 1, py, 3, 1); cx.fillRect(px, py - 1, 1, 3);
    }
    return cv;
  }

  // ---- ICONS --------------------------------------------------------------
  function iconBg(kind) {
    const cv = newCanvas(16, 16), cx = cv.getContext('2d');
    const P = {
      w: ['#1a2032', '#3a4468', '#262f4a'],
      p: ['#231b2e', '#52406a', '#2f2540'],
      e: ['#2c2310', '#e5ad35', '#8a6a24'],
      i: ['#1e222e', '#3f465c', '#2a2f40'],
    }[kind];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if ((x === 0 || x === 15) && (y === 0 || y === 15)) continue;
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      const corner = (x === 1 || x === 14) && (y === 1 || y === 14);
      let c = P[0];
      if (edge || corner) c = P[1];
      else if (kind === 'e' && (x === 1 || y === 1 || x === 14 || y === 14)) c = P[2];
      else if (y === 1 || x === 1) c = P[2];
      cx.fillStyle = c; cx.fillRect(x, y, 1, 1);
    }
    if (kind === 'e') {
      for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (d < 7) { cx.fillStyle = 'rgba(255,200,70,' + (0.28 * (1 - d / 7)).toFixed(2) + ')'; cx.fillRect(x, y, 1, 1); }
      }
    }
    return cv;
  }
  function icon(kind, fn) {
    const g = mk(16, 16);
    fn(g);
    const sp = draw(g);
    const cv = iconBg(kind), cx = cv.getContext('2d');
    cx.drawImage(sp, 0, 0);
    if (kind === 'e') {
      cx.fillStyle = '#fff3b0';
      for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) cx.fillRect(x, y, 1, 1);
      cx.fillStyle = 'rgba(255,243,176,0.6)';
      for (const [x, y] of [[3, 2], [2, 3], [12, 2], [13, 3], [3, 13], [2, 12], [12, 13], [13, 12]]) cx.fillRect(x, y, 1, 1);
    }
    return cv;
  }
  const dagger = (g, gold) => {
    const cl = gold ? ['#fff6c0', '#ffe27a', '#e5ad35'] : ['w', 'l', 'm'];
    for (let t = 0; t <= 6; t++) {
      const x = 12 - t, y = 2 + t;
      if (t > 0) p(g, x - 1, y, cl[0]);
      p(g, x, y, t === 0 ? cl[0] : cl[1]);
      if (t > 0) p(g, x + 1, y, cl[2]);
    }
    for (let i = 0; i < 5; i++) p(g, 3 + i, 7 + i, i === 2 ? 'y' : (i < 2 ? 'y' : 'Y'));
    p(g, 4, 10, 'B'); p(g, 3, 11, 'B'); p(g, 5, 10, 'n'); p(g, 4, 11, 'n'); p(g, 2, 12, 'B'); p(g, 3, 12, 'n');
    p(g, 1, 13, 'Y'); p(g, 2, 13, 'Y');
  };
  const blade = (g, gold) => {
    const cl = gold ? ['#fff6c0', '#ffe27a', '#e5ad35'] : ['w', 'l', 'm'];
    for (let y = 2; y <= 9; y++) { p(g, 6, y, cl[0]); p(g, 7, y, cl[1]); p(g, 8, y, cl[2]); }
    p(g, 7, 1, cl[0]); p(g, 6, 2, cl[0]);
    rect(g, 4, 10, 7, 1, 'Y'); p(g, 4, 10, 'y'); p(g, 5, 10, 'y'); p(g, 3, 9, 'Y'); p(g, 11, 9, 'Y');
    rect(g, 7, 11, 2, 2, 'B'); p(g, 8, 11, 'n'); p(g, 8, 12, 'n');
    p(g, 6, 13, 'Y'); p(g, 7, 13, 'y'); p(g, 8, 13, 'Y');
    // swing marks
    p(g, 12, 4, 'rgba(160,230,255,0.8)'); p(g, 13, 6, 'rgba(160,230,255,0.8)'); p(g, 12, 8, 'rgba(160,230,255,0.6)');
    p(g, 3, 4, 'rgba(160,230,255,0.6)');
  };
  const orbIcon = (g, gold) => {
    const cx = 7.5, cy = 7.5;
    disc(g, cx, cy, 5, 5, (x, y, dx, dy, d) => {
      const l = Math.hypot(dx + 0.4, dy + 0.4);
      if (l < 0.3) return 'w';
      if (l < 0.62) return gold ? '#fff0a0' : '#c4f8ff';
      if (d < 0.8) return gold ? '#ffd04a' : '#74b8ff';
      return gold ? 'Y' : '#6a50e0';
    });
    for (const [x, y] of [[2, 3], [13, 4], [11, 13], [3, 12]]) p(g, x, y, gold ? 'y' : 'c');
    p(g, 12, 2, 'w'); p(g, 2, 8, 'w');
  };
  const skullIcon = (g, gold) => {
    const map = gold ? { t: 'y', T: 'Y' } : null;
    stamp(g, SKULL_ROWS, 3, 3, map);
    p(g, 5, 8, 'i'); p(g, 9, 8, 'i');
    for (const [x, y] of [[2, 6], [13, 6], [7, 1], [8, 13]]) p(g, x, y, 'rgba(150,255,120,0.8)');
  };
  const lightningIcon = g => {
    stamp(g, [
      '......yyyy',
      '.....yyyyY',
      '....yyyyY.',
      '...yyyyY..',
      '..yyyyyyyy',
      '..YYYyyyY.',
      '....yyyY..',
      '...yyyY...',
      '..yyyY....',
      '.yyyY.....',
      '.yY.......',
      '.y........',
    ], 3, 2);
    p(g, 9, 3, 'w'); p(g, 8, 4, 'w'); p(g, 7, 5, 'w'); p(g, 6, 6, 'w'); p(g, 8, 8, 'w');
    p(g, 12, 9, 'rgba(255,240,140,0.8)'); p(g, 2, 3, 'rgba(255,240,140,0.8)');
  };
  const fireballIcon = g => {
    const cx = 9, cy = 9;
    // tail
    for (let t = 1; t <= 6; t++) {
      const w = Math.max(0, 2.4 - t * 0.35);
      for (let k = -Math.floor(w); k <= Math.floor(w); k++) {
        p(g, cx - t - k * 0.0 + 0, cy - t + k, t < 3 ? 'O' : (t < 5 ? 'R' : 'r'));
      }
    }
    p(g, 3, 6, 'r'); p(g, 5, 3, 'O'); p(g, 4, 4, 'O');
    disc(g, cx, cy, 4.4, 4.4, (x, y, dx, dy, d) => {
      const l = Math.hypot(dx + 0.3, dy + 0.3);
      if (l < 0.35) return 'w';
      if (l < 0.6) return 'y';
      if (d < 0.8) return 'F';
      return d > 0.85 && dx + dy > 0 ? 'R' : 'O';
    });
  };
  const auraIcon = g => {
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy);
      if (d <= 6.3 && d >= 4.5) p(g, x, y, dx + dy < 0 ? 'w' : (d > 5.5 ? 'C' : 'c'));
      else if (d < 4.5) p(g, x, y, d < 1.6 ? 'w' : 'rgba(110,190,255,0.35)');
    }
    for (const [x, y] of [[7, 5], [8, 5], [7, 10], [8, 10], [5, 7], [5, 8], [10, 7], [10, 8]]) p(g, x, y, 'w');
    for (const [x, y] of [[6, 6], [9, 6], [6, 9], [9, 9]]) p(g, x, y, 'c');
  };
  const axeIcon = g => { stampGrid(g, axeBase(), 2, 2); };
  const mightIcon = g => {
    stamp(g, [
      '..bbbbbbbb..',
      '.bbBbbBbbBB.',
      '.bbBbbBbbBB.',
      '.bbBbbBbbBB.',
      '.bbbbbbbbbB.',
      '.bbbbbbbbBB.',
      '..bbbbbbBB..',
      '..rrrrrrrr..',
      '..rRRRRRRx..',
      '..rrrrrrrr..',
    ], 2, 4);
    // power sparks
    for (const [x, y] of [[8, 1], [3, 2], [12, 2]]) { p(g, x, y, 'y'); }
    p(g, 8, 2, 'Y'); p(g, 8, 0, 'Y'); p(g, 7, 1, 'Y'); p(g, 9, 1, 'Y');
    p(g, 4, 5, 'T'); p(g, 5, 5, 'T');
  };
  const hasteIcon = g => {
    stamp(g, [
      'YyyyyyyyyY',
      '.wccccccc.',
      '..cyyyyc..',
      '...cyyc...',
      '....cc....',
      '....yy....',
      '...cYYc...',
      '..cccyyc..',
      '.ccyyyyyc.',
      '.cyyyyyyyc',
      'YyyyyyyyyY',
    ], 3, 2);
    p(g, 1, 8, 'rgba(200,230,255,0.7)'); p(g, 14, 5, 'rgba(200,230,255,0.7)');
  };
  const heartRows = [
    '.rrr...rrr.',
    'rrwrr.rrrrR',
    'rwrrrrrrrrR',
    'rrrrrrrrrrR',
    '.rrrrrrrrR.',
    '..rrrrrrR..',
    '...rrrrR...',
    '....rrR....',
    '.....R.....',
  ];
  const vitalityIcon = g => {
    stamp(g, heartRows, 2, 3);
    p(g, 3, 5, 'w'); p(g, 4, 4, 'w');
    for (let i = 2; i < 10; i++) { p(g, 2 + i, 8, i > 6 ? 'x' : 'R'); }
    p(g, 7, 12, 'x'); p(g, 6, 11, 'R'); p(g, 8, 11, 'x');
  };
  const regenIcon = g => {
    const map = { r: 'S', R: 'z', w: 's' };
    stamp(g, heartRows, 2, 4, map);
    stamp(g, ['..w..', '..w..', 'wwwww', '..w..', '..w..'], 5, 5);
    p(g, 12, 3, 'i'); p(g, 13, 2, 'I'); p(g, 12, 2, 'i'); p(g, 11, 4, 'I'); p(g, 13, 3, 'j');
    p(g, 3, 6, 's');
  };
  const bootsIcon = g => {
    stamp(g, [
      '..YYYYY.....',
      '..bbbbB.....',
      '..bbbbB.....',
      '..bbbbB.....',
      '..bbbbBB....',
      '..bbbbbbBB..',
      '.bbbbbbbbbB.',
      'bbbbbbbbbbbB',
      'nnnnnnnnnnnn',
    ], 2, 3);
    p(g, 4, 4, 'T'); p(g, 4, 5, 'T');
    p(g, 2, 5, 'w'); p(g, 3, 5, 'w'); p(g, 1, 7, 'm'); p(g, 2, 7, 'm');
    p(g, 12, 6, 'Y'); p(g, 11, 7, 'Y');
  };
  const magnetIcon = g => {
    stampGrid(g, magnetGrid(), 3, 3);
    p(g, 2, 1, 'c'); p(g, 5, 1, 'c'); p(g, 10, 1, 'c'); p(g, 13, 2, 'c'); p(g, 3, 2, 'C');
  };
  const armorIcon = g => {
    for (let y = 0; y < 12; y++) {
      const hw = y <= 6 ? 5 : 5 - (y - 6) * 0.95;
      for (let x = Math.ceil(5 - hw + 0.5); x < 5 + hw + 0.5; x++) {
        const edge = x === Math.ceil(5 - hw + 0.5) || x === Math.ceil(5 + hw - 0.5) || y === 0;
        let c = x < 5 ? 'c' : 'C';
        if (edge) c = x < 5 ? 'l' : 'M';
        p(g, 3 + x, 2 + y, c);
      }
    }
    rect(g, 7, 4, 2, 7, 'y'); rect(g, 5, 6, 6, 2, 'y');
    rect(g, 8, 4, 1, 7, 'Y'); rect(g, 8, 6, 3, 2, 'Y'); rect(g, 5, 6, 3, 1, 'y');
    p(g, 4, 3, 'w'); p(g, 5, 3, 'w');
  };
  const growthIcon = g => {
    // blue gem on a sprout
    stamp(g, [
      '..w.',
    ], 20, 20);
    stamp(g, [
      '...CCC...',
      '..cwcCv..',
      '.ccccCCv.',
      '..cCCCv..',
      '...CCv...',
    ], 3, 1);
    p(g, 7, 6, 'I'); p(g, 7, 7, 'I'); p(g, 7, 8, 'I'); p(g, 8, 7, 'j'); p(g, 8, 8, 'j'); p(g, 8, 9, 'j');
    stamp(g, ['.ii', 'iII'], 4, 8);
    stamp(g, ['ii.', 'Iij'], 9, 9);
    p(g, 6, 8, 'I'); p(g, 5, 9, 'I');
    stamp(g, ['.BBBBBB.', 'BBnBBnBB'], 4, 11);
    p(g, 12, 3, 'w'); p(g, 3, 5, 'w');
  };
  const coinIcon = g => {
    disc(g, 7.5, 7.5, 5.2, 5.2, (x, y, dx, dy, d) => {
      if (d > 0.82) return dx + dy > 0 ? 'a' : 'Y';
      if (Math.abs(dx) < 0.12 && Math.abs(dy) < 0.55) return 'Y';
      if (Math.abs(dy + 0.35) < 0.16 && Math.abs(dx) < 0.45) return 'Y';
      if (Math.abs(dy - 0.35) < 0.16 && Math.abs(dx) < 0.45) return 'Y';
      return dx + dy < -0.4 ? 'y' : '#f5cf55';
    });
    p(g, 4, 4, 'w'); p(g, 5, 3, 'w'); p(g, 3, 5, 'w');
  };
  const skullCountIcon = g => {
    line(g, 2, 11, 13, 14, 'W'); line(g, 2, 14, 13, 11, 'W');
    p(g, 2, 11, 'T'); p(g, 13, 11, 'T'); p(g, 2, 14, 'T'); p(g, 13, 14, 'T');
    stamp(g, SKULL_ROWS.slice(0, 7), 4, 2);
    p(g, 6, 7, 'r'); p(g, 10, 7, 'r');
  };
  const clockIcon = g => {
    disc(g, 7.5, 7.5, 6, 6, (x, y, dx, dy, d) => {
      if (d > 0.82) return dx + dy < 0 ? 'l' : 'M';
      return dx + dy < -0.2 ? 'w' : 'l';
    });
    for (const [x, y] of [[7, 3], [8, 3], [7, 12], [8, 12], [3, 7], [3, 8], [12, 7], [12, 8]]) p(g, x, y, 'd');
    line(g, 7, 7, 7, 4, 'k'); line(g, 8, 8, 10, 10, 'k'); line(g, 8, 7, 8, 6, 'k');
    p(g, 7, 7, 'r'); p(g, 8, 8, 'r'); p(g, 7, 8, 'r'); p(g, 8, 7, 'r');
    p(g, 12, 2, 'Y'); p(g, 13, 3, 'Y');
  };

  // ---- FLOOR TILES --------------------------------------------------------
  function floorTile(variant) {
    const g = mk(16, 16);
    const r = rng(1234);   // identical base noise for every variant so edges match
    const base = ['#2a3040', '#2c3243', '#2e3446', '#2b3141'];
    const MORT = '#1d212d', HI = '#353c4f', SH = '#252a38';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = r();
      g.c[y][x] = k < 0.55 ? base[1] : k < 0.78 ? base[0] : k < 0.93 ? base[2] : base[3];
    }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const band2 = y >= 8;
      const sx = band2 ? 8 : 0;
      const ly = y % 8;
      if (ly === 0 || x === sx) g.c[y][x] = MORT;
      else if (ly === 1 || x === (sx + 1) % 16) g.c[y][x] = HI;
      else if (ly === 7 && (x * 7 + y) % 3 !== 0) g.c[y][x] = SH;
    }
    // slight highlight dots on stone tops
    const vr = rng(900 + variant * 31);
    if (variant === 1) {
      const crack = (x, y, n) => { for (let i = 0; i < n; i++) { p(g, x, y, '#1b1f2b'); const k = vr(); if (k < 0.4) x++; else if (k < 0.7) y++; else { x++; y++; } if (x > 14 || y > 14 || x < 2) break; if (y % 8 === 0) break; } };
      crack(3, 3, 8); crack(11, 10, 6);
      p(g, 5, 4, '#1b1f2b'); p(g, 12, 12, '#1b1f2b');
    } else if (variant === 2) {
      const cols = ['#2f4a3a', '#35553f', '#294234'];
      for (const [mx, my] of [[3, 12], [11, 4], [6, 13]]) {
        for (let i = 0; i < 7; i++) {
          const x = mx + Math.round((vr() - 0.5) * 4), y = my + Math.round((vr() - 0.5) * 3);
          if (x < 1 || x > 14 || y < 1 || y > 14) continue;
          if ((y % 8 === 0) || y % 8 === 1) continue;
          p(g, x, y, cols[Math.floor(vr() * 3)]);
        }
      }
      p(g, 4, 12, '#3c6347'); p(g, 11, 4, '#3c6347');
    } else if (variant === 3) {
      for (const [px, py] of [[11, 3], [4, 11], [12, 13]]) {
        p(g, px, py, '#4a5268'); p(g, px + 1, py, '#3f465a');
        p(g, px, py + 1, '#1f2330'); p(g, px + 1, py + 1, '#1f2330'); p(g, px + 2, py + 1, '#1f2330');
        p(g, px + 2, py, '#1f2330');
      }
      p(g, 6, 5, '#3f465a'); p(g, 13, 11, '#3f465a');
    }
    return draw(g, O0);
  }

  // ---- PROPS --------------------------------------------------------------
  function blob(g, cx, cy, rx, ry, cols, r) {
    disc(g, cx, cy, rx, ry, (x, y, dx, dy, d) => {
      const f = -0.6 * dx - 0.8 * dy + (r ? (r() - 0.5) * 0.3 : 0);
      return f > 0.35 ? cols[0] : f > -0.25 ? cols[1] : cols[2];
    });
  }
  function rock() {
    const g = mk(16, 14);
    const r = rng(5);
    blob(g, 5, 8.5, 4.5, 3.8, ['l', 'm', 'M'], null);
    blob(g, 9.5, 7.5, 5.2, 4.8, ['m', 'M', 'd'], r);
    blob(g, 5.2, 8.6, 3.6, 3.0, ['l', 'm', 'M'], r);
    p(g, 4, 6, 'w'); p(g, 5, 6, 'w'); p(g, 8, 4, 'l'); p(g, 9, 4, 'l'); p(g, 7, 5, 'l');
    line(g, 10, 6, 11, 9, 'd'); p(g, 9, 9, 'd');
    // shadow base
    for (let x = 3; x < 14; x++) if (get(g, x, 12) === '.') p(g, x, 12, 'rgba(15,18,28,0.35)');
    return draw(g);
  }
  function boneStick(g, x0, y0, x1, y1) {
    line(g, x0, y0 + 1, x1, y1 + 1, 'V');
    line(g, x0, y0, x1, y1, 'W');
    for (const [x, y] of [[x0, y0], [x1, y1]]) { rect(g, x - 1, y - 1, 2, 2, 'W'); p(g, x, y, 'W'); p(g, x - 1, y, 'W'); }
    p(g, x0 - 1, y0, 'V'); p(g, x1, y1 + 1, 'V');
  }
  function bones() {
    const g = mk(14, 10);
    boneStick(g, 2, 7, 11, 3);
    boneStick(g, 3, 3, 10, 8);
    // little skull
    stamp(g, ['.WWW.', 'WWWWV', 'WkWkV', '.WWV.', '.VWV.'], 4, 2);
    p(g, 5, 4, 'k'); p(g, 7, 4, 'k');
    return draw(g);
  }
  function pillar() {
    const g = mk(16, 34);
    const rn = rng(42);
    const cl = x => x <= 4 ? 'H' : x <= 7 ? 'J' : x <= 9 ? 'K' : 'D';
    // capital
    rect(g, 1, 1, 14, 1, 'N'); rect(g, 1, 2, 14, 2, 'H'); rect(g, 2, 4, 12, 1, 'J');
    for (let x = 1; x <= 14; x++) { if (x > 9) { p(g, x, 3, 'J'); } }
    rect(g, 11, 2, 4, 1, 'J'); p(g, 14, 1, 'H');
    rect(g, 1, 3, 14, 1, 'J'); rect(g, 1, 2, 13, 1, 'H'); p(g, 14, 2, 'J');
    for (let x = 2; x <= 13; x++) p(g, x, 5, 'K');
    // shaft
    for (let y = 5; y <= 28; y++) for (let x = 3; x <= 12; x++) p(g, x, y, cl(x - 1));
    for (let y = 5; y <= 28; y++) { p(g, 6, y, 'J'); p(g, 9, y, 'K'); p(g, 5, y, 'H'); p(g, 4, y, 'N'); }
    for (let y = 5; y <= 28; y++) { p(g, 3, y, 'H'); p(g, 4, y, 'N'); p(g, 5, y, 'H'); p(g, 6, y, 'H'); p(g, 7, y, 'J'); p(g, 8, y, 'J'); p(g, 9, y, 'K'); p(g, 10, y, 'K'); p(g, 11, y, 'D'); p(g, 12, y, 'D'); }
    for (let y = 6; y <= 28; y++) { p(g, 7, y, 'K'); }
    // chips and cracks
    for (let i = 0; i < 10; i++) { const x = 4 + Math.floor(rn() * 8), y = 7 + Math.floor(rn() * 20); p(g, x, y, rn() < 0.5 ? 'D' : 'N'); }
    line(g, 8, 12, 9, 16, 'D'); p(g, 9, 17, 'D'); line(g, 6, 22, 7, 25, 'D');
    // moss near the base
    p(g, 4, 27, 'h'); p(g, 5, 28, 'G'); p(g, 4, 28, 'h'); p(g, 11, 27, 'h');
    // base
    rect(g, 2, 29, 12, 1, 'K');
    rect(g, 1, 30, 14, 3, 'J'); rect(g, 1, 30, 14, 1, 'H'); rect(g, 1, 31, 4, 2, 'H'); rect(g, 11, 31, 4, 2, 'K'); rect(g, 1, 32, 14, 1, 'K');
    p(g, 14, 30, 'K');
    return draw(g);
  }
  function torch(frame) {
    const g = mk(16, 28);
    // foot
    rect(g, 5, 25, 6, 1, 'M'); rect(g, 4, 26, 8, 1, 'd'); rect(g, 6, 24, 4, 1, 'd');
    p(g, 4, 26, 'M'); p(g, 5, 26, 'M');
    // pole
    for (let y = 17; y <= 24; y++) { p(g, 7, y, 'M'); p(g, 8, y, 'd'); }
    p(g, 7, 20, 'm'); p(g, 7, 21, 'm');
    p(g, 6, 22, 'd'); p(g, 9, 22, 'd');
    // bowl
    rect(g, 3, 13, 10, 1, 'm'); rect(g, 3, 14, 10, 1, 'M');
    rect(g, 4, 15, 8, 1, 'M'); rect(g, 5, 16, 6, 1, 'd');
    p(g, 3, 14, 'l'); p(g, 4, 13, 'l'); p(g, 12, 14, 'd'); p(g, 11, 15, 'd');
    p(g, 6, 15, 'd'); p(g, 9, 15, 'd');
    // coals / flame
    rect(g, 4, 12, 8, 1, '4');
    const cfg = [[9, 3.0, -0.6], [11, 3.3, 0.8], [8, 2.8, 1.4]][frame];
    flame(g, 7.5, 12, cfg[0] + 1, cfg[1], cfg[2], 9 + frame);
    p(g, 4, 12, '3'); p(g, 11, 12, '3');
    p(g, 3 + frame * 4, 4 + frame, 'rgba(255,200,80,0.8)');
    return draw(g);
  }
  function grave() {
    const g = mk(14, 18);
    // dirt mound
    for (let x = 1; x <= 12; x++) {
      const h = x < 3 || x > 10 ? 1 : 2;
      for (let y = 17 - h - 1; y <= 16; y++) p(g, x, y, y === 17 - h - 1 ? 'B' : (y > 14 ? 'n' : 'B'));
    }
    p(g, 2, 14, 'b'); p(g, 3, 14, 'b'); p(g, 9, 14, 'n'); p(g, 5, 15, 'n'); p(g, 10, 15, 'B');
    // tombstone
    const spans = { 1: [4, 9], 2: [3, 10], 3: [2, 11] };
    for (let y = 1; y <= 13; y++) {
      const [a, b] = spans[y] || [2, 11];
      for (let x = a; x <= b; x++) p(g, x, y, x <= 4 ? 'H' : x <= 8 ? 'J' : 'K');
    }
    for (let x = 4; x <= 9; x++) p(g, x, 1, 'N');
    p(g, 3, 2, 'N'); p(g, 2, 3, 'N');
    for (let y = 3; y <= 13; y++) { p(g, 11, y, 'D'); p(g, 10, y, y > 4 ? 'K' : 'K'); }
    for (let x = 2; x <= 11; x++) p(g, x, 13, 'K');
    // cross
    rect(g, 6, 4, 2, 7, 'D'); rect(g, 4, 6, 6, 1, 'D');
    p(g, 5, 11, 'D'); p(g, 8, 12, 'D');
    // crack + moss
    line(g, 3, 9, 4, 11, 'D'); p(g, 3, 12, 'D');
    p(g, 9, 3, 'h'); p(g, 10, 3, 'G'); p(g, 2, 12, 'G'); p(g, 3, 13, 'h'); p(g, 2, 13, 'h');
    // grass tufts on the mound
    p(g, 1, 15, 'G'); p(g, 12, 15, 'G'); p(g, 12, 14, 'h'); p(g, 1, 14, 'h');
    return draw(g);
  }
  const SMALL_SKULL = ['.WWW.', 'WWWWV', 'WkWkV', '.WWV.', '.VWV.'];
  function skullpile() {
    const g = mk(16, 14);
    boneStick(g, 1, 11, 6, 9);
    stamp(g, SMALL_SKULL, 5, 1);
    stamp(g, SMALL_SKULL, 2, 5); stamp(g, SMALL_SKULL, 8, 5);
    stamp(g, SMALL_SKULL, 0, 8); stamp(g, SMALL_SKULL, 5, 8); stamp(g, SMALL_SKULL, 10, 8);
    p(g, 14, 12, 'W'); p(g, 13, 12, 'W'); p(g, 12, 12, 'V');
    return draw(g);
  }
  function candles(frame) {
    const g = mk(12, 10);
    // wax puddle
    rect(g, 1, 8, 10, 1, 'T'); rect(g, 2, 7, 8, 1, 't'); p(g, 1, 8, 'A'); p(g, 10, 8, 'A'); rect(g, 3, 8, 6, 1, 'A');
    rect(g, 1, 8, 10, 1, 'T');
    const cs = [[2, 5], [5, 6], [8, 4]];
    for (const [x, h] of cs) {
      rect(g, x, 8 - h, 2, h, 't');
      rect(g, x + 1, 8 - h, 1, h, 'T');
      p(g, x, 8 - h, 'w');
      p(g, x + 1, 8 - h - 0, 'T');
    }
    const fl = [
      [[1, 'b'], [0, 'b']],
    ];
    const jit = [[0, 0, 0], [0, -1, 0], [-1, 0, 0]];
    cs.forEach(([x, h], i) => {
      const top = 8 - h - 1;
      const j = (frame + i) % 3;
      p(g, x, top, '#3a2a20');
      p(g, x, top - 1, j === 1 ? '1' : '2'); p(g, x, top - 2 + (j === 2 ? 1 : 0), j === 0 ? '3' : '2');
      if (j === 0) p(g, x, top - 3 + 1, '4');
      if (j === 2) p(g, x + 1, top - 1, '3');
    });
    return draw(g);
  }
  function crack() {
    const g = mk(16, 16);
    const r = rng(31);
    const D = 'rgba(14,16,26,0.7)', L = 'rgba(70,80,105,0.35)';
    const walk = (x, y, n, dir) => {
      for (let i = 0; i < n; i++) {
        p(g, x, y, D);
        if (get(g, x + 1, y) === '.') p(g, x + 1, y, L);
        const k = r();
        if (k < 0.35) x += dir; else if (k < 0.55) y++; else { x += dir; y++; }
        if (x < 0 || y > 15 || x > 15) break;
      }
    };
    walk(2, 1, 16, 1);
    walk(7, 6, 6, -1);
    walk(9, 9, 7, 1);
    return draw(g, O0);
  }
  function blood(variant) {
    const g = mk(16, 16);
    const r = rng(200 + variant * 19);
    const cols = ['rgba(90,18,28,0.85)', 'rgba(126,28,38,0.85)', 'rgba(154,42,48,0.8)'];
    const cx = 7.5 + (variant - 1) * 0.8, cy = 7.5 + (variant === 2 ? -0.5 : 0.5);
    const rx = [4.6, 3.6, 5.2][variant], ry = [3.4, 4.4, 3.6][variant];
    disc(g, cx, cy, rx, ry, (x, y, dx, dy, d) => {
      if (d + (r() - 0.5) * 0.55 > 0.95) return null;
      if (d < 0.35) return cols[2];
      return d < 0.7 ? cols[1] : cols[0];
    });
    for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2, dist = 5 + r() * 2.6;
      const x = cx + Math.cos(a) * dist, y = cy + Math.sin(a) * dist * 0.8;
      p(g, x, y, cols[i % 2]);
      if (i % 3 === 0) p(g, x + 1, y, cols[0]);
    }
    // drag streak
    for (let i = 0; i < 4; i++) p(g, cx - 5 - i * (variant + 1) % 3 + 0, cy + i * 0.5 - 1, cols[0]);
    return draw(g, O0);
  }

  // ---- build --------------------------------------------------------------
  function build() {
    const R = {};
    R.gem_blue = [gem(8, 'dia', GEMB, 0), gem(8, 'dia', GEMB, 1)];
    R.gem_green = [gem(9, 'hex', GEMG, 0), gem(9, 'hex', GEMG, 1)];
    R.gem_red = [gem(11, 'tall', GEMR, 0), gem(11, 'tall', GEMR, 1)];
    R.coin = [0, 1, 2, 3].map(coin);
    R.roast = [roast()];
    R.magnet = [magnet()];
    R.bomb = [bomb(0), bomb(1)];
    R.chest_gold = [chest(false), chest(true)];
    R.knife = [knife()];
    R.orb = [orb(0), orb(1)];
    R.axe = [0, 1, 2, 3].map(axe);
    R.skull = [skull(0), skull(1)];
    R.fireball = [0, 1, 2].map(fireball);
    R.slash = [0, 1, 2].map(slash);
    R.spark = [0, 1, 2].map(spark);
    R.ring_frost = [ringFrost()];
    // icons
    R.icon_dagger = [icon('w', g => dagger(g, false))];
    R.icon_orb = [icon('w', g => orbIcon(g, false))];
    R.icon_blade = [icon('w', g => blade(g, false))];
    R.icon_skull = [icon('w', g => skullIcon(g, false))];
    R.icon_lightning = [icon('w', lightningIcon)];
    R.icon_fireball = [icon('w', fireballIcon)];
    R.icon_aura = [icon('w', auraIcon)];
    R.icon_axe = [icon('w', axeIcon)];
    R.icon_might = [icon('p', mightIcon)];
    R.icon_haste = [icon('p', hasteIcon)];
    R.icon_vitality = [icon('p', vitalityIcon)];
    R.icon_regen = [icon('p', regenIcon)];
    R.icon_boots = [icon('p', bootsIcon)];
    R.icon_magnet = [icon('p', magnetIcon)];
    R.icon_armor = [icon('p', armorIcon)];
    R.icon_growth = [icon('p', growthIcon)];
    R.icon_evo_dagger = [icon('e', g => dagger(g, true))];
    R.icon_evo_blade = [icon('e', g => blade(g, true))];
    R.icon_evo_orb = [icon('e', g => orbIcon(g, true))];
    R.icon_evo_skull = [icon('e', g => skullIcon(g, true))];
    R.icon_coin = [icon('i', coinIcon)];
    R.icon_skullcount = [icon('i', skullCountIcon)];
    R.icon_clock = [icon('i', clockIcon)];
    // world
    R.floor0 = [floorTile(0)]; R.floor1 = [floorTile(1)]; R.floor2 = [floorTile(2)]; R.floor3 = [floorTile(3)];
    R.prop_rock = [rock()];
    R.prop_bones = [bones()];
    R.prop_pillar = [pillar()];
    R.prop_torch = [0, 1, 2].map(torch);
    R.prop_grave = [grave()];
    R.prop_skullpile = [skullpile()];
    R.prop_candles = [0, 1, 2].map(candles);
    R.prop_crack = [crack()];
    R.prop_blood = [0, 1, 2].map(blood);
    return R;
  }
  return { build };
})();
