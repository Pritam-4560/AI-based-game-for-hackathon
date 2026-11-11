// art.js - procedural pixel art for Lost Chambers (new monsters, items, world props).
// Every sprite is authored as rows of palette characters ('.' = transparent).
// A 1px dark outline (#484241, same as the original pack) is added automatically
// around solid pixels unless the sprite opts out; glow/flame/blood characters
// never generate outline.
const ART = (() => {
  const OUT = '#484241';
  const PAL = {
    o: OUT, k: '#2a2630', w: '#f2f2f0',
    // greens (goblin skin)
    g: '#a6c95a', G: '#76a043', h: '#4f7432',
    // slime
    q: '#eaffd8', s: '#9be57f', S: '#5cbf55', z: '#368a46', Z: '#256a38',
    // browns
    b: '#c08a5c', B: '#94603f', n: '#5e3b2a',
    // purples
    p: '#a77cc8', P: '#7a4f9c', u: '#4f3070', U: '#2b1a3c',
    // greys / steel
    l: '#dcdae4', m: '#b0adbd', M: '#827f90', d: '#5c5966',
    // ogre blue-grey
    e: '#a9bccd', E: '#7d93aa', f: '#56677e',
    // reds
    r: '#f25050', R: '#b83a40', x: '#7c1f2c', X: '#531624',
    // gold
    y: '#ffe27a', Y: '#e5ad35', a: '#a8692a',
    // blue
    c: '#8fd4ff', C: '#4a8ee0', v: '#2c56a8',
    // eye glow / magic green
    i: '#b4ff6a', I: '#4fd04a', j: '#2e8c3a',
    // parchment
    t: '#f6e8c4', T: '#dcc08e', A: '#a8885a',
    // skin of lich bones
    W: '#c7c7af', V: '#9e9e89',
    // flame (no outline)
    '1': '#fff7c0', '2': '#ffd04a', '3': '#ff8a24', '4': '#d0421e',
    // glows (no outline)
    '5': 'rgba(120,255,110,0.35)', '6': 'rgba(150,255,120,0.7)',
    '7': 'rgba(255,190,90,0.35)',
    // blood (no outline)
    '8': '#5a121c', '9': '#7e1c26', '0': '#9a2a30',
    // heart glow (no outline)
    '+': 'rgba(255,60,90,0.28)', '*': 'rgba(255,90,110,0.55)',
  };
  const NOOUT = new Set('1234567890+*'.split(''));

  // ---- rendering ----------------------------------------------------------
  function norm(rows) {
    const w = Math.max(...rows.map(r => r.length));
    return rows.map(r => r.padEnd(w, '.'));
  }
  function render(rows, opt) {
    opt = opt || {};
    const pal = Object.assign({}, PAL, opt.pal || {});
    rows = norm(rows);
    const outline = opt.outline !== false;
    const pad = outline ? 1 : 0;
    const H = rows.length, W = rows[0].length;
    const cw = W + pad * 2, ch = H + pad * 2;
    const g = [];
    for (let y = 0; y < ch; y++) {
      g.push([]);
      for (let x = 0; x < cw; x++) {
        const sy = y - pad, sx = x - pad;
        g[y].push(sy >= 0 && sy < H && sx >= 0 && sx < W ? rows[sy][sx] : '.');
      }
    }
    if (outline) {
      const solid = (x, y) => x >= 0 && y >= 0 && x < cw && y < ch && g[y][x] !== '.' && g[y][x] !== '~' && !NOOUT.has(g[y][x]);
      const add = [];
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        if (g[y][x] !== '.' && !NOOUT.has(g[y][x])) continue;
        if (g[y][x] !== '.') continue; // keep glow pixels as they are
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) add.push([x, y]);
      }
      for (const [x, y] of add) g[y][x] = 'o';
    }
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const cx = cv.getContext('2d');
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const c = g[y][x];
      if (c === '.' || c === '~') continue;
      const col = pal[c];
      if (!col) continue;
      cx.fillStyle = col;
      cx.fillRect(x, y, 1, 1);
    }
    return cv;
  }

  // ---- row helpers --------------------------------------------------------
  const blank = w => '.'.repeat(w);
  // shift the upper body down one pixel (drops row `drop`), keeps legs fixed
  function bob(top, drop) {
    const w = norm(top)[0].length;
    return [blank(w)].concat(top.filter((_, i) => i !== drop));
  }
  function grid(w, h) { const a = []; for (let y = 0; y < h; y++) a.push(new Array(w).fill('.')); return a; }
  const toRows = gr => gr.map(r => r.join(''));
  function put(gr, x, y, c) { if (y >= 0 && y < gr.length && x >= 0 && x < gr[0].length) gr[y][x] = c; }
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // ---- BAT (14x10 interior -> 16x12) --------------------------------------
  const batUp = [
    'pP..........Pp',
    'uPp........pPu',
    'uuPp.B..B.pPuu',
    '.uuPpBBBBpPuu.',
    '..uuBbbbbBuu..',
    '...uBbrbrBu...',
    '....BbbbbB....',
    '.....BBBB.....',
    '......nn......',
    '..............',
  ];
  const batMid = [
    '..............',
    '.....B..B.....',
    '.....BBBB.....',
    '.pPpBbbbbBpPp.',
    'pPPpBbrbrBpPPP',
    'uuPuBbbbbBuPuu',
    'u.u.uBbbBu.u.u',
    '.....BnnB.....',
    '..............',
    '..............',
  ];
  const batDown = [
    '..............',
    '..............',
    '.....B..B.....',
    '.....BBBB.....',
    '...pBbbbbBp...',
    '..pPBbrbrBPp..',
    '.pPuBbbbbBuPp.',
    'pPu.uBnnBu.uPp',
    'Pu..........uP',
    'u............u',
  ];
  const batDead = [
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '....n.....n...',
    '..uPpBBBBpPu..',
    '.uPpBbkbkBpPu.',
    'uuPuBbbbbBuPuu',
    '.u.u.BBBB.u.u.',
  ];

  // ---- SLIME (12x10 interior -> 14x12) ------------------------------------
  const slimeN = [
    '............',
    '............',
    '....SSSS....',
    '...SqqsSS...',
    '..SqqsSSSS..',
    '.SqssSSkSkS.',
    '.SssSSSkSkS.',
    'SsSSSSSSSSSz',
    'SSSSSSSSSSzz',
    '.zzzzzzzzzz.',
  ];
  const slimeSq = [
    '............',
    '............',
    '............',
    '............',
    '...SSSSSS...',
    '.SqqsSSSSSS.',
    'SqssSSSkSkSS',
    'SsSSSSSkSkSz',
    'SSSSSSSSSSzz',
    'zzzzzzzzzzzz',
  ];
  const slimeSt = [
    '.....SS.....',
    '....SqqS....',
    '...SqqsSS...',
    '...SqsSSSS..',
    '...SsSkSkS..',
    '...SsSkSkS..',
    '...SSSSSSS..',
    '..SSSSSSSSz.',
    '..SSSSSSSzz.',
    '...zzzzzzz..',
  ];
  const slimeDead = [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '...SqsSS....',
    '.SsSSSSSSSz.',
    'zSSzzSSSzzzz',
  ];
  // slime body slightly translucent so the floor tints through
  const slimePal = { S: 'rgba(92,191,85,0.92)', s: 'rgba(155,229,127,0.92)', z: 'rgba(54,138,70,0.95)' };

  // ---- GOBLIN ARCHER (16x16 interior -> 18x18) ----------------------------
  const archTop = [
    '......nnnn......',
    '....nnBbbbnn....',
    '...nBbbbBBBBn...',
    '..nBbbBBBBBBBn..',
    'ggnBggggggggBnGG',
    '.gnBgykggykgBnG.',
    '..nBggkwwkGGBn..',
    '...nBhhhhhhBn...',
    '....nBBbbBBn.Y..',
    '...gBbbbbBBBl.Y.',
    '..ggnnnynnnnlGY.',
    '...hBbbbbBBBlGa.',
    '....BbbbbBBBl.Y.',
    '....nBBnnBBn.Y..',
  ];
  const archLegs = {
    stand: ['.....BB..BB.....', '....nnn..nnn....'],
    a: ['....BB...BB.....', '...nnn...nn.....'],
    b: ['.....BB...BB....', '.....nn...nnn...'],
  };
  // rotate 90deg clockwise (head ends up on the right), then sit it on the bottom row
  function lieDown(rows, h) {
    rows = norm(rows);
    const H = rows.length, W = rows[0].length, out = [];
    for (let y = 0; y < W; y++) { let s = ''; for (let x = 0; x < H; x++) s += rows[H - 1 - x][y]; out.push(s); }
    const t = out.filter(r => /[^.]/.test(r));
    while (t.length < h) t.unshift(blank(H));
    return t;
  }
  const archDead = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....nnnnnn.....',
    '...nnBbbbBBnn...',
    '..nBbggggggBBn..',
    'ggnBkgkgkgkgBnGG',
    '.gnBgkgggkgGBnG.',
    '..nBBbbbbbbBBn..',
    '.YYYYYYlllllYa..',
    '..nnn......nnn..',
  ];

  // ---- OGRE (20x20 interior -> 22x22) -------------------------------------
  const ogreTop = [
    '...............nn...',
    '........eeEE..nbbBn.',
    '.......eeEEEE.nbBBn.',
    '......eEfEEfE.bMBBn.',
    '......eErEErE.nbBMn.',
    '......eEEfEEE..nBn..',
    '......ewkkkwE.eeEf..',
    '...eeeeEEEEEEeEEEf..',
    '..eeeEEEEEEEEEEEEf..',
    '.eeEEEfEEEEEEEfEEf..',
    '.eEEEEfEEEEEEEfEf...',
    'eeEEEEEffEEEffEEf...',
    'eEEfEEEEEEEEEEEEf...',
    'eEEfnBBBBBBBBBBn....',
    'eEf.nBbbBBBBBbBn....',
    '.f..nBbBBnBBBBBn....',
    '....nBBBnnnBBBBn....',
  ];
  const ogreLegs = {
    stand: ['.....eEEf..eEEf.....', '.....eEEf..eEEf.....', '....ffff...ffff.....'],
    a: ['....eEEf...eEEf.....', '....eEEf....eEf.....', '...ffff.....fff.....'],
    b: ['.....eEf..eEEf......', '.....eEf...eEEf.....', '.....fff...ffff.....'],
  };
  // club raised higher (telegraph pose)

  const ogreDead = [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '..........nn........',
    '..eEE....nbbBn......',
    '.eEEEfeeEnBMBn..eEE.',
    'eEkEEfEEEEnBnEEeEEEf',
    'eEEkEEEEEEEnnBBBnEEf',
    'eEEwkfEEEEEEBbbBnEEf',
    '.eEEEfEEEEEEBBBBnEf.',
    '..fff.fEEEEEnBBn.f..',
    '.......ffff..nn.....',
  ];

  // ---- LICH (20x24 interior -> 22x26) -------------------------------------
  const lichHead = [
    '........uPPu......i.',
    '.......uPpPPu....iqI',
    '......uPpPPPPu....I.',
    '.....uPpUUUUPPu...a.',
    '.....uPUWwwwUPu...a.',
    '.....uPwiwwiwPu...a.',
    '.....uPWwwkwWPu...a.',
    '.....uUUwkwkUUu...a.',
  ];
  // robe rows 8..20: [left edge, right edge]; front opening widens downward
  const lichEdges = [[4, 15], [3, 16], [2, 16], [2, 16], [2, 16], [3, 16], [3, 16], [3, 16], [2, 17], [2, 17], [1, 17], [1, 17], [0, 18]];
  const lichBody = lichHead.concat(lichEdges.map(([L, R], i) => {
    const r = i + 8, row = new Array(20).fill('.');
    const half = i < 1 ? 0 : 1 + Math.floor((i - 1) / 4); // opening half width
    for (let x = L; x <= R; x++) {
      let c = 'P';
      if (x === L || x === R) c = 'u';
      else if (x === L + 1 && i > 0) c = 'p';
      else if (x === R - 1) c = 'u';
      else if (x - L < 4 && (x + r) % 5 === 0) c = 'p';
      if (Math.abs(x - 10) < half) c = 'U';
      else if (Math.abs(x - 10) === half && half > 0) c = 'j';
      if (i === 0 && (x === 9 || x === 10)) c = 'j';
      if (i === 4 && x > L && x < L + 4) c = 'u'; // sleeve cuff shadow
      row[x] = c;
    }
    if (i === 4) { row[L] = 'W'; } // bony left hand peeking from the sleeve
    if (i === 1 || i === 2) row[17] = i === 1 ? 'w' : 'W';
    row[18] = 'a';
    if (r === 20) row[19] = 'a', row[18] = 'u';
    return row.join('');
  }));
  const lichHemA = ['uUPUUuUPUUPuUUPUuUua', 'U.u.U.U..U.u..U.U.a.', '..................a.'];
  const lichHemB = ['uPUUuUPUUuPUUuPUUUua', '.U.U..U.U..U.U..U.a.', '..................a.'];
  const gemBright = { i: '#e2ffb0', I: '#8cff6a', q: '#ffffff' };
  const lichDead = [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '...............i....',
    '..............Iqi...',
    '...............I....',
    '.....WwwW.......a...',
    '....WkwwkW.......a..',
    '....WwkwwW..uPPu..a.',
    '.....wkwk..uPpPPu...',
    '...uuPPPPuuPPPPPPu..',
    '..uPpPPPPPPPPUPPPPu.',
    '.uPpPPUPPPPPUPPPPPPu',
    '.UuUPUuUPUUuUPUuUUU.',
  ];

  // ---- ITEMS --------------------------------------------------------------
  const gold = [
    '.....yy.....',
    '....yqyY....',
    '..yyyyYYa...',
    '.yqyYYyYYaY.',
    '.yyYYaYYYYa.',
    'yqyYYYaYyYaa',
    'yyYYaaYYYYYa',
    '.aaaaaaaaaa.',
  ];
  const chest = [
    '.bbYbbbbYbb.',
    'bbBYBBBBYBBn',
    'bBBYBBBBYBBn',
    'oooYoyyoYooo',
    'BbBYBykBYBBn',
    'BBBYByyBYBBn',
    'BBBYBBBBYBBn',
    'nnnannnnannn',
  ];
  const chestOpen = [
    '.bbYbbbbYbb.',
    'bnnannnnannn',
    'nkkkkkkkkkkn',
    'BkyqyykyykkB',
    'oooYooooYooo',
    'BbBYBBBBYBBn',
    'BBBYBBBBYBBn',
    'nnnannnnannn',
  ];
  const axe = (() => {
    const gr = grid(12, 12);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const s = 12 - (x + y), t = x - y; // s: towards top-left of the haft, t: along the haft
      if ((s === 0 || s === -1) && t >= -10 && t <= 7) gr[y][x] = s === 0 ? 'b' : 'B';
      if (s >= 1 && s <= 5 && Math.abs(t - 3) <= 1 + s * 0.75) gr[y][x] = s >= 4 ? 'l' : s === 3 ? 'm' : 'M';
      if (s >= -3 && s <= -2 && Math.abs(t - 3) <= 1) gr[y][x] = 'M';
    }
    gr[11][1] = 'Y'; gr[10][1] = 'a';
    return toRows(gr);
  })();
  const plate = [
    '.lmm....mMd.',
    'llllmllmMMMd',
    'lwlllmmlMMMd',
    '.lwllllmMMd.',
    '.lllllmmMMd.',
    '.lwllllmMMd.',
    '.YyYYYYYYYa.',
    '.mllllmMMMd.',
    '..mllmMMMd..',
    '...mmMMdd...',
  ];
  const potionBig = [
    '...bBBn...',
    '..yYYYYa..',
    '...lwmm...',
    '...lwmm...',
    '..lwrrRm..',
    '.lwrrrrRm.',
    'lwqrrrrRRx',
    'lwrrrrrRRx',
    'lrrrrrRRRx',
    '.rrrRRRRx.',
    '..xxxxxx..',
  ];
  const scroll = [
    '.tttttttttt.',
    'TTTTTTTTTTTT',
    'AAAAAAAAAAAA',
    '.tAAAAAAAtT.',
    '.tttttttttT.',
    '.tAAAAtttTT.',
    '.ttttCCtttT.',
    '.tttCqcCttT.',
    '.tttCCCCttt.',
    'ttttttttttTT',
    'TTTTTTTTTTTT',
    'AAAAAAAAAAAA',
  ];
  const scrollBlue = { q: '#e0f4ff' };
  const scrollGreen = { C: '#3fae4a', c: '#8ee87a', v: '#246c30', q: '#e6ffd8' };
  const heart = [
    '..RR...RR..',
    '.RrrR.RrrR.',
    'RrwqrRrrrxR',
    'RqqrrrrrrxR',
    'RrqrrrrrxxR',
    '.RrrrrrxxR.',
    '..RrrrxxR..',
    '...RrxxR...',
    '....RxR....',
    '.....R.....',
  ];
  const heartPalDim = { r: '#d23a4a', R: '#8e2032', q: '#ff8a96', w: '#ffd0d6', x: '#6a1528' };
  const heartPalBright = { r: '#ff5a6a', R: '#c8303f', q: '#ffb4bc', w: '#ffffff', x: '#9a2036' };

  // ---- WORLD --------------------------------------------------------------
  const torchFlames = [
    ['...4..', '..43..', '.4324.', '.3213.', '.3213.', '..33..'],
    ['..4...', '.343..', '.3234.', '.3212.', '.3213.', '..33..'],
    ['....4.', '..434.', '.4323.', '.3123.', '.3213.', '..33..'],
  ];
  const torchBase = [
    'aYYYYa',
    '.aYYa.',
    '..Bn..',
    '..Bn..',
    'mMBnMd',
    '.MddM.',
  ];

  function spikes(up) {
    const gr = grid(16, 16);
    const spots = [[4, 6], [11, 6], [4, 13], [11, 13], [7, 9.5]];
    for (const [sx, sy0] of spots) {
      const sx0 = Math.round(sx), sy = Math.round(sy0);
      if (!up) {
        put(gr, sx0 - 1, sy, 'k'); put(gr, sx0, sy, 'k'); put(gr, sx0 + 1, sy, 'k');
        put(gr, sx0 - 1, sy - 1, 'o'); put(gr, sx0, sy - 1, 'o'); put(gr, sx0 + 1, sy - 1, 'o');
        put(gr, sx0 - 1, sy + 1, 'M'); put(gr, sx0, sy + 1, 'M'); put(gr, sx0 + 1, sy + 1, 'd');
      } else {
        // base hole
        put(gr, sx0 - 2, sy, 'o'); put(gr, sx0 + 2, sy, 'o');
        // triangular spike
        const sp = [
          [0, -4, 'l'],
          [0, -3, 'l'], [-1, -2, 'o'], [1, -3, 'o'], [-1, -3, 'o'], [0, -5, 'o'],
          [0, -2, 'm'], [1, -2, 'M'],
          [-1, -1, 'l'], [0, -1, 'm'], [1, -1, 'M'],
          [-1, 0, 'm'], [0, 0, 'M'], [1, 0, 'd'],
          [-2, -1, 'o'], [2, -1, 'o'], [2, -2, 'o'],
          [-1, 1, 'o'], [0, 1, 'o'], [1, 1, 'o'],
        ];
        for (const [dx, dy, c] of sp) put(gr, sx0 + dx, sy + dy, c);
      }
    }
    return toRows(gr);
  }

  function fountain(full) {
    const gr = grid(14, 14), cx = 6.5, cy = 6.5;
    const inE = (x, y, rx, ry, oy) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy - (oy || 0)) / ry) ** 2 <= 1;
    for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
      let c = '.';
      for (let t = 1; t <= 4; t++) if (inE(x, y, 7, 4.6, t)) c = (x + Math.floor((y - t) / 2) * 3) % 5 === 0 ? 'd' : (x < 4 ? 'M' : 'M');
      if (c !== '.' && y >= 12) c = 'd';
      if (inE(x, y, 7, 4.6)) c = (y < 5 || x < 3) ? 'l' : 'm';
      if (inE(x, y, 5.2, 3.0)) {
        if (full) c = y <= 5 ? 'c' : 'C';
        else c = 'd';
      }
      gr[y][x] = c;
    }
    if (full) { put(gr, 3, 6, 'w'); put(gr, 4, 6, 'c'); put(gr, 9, 8, 'c'); put(gr, 8, 8, 'w'); put(gr, 5, 9, 'v'); put(gr, 6, 9, 'v'); put(gr, 7, 9, 'v'); }
    else { put(gr, 4, 6, 'k'); put(gr, 5, 7, 'k'); put(gr, 9, 7, 'k'); put(gr, 8, 8, 'k'); put(gr, 3, 7, 'M'); }
    // centre pillar + spout
    for (let y = 2; y <= 7; y++) { put(gr, 6, y, 'l'); put(gr, 7, y, 'M'); }
    put(gr, 5, 7, 'm'); put(gr, 8, 7, 'd');
    put(gr, 5, 1, 'l'); put(gr, 6, 1, 'l'); put(gr, 7, 1, 'm'); put(gr, 8, 1, 'M');
    if (full) { put(gr, 6, 0, 'c'); put(gr, 7, 0, 'c'); put(gr, 4, 2, 'c'); put(gr, 9, 2, 'c'); put(gr, 4, 3, 'c'); put(gr, 9, 3, 'C'); put(gr, 4, 4, 'C'); put(gr, 9, 4, 'C'); }
    return toRows(gr);
  }
  const fountainFull = fountain(true), fountainDry = fountain(false);

  function blood(seed) {
    const gr = grid(16, 16), R = rng(seed);
    const blobs = [[8, 8, 3.3]];
    for (let i = 0; i < 4; i++) {
      const a = R() * Math.PI * 2, d = 2 + R() * 2.5;
      blobs.push([8 + Math.cos(a) * d, 8 + Math.sin(a) * d, 1.2 + R() * 1.6]);
    }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      for (const [bx, by, br] of blobs) {
        const dd = Math.hypot(x + 0.5 - bx, y + 0.5 - by);
        if (dd < br) { put(gr, x, y, dd < br - 1.6 ? '9' : '8'); break; }
      }
    }
    for (let i = 0; i < 6; i++) {
      const a = R() * Math.PI * 2, d = 5 + R() * 2.5;
      put(gr, Math.round(8 + Math.cos(a) * d), Math.round(8 + Math.sin(a) * d), R() < 0.5 ? '8' : '9');
    }
    // wet highlight top-left of the centre pool
    put(gr, 7, 7, '0'); put(gr, 6, 7, '0'); put(gr, 7, 6, '0');
    return toRows(gr);
  }

  const bones = [
    '..............',
    '..............',
    '..............',
    '..............',
    '......WWW.....',
    '.....WwwwW....',
    '.....wkwkW....',
    '.ww..WwwwV.ww.',
    '.wWw..wVw.wWw.',
    '..wWwWW.WwWV..',
    '...VwWVWVWV...',
    '..wwWV..wWww..',
    '.wWV......wWV.',
    '..V........V..',
  ];

  // ---- PROJECTILES --------------------------------------------------------
  const arrow = [
    'rw......l.',
    '.rwbbbbbml',
    'rw......M.',
  ];
  const arrowPal = { b: '#c8925e', r: '#e04848', w: '#f2f2f0' };
  const bolt = [
    ['..5555..', '.56II65.', '56IiiI65', '5IiqqiI5', '5IiqqiI5', '56IiiI65', '.56II65.', '..5555..'],
    ['...55...', '..5665..', '.56ii65.', '56iqqi65', '56iqqi65', '.56ii65.', '..5665..', '...55...'],
  ];

  function build() {
    const S = {};
    const F = (rows, opt) => render(rows, opt);

    S.bat = [F(batUp), F(batMid), F(batDown), F(batMid)];
    S.bat_dead = [F(batDead)];

    S.slime = [F(slimeN, { pal: slimePal }), F(slimeSq, { pal: slimePal }), F(slimeSt, { pal: slimePal })];
    S.slime_dead = [F(slimeDead, { pal: slimePal })];

    S.archer = [
      F(archTop.concat(archLegs.stand)),
      F(bob(archTop, 8).concat(archLegs.a)),
      F(archTop.concat(archLegs.stand)),
      F(bob(archTop, 8).concat(archLegs.b)),
    ];
    S.archer_dead = [F(archDead)];

    S.ogre = [
      F(ogreTop.concat(ogreLegs.stand)),
      F(bob(ogreTop, 7).concat(ogreLegs.a)),
      F(ogreTop.concat(ogreLegs.stand)),
      F(bob(ogreTop, 7).concat(ogreLegs.b)),
    ];
    S.ogre_dead = [F(ogreDead)];

    const lichA = ['....................'].concat(lichBody, lichHemA.slice(0, 2)); // 24 rows, grounded
    const lichUp = lichBody.concat(lichHemB.slice(0, 2), ['..................a.']); // raised 1px
    const lichB = ['....................'].concat(lichBody, lichHemB.slice(0, 2));
    const lichUp2 = lichBody.concat(lichHemA.slice(0, 2), ['..................a.']);
    S.lich = [F(lichA), F(lichUp, { pal: gemBright }), F(lichB), F(lichUp2, { pal: gemBright })];
    S.lich_dead = [F(lichDead)];

    S.gold = [F(gold)];
    S.chest = [F(chest)];
    S.chest_open = [F(chestOpen)];
    S.axe = [F(axe)];
    S.plate = [F(plate)];
    S.potion_big = [F(potionBig)];
    S.scroll_teleport = [F(scroll, { pal: scrollBlue })];
    S.scroll_mapping = [F(scroll, { pal: scrollGreen })];
    S.heart = [
      F(halo(heart, '+'), { pal: heartPalDim }),
      F(halo(heart, '*'), { pal: heartPalBright }),
      F(halo(heart, '+'), { pal: Object.assign({}, heartPalDim, { r: '#e8485a' }) }),
    ];

    S.torch = torchFlames.map((fl, i) => F(fl.concat(torchBase), { pal: i === 1 ? { '2': '#ffe070' } : null }));
    S.spikes = [F(spikes(false), { outline: false }), F(spikes(true), { outline: false })];
    S.fountain = [F(fountainFull), F(fountainDry)];
    S.blood = [F(blood(7), { outline: false }), F(blood(31), { outline: false }), F(blood(1234), { outline: false })];
    S.bones = [F(bones)];

    S.arrow = [F(arrow, { outline: false, pal: arrowPal })];
    S.bolt = bolt.map(b => F(b, { outline: false }));
    return S;
  }

  // surround a shape with a 1px ring of glow characters (outside the outline)
  function halo(rows, ch) {
    rows = norm(rows);
    const H = rows.length + 4, W = rows[0].length + 4;
    const g = grid(W, H);
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[0].length; x++) g[y + 2][x + 2] = rows[y][x];
    // cells at chebyshev distance 2 from solid (outline will take distance 1)
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] !== '.' && !'+*'.includes(g[y][x]);
    const out = g.map(r => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] !== '.') continue;
      let near1 = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1);
      if (near1) continue;
      let near2 = false;
      for (let dy = -2; dy <= 2 && !near2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 2 && solid(x + dx, y + dy)) { near2 = true; break; }
      }
      if (near2) out[y][x] = ch;
    }
    // strip the outer padding that is unused only when nothing there
    return out.map(r => r.join(''));
  }

  return { build };
})();
