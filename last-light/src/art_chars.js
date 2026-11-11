// art_chars.js - procedural pixel art for Nightfall Chambers: heroes + new enemies.
// Rows of palette characters ('.' = transparent) and small shape helpers; a 1px #484241
// outline is added automatically (glow/wisp characters never get outline).
const ARTC = (() => {
  const OUT = '#484241';
  const PAL = {
    o: OUT, k: '#2a2630', w: '#f2f2f0',
    l: '#dcdae4', m: '#b0adbd', M: '#827f90', d: '#5c5966',
    r: '#f25050', R: '#b83a40', x: '#7c1f2c', X: '#531624',
    y: '#ffe27a', Y: '#e5ad35', a: '#a8692a',
    c: '#8fd4ff', C: '#4a8ee0', v: '#2c56a8',
    b: '#c08a5c', B: '#94603f', n: '#5e3b2a',
    F: '#f2c9a0', H: '#d49a72',
    g: '#a6c95a', G: '#76a043', h: '#4f7432', j: '#2f5028',
    p: '#a77cc8', P: '#7a4f9c', u: '#4f3070', U: '#2b1a3c',
    e: '#b4fcff', E: '#38c8e8',
    W: '#e6e2c8', Z: '#c7c7af', z: '#9e9e89', D: '#6e6a5e',
    '3': '#12152a', '4': '#222a4d', '5': '#34427a', '6': '#566bb0',
    '7': '#f6e8c4', '8': '#dcc08e', '9': '#a8885a', '0': '#6e5a3c',
    t: '#fff7c0', T: '#ffd04a', s: '#ff8a24', S: '#d0421e',
    '<': 'rgba(246,250,255,0.9)', '>': 'rgba(205,218,242,0.88)', '^': 'rgba(160,178,222,0.86)',
    // no-outline glows / wisps
    '%': 'rgba(70,90,160,0.85)', '&': 'rgba(86,107,176,0.55)', '$': 'rgba(110,130,200,0.3)',
    '@': 'rgba(90,230,255,0.38)', '#': 'rgba(255,230,90,0.38)', '!': 'rgba(255,60,50,0.38)',
    '(': 'rgba(120,200,255,0.35)',
  };
  const NOOUT = new Set('%&$@#!('.split(''));
  const FLAME = new Set('tTsS'.split(''));
  for (const c of FLAME) NOOUT.add(c);

  function render(rows, opt) {
    opt = opt || {};
    const pal = Object.assign({}, PAL, opt.pal || {});
    const oc = opt.outlineColor || OUT;
    const outline = opt.outline !== false;
    const pad = outline ? 1 : 0;
    const H = rows.length, W = Math.max(...rows.map(r => r.length));
    const cw = W + pad * 2, ch = H + pad * 2;
    const g = [];
    for (let y = 0; y < ch; y++) {
      g.push([]);
      for (let x = 0; x < cw; x++) {
        const sy = y - pad, sx = x - pad;
        const c = sy >= 0 && sy < H && sx >= 0 && sx < rows[sy].length ? rows[sy][sx] : '.';
        g[y].push(c === ' ' ? '.' : c);
      }
    }
    if (outline) {
      const solid = (x, y) => x >= 0 && y >= 0 && x < cw && y < ch && g[y][x] !== '.' && !NOOUT.has(g[y][x]);
      const add = [];
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        if (g[y][x] !== '.') continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) add.push([x, y]);
      }
      for (const [x, y] of add) g[y][x] = 'o';
    }
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const cx = cv.getContext('2d');
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const c = g[y][x];
      if (c === '.') continue;
      const col = c === 'o' ? oc : pal[c];
      if (!col) continue;
      cx.fillStyle = col;
      cx.fillRect(x, y, 1, 1);
    }
    return cv;
  }

  // ---- grid helpers --------------------------------------------------------
  const G = (w, h) => ({ w, h, a: Array.from({ length: h }, () => new Array(w).fill('.')) });
  const px = (g, x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.a[y][x] = c; };
  const rect = (g, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(g, x + i, y + j, c); };
  const stamp = (g, rows, x, y) => { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.' && r[i] !== ' ') px(g, x + i, y + j, r[i]); }); };
  function line(g, x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx - dy;
    for (;;) {
      px(g, x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 > -dy) { e -= dy; x0 += sx; }
      if (e2 < dx) { e += dx; y0 += sy; }
    }
  }
  // shaded ellipse, light from top-left. cols = [hi, mid, lo]
  function ball(g, cx, cy, rx, ry, cols) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / (rx + 0.35), ny = (y - cy) / (ry + 0.35);
      if (nx * nx + ny * ny > 1) continue;
      const t = (nx + ny) * 0.7;
      px(g, x, y, t < -0.42 ? cols[0] : t > 0.3 ? cols[2] : cols[1]);
    }
  }
  const fin = (g, opt) => render(g.a.map(r => r.join('')), opt);

  // ---- leg cycle (16 wide, 4 rows): L near leg, Q far leg, N near boot, K far boot ----
  const LEGS = {
    A: ['.....QQLL.......', '....QQ..LL......', '...QQ....LL.....', '..KKK....NNN....'],
    B: ['......QQLL......', '......QQ.LL.....', '......QQ.LNN....', '.....KKK........'],
    C: ['......LLQQ......', '.....LL..QQ.....', '....LL....QQ....', '...NNN....KKK...'],
    D: ['......LLQQ......', '......LL.QQ.....', '......LL.QKK....', '.....NNN........'],
    I: ['......QQLL......', '......QQLL......', '......QQLL......', '.....KKKNNN.....'],
  };
  const RUNLEG = ['A', 'B', 'C', 'D'];

  function hero(def, f, idle) {
    const g = G(16, 18);
    const dy = idle ? [0, 1][f] : [1, 0, 1, 0][f];
    const top = def.top || 0;
    if (def.back) def.back(g, dy, f, idle);
    stamp(g, LEGS[idle ? 'I' : RUNLEG[f]], 0, 14);
    stamp(g, def.torso, 0, top + def.head.length + dy);
    stamp(g, def.head, 0, top + dy);
    if (def.front) def.front(g, dy, f, idle);
    return fin(g, { pal: def.pal });
  }
  const frames = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
  const heroSet = def => ({
    run: frames(4, f => hero(def, f, false)),
    idle: frames(2, f => hero(def, f, true)),
  });

  // ---- KNIGHT --------------------------------------------------------------
  const PLUME = [
    [[7, 0, 'r'], [6, 0, 'r'], [5, 0, 'R'], [4, 1, 'R'], [3, 2, 'x']],
    [[7, 0, 'r'], [6, 0, 'r'], [5, 0, 'R'], [4, 0, 'R'], [3, 1, 'x'], [2, 1, 'x']],
    [[7, 0, 'r'], [6, 0, 'r'], [5, 1, 'R'], [4, 1, 'R'], [3, 0, 'x'], [2, 0, 'x']],
    [[7, 0, 'r'], [6, 0, 'r'], [5, 0, 'R'], [4, 0, 'R'], [3, 0, 'x'], [2, 1, 'x']],
  ];
  const PLUME_IDLE = [
    [[7, 0, 'r'], [6, 0, 'r'], [5, 0, 'R'], [4, 1, 'R'], [4, 2, 'x']],
    [[7, 0, 'r'], [6, 0, 'r'], [5, 0, 'R'], [4, 0, 'R'], [3, 1, 'x']],
  ];
  const SHIELD = [
    '.lmmM.',
    'lcCCvM',
    'mCyYCd',
    'mCYaCd',
    'MCCvvd',
    '.Mddd.',
  ];
  const knight = {
    head: [
      '................',
      '.....lllmm......',
      '....llllllmM....',
      '...lllllllmMM...',
      '...llmmmmMMMMd..',
      '...lmMdFFFFFd...',
      '...mMdFFFkFHd...',
      '....MdddHHHd....',
    ],
    torso: [
      '...lmMCCCCMmd...',
      '...mMCCccCCMd...',
      '....dCCccCCd....',
      '....nbbyYbbn....',
      '....CCCccCCCv...',
      '....vCC..CCv....',
    ],
    pal: { L: '#9a97a8', Q: '#5c5966', N: '#94603f', K: '#5e3b2a' },
    back(g, dy, f, idle) {
      for (const [x, y, c] of (idle ? PLUME_IDLE[f] : PLUME[f])) px(g, x, y + dy, c);
      line(g, 4, 12 + dy, 0, 16 + dy, 'M'); px(g, 0, 16 + dy, 'm');
    },
    front(g, dy, f, idle) {
      px(g, 4, 11 + dy, 'Y'); px(g, 3, 11 + dy, 'Y'); px(g, 5, 11 + dy, 'a');
      stamp(g, SHIELD, 9, 9 + dy + (idle ? 0 : (f % 2 ? 0 : 0)));
    },
  };

  // ---- ROGUE ---------------------------------------------------------------
  const SCARF = [
    [[4, 7], [3, 7], [2, 8], [1, 8], [0, 9]],
    [[4, 7], [3, 8], [2, 8], [1, 7], [0, 7]],
    [[4, 8], [3, 8], [2, 7], [1, 7], [0, 8]],
    [[4, 7], [3, 7], [2, 7], [1, 8], [0, 8]],
  ];
  const SCARF_IDLE = [[[4, 7], [3, 8], [3, 9]], [[4, 8], [3, 9], [3, 10]]];
  const rogue = {
    head: [
      '....hGg.........',
      '...hGGGGg.......',
      '..jhGGGGGGg.....',
      '...jhGGGGGGgg...',
      '...jhGGhhhhhhd..',
      '....jhhhFFkFHd..',
      '.....jhhFFFHd...',
      '.....gggGGGGg...',
    ],
    torso: [
      '....hGGgGGGGh...',
      '....hGGGGGGGhd..',
      '....nBBBnBBBn...',
      '....hGGGGGGh....',
      '....hGGhhGGh....',
      '....jGG..GGj....',
    ],
    pal: { L: '#94603f', Q: '#5e3b2a', N: '#c08a5c', K: '#5e3b2a' },
    back(g, dy, f, idle) {
      const s = idle ? SCARF_IDLE[f] : SCARF[f];
      s.forEach(([x, y], i) => { px(g, x, y + dy, i < 2 ? 'g' : 'G'); px(g, x, y + dy + 1, 'G'); });
      // pointed hood tip
      px(g, 1, 3 + dy + (idle ? 0 : f % 2), 'j');
    },
    front(g, dy, f, idle) {
      const s = idle ? 0 : [2, 0, -2, 0][f];
      line(g, 8, 9 + dy, 8 + s, 12 + dy, 'G'); px(g, 8 + s, 12 + dy, 'F');
      px(g, 10, 10 + dy, 'Y'); px(g, 10, 11 + dy, 'a'); px(g, 10, 12 + dy, 'l'); px(g, 10, 13 + dy, 'm');
      px(g, 11, 11 + dy, 'a');
    },
  };

  // ---- MAGE ----------------------------------------------------------------
  const HEM = [
    '.vCCCCCCCCv.....', '..vCCCCCCCCv....', '.vvCCCCCCCv.....', '..vCCCCCCCv.....',
  ];
  const mage = {
    head: [
      '.....pP.........',
      '....pPPu........',
      '...pPPPPu.......',
      '...PPYYYYPu.....',
      '..pPPPPPPPPPu...',
      '.....uFFFFFd....',
      '.....uFFkFFd....',
      '.....wwwwwWw....',
    ],
    torso: [
      '....vCCCCCCv....',
      '...vCCcCCCCCv...',
      '...vCCCCyyCCv...',
      '...vCCCCCCCCv...',
      '..vCCCCcCCCCCv..',
      '..vCCCCCCCCCCv..',
    ],
    pal: { L: '#5e3b2a', Q: '#3d2a20', N: '#94603f', K: '#5e3b2a' },
    back(g, dy, f, idle) {
      // robe skirt trailing behind
      const h = idle ? (f ? HEM[1] : HEM[0]) : HEM[f];
      stamp(g, ['..vCCCCCCCCCv...'], 0, 14 + dy);
      stamp(g, [h], 0, 15 + dy);
    },
    front(g, dy, f, idle) {
      const sy = idle ? 0 : (f % 2 ? 0 : 1);
      for (let y = 4; y <= 17; y++) px(g, 13, y + (y < 5 ? dy : (dy > sy ? 0 : 0)), y % 3 ? 'B' : 'a');
      px(g, 14, 12 + dy, 'F'); px(g, 12, 11 + dy, 'F'); px(g, 13, 11 + dy, 'F'); px(g, 13, 12 + dy, 'F');
      // gem
      px(g, 13, 1 + dy, 'e'); px(g, 12, 2 + dy, 'e'); px(g, 13, 2 + dy, 'w'); px(g, 14, 2 + dy, 'E'); px(g, 13, 3 + dy, 'E');
      px(g, 13, 0 + dy, '@'); px(g, 12, 1 + dy, '@'); px(g, 14, 1 + dy, '@'); px(g, 11, 2 + dy, '@'); px(g, 15, 2 + dy, '@');
      px(g, 12, 3 + dy, '@'); px(g, 14, 3 + dy, '@'); px(g, 13, 4 + dy, 'a');
      if (f % 2 === 0 || idle) { px(g, 13, -1, '.'); }
    },
  };

  // ---- GHOST (14x14 -> 16x16) ----------------------------------------------
  function ghost(f) {
    const g = G(14, 14);
    const oy = [1, 0, 1, 2][f];
    const sh = (x, y) => { const t = ((x - 6.5) * 0.6 + (y - oy - 5) * 0.8) / 7; return t < -0.32 ? '<' : t > 0.3 ? '^' : '>'; };
    for (let y = 0; y < 13; y++) for (let x = 0; x < 14; x++) {
      const yy = y - oy;
      let inside = false;
      const cx = 6.5, cy = 5;
      if (yy < 5) { const nx = (x - cx) / 5.9, ny = (yy - cy) / 5.4; inside = nx * nx + ny * ny <= 1; }
      else if (x >= 1 && x <= 12) {
        const wave = Math.round(Math.sin(x * 1.15 + f * Math.PI / 2) * 1.4);
        inside = yy <= 9 + wave + (x === 1 || x === 12 ? -1 : 0);
      }
      if (inside) px(g, x, y, sh(x, y));
    }
    for (let x = 1; x <= 12; x++) { // dark-ish hem underside
      for (let y = 12; y >= 0; y--) if (g.a[y][x] !== '.') { px(g, x, y, '^'); break; }
    }
    // little arms reaching forward
    const ay = 6 + oy + (f % 2);
    px(g, 12, ay, '>'); px(g, 13, ay, '<'); px(g, 13, ay + 1, '>');
    // eyes + mouth
    for (const ex of [8, 11]) { px(g, ex, 3 + oy, 'U'); px(g, ex, 4 + oy, 'U'); px(g, ex, 5 + oy, 'U'); px(g, ex + 1, 4 + oy, 'U'); px(g, ex, 3 + oy, 'e'); px(g, ex, 4 + oy, 'E'); }
    px(g, 9, 7 + oy, 'U'); px(g, 10, 7 + oy, 'U'); px(g, 10, 8 + oy, 'U');
    return fin(g, { outlineColor: '#4e5a7e' });
  }

  // ---- SPIDER (14x10 -> 16x12) ---------------------------------------------
  function spider(f) {
    const g = G(16, 10);
    const oy = [0, 1, 0, 1][f];
    const base = [15, 12, 3, 0], knee = [[14, 1], [12, 0], [4, 0], [1, 1]], hip = [11, 10, 8, 7];
    const sA = [1, 0, -1, 0][f], sB = [-1, 0, 1, 0][f];
    const legs = (col, grpA, grpB) => {
      for (let i = 0; i < 4; i++) {
        const s = (i % 2 === 0 ? grpA : grpB);
        const lift = s === 0;
        const fx = Math.max(0, Math.min(15, base[i] + s));
        const kx = knee[i][0], ky = knee[i][1] + (lift ? -0 : 0) + (lift ? 0 : 1);
        line(g, hip[i], 5 + oy, kx, ky, col);
        line(g, kx, ky, fx, lift ? 7 : 9, col);
        if (lift) px(g, fx, 8, col);
      }
    };
    legs('u', sB, sA);
    legs('P', sA, sB);
    ball(g, 5.8, 5 + oy, 3.9, 3.2, ['P', 'u', 'U']);
    ball(g, 11.4, 5.4 + oy, 2.5, 2.5, ['p', 'P', 'u']);
    px(g, 5, 4 + oy, 'R'); px(g, 4, 5 + oy, 'r'); px(g, 5, 5 + oy, 'r'); px(g, 6, 5 + oy, 'R'); px(g, 5, 6 + oy, 'x');
    px(g, 12, 4 + oy, 'r'); px(g, 13, 4 + oy, 'r'); px(g, 13, 6 + oy, 'R'); px(g, 12, 6 + oy, 'r');
    px(g, 13, 7 + oy, 'w'); px(g, 12, 7 + oy, 'w');
    return fin(g);
  }

  // ---- MUMMY (16x18 -> 18x20) ----------------------------------------------
  const mummyDef = {
    top: 1,
    head: [
      '.....7778.......',
      '....7788778.....',
      '...778999878....',
      '...79kkk7788....',
      '...78kyk9978d...',
      '...7899978880...',
      '....89777890....',
    ],
    torso: [
      '...7877787780...',
      '...8998899890...',
      '....7778877.....',
      '....8998899.....',
      '....7787787.....',
      '....8788978.....',
    ],
    pal: { L: '#dcc08e', Q: '#a8885a', N: '#a8885a', K: '#6e5a3c' },
    back(g, dy, f) {
      // loose bandage strands fluttering behind
      const s = [[[3, 9], [2, 10], [1, 10]], [[3, 10], [2, 10], [1, 11]], [[3, 9], [2, 9], [1, 10]], [[3, 10], [2, 11], [1, 11]]][f % 4];
      s.forEach(([x, y], i) => px(g, x, y + dy, i ? '8' : '7'));
    },
    front(g, dy, f) {
      const a = [0, 1, 0, -1][f];
      // far arm (behind) and near arm, both reaching forward
      for (let x = 9; x <= 14; x++) px(g, x, 8 + dy + a, x % 2 ? '8' : '9');
      for (let x = 9; x <= 14; x++) px(g, x, 9 + dy + a, '9');
      px(g, 15, 8 + dy + a, '8');
      for (let x = 8; x <= 14; x++) px(g, x, 10 + dy - a, x % 2 ? '7' : '8');
      for (let x = 8; x <= 14; x++) px(g, x, 11 + dy - a, x % 2 ? '8' : '9');
      px(g, 15, 10 + dy - a, '7'); px(g, 15, 11 + dy - a, '8');
      px(g, 10, 4 + 1 + dy, 'y'); px(g, 9, 4 + 1 + dy, '#');
      // eye glow
      px(g, 11, 5 + dy + 0, '#');
    },
  };
  function mummy(f) {
    const dy = [1, 0, 1, 0][f];
    const g = G(16, 18);
    const lean = [0, 0, 0, 0][f];
    mummyDef.back(g, dy, f);
    stamp(g, LEGS[RUNLEG[f]], 0, 14);
    stamp(g, mummyDef.torso, lean, 1 + 7 + dy);
    stamp(g, mummyDef.head, lean, 1 + dy);
    mummyDef.front(g, dy, f);
    return fin(g, { pal: mummyDef.pal });
  }

  // ---- WRAITH (18x20 -> 20x22) ---------------------------------------------
  function wraith(f) {
    const g = G(18, 20);
    const oy = [0, 1, 1, 0][f];
    // trailing cloak (flows left/back)
    for (let y = 9; y <= 15; y++) {
      const t = y - 9;
      const sway = Math.round(Math.sin(f * Math.PI / 2 + t * 0.9) * 1.2);
      const x0 = 3 - Math.round(t * 0.9) + sway;
      const x1 = 13 - Math.round(t * 0.2);
      for (let x = Math.max(0, x0); x <= x1; x++) {
        const tt = (x - 8) * 0.5 + (y - 10) * 0.6;
        px(g, x, y + oy, tt < -1.5 ? '6' : tt > 1.3 ? '3' : '5');
        if (x === x0 + 1 && y > 10) px(g, x, y + oy, '4');
      }
    }
    // fold lines
    for (let y = 10; y <= 13; y++) px(g, 8, y + oy, '4');
    for (let y = 12; y <= 13; y++) px(g, 11, y + oy, '4');
    // wispy tails
    for (let x = 0; x <= 13; x++) {
      let bottom = -1;
      for (let y = 17; y >= 9; y--) if (g.a[Math.min(y + oy, 19)][x] !== '.' && 'x') { if (g.a[y + oy] && g.a[y + oy][x] !== '.') { bottom = y + oy; break; } }
      if (bottom < 0) continue;
      const len = 1 + Math.floor((Math.sin(x * 1.1 + f * 1.6) + 1) * 1.8) + (x % 3 === 0 ? 1 : 0);
      for (let k = 1; k <= len; k++) if (bottom + k < 20) px(g, x, bottom + k, k === 1 ? '%' : k === 2 ? '&' : '$');
    }
    // hood
    ball(g, 8, 5 + oy, 5.2, 5.2, ['5', '4', '3']);
    for (let y = 8; y <= 10; y++) for (let x = 3; x <= 13; x++) if (g.a[y + oy][x] === '.') px(g, x, y + oy, y === 8 ? '4' : '5');
    px(g, 3, 4 + oy, '.'); px(g, 2, 3 + oy, '.');
    ball(g, 12.2, 5.5 + oy, 2.8, 3.2, ['3', '3', '3']);   // dark face void
    px(g, 11, 3 + oy, '5'); px(g, 12, 2 + oy, '5');
    px(g, 11, 5 + oy, 'E'); px(g, 11, 6 + oy, 'e'); px(g, 14, 5 + oy, 'E'); px(g, 14, 6 + oy, 'e');
    px(g, 10, 5 + oy, '@'); px(g, 10, 6 + oy, '@'); px(g, 15, 5 + oy, '@'); px(g, 15, 6 + oy, '@');
    px(g, 11, 4 + oy, '@'); px(g, 14, 4 + oy, '@');
    // sleeve + skeletal hand reaching
    const hy = 10 + oy + (f % 2);
    for (let x = 10; x <= 14; x++) { px(g, x, hy, x > 12 ? '4' : '5'); px(g, x, hy + 1, '3'); }
    px(g, 15, hy, 'Z'); px(g, 16, hy, 'W'); px(g, 15, hy + 1, 'z'); px(g, 16, hy - 1, 'W');
    return fin(g);
  }

  // ---- IMP (12x12 -> 14x14) ------------------------------------------------
  function imp(f) {
    const g = G(12, 12);
    const wing = [0, 1, 2, 1][f];                    // 0 up, 1 mid, 2 down
    const oy = [0, 1, 1, 0][f];
    const tip = [[1, 0], [0, 4], [1, 9]][wing];
    // wings behind body
    const wcol = wing === 1 ? 'P' : 'u';
    for (const [sx, sy] of [[6, 5], [5, 6], [5, 7], [6, 8]]) line(g, sx, sy + oy, tip[0], tip[1] + oy, wcol);
    line(g, 5, 6 + oy, tip[0], tip[1] + oy, 'p');
    // tail with flame
    const tail = [[[4, 9], [3, 10], [2, 10], [1, 9], [1, 8]], [[4, 9], [3, 10], [2, 10], [1, 10], [0, 9]], [[4, 9], [3, 10], [2, 10], [1, 9], [0, 8]], [[4, 9], [3, 10], [2, 10], [1, 10], [1, 8]]][f];
    tail.forEach(([x, y]) => px(g, x, y + oy, 'R'));
    const [fx, fy] = tail[tail.length - 1];
    px(g, fx, fy - 1 + oy, 's'); px(g, fx, fy - 2 + oy, 'T'); px(g, fx - 1 + (f % 2), fy - 1 + oy, 'S'); px(g, fx + 1, fy - 1 + oy, 's'); px(g, fx, fy - 2 + oy, 't');
    // legs
    const st = f % 2;
    px(g, 5, 10 + oy, 'x'); px(g, 5 + st, 11, 'x'); px(g, 7, 10 + oy, 'x'); px(g, 7 + (1 - st), 11, 'x'); px(g, 8 + st, 11, 'x');
    ball(g, 6.2, 8 + oy, 2.7, 2.5, ['r', 'R', 'x']);      // body
    px(g, 6, 8 + oy, 'T'); px(g, 7, 8 + oy, 'T');         // belly glow
    ball(g, 7.5, 4 + oy, 3.2, 3, ['r', 'R', 'x']);        // head
    px(g, 6, 0 + oy, 'y'); px(g, 5, 1 + oy, 'Y'); px(g, 10, 0 + oy, 'y'); px(g, 10, 1 + oy, 'Y'); px(g, 6, 1 + oy, 'y'); px(g, 9, 1 + oy, 'y');
    px(g, 9, 3 + oy, 'y'); px(g, 8, 3 + oy, 'k'); px(g, 10, 4 + oy, 'k'); px(g, 10, 5 + oy, 'w'); px(g, 9, 5 + oy, 'k');
    px(g, 11, 4 + oy, 'R'); px(g, 11, 5 + oy, 'x');
    // arms
    px(g, 9, 8 + oy, 'R'); px(g, 10, 7 + oy + (f % 2), 'R'); px(g, 10, 8 + oy, 'x');
    return fin(g);
  }

  // ---- BONE GOLEM (28x28 -> 30x30) -----------------------------------------
  function golem(f) {
    const g = G(28, 28);
    const dy = [0, 2, 0, 2][f];                       // body drops on each slam
    const nearUp = f === 0, farUp = f === 2;
    const BONE = ['W', 'Z', 'z'], DARK = ['Z', 'z', 'D'];
    const ballO = (cx, cy, rx, ry, c) => { ball(g, cx, cy, rx + 1, ry + 1, ['D', 'D', 'D']); ball(g, cx, cy, rx, ry, c); };
    const hipY = 18 + dy;
    const leg = (x, up, c) => {
      const bot = up ? 24 : 27;
      rect(g, x - 1, hipY, 7, bot - hipY - 2, 'D');
      for (let y = hipY; y <= bot - 3; y++) for (let i = 0; i < 5; i++) px(g, x + i, y, i === 0 ? c[0] : i > 3 ? c[2] : c[1]);
      ball(g, x + 2, hipY + 2, 3.4, 2.6, c);
      ball(g, x + 2, bot - 4, 3.2, 2, c);
      rect(g, x - 2, bot - 2, 10, 3, 'D');
      for (let y = bot - 2; y <= bot; y++) for (let i = -1; i < 7; i++) px(g, x + i, y, y === bot - 2 ? c[0] : y === bot ? c[2] : c[1]);
      px(g, x + 1, hipY + 5, 'D'); px(g, x + 3, hipY + 6, 'D'); px(g, x + 2, bot - 6, 'D');
    };
    leg(7, farUp, DARK);
    // far arm behind torso (hangs on the left)
    const fFist = [20, 18, 20, 22][f];
    for (let t = 0; t <= 1; t += 0.15) ballO(6 - t * 2, 9 + dy + t * (fFist - 9), 1.6, 1.6, DARK);
    ballO(4, fFist + dy * 0.5, 3.4, 3.6, DARK);
    // pelvis + torso
    ballO(13.5, hipY - 1, 4.2, 2.2, BONE);
    ballO(13.5, 10 + dy, 7.2, 5.6, BONE);
    for (const ry of [8, 10, 13]) for (let x = 8; x <= 19; x++) if (g.a[ry + dy][x] !== '.') px(g, x, ry + dy, (x + ry) % 4 < 2 ? 'D' : 'z');
    for (let y = 6; y <= 15; y++) px(g, 13, y + dy, 'D');
    leg(16, nearUp, BONE);
    // shoulders
    ballO(6.5, 8 + dy, 3.6, 3.2, BONE);
    ballO(21, 8 + dy, 4, 3.6, BONE);
    px(g, 5, 8 + dy, 'D'); px(g, 21, 9 + dy, 'D'); px(g, 22, 7 + dy, 'D');
    // skull head, hunched forward
    ballO(16.5, 4.5 + dy, 4.8, 3.9, ['W', 'W', 'Z']);
    for (let x = 14; x <= 20; x++) px(g, x, 8 + dy, x % 2 ? 'z' : 'W');
    px(g, 21, 7 + dy, 'z'); px(g, 21, 6 + dy, 'Z');
    rect(g, 13, 4 + dy, 3, 3, 'k'); rect(g, 18, 4 + dy, 3, 3, 'k');
    px(g, 14, 5 + dy, 'r'); px(g, 15, 5 + dy, 'r'); px(g, 19, 5 + dy, 'r'); px(g, 20, 5 + dy, 'r'); px(g, 14, 4 + dy, 'R'); px(g, 19, 4 + dy, 'R');
    px(g, 12, 5 + dy, '!'); px(g, 21, 5 + dy, '!'); px(g, 14, 3 + dy, '!'); px(g, 19, 3 + dy, '!');
    px(g, 17, 6 + dy, 'D'); px(g, 16, 7 + dy, 'k');
    // near arm + huge fist (front)
    const nfy = [18, 20, 22, 20][f];
    for (let t = 0; t <= 1; t += 0.14) ballO(21.5 + t * 2, 10 + dy + t * (nfy - 10 + dy * 0.5), 1.9, 1.9, BONE);
    ballO(23.5, nfy + 1 + dy * 0.5, 3.6, 3.6, BONE);
    for (let i = 0; i < 3; i++) px(g, 22 + i * 2 - 1, nfy + 2 + dy * 0.5, 'D');
    return fin(g);
  }

  function shadow() {
    const g = G(16, 6);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) {
      const nx = (x - 7.5) / 8, ny = (y - 2.5) / 3;
      const d = nx * nx + ny * ny;
      if (d <= 1) px(g, x, y, d > 0.55 ? 's' : 'S');
    }
    return fin(g, { outline: false, pal: { s: 'rgba(0,0,0,0.2)', S: 'rgba(0,0,0,0.35)' } });
  }

  return {
    build() {
      const out = {};
      const K = heroSet(knight), R = heroSet(rogue), M = heroSet(mage);
      out.hero_knight_run = K.run; out.hero_knight_idle = K.idle;
      out.hero_rogue_run = R.run; out.hero_rogue_idle = R.idle;
      out.hero_mage_run = M.run; out.hero_mage_idle = M.idle;
      out.ghost = frames(4, ghost);
      out.spider = frames(4, spider);
      out.mummy = frames(4, mummy);
      out.wraith = frames(4, wraith);
      out.imp = frames(4, imp);
      out.bone_golem = frames(4, golem);
      out.enemy_shadow = [shadow()];
      return out;
    },
  };
})();
