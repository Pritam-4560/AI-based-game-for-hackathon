"use strict";
// Last Light - a casual lantern roguelite. Baddies steal your flame; the dark is where you get hurt.

// ---------- guarded modules ----------
const HAS_FX = typeof FX !== "undefined", HAS_SOUND = typeof Sound !== "undefined";
const fx = (n, ...a) => { try { if (HAS_FX && FX[n]) return FX[n](...a); } catch (e) { console.warn("fx", n, e); } };
const sfx = (n, o) => { try { if (HAS_SOUND) Sound.play(n, o); } catch (e) {} };
const music = (n, ...a) => { try { if (HAS_SOUND && Sound.music && Sound.music[n]) Sound.music[n](...a); } catch (e) {} };

const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hyp = Math.hypot;
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }

// ---------- sprites (all drawn in code, nothing borrowed) ----------
const ANIM = {};
function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function buildAnims() {
  for (const M of [typeof ART !== "undefined" && ART, typeof ARTC !== "undefined" && ARTC, typeof ARTI !== "undefined" && ARTI]) { if (M) try { Object.assign(ANIM, M.build()); } catch (e) { console.warn("art", e); } }
  const lit = ANIM.prop_torch[0], off = mkCanvas(lit.width, lit.height), g = off.getContext("2d"); g.drawImage(lit, 0, 0);
  const d = g.getImageData(0, 0, off.width, off.height), cut = Math.round(off.height * 0.36);
  for (let y = 0; y < off.height; y++) for (let x = 0; x < off.width; x++) { const i = (y * off.width + x) * 4, r = d.data[i], gg = d.data[i + 1], b = d.data[i + 2]; if (y < cut || (r > 170 && r > b + 60 && gg > 70 && y < off.height * 0.55)) d.data[i + 3] = 0; }
  g.putImageData(d, 0, 0); ANIM.brazier_off = [off];
  const L = mkCanvas(9, 11), q = L.getContext("2d"), px = (c, x, y, w = 1, h = 1) => { q.fillStyle = c; q.fillRect(x, y, w, h); };
  px("#484241", 3, 0, 3, 1); px("#484241", 2, 1); px("#484241", 6, 1); px("#484241", 2, 2, 5, 1); px("#484241", 1, 3, 7, 7); px("#484241", 2, 10, 5, 1);
  px("#8a5a2a", 2, 3, 5, 1); px("#8a5a2a", 2, 9, 5, 1); px("#ffb347", 2, 4, 5, 5); px("#ffe9a0", 3, 5, 3, 3); px("#ffffff", 4, 6);
  ANIM.lantern = [L];
  // wall: chunky stone bricks
  const W = mkCanvas(16, 16), w = W.getContext("2d"); w.fillStyle = "#6f6a86"; w.fillRect(0, 0, 16, 16); w.fillStyle = "#8a85a4"; w.fillRect(0, 0, 16, 1); w.fillRect(0, 8, 16, 1);
  w.fillStyle = "#484462"; w.fillRect(0, 7, 16, 1); w.fillRect(0, 15, 16, 1); w.fillRect(7, 0, 1, 7); w.fillRect(15, 0, 1, 7); w.fillRect(3, 8, 1, 7); w.fillRect(11, 8, 1, 7);
  w.fillStyle = "#5c5876"; w.fillRect(2, 3, 2, 1); w.fillRect(10, 4, 3, 1); w.fillRect(6, 11, 2, 1); w.fillRect(13, 12, 2, 1); ANIM.wall = [W];
  // heart and sun pickups
  const H = mkCanvas(9, 8), hc = H.getContext("2d"); hc.fillStyle = "#484241"; for (const [x, y, ww] of [[1, 0, 3], [5, 0, 3], [0, 1, 9], [0, 2, 9], [0, 3, 9], [1, 4, 7], [2, 5, 5], [3, 6, 3], [4, 7, 1]]) hc.fillRect(x, y, ww, 1);
  hc.fillStyle = "#ff5a7a"; for (const [x, y, ww] of [[1, 1, 3], [5, 1, 3], [1, 2, 7], [1, 3, 7], [2, 4, 5], [3, 5, 3], [4, 6, 1]]) hc.fillRect(x, y, ww, 1); hc.fillStyle = "#ffc0cc"; hc.fillRect(2, 2, 1, 1); ANIM.heart = [H];
  const Sn = mkCanvas(13, 13), sc = Sn.getContext("2d"); sc.fillStyle = "#ffd27a"; for (const [x, y] of [[6, 0], [6, 12], [0, 6], [12, 6], [2, 2], [10, 2], [2, 10], [10, 10]]) sc.fillRect(x, y, 1, 1);
  sc.fillStyle = "#b8501a"; sc.fillRect(4, 3, 5, 7); sc.fillRect(3, 4, 7, 5); sc.fillStyle = "#ffc24a"; sc.fillRect(4, 4, 5, 5); sc.fillStyle = "#fff3c4"; sc.fillRect(5, 5, 2, 2); ANIM.sun = [Sn];
}
const A = k => ANIM[k];
const frameAt = (fr, t, fps, off = 0) => fr[((Math.floor(t * fps + off) % fr.length) + fr.length) % fr.length];
const tintCache = new Map();
function tintFrame(src, color, wash) {
  const key = color + "|" + (wash || 0); let m = tintCache.get(key); if (!m) tintCache.set(key, m = new WeakMap());
  let c = m.get(src); if (c) return c; c = mkCanvas(src.width, src.height); const x = c.getContext("2d"); x.drawImage(src, 0, 0);
  if (wash) { x.globalCompositeOperation = "source-atop"; x.globalAlpha = wash; } else x.globalCompositeOperation = "source-in";
  x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); m.set(src, c); return c;
}
const IC = {}; function icon(k, scale = 4) { if (IC[k]) return IC[k]; const im = A(k)[0], c = mkCanvas(im.width * scale, im.height * scale), g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, c.width, c.height); return IC[k] = c.toDataURL(); }

// ---------- content ----------
let RW = 16, RH = 12; const MAXF = 100;
const T = { emberFlame: 2, searLantern: 1.5, searBrazier: 2, brazierR: 3.2, towerCd: 0.75, towerHeal: 15, throwMax: 6.5, flick: 5.5 };
const ENEMY = {
  moth:     { name: "Nibbler",  anim: "bat",    hp: 5,   spd: 3.1, steal: 3,  r: 0.28, embers: 1, fps: 12, coin: 0.15 },
  shade:    { name: "Sneak",    anim: "ghost",  hp: 22,  spd: 2.7, steal: 8, r: 0.34, embers: 3, fps: 6,  coin: 0.6 },
  statue:   { name: "Peekaboo", anim: "mummy",  hp: 55,  spd: 2.9, steal: 12, r: 0.4,  embers: 6, fps: 6,  coin: 1, tint: ["#8d93a3", 0.75] },
  snuffer:  { name: "Snatcher", anim: "imp",    hp: 26,  spd: 2.4, steal: 6, r: 0.3,  embers: 3, fps: 12, coin: 0.7, tint: ["#3a6cff", 0.55] },
  spider:   { name: "Skitter",  anim: "spider", hp: 10,  spd: 3.9, steal: 4,  r: 0.3,  embers: 2, fps: 14, coin: 0.4 },
  slime:    { name: "Blob",     anim: "slime",  hp: 26,  spd: 1.9, steal: 7, r: 0.36, embers: 2, fps: 5,  coin: 0.6, split: "blobling" },
  blobling: { name: "Blobling", anim: "slime",  hp: 8,   spd: 2.6, steal: 3,  r: 0.26, embers: 1, fps: 7,  coin: 0.2, scale: 0.7 },
  blower:   { name: "Huff",     anim: "wraith", hp: 30,  spd: 2.0, steal: 6, r: 0.36, embers: 4, fps: 8,  coin: 1 },
  brute:    { name: "Grabby",   anim: "ogre",   hp: 170, spd: 1.5, steal: 18, r: 0.55, embers: 10, fps: 5, coin: 8, heavy: true },
  king:     { name: "The Gloom King", anim: "lich", hp: 1100, spd: 1.25, steal: 14, r: 0.7, embers: 0, fps: 6, coin: 40, heavy: true, scale: 1.5, boss: true },
};
// each level is a small dungeon of connected rooms
const DG = (name, rooms, roster, o = {}) => ({ name, rooms, roster, rate: 2.6, cap: 8, start: 3, wave: 2, towers: 2, ...o });
const LEVELS = [
  DG("The Cellar Door", 4, { moth: 4, shade: 1 }, { rate: 3.4, cap: 5, start: 1, wave: 1, towers: 1, tutorial: true, intro: "Light every tower to open the doors" }),
  DG("Dusty Barrels", 6, { moth: 4, shade: 3, snuffer: 2 }, { rate: 3, cap: 7, start: 2, intro: "Find the shop and the treasure room" }),
  DG("Grabby's Den", 6, { moth: 4, shade: 3, snuffer: 2, statue: 2 }, { boss: "brute", intro: "Grabby waits in the last room" }),
  DG("Skitter Shelves", 7, { spider: 5, moth: 3, shade: 2 }, { intro: "Skitters are fast. Really fast." }),
  DG("Blob Stacks", 7, { slime: 4, spider: 3, shade: 2, blower: 1 }, { cap: 9, intro: "Zap a Blob and you get two Bloblings" }),
  DG("The Huff Wing", 8, { blower: 3, slime: 3, spider: 3, statue: 2 }, { boss: "brute2", cap: 9, rate: 2.3, intro: "Huffs blow the lantern out of your hands" }),
  DG("Spiral Stairs", 8, { spider: 3, shade: 4, blower: 2, snuffer: 3 }, { cap: 10, rate: 2.2, towers: 3 }),
  DG("Stone Gallery", 9, { statue: 5, blower: 2, slime: 3, snuffer: 3 }, { cap: 10, rate: 2.1, towers: 3 }),
  DG("The Lamp Room", 9, { moth: 3, shade: 3, spider: 3, slime: 2, blower: 2 }, { boss: "king", cap: 10, rate: 2.1, towers: 3, intro: "The Gloom King is in the last room" }),
];
const WORLDS = [{ name: "The Cellar", dark: "14,10,44", tint: null }, { name: "The Library", dark: "6,22,40", tint: ["#2a9a8a", 0.16] }, { name: "The Lamp Room", dark: "34,8,40", tint: ["#c0508a", 0.14] }];
function endlessDef(k) {
  const r = { moth: 4, shade: 3 }; if (k >= 2) { r.snuffer = 2; r.spider = 3; } if (k >= 3) { r.statue = 2; r.slime = 2; } if (k >= 4) r.blower = 2;
  return DG("Depth " + k, Math.min(10, 5 + k), r, { rate: Math.max(1.6, 2.8 - 0.15 * k), cap: 7 + k, start: 2 + Math.min(4, k), towers: k >= 3 ? 3 : 2, boss: k % 3 === 0 ? (k % 6 === 0 ? "king" : "brute2") : null, hpMul: 1.3 + 0.2 * (k - 1) });
}
// permanent upgrades, bought with banked coins between dungeons
const SHOP = {
  lamp:   { name: "Bigger Lantern", icon: "icon_orb",       max: 5, cost: 40,  desc: "+6% light size" },
  zap:    { name: "Hotter Lantern", icon: "icon_fireball",  max: 5, cost: 40,  desc: "+20% throw damage" },
  quick:  { name: "Snappy Return",  icon: "icon_haste",     max: 4, cost: 60,  desc: "Lantern flies 10% faster" },
  tower:  { name: "Tower Power",    icon: "icon_lightning", max: 4, cost: 50,  desc: "+25% tower damage" },
  boom:   { name: "Big Toss",       icon: "icon_aura",      max: 4, cost: 45,  desc: "Bigger, stronger landing blast" },
  boots:  { name: "Zoomy Boots",    icon: "icon_boots",     max: 3, cost: 60,  desc: "+6% run speed" },
  magnet: { name: "Ember Magnet",   icon: "icon_magnet",    max: 3, cost: 40,  desc: "Pull embers and coins from further" },
  tank:   { name: "Full Tank",      icon: "icon_regen",     max: 3, cost: 50,  desc: "Start with +10 flame" },
  luck:   { name: "Lucky Start",    icon: "icon_growth",    max: 1, cost: 300, desc: "Start every dungeon with a random relic" },
};
const price = (k, l) => Math.round(SHOP[k].cost * (1 + l * 0.8) / 5) * 5;
// relics: found in treasure rooms, shops and shrines; they last for one dungeon run
const RELICS = {
  arm:    { name: "Long Arm",       icon: "icon_dagger",    desc: "Throw 35% further" },
  twin:   { name: "Twin Wick",      icon: "icon_evo_orb",   desc: "The landing blast hits 60% harder" },
  trail:  { name: "Hot Trail",      icon: "icon_fireball",  desc: "The flying lantern burns 60% hotter" },
  quickw: { name: "Quick Wick",     icon: "icon_haste",     desc: "The lantern flies 30% faster" },
  glow:   { name: "Big Glow",       icon: "icon_orb",       desc: "20% bigger light" },
  magnet: { name: "Magnet Charm",   icon: "icon_magnet",    desc: "Pull embers and coins from twice as far" },
  sticky: { name: "Sticky Fingers", icon: "icon_might",     desc: "Win back 50% extra when you catch a thief" },
  thorn:  { name: "Thorny Flame",   icon: "icon_evo_blade", desc: "Thieves get burned when they grab your flame" },
  friend: { name: "Tower Friend",   icon: "icon_lightning", desc: "Towers shoot twice as fast" },
  ember:  { name: "Ember Heart",    icon: "icon_vitality",  desc: "+1 flame for every baddie zapped" },
  nose:   { name: "Coin Nose",      icon: "icon_coin",      desc: "Baddies drop more coins" },
  second: { name: "Second Wind",    icon: "icon_regen",     desc: "Once per dungeon, relight at 40 flame" },
};
const STORY = {
  intro: [["hero_rogue_idle", "This is Pip. Pip keeps the lights on in the old lighthouse."], ["lich", "One night the Gloom King sent his baddies to steal every flame. All of them!"], ["lantern", "Pip still has one little lantern. If its light goes out, so does Pip. No pressure."]],
  w2: [["hero_rogue_idle", "The cellar is bright again. Nice one, Pip!"], ["spider", "Next up: the library. Something skitters between the shelves..."]],
  w3: [["prop_torch", "Two floors glowing. The Gloom King is getting grumpy."], ["lich", "He's waiting in the lamp room, at the very top."]],
  end: [["lich", "The Gloom King pops like a soap bubble."], ["sun", "The big lamp roars back to life. Ships can see the rocks again."], ["hero_rogue_idle", "Pip gets a nap. Thanks for playing!"]],
};

// ---------- save ----------
const SAVE_KEY = "last-light-save-v3"; let SAVE = { coins: 0, up: {}, stars: {}, unlocked: 1, bestEndless: 0, sound: true, seen: {}, daily: "", streak: 0 };
try { SAVE = { ...SAVE, ...(JSON.parse(localStorage.getItem(SAVE_KEY) || "{}")) }; } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} };
const up = k => SAVE.up[k] || 0;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ---------- state ----------
let S = null;
const input = { ix: 0, iy: 0 };
const ui = { mode: "title", hint: "", bannerT: 0, coarse: matchMedia("(pointer: coarse)").matches };
const lightR = () => (1.5 + 3.3 * clamp(S.flame / MAXF, 0, 1)) * S.st.light;
const has = k => S.relics.indexOf(k) >= 0;
function recalc() {
  S.st = { light: (1 + 0.06 * up("lamp")) * (has("glow") ? 1.2 : 1), throwDmg: 9 * (1 + 0.2 * up("zap")) * (has("trail") ? 1.6 : 1), fly: 15 * (1 + 0.1 * up("quick")) * (has("quickw") ? 1.3 : 1), towerDmg: 12 * (1 + 0.25 * up("tower")), towerCd: T.towerCd * (has("friend") ? 0.5 : 1),
    landDmg: 13 * (1 + 0.2 * up("boom")) * (has("twin") ? 1.6 : 1), landR: 1.9 + 0.2 * up("boom"), spd: 3.7 * (1 + 0.06 * up("boots")), mag: 2.3 * (1 + 0.35 * up("magnet")) * (has("magnet") ? 2 : 1), range: T.throwMax * (has("arm") ? 1.35 : 1) };
}
function randomRelics(n) { const pool = Object.keys(RELICS).filter(k => !has(k)); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; } return pool.slice(0, n); }
function giveRelic(k, quiet) { S.relics.push(k); recalc(); if (!quiet) { sfx("evolve"); banner(RELICS[k].name, RELICS[k].desc); } }

function newRun(levelIdx) { // levelIdx: 0..8, or -1 for endless
  S = { state: "play", level: levelIdx, ch: 1, st: null, relics: [], flame: Math.min(MAXF, 70 + 10 * up("tank")), escaped: 0, combo: 0, comboT: 0, bestCombo: 0, glowT: 0, stolen: 0, saved: 0, coins: 0, t: 0, kills: 0, lit: 0, snuffed: 0, roomsCleared: 0, usedSecond: false,
    hero: { x: 0, y: 0, r: 0.3, face: 1, fx: 0, fy: -1, moving: false, iframes: 0, hurtT: 0, walked: 0 }, lantern: { state: "held", x: 0, y: 0, sx: 0, sy: 0, dx: 0, dy: 0, t: 0, dur: 0.3, wait: 0, hit: [], kills: 0, blown: false },
    enemies: [], embers: [], bolts: [], gusts: [], braziers: [], pillars: [], src: [], spawnT: 0, banished: false, amb: 0.9, endT: 0, threw: false, picked: false, litOnce: false, sunT: 0, king: null, kingTarget: null, def: null, world: 0, dun: null, room: null, ri: 0, npcLock: false, choice: null, botShop: {} };
  recalc(); if (up("luck")) giveRelic(randomRelics(1)[0], true);
  startDungeon(); music("startAction");
}
function startDungeon() {
  const s = S; s.def = s.level >= 0 ? LEVELS[s.level] : endlessDef(s.ch); s.world = s.level >= 0 ? Math.floor(s.level / 3) : (s.ch - 1) % 3; s.usedSecond = false; s.botShop = {};
  s.dun = genDungeon(s.def); enterRoom(0, null);
  banner(s.level >= 0 ? `${s.level + 1}. ${s.def.name}` : s.def.name, s.def.intro || "Find the way out");
}
const DIRS = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
function genDungeon(def) {
  const rooms = [{ gx: 0, gy: 0 }], at = new Map([["0,0", 0]]), dv = Object.values(DIRS);
  for (let guard = 0; rooms.length < def.rooms && guard < 4000; guard++) {
    const b = rooms[Math.floor(Math.random() * rooms.length)], d = dv[Math.floor(Math.random() * 4)], x = b.gx + d[0], y = b.gy + d[1];
    if (at.has(x + "," + y) || Math.abs(x) > 3 || Math.abs(y) > 3) continue; let nb = 0; for (const q of dv) if (at.has((x + q[0]) + "," + (y + q[1]))) nb++;
    if (nb > 1 && Math.random() < 0.75) continue; at.set(x + "," + y, rooms.length); rooms.push({ gx: x, gy: y });
  }
  rooms.forEach((r, i) => { r.i = i; r.nbr = {}; for (const k in DIRS) { const j = at.get((r.gx + DIRS[k][0]) + "," + (r.gy + DIRS[k][1])); if (j !== undefined) r.nbr[k] = j; } r.type = "fight"; r.cleared = false; r.visited = false; r.used = false; });
  const dist = new Array(rooms.length).fill(-1); dist[0] = 0; const q = [0]; for (let h = 0; h < q.length; h++) for (const k in rooms[q[h]].nbr) { const j = rooms[q[h]].nbr[k]; if (dist[j] < 0) { dist[j] = dist[q[h]] + 1; q.push(j); } }
  let goal = 0; rooms.forEach((r, i) => { if (dist[i] > dist[goal]) goal = i; }); rooms[goal].type = "goal"; if (!def.tutorial) rooms[0].type = "start";
  const cand = rooms.filter(r => r.i !== 0 && r.i !== goal).map(r => ({ r, k: Object.keys(r.nbr).length + Math.random() * 0.5 })).sort((a, b) => a.k - b.k).map(x => x.r);
  const specials = rooms.length >= 6 ? ["treasure", "shop", "shrine"] : rooms.length >= 5 ? ["treasure", "shop"] : ["treasure"];
  specials.forEach((t, k) => { if (k < cand.length - 1) cand[k].type = t; });
  for (const r of rooms) buildRoom(r, def);
  return { rooms, goal };
}
function buildRoom(r, def) {
  r.towers = []; r.pillars = []; const fight = r.type === "fight" || r.type === "goal", W = 16, H = 12, doors = [[W / 2, 0], [W / 2, H], [0, H / 2], [W, H / 2]];
  const v = r.type === "goal" ? Math.floor(Math.random() * 2) : fight ? Math.floor(Math.random() * 4) : 1;
  if (v === 1) for (const [x, y] of [[3.5, 3], [12.5, 3], [3.5, 9], [12.5, 9]]) r.pillars.push({ x, y, r: 0.45 });
  else if (v === 2) for (const [x, y] of [[5, 6], [11, 6]]) r.pillars.push({ x, y, r: 0.45 });
  else if (v === 3) for (let i = 0, t = 0; i < 3 && t < 60; t++) { const x = rnd(2.5, W - 2.5), y = rnd(2.5, H - 2.5); if (hyp(x - W / 2, y - H / 2) > 2.6 && doors.every(d => hyp(d[0] - x, d[1] - y) > 2.6) && r.pillars.every(p => hyp(p.x - x, p.y - y) > 3)) { r.pillars.push({ x, y, r: 0.45 }); i++; } }
  if (!fight) { r.cleared = true; if (r.type === "shop") r.stock = [{ k: "jar", price: 12, left: 2 }, { k: "relic", price: 30 }, { k: "relic", price: 45 }]; return; }
  r.boss = r.type === "goal" && def.boss ? def.boss : null;
  const n = def.tutorial && r.i === 0 ? 1 : r.type === "goal" ? Math.min(4, def.towers + 1) : 1 + Math.floor(Math.random() * def.towers);
  for (let t = 0; r.towers.length < n && t < 500; t++) { const x = rnd(2.2, W - 2.2), y = rnd(2.2, H - 2.2), sep = t < 250 ? 4.2 : 3;
    if (hyp(x - W / 2, y - H / 2) > 2.4 && doors.every(d => hyp(d[0] - x, d[1] - y) > 2.7) && r.pillars.every(p => hyp(p.x - x, p.y - y) > 1.6) && r.towers.every(p => hyp(p.x - x, p.y - y) > sep)) r.towers.push({ x, y, r: 0.42, lit: false, snuff: 0, cd: 0, healed: false }); }
}
function enterRoom(i, dir) {
  const s = S, r = s.room = s.dun.rooms[i], h = s.hero, first = !r.visited; s.ri = i; r.visited = true; RW = 16; RH = 12;
  s.enemies = []; s.embers = []; s.bolts = []; s.gusts = []; s.braziers = r.towers; s.pillars = r.pillars;
  if (dir === "n") { h.x = RW / 2; h.y = RH - 1.2; } else if (dir === "s") { h.x = RW / 2; h.y = 1.2; } else if (dir === "e") { h.x = 1.2; h.y = RH / 2; } else if (dir === "w") { h.x = RW - 1.2; h.y = RH / 2; } else { h.x = RW / 2; h.y = RH / 2 + 2.5; }
  h.iframes = 0.8; s.lantern.state = "held"; s.banished = r.cleared; s.amb = r.cleared ? 0.3 : 0.9; s.chT = 0; s.spawnT = 2.5; s.sunT = 0; s.king = null; s.kingTarget = null; s.npcLock = true;
  rebuildSources();
  if (!r.cleared) { for (let k = 0; k < s.def.start; k++) spawnEnemy();
    if (r.boss) { const types = r.boss === "king" ? ["king"] : r.boss === "brute2" ? ["brute", "brute"] : ["brute"];
      types.forEach((t, k) => { spawnEnemy(t, { x: RW / 2 + (k ? 2.5 : types.length > 1 ? -2.5 : 0), y: RH / 2 - 1 }); const e = s.enemies[s.enemies.length - 1]; e.bossy = true; if (t === "brute") { e.hp = e.maxHp = e.maxHp * 1.8; } s.king = s.king || e; });
      music("boss", true); banner(s.king.d.name, r.boss === "king" ? "Keep the towers lit. He hates the light!" : "Zap it before it runs off with your flame"); }
    else if (r.type === "goal" && s.world >= 1) spawnEnemy("brute"); }
  else if (first && r.type !== "start") banner(r.type === "shop" ? "Shop" : r.type === "treasure" ? "Treasure room" : "Wishing candle", r.type === "shop" ? "Spend the coins you found" : r.type === "treasure" ? "Pick one relic" : "Make a wish");
  if (!r.boss) music("boss", false);
  fx("clear"); cam.x = h.x; cam.y = h.y; music("setIntensity", Math.min(0.9, 0.15 + (s.level >= 0 ? s.level * 0.08 : s.ch * 0.1)));
}
function clearRoom() {
  const s = S, r = s.room; if (r.cleared) return; r.cleared = true; s.banished = true; s.roomsCleared++; s.kingTarget = null; s.king = null; rebuildSources();
  for (const e of s.enemies.slice()) if (!e.dead) kill(e); s.enemies.length = 0; for (const e of s.embers) if (e.kind !== "sun") e.mag = true;
  sfx("levelup"); fx("shake", 0.5); music("boss", false); banner(r.type === "goal" ? "The way out is open!" : "Room clear!", r.type === "goal" ? "Step into the light" : "The doors are open");
}
function banner(title, sub) { const el = $("#banner"); el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ""}`; el.classList.add("on"); clearTimeout(ui.bt); ui.bt = setTimeout(() => el.classList.remove("on"), 2400); }

// ---------- rooms with something to offer: treasure, shop, wishing candle ----------
function openNpc(r) {
  const s = S, opts = [], ic = k => RELICS[k].icon;
  if (r.type === "treasure") { const rs = randomRelics(3); if (!rs.length) opts.push({ name: "A bag of coins", desc: "+30 coins", icon: "icon_coin", fn: () => { s.coins += 30; r.used = true; } });
    for (const k of rs) opts.push({ name: RELICS[k].name, desc: RELICS[k].desc, icon: ic(k), fn: () => { giveRelic(k); r.used = true; } });
    s.choice = { title: "Treasure!", sub: "Pick one. It lasts for this dungeon.", opts, leave: false }; sfx("chest_open"); }
  else if (r.type === "shop") {
    for (const it of r.stock) { if (it.k === "relic" && (!it.id || has(it.id))) it.id = randomRelics(4).find(k => !r.stock.some(o => o !== it && o.id === k)); }
    r.stock = r.stock.filter(it => it.k !== "relic" || it.id);
    for (const it of r.stock) { const buy = () => { s.coins -= it.price; sfx("ui_buy"); if (it.k === "jar") { s.flame = Math.min(MAXF, s.flame + 35); if (--it.left <= 0) r.stock.splice(r.stock.indexOf(it), 1); } else { giveRelic(it.id); r.stock.splice(r.stock.indexOf(it), 1); } return true; };
      opts.push(it.k === "jar" ? { name: "Ember Jar", desc: "+35 flame", icon: "icon_fireball", price: it.price, disabled: s.coins < it.price || s.flame >= MAXF, fn: buy } : { name: RELICS[it.id].name, desc: RELICS[it.id].desc, icon: ic(it.id), price: it.price, disabled: s.coins < it.price, fn: buy }); }
    s.choice = { title: "Shop", sub: `You have ${s.coins} coins`, opts, leave: true };
  } else { opts.push({ name: "Warm up", desc: "+30 flame, free", icon: "icon_fireball", fn: () => { s.flame = Math.min(MAXF, s.flame + 30); r.used = true; sfx("heal"); } });
    const rs = randomRelics(1); if (rs.length) opts.push({ name: "Make a wish", desc: "Give 25 flame, get a surprise relic", icon: "icon_growth", disabled: s.flame <= 30, fn: () => { s.flame -= 25; giveRelic(rs[0]); r.used = true; } });
    s.choice = { title: "Wishing candle", sub: "One wish only", opts, leave: true }; }
  s.state = "choice";
}
function choose(i) { const s = S, c = s.choice, o = c && c.opts[i]; if (!o || o.disabled) return; const again = o.fn(); if (again) openNpc(s.room); else closeChoice(); }
function closeChoice() { const s = S; s.choice = null; ui.choice = null; if (s.state === "choice") s.state = "play"; hideScreen(); }

// ---------- light ----------
function rebuildSources() {
  const s = S, L = s.lantern, h = s.hero, src = s.src; src.length = 0;
  const r = s.flame > 0 ? lightR() * (s.state === "dying" ? Math.max(0, 1 - s.endT * 1.2) : 1) : 0;
  if (L.state === "held") { if (r > 0) src.push({ x: h.x, y: h.y, r, sear: T.searLantern, lantern: true, safe: true }); else src.push({ x: h.x, y: h.y, r: 0.95, sear: 0 }); }
  else { if (r > 0) src.push({ x: L.x, y: L.y, r: r * (L.state === "ground" ? 1 : 0.6), sear: T.searLantern, lantern: true, safe: true }); src.push({ x: h.x, y: h.y, r: 0.95, sear: 0 }); }
  for (const b of s.braziers) if (b.lit) src.push({ x: b.x, y: b.y, r: T.brazierR, sear: T.searBrazier, brazier: true, safe: true });
  for (const e of s.enemies) if (e.carry > 0 && e.type !== "statue") src.push({ x: e.x, y: e.y, r: 1.15, sear: 0 });
  const r0 = s.room; if (r0 && r0.cleared) { for (const k in r0.nbr) { const p = doorPt(k); src.push({ x: p[0], y: p[1], r: 1.8, sear: 0, safe: true }); } if (r0.type === "goal") src.push({ x: RW / 2, y: RH / 2, r: 3, sear: 0, safe: true }); }
}
const doorPt = k => k === "n" ? [RW / 2, 0] : k === "s" ? [RW / 2, RH] : k === "w" ? [0, RH / 2] : [RW, RH / 2];
function litAt(x, y) { let sear = S.sunT > 0 ? 1 : -1; for (const q of S.src) { const dx = q.x - x, dy = q.y - y, rr = q.r * 0.94; if (dx * dx + dy * dy < rr * rr && q.sear > sear) sear = q.sear; } return sear; }
function heroSafe() { if (S.sunT > 0 || S.glowT > 0) return true; const h = S.hero; for (const q of S.src) { if (!q.safe) continue; const dx = q.x - h.x, dy = q.y - h.y; if (dx * dx + dy * dy < q.r * q.r) return true; } return false; }

// ---------- enemies ----------
function spawnEnemy(type, at) {
  const s = S, h = s.hero, def = s.def;
  if (!type) { let tot = 0; for (const k in def.roster) tot += def.roster[k]; let x = Math.random() * tot; for (const k in def.roster) { type = k; x -= def.roster[k]; if (x < 0) break; }
    const count = t => s.enemies.filter(e => e.type === t).length;
    if (type === "snuffer" && (count("snuffer") >= 2 || !s.braziers.some(b => b.lit))) type = "shade"; if (type === "blower" && count("blower") >= 2) type = "shade"; if (type === "shade" && !def.roster.shade) type = Object.keys(def.roster)[0]; }
  let px = 0, py = 0; if (at) { px = at.x; py = at.y; } else for (let i = 0; i < 30; i++) { px = rnd(0.8, RW - 0.8); py = rnd(0.8, RH - 0.8); if (hyp(px - h.x, py - h.y) > 5 && litAt(px, py) < 0) break; }
  const d = ENEMY[type], n = type === "moth" ? 3 : type === "spider" ? 2 : 1, mul = d.boss ? 1 : (def.hpMul || 1 + 0.1 * Math.max(0, s.level));
  for (let i = 0; i < n; i++) s.enemies.push({ type, d, x: clamp(px + rnd(-0.6, 0.6), 0.5, RW - 0.5), y: clamp(py + rnd(-0.6, 0.6), 0.5, RH - 0.5), hp: d.hp * mul, maxHp: d.hp * mul, r: d.r, kx: 0, ky: 0, flash: 0, lit: false, t: rnd(0, 9), ph: rnd(0, 6.28), face: 1, cd: rnd(1.5, 3.5), wind: 0, lunge: 0, lx: 0, ly: 0, chan: 0, dead: false, born: at ? 0.6 : 0, carry: 0, fleeT: 0, tower: null, a1: 5, a2: 6 });
}
function damage(e, dmg, kx = 0, ky = 0) { if (e.dead) return; e.hp -= dmg; e.flash = 0.08; if (!e.d.heavy && e.type !== "statue" && !(e.chan > 0)) { e.kx += kx; e.ky += ky; } if (e.hp <= 0) kill(e); }
function drop(kind, x, y, o) { const a = rnd(0, 6.28), sp = rnd(1, 3); S.embers.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, mag: S.banished && kind !== "sun", ...o }); }
function kill(e) {
  const s = S, d = e.d; e.dead = true; s.kills++; sfx("kill"); s.lantern.kills++;
  s.combo = s.comboT > 0 ? s.combo + 1 : 1; s.comboT = 2.5; s.bestCombo = Math.max(s.bestCombo, s.combo); if (s.combo >= 3 && !s.banished) { say(e.x, e.y - 0.9, "x" + s.combo, "#7be38a"); if (s.combo % 3 === 0) drop("coin", e.x, e.y); s.flame = Math.min(MAXF, s.flame + 1); sfx("gem", { pitch: Math.min(2, 1 + s.combo * 0.08) }); } fx("burst", e.x, e.y, d.anim === "slime" ? "#7ad66a" : "#ffb347", { count: d.heavy ? 30 : 8, speed: d.heavy ? 1.5 : 0.9, glow: true });
  for (let i = 0; i < d.embers; i++) { if (e.type === "moth" && Math.random() < 0.5) continue; drop("ember", e.x, e.y); }
  let c = Math.floor(d.coin) + (Math.random() < d.coin % 1 ? 1 : 0) + (has("nose") && Math.random() < 0.5 ? 1 : 0); if (has("ember")) s.flame = Math.min(MAXF, s.flame + 1); for (let i = 0; i < c; i++) drop("coin", e.x, e.y);
  if (!d.boss && !s.banished) { const r = Math.random(); if (r < 0.03) drop("jar", e.x, e.y); else if (r < 0.05 && s.sunT <= 0 && !s.embers.some(x => x.kind === "sun")) drop("sun", e.x, e.y); }
  if (e.tower) { e.tower.lit = true; e.tower.snuff = 0; s.saved++; sfx("levelup_open"); fx("ring", e.tower.x, e.tower.y, T.brazierR, "#ffb347"); say(e.tower.x, e.tower.y - 1.2, "BACK ON!", "#ffd27a"); }
  else if (e.carry > 0) { s.embers.push({ kind: "ember", x: e.x, y: e.y, vx: 0, vy: 0, t: 0, mag: true, v: e.carry * (has("sticky") ? 1.5 : 1), big: true }); s.saved++; say(e.x, e.y - 0.6, "GOT IT!", "#ffd27a"); }
  if (d.split) for (let i = 0; i < 2; i++) spawnEnemy(d.split, { x: e.x, y: e.y });
  if (e.bossy) { sfx("boss_die"); fx("shake", 1); fx("ring", e.x, e.y, 6, "#d07aff"); const left = s.enemies.find(o => o.bossy && !o.dead); if (left) s.king = left; else clearRoom(); }
}
function say(x, y, text, color) { fx("damageNumber", x, y, text, color); }
// Light is the only health. Every grab steals flame; in the dark they grab more.
function touch(e, dx, dy) {
  const s = S, h = s.hero; if (h.iframes > 0 || s.state !== "play" || e.carry > 0) return;
  const dark = !heroSafe(), amt = Math.min(s.flame, e.d.steal * (dark ? 1.25 : 1)); s.flame -= amt; s.stolen++; h.iframes = 1.2; for (const o of s.enemies) { const q = hyp(o.x - h.x, o.y - h.y) || 1; if (o !== e && q < 2.5 && !o.d.heavy) { o.kx = (o.x - h.x) / q * 9; o.ky = (o.y - h.y) / q * 9; } } h.hurtT = dark ? 0.3 : 0;
  sfx("hero_hurt", { pitch: dark ? 1 : 1.5, volume: 0.7 }); fx("shake", dark ? 0.45 : 0.2); if (dark) fx("hurtFlash"); say(h.x, h.y - 0.7, e.d.boss ? "MINE!" : dark ? "OUCH!" : "HEY!", dark ? "#ff6a6a" : "#ffd27a");
  try { if (dark && navigator.vibrate) navigator.vibrate(30); } catch (er) {}
  e.lunge = 0; e.wind = 0; if (!e.d.boss) { e.carry = amt; e.fleeT = e.d.heavy ? 7 : 5.5; } if (has("thorn")) damage(e, 15);
}
function stealFlame(e, avail) { const amt = Math.min(avail, e.d.steal); S.flame -= amt; S.stolen++; sfx("hero_hurt", { pitch: 1.5, volume: 0.7 }); e.lunge = 0; e.wind = 0; e.carry = amt; e.fleeT = 4.5; }
function lightsOut() {
  const s = S, h = s.hero;
  if (has("second") && !s.usedSecond) { s.usedSecond = true; s.flame = 40; h.iframes = 2; say(h.x, h.y - 0.9, "SECOND WIND!", "#7be38a"); sfx("revive"); fx("levelUp", h.x, h.y); for (const o of s.enemies) { const q = hyp(o.x - h.x, o.y - h.y) || 1; if (q < 4 && !o.d.heavy) { o.kx = (o.x - h.x) / q * 12; o.ky = (o.y - h.y) / q * 12; } } return; }
  s.flame = 0; s.state = "dying"; s.endT = 0; sfx("player_die"); music("stop");
}
function updateEnemies(dt) {
  const s = S, h = s.hero, L = s.lantern, held = L.state === "held", LR = lightR(), rush = !heroSafe();
  for (const e of s.enemies) {
    if (e.dead) continue; e.t += dt; e.born += dt; e.flash = Math.max(0, e.flash - dt);
    const sear = litAt(e.x, e.y); e.lit = sear >= 0; if (sear > 0) { e.hp -= sear * dt; if (e.hp <= 0) { kill(e); continue; } }
    let dx = h.x - e.x, dy = h.y - e.y; const d = hyp(dx, dy) || 0.001; dx /= d; dy /= d;
    let mx = dx, my = dy, spd = e.d.spd, contact = true; const type = e.type;
    if (e.carry > 0) {
      contact = false; e.fleeT -= dt; mx = -dx; my = -dy; spd = type === "statue" ? (e.lit ? 0 : 2) : Math.min(3.3, e.d.spd * 0.95);
      if (e.x < 0.6 || e.x > RW - 0.6) { mx = 0; my = Math.sign(my || 1); } if (e.y < 0.6 || e.y > RH - 0.6) { my = 0; mx = Math.sign(mx || 1); }
      if (e.fleeT <= 0 && e.bossy) { e.carry = 0; say(e.x, e.y - 1, "YUM!", "#d07aff"); } else if (e.fleeT <= 0) { e.dead = true; s.escaped++; fx("burst", e.x, e.y, "#8a7cff", { count: 10 }); say(e.x, e.y - 0.5, "GOT AWAY", "#b8a8ff"); sfx("ui_deny"); continue; }
    } else if (type === "moth") {
      const tx = held ? h.x : L.x, ty = held ? h.y : L.y; let ax = tx - e.x, ay = ty - e.y; const ad = hyp(ax, ay) || 0.001; ax /= ad; ay /= ad;
      const w = Math.sin(e.t * 6 + e.ph) * 0.8; mx = ax * Math.cos(w) - ay * Math.sin(w); my = ax * Math.sin(w) + ay * Math.cos(w);
      if (!held && L.state === "ground" && ad < 0.5 && s.flame > 0) { stealFlame(e, s.flame); say(L.x, L.y - 0.5, "NIBBLE!", "#ffd27a"); }
    } else if (type === "spider") { const w = Math.sin(e.t * 9 + e.ph) * 1.0; mx = dx * Math.cos(w) - dy * Math.sin(w); my = dx * Math.sin(w) + dy * Math.cos(w); }
    else if (type === "shade") {
      if (e.lunge > 0) { e.lunge -= dt; mx = e.lx; my = e.ly; spd = 7.5; }
      else if (e.wind > 0) { e.wind -= dt; spd = 0; if (e.wind <= 0) { e.lunge = 0.8; e.lx = dx; e.ly = dy; sfx("bat", { volume: 0.4, pitch: 0.6 }); } }
      else if (held && s.flame > 0) { const want = LR + 0.9, rad = clamp(want - d, -1, 1); mx = -dx * rad + -dy * 0.75; my = -dy * rad + dx * 0.75; e.cd -= dt; if (e.cd <= 0 && d < want + 1.5) { e.cd = rnd(2.6, 4.2); e.wind = 0.45; } }
    } else if (type === "statue") { if (e.lit) spd = 0; }
    else if (type === "snuffer") {
      let tb = null, bd = 1e9; for (const b of s.braziers) if (b.lit) { const q = hyp(b.x - e.x, b.y - e.y); if (q < bd) { bd = q; tb = b; } }
      if (tb) { contact = false; if (bd < (e.chan > 0 ? 1.6 : 0.95)) { spd = 0; e.chan += dt; tb.snuff = e.chan / 3.5; if (e.chan >= 3.5) { tb.lit = false; tb.snuff = 0; e.chan = 0; s.snuffed++; e.carry = 1; e.tower = tb; e.fleeT = 5.5; sfx("ui_deny"); say(tb.x, tb.y - 1.2, "THIEF!", "#6aa8ff"); hint("A Snatcher took a tower's flame. Catch it to get it back!", 3); } } else { e.chan = 0; mx = (tb.x - e.x) / bd; my = (tb.y - e.y) / bd; } }
      else e.chan = 0;
    } else if (type === "blower") {
      if (d < 4.5) { mx = -dx; my = -dy; } else if (d < 6.5) { mx = -dy; my = dx; spd *= 0.6; }
      e.cd -= dt; if (e.cd <= 0 && d < 8.5 && e.born > 1) { e.cd = rnd(3, 4); s.gusts.push({ x: e.x, y: e.y, vx: dx * 6, vy: dy * 6, life: 1.6 }); sfx("slash", { volume: 0.5, pitch: 0.6 }); }
    } else if (type === "king") {
      const p2 = e.hp < e.maxHp * 0.5; e.a1 -= dt; e.a2 -= dt;
      if (s.kingTarget) { s.kingTarget.t += dt; spd = 0; if (s.kingTarget.t >= 1.5) { const b = s.kingTarget.b; if (b.lit) { b.lit = false; sfx("ui_deny"); fx("burst", b.x, b.y - 0.8, "#d07aff", { count: 18 }); say(b.x, b.y - 1.2, "POOF!", "#d07aff"); } s.kingTarget = null; } }
      else if (e.a1 <= 0) { const lit = s.braziers.filter(b => b.lit); e.a1 = p2 ? 5 : 7.5; if (lit.length) { s.kingTarget = { b: lit[Math.floor(Math.random() * lit.length)], t: 0 }; sfx("boss_warn", { volume: 0.5 }); } }
      if (e.a2 <= 0) { e.a2 = p2 ? 7 : 10; sfx("summon"); fx("ring", e.x, e.y, 2, "#d07aff"); for (let i = 0; i < (p2 ? 3 : 2); i++) if (s.enemies.length < 14) spawnEnemy(null, { x: e.x + rnd(-1, 1), y: e.y + rnd(-1, 1) }); }
    }
    if (rush && !(e.carry > 0) && !e.d.boss && type !== "blower" && !(e.chan > 0) && !(type === "statue" && e.lit) && d < 9) { if (e.lunge <= 0) { mx = dx; my = dy; spd = Math.max(spd, e.d.spd * 1.25); } e.wind = 0; }
    e.x += (mx * spd + e.kx) * dt; e.y += (my * spd + e.ky) * dt; const kd = Math.exp(-8 * dt); e.kx *= kd; e.ky *= kd;
    e.x = clamp(e.x, 0.4, RW - 0.4); e.y = clamp(e.y, 0.4, RH - 0.4);
    if (type === "statue" || type === "snuffer" || type === "brute" || type === "slime") for (const o of s.pillars) pushOut(e, o);
    if (mx > 0.2) e.face = 1; else if (mx < -0.2) e.face = -1;
    if (contact && e.born > 0.6 && d < e.r + h.r + 0.05) touch(e, dx, dy);
  }
  for (const b of s.braziers) if (b.snuff > 0 && !s.enemies.some(e => !e.dead && e.type === "snuffer" && e.chan > 0 && hyp(e.x - b.x, e.y - b.y) < 1.7)) b.snuff = 0;
  let w = 0; for (const e of s.enemies) if (!e.dead) s.enemies[w++] = e; s.enemies.length = w;
}
function pushOut(a, o) { const dx = a.x - o.x, dy = a.y - o.y, d = hyp(dx, dy) || 0.001, m = a.r + o.r; if (d < m) { a.x = o.x + dx / d * m; a.y = o.y + dy / d * m; } }

// ---------- lantern: the only weapon. It flies out, blasts, then comes back like a boomerang ----------
function launch(tx, ty) { const L = S.lantern, h = S.hero; L.sx = h.x; L.sy = h.y; L.dx = clamp(tx, 0.6, RW - 0.6); L.dy = clamp(ty, 0.6, RH - 0.6); L.t = 0; L.dur = Math.max(0.12, hyp(L.dx - h.x, L.dy - h.y) / S.st.fly); L.state = "air"; L.x = h.x; L.y = h.y; L.hit = []; L.kills = 0; }
function throwTo(wx, wy) {
  const s = S; if (!s || s.state !== "play") return; const L = s.lantern, h = s.hero; if (L.state !== "held") return;
  let dx = wx - h.x, dy = wy - h.y, d = hyp(dx, dy); if (d < 0.5) { dx = h.fx * 3; dy = h.fy * 3; d = 3; }
  if (d > s.st.range) { dx *= s.st.range / d; dy *= s.st.range / d; }
  L.blown = false; launch(h.x + dx, h.y + dy); s.threw = true; s.glowT = 0.3; sfx("fireball_throw"); if (Math.abs(dx) > 0.2) h.face = dx > 0 ? 1 : -1;
}
function throwDir(dx, dy) { const d = hyp(dx, dy) || 1; const f = T.flick * S.st.range / T.throwMax; throwTo(S.hero.x + dx / d * f, S.hero.y + dy / d * f); }
function lanternHits(vx, vy) { const s = S, L = s.lantern; if (s.flame <= 0 || L.blown) return; for (const e of s.enemies) { if (e.dead || L.hit.indexOf(e) >= 0) continue; if (hyp(e.x - L.x, e.y - L.y) < e.r + 0.5) { L.hit.push(e); damage(e, s.st.throwDmg, vx * 0.3, vy * 0.3); sfx("hit_enemy"); fx("burst", e.x, e.y, "#ffd27a", { count: 5, speed: 0.8 }); } } }
function updateLantern(dt) {
  const s = S, L = s.lantern, h = s.hero;
  if (L.state === "air") {
    L.t += dt / L.dur; const k = Math.min(1, L.t); L.x = L.sx + (L.dx - L.sx) * k; L.y = L.sy + (L.dy - L.sy) * k; lanternHits((L.dx - L.sx) / L.dur, (L.dy - L.sy) / L.dur);
    if (k >= 1) { L.state = "ground"; L.wait = L.blown ? 2.5 : 0.3; L.hit = [];
      if (s.flame > 0 && !L.blown) { sfx("fireball_boom", { volume: 0.5 }); fx("shake", 0.22); fx("ring", L.x, L.y, s.st.landR, "#ffb347"); fx("burst", L.x, L.y, "#ffd27a", { count: 16, speed: 1.3, glow: true });
        for (const e of s.enemies) { const q = hyp(e.x - L.x, e.y - L.y); if (q < s.st.landR + e.r) damage(e, s.st.landDmg, (e.x - L.x) / (q || 1) * 5, (e.y - L.y) / (q || 1) * 5); }
        for (const b of s.braziers) if (!b.lit && hyp(b.x - L.x, b.y - L.y) < 1.1) { lightBrazier(b); if (s.state !== "play") return; } } }
  } else if (L.state === "ground") {
    L.wait -= dt; if (L.wait < (L.blown ? 2.3 : 0.15) && hyp(h.x - L.x, h.y - L.y) < 0.8) catchLantern(); else if (L.wait <= 0) { L.state = "back"; L.blown = false; L.hit = []; }
  } else if (L.state === "back") {
    const dx = h.x - L.x, dy = h.y - L.y, d = hyp(dx, dy) || 0.001, sp = s.st.fly * 1.0; if (d < 0.5 || d < sp * dt) { catchLantern(); return; }
    L.x += dx / d * sp * dt; L.y += dy / d * sp * dt; lanternHits(dx / d * sp, dy / d * sp);
  }
}
function catchLantern() { const s = S, L = s.lantern; L.state = "held"; s.picked = true; sfx("pickup", { volume: 0.6 }); if (L.kills >= 3) { say(s.hero.x, s.hero.y - 0.9, "NICE!", "#7be38a"); s.flame = Math.min(MAXF, s.flame + 3); } }

// ---------- step ----------
function step(dt) {
  const s = S; if (!s) return;
  if (s.state === "dying") { s.endT += dt; rebuildSources(); if (s.endT > 1.7) endRun(false); return; }
  if (s.state !== "play") return;
  s.t += dt; s.chT += dt; s.sunT = Math.max(0, s.sunT - dt); s.glowT = Math.max(0, s.glowT - dt); s.comboT = Math.max(0, s.comboT - dt); const h = s.hero, L = s.lantern;
  let ix = input.ix, iy = input.iy; const m = hyp(ix, iy); if (m > 1) { ix /= m; iy /= m; }
  h.moving = m > 0.12; if (h.moving) { h.x += ix * s.st.spd * dt; h.y += iy * s.st.spd * dt; h.walked += s.st.spd * dt * Math.min(1, m); const n = hyp(ix, iy); h.fx = ix / n; h.fy = iy / n; if (Math.abs(ix) > 0.15) h.face = ix > 0 ? 1 : -1; }
  const r = s.room, open = r.cleared, dn = open && r.nbr.n !== undefined && Math.abs(h.x - RW / 2) < 0.9, ds = open && r.nbr.s !== undefined && Math.abs(h.x - RW / 2) < 0.9, dw = open && r.nbr.w !== undefined && Math.abs(h.y - RH / 2) < 0.9, de = open && r.nbr.e !== undefined && Math.abs(h.y - RH / 2) < 0.9;
  h.x = clamp(h.x, dw ? -0.7 : 0.4, de ? RW + 0.7 : RW - 0.4); h.y = clamp(h.y, dn ? -0.7 : 0.4, ds ? RH + 0.7 : RH - 0.4);
  for (const o of s.pillars) pushOut(h, o); for (const o of s.braziers) pushOut(h, o);
  h.iframes = Math.max(0, h.iframes - dt); h.hurtT = Math.max(0, h.hurtT - dt);
  const go = dn && h.y < -0.3 ? "n" : ds && h.y > RH + 0.3 ? "s" : dw && h.x < -0.3 ? "w" : de && h.x > RW + 0.3 ? "e" : null;
  if (go) { sfx("stairs", { volume: 0.5 }); enterRoom(r.nbr[go], go); return; }
  if (r.type === "goal" && r.cleared && hyp(h.x - RW / 2, h.y - RH / 2) < 0.7) { sfx("stairs"); if (s.level >= 0) endRun(true); else { s.ch++; s.coins += 10; s.flame = Math.min(MAXF, s.flame + 20); startDungeon(); } return; }
  if (r.type === "treasure" || r.type === "shop" || r.type === "shrine") { const npc = { x: RW / 2, y: RH / 2 - 0.6, r: 0.5 }, d = hyp(h.x - npc.x, h.y - npc.y); pushOut(h, npc);
    if (d > 2.2) s.npcLock = false; else if (d < 1.25 && !s.npcLock && !(r.used && r.type !== "shop")) { s.npcLock = true; openNpc(r); return; } }
  updateLantern(dt); rebuildSources();
  for (const b of s.braziers) { if (!b.lit) continue;
    b.cd -= dt; if (b.cd <= 0) { let best = null, bd = T.brazierR; for (const e of s.enemies) { const q = hyp(e.x - b.x, e.y - b.y) - e.r; if (q < bd) { bd = q; best = e; } }
      if (best) { b.cd = s.st.towerCd; const ox = b.x, oy = b.y - 1.0, a = Math.atan2(best.y - oy, best.x - ox); s.bolts.push({ x: ox, y: oy, vx: Math.cos(a) * 11, vy: Math.sin(a) * 11, life: 0.6, dmg: s.st.towerDmg }); sfx("orb_fire", { volume: 0.3, pitch: 0.7 }); } } }
  for (let i = s.bolts.length - 1; i >= 0; i--) { const b = s.bolts[i]; b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; let hit = false;
    for (const e of s.enemies) { if (e.dead || !e.lit) continue; if (hyp(e.x - b.x, e.y - b.y) < e.r + 0.18) { damage(e, b.dmg, b.vx * 0.2, b.vy * 0.2); sfx("hit_enemy"); fx("burst", b.x, b.y, "#ffd27a", { count: 4, speed: 0.7 }); hit = true; break; } }
    if (hit || b.life <= 0 || b.x < 0 || b.y < 0 || b.x > RW || b.y > RH) s.bolts.splice(i, 1); }
  for (let i = s.gusts.length - 1; i >= 0; i--) { const g = s.gusts[i]; g.life -= dt; g.x += g.vx * dt; g.y += g.vy * dt;
    if (hyp(g.x - h.x, g.y - h.y) < 0.55) { s.gusts.splice(i, 1); if (L.state === "held") { const d = hyp(g.vx, g.vy); launch(h.x + g.vx / d * 3.8, h.y + g.vy / d * 3.8); L.blown = true; say(h.x, h.y - 0.7, "WHOOSH!", "#bfe0ff"); sfx("slash", { pitch: 0.5 }); fx("shake", 0.3); } continue; }
    if (g.life <= 0) s.gusts.splice(i, 1); }
  updateEnemies(dt); if (s.state !== "play") return;
  collectDrops(dt, false);
  if (!s.banished) { s.spawnT -= dt; if (s.spawnT <= 0) { s.spawnT = Math.max(1.2, s.def.rate - s.chT * 0.015); if (s.enemies.length < s.def.cap) spawnEnemy(); } }
  if (s.flame <= 0) lightsOut();
}
function collectDrops(dt, all) {
  const s = S, h = s.hero;
  for (let i = s.embers.length - 1; i >= 0; i--) { const e = s.embers[i]; e.t += dt; const dx = h.x - e.x, dy = h.y - e.y, d = hyp(dx, dy) || 0.001;
    if (all || e.mag || d < s.st.mag) { e.mag = true; const sp = Math.min(16, 4 + e.t * 14); e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; } else { e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= Math.exp(-4 * dt); e.vy *= Math.exp(-4 * dt); }
    e.x = clamp(e.x, 0.3, RW - 0.3); e.y = clamp(e.y, -0.5, RH - 0.3);
    if (d < 0.5) { s.embers.splice(i, 1);
      if (e.kind === "coin") { s.coins++; sfx("coin_get"); }
      else if (e.kind === "jar") { s.flame = Math.min(MAXF, s.flame + 20); sfx("heal"); say(h.x, h.y - 0.7, "+20", "#ffd27a"); }
      else if (e.kind === "sun") { s.sunT = 6; sfx("evolve"); fx("levelUp", h.x, h.y); banner("Sunshine!", "Everything is lit for a moment"); }
      else { s.flame = Math.min(MAXF, s.flame + (e.v || T.emberFlame)); sfx(e.big ? "heal" : "gem", { pitch: 0.8 + Math.random() * 0.3 }); } }
    else if (e.t > 30) s.embers.splice(i, 1); }
}
function lightBrazier(b) {
  const s = S; b.lit = true; b.cd = 0.3; s.litOnce = true; s.lit++;
  if (!b.healed) { b.healed = true; s.flame = Math.min(MAXF, s.flame + T.towerHeal); say(b.x, b.y - 1.6, "+" + T.towerHeal, "#ffd27a"); sfx("heal"); }
  sfx("fireball_boom", { volume: 0.6, pitch: 0.9 }); sfx("levelup_open"); fx("ring", b.x, b.y, T.brazierR, "#ffb347"); fx("burst", b.x, b.y - 0.8, "#ffd27a", { count: 24, speed: 1.4, glow: true }); fx("shake", 0.25);
  if (s.room.boss) return; // boss rooms clear when the boss is zapped, not when the towers are lit
  if (s.braziers.every(x => x.lit)) clearRoom(); else for (let i = 0; i < s.def.wave; i++) spawnEnemy();
}
function endRun(win) {
  const s = S; s.state = "over"; s.won = win; s.choice = null; music("boss", false); music("stop"); const r = s.result = { win, coins: s.coins, bonus: 0, stars: 0, first: false };
  if (s.level >= 0) { if (win) { r.stars = s.escaped <= 1 ? 3 : s.escaped <= 4 ? 2 : 1; r.first = !SAVE.stars[s.level]; r.bonus = 15 + r.stars * 5 + (r.first ? 25 : 0); SAVE.stars[s.level] = Math.max(SAVE.stars[s.level] || 0, r.stars); SAVE.unlocked = Math.max(SAVE.unlocked, Math.min(LEVELS.length, s.level + 2)); sfx("victory"); } }
  else { r.depth = s.ch - 1; r.bonus = r.depth * 15; SAVE.bestEndless = Math.max(SAVE.bestEndless, r.depth); }
  SAVE.coins += r.coins + r.bonus; persist(); showResult();
}

// ---------- test bot ----------
let CLUMSY = false, botNext = 0;
function botDoor() { // first step toward the nearest unvisited room, else toward the exit room
  const s = S, R = s.dun.rooms, prev = new Map([[s.ri, null]]), q = [s.ri]; let target = -1;
  for (let h = 0; h < q.length && target < 0; h++) for (const k in R[q[h]].nbr) { const j = R[q[h]].nbr[k]; if (prev.has(j)) continue; prev.set(j, [q[h], k]); q.push(j); if (!R[j].visited) { target = j; break; } }
  if (target < 0) target = s.dun.goal; if (target === s.ri || !prev.has(target)) return null;
  let c = target, k = null; while (prev.get(c)) { k = prev.get(c)[1]; c = prev.get(c)[0]; } return k;
}
function botChoose() { const s = S, c = s.choice, i = c.opts.findIndex(o => !o.disabled); if (s.room.type === "shop") { if (i >= 0 && !s.botBought) { s.botBought = true; choose(i); } else { s.botBought = false; s.botShop[s.ri] = true; closeChoice(); } } else if (i >= 0) choose(i); else closeChoice(); }
function bot() {
  const s = S, h = s.hero, L = s.lantern, r = s.room; let tx = h.x, ty = h.y, goal = null; const err = CLUMSY ? 1.1 : 0, aim = (x, y) => { if (CLUMSY) { if (s.t < botNext) return; botNext = s.t + 1.3; } throwTo(x + rnd(-err, err), y + rnd(-err, err)); };
  if (L.state === "ground" && L.blown) { tx = L.x; ty = L.y; }
  else if (r.cleared) {
    if (r.type === "goal") { tx = RW / 2; ty = RH / 2; }
    else if ((r.type === "treasure" || r.type === "shrine") && !r.used || (r.type === "shop" && !s.botShop[s.ri])) { tx = RW / 2; ty = RH / 2 - 0.6; }
    else { const k = botDoor(); if (k) { const p = doorPt(k); const along = k === "n" || k === "s" ? Math.abs(h.x - p[0]) : Math.abs(h.y - p[1]); if (along > 0.5) { tx = k === "n" || k === "s" ? p[0] : h.x + Math.sign(p[0] - h.x) * 2; ty = k === "n" || k === "s" ? h.y + Math.sign(p[1] - h.y) * 2 : p[1]; if (hyp(p[0] - h.x, p[1] - h.y) > 3) { tx = p[0] + (k === "w" ? 1.5 : k === "e" ? -1.5 : 0); ty = p[1] + (k === "n" ? 1.5 : k === "s" ? -1.5 : 0); } } else { tx = p[0] + DIRS[k][0] * 2; ty = p[1] + DIRS[k][1] * 2; } } }
  } else { let bd = 1e9; for (const b of s.braziers) if (!b.lit) { const d = hyp(b.x - h.x, b.y - h.y); if (d < bd) { bd = d; goal = b; } }
    if (!goal && s.king) { bd = -1; for (const b of s.braziers) { const d = hyp(b.x - s.king.x, b.y - s.king.y); if (d > bd) { bd = d; goal = { x: b.x + 1.2, y: b.y + 0.6, stay: true }; } } if (!goal) goal = { x: RW / 2, y: RH - 2, stay: true }; }
    if (goal) { const d = hyp(goal.x - h.x, goal.y - h.y); if (goal.stay || d > 4.5) { tx = goal.x; ty = goal.y; } } }
  let ax = 0, ay = 0, near = null, nd = s.st.range - 0.2, crowd = 0;
  for (const e of s.enemies) { const dx = h.x - e.x, dy = h.y - e.y, d = hyp(dx, dy) + 0.01; const pr = d - (e.carry > 0 ? 3 : 0); if (pr < nd) { nd = pr; near = e; } if (d < 1.6) crowd++;
    if (d < (e.d.heavy ? 3 : 2.2) && (L.state !== "held" || e.d.heavy)) { const w = (e.d.heavy ? 3 : 1.5) / d; ax += dx / d * w; ay += dy / d * w; } }
  for (const g of s.gusts) { const dx = h.x - g.x, dy = h.y - g.y, d = hyp(dx, dy) + 0.01; if (d < 3) { ax += -g.vy / 6 * 1.5; ay += g.vx / 6 * 1.5; } }
  if (L.state === "held" && s.flame > 0 && !r.cleared) { if (near && (CLUMSY || !(crowd >= 2 && hyp(near.x - h.x, near.y - h.y) > 2.5))) aim(near.x, near.y); else if (!near && goal && !goal.stay && hyp(goal.x - h.x, goal.y - h.y) < 5.5) aim(goal.x, goal.y); }
  if (CLUMSY) { ax *= 0.25; ay *= 0.25; }
  // unstick: if we have not moved for a while, sidestep
  bot.still = hyp(h.x - (bot.lx || 0), h.y - (bot.ly || 0)) < 0.01 ? (bot.still || 0) + 1 : 0; bot.lx = h.x; bot.ly = h.y; if (bot.still > 12) bot.side = 25; if (bot.side > 0) { bot.side--; const qx = tx - h.x, qy = ty - h.y, q = hyp(qx, qy) || 1; ax += -qy / q * 2; ay += qx / q * 2; }
  const dx = tx - h.x, dy = ty - h.y, d = hyp(dx, dy) || 1; let ix = (d > 0.15 ? dx / d : 0) + ax * 1.3, iy = (d > 0.15 ? dy / d : 0) + ay * 1.3; const m = hyp(ix, iy) || 1; input.ix = hyp(ix, iy) > 0.05 ? ix / m : 0; input.iy = hyp(ix, iy) > 0.05 ? iy / m : 0;
}

// ---------- rendering ----------
const cv = $("#view"), ctx = cv.getContext("2d"), view = { ox: 0, oy: 0, cs: 48, dpr: 1, scale: 3 }, cam = { x: 12, y: 9 };
const dark = mkCanvas(4, 4), dctx = dark.getContext("2d");
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1); view.dpr = dpr; cv.width = Math.floor(cv.clientWidth * dpr); cv.height = Math.floor(cv.clientHeight * dpr);
  view.scale = Math.max(2, Math.round(Math.min(cv.clientWidth, cv.clientHeight) * dpr / (11 * 16))); view.cs = view.scale * 16;
  dark.width = Math.ceil(cv.width / view.scale); dark.height = Math.ceil(cv.height / view.scale);
}
window.addEventListener("resize", resize);
function blit(im, x, y, sc = 1, flip, alpha, rot) {
  const px = view.cs / 16 * sc, w = im.width * px, h = im.height * px, X = view.ox + x * view.cs, Y = view.oy + y * view.cs;
  if (!flip && !rot && alpha === undefined) { ctx.drawImage(im, Math.round(X - w / 2), Math.round(Y - h / 2), Math.round(w), Math.round(h)); return; }
  ctx.save(); ctx.translate(Math.round(X), Math.round(Y)); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1); if (alpha !== undefined) ctx.globalAlpha = alpha; ctx.drawImage(im, Math.round(-w / 2), Math.round(-h / 2), Math.round(w), Math.round(h)); ctx.restore();
}
const sx = x => view.ox + x * view.cs, sy = y => view.oy + y * view.cs;
function render(now, dt) {
  const cw = cv.width, chh = cv.height, cs = view.cs; ctx.imageSmoothingEnabled = false; ctx.fillStyle = "#0b0920"; ctx.fillRect(0, 0, cw, chh);
  if (!S) return; const s = S, h = s.hero, L = s.lantern, W = WORLDS[s.world], sh = (HAS_FX && FX.shakeOffset && FX.shakeOffset()) || { x: 0, y: 0 };
  cam.x += (h.x - cam.x) * Math.min(1, dt * 8); cam.y += (h.y - cam.y) * Math.min(1, dt * 8);
  view.ox = Math.round(cw / 2 - cam.x * cs + sh.x * view.dpr); view.oy = Math.round(chh / 2 - cam.y * cs + sh.y * view.dpr);
  const i0 = Math.floor(-view.ox / cs) - 1, i1 = Math.ceil((cw - view.ox) / cs), j0 = Math.floor(-view.oy / cs) - 1, j1 = Math.ceil((chh - view.oy) / cs);
  const tw = im => W.tint ? tintFrame(im, W.tint[0], W.tint[1]) : im;
  const R = s.room, hx = RW / 2, hy = RH / 2, doorAt = (i, j) => j === -1 && (i === hx - 1 || i === hx) ? "n" : j === RH && (i === hx - 1 || i === hx) ? "s" : i === -1 && (j === hy - 1 || j === hy) ? "w" : i === RW && (j === hy - 1 || j === hy) ? "e" : null;
  for (let j = Math.max(j0, -2); j <= Math.min(j1, RH + 1); j++) for (let i = Math.max(i0, -2); i <= Math.min(i1, RW + 1); i++) {
    const inside = i >= 0 && j >= 0 && i < RW && j < RH, dk = doorAt(i, j), door = dk && R.nbr[dk] !== undefined, X = view.ox + i * cs, Y = view.oy + j * cs;
    if (inside || (door && R.cleared)) { const hv = hash2(i + R.i * 17, j + s.ch * 31 + s.level * 7), v = hv < 0.7 ? 0 : 1 + Math.floor((hv - 0.7) / 0.1); ctx.drawImage(tw(A("floor" + Math.min(3, v))[0]), X, Y, cs + 1, cs + 1); }
    else if (door) { ctx.fillStyle = "#0a0a10"; ctx.fillRect(X, Y, cs + 1, cs + 1); ctx.fillStyle = "#4a4660"; const vert = dk === "n" || dk === "s"; for (let k = 0; k < 3; k++) { if (vert) ctx.fillRect(X + cs * (0.15 + k * 0.3), Y, cs * 0.1, cs); else ctx.fillRect(X, Y + cs * (0.15 + k * 0.3), cs, cs * 0.1); } }
    else ctx.drawImage(tw(A("wall")[0]), X, Y, cs + 1, cs + 1);
  }
  if (R.type === "goal" && R.cleared) { ctx.globalCompositeOperation = "lighter"; for (let k = 3; k > 0; k--) { ctx.fillStyle = `rgba(255,220,130,${0.10 + 0.05 * Math.sin(now / 200 + k)})`; ctx.beginPath(); ctx.arc(sx(hx), sy(hy), cs * (0.45 + k * 0.28), 0, 6.283); ctx.fill(); } ctx.globalCompositeOperation = "source-over"; blit(A("sun")[0], hx, hy + Math.sin(now / 300) * 0.06, 1.8, false, undefined, now / 900); }
  ctx.globalCompositeOperation = "lighter"; for (const e of s.embers) { if (e.kind !== "ember") continue; const p = cs * (e.big ? 0.16 : 0.09) * (1 + 0.3 * Math.sin(now / 90 + e.x * 7)); ctx.fillStyle = "#ff8a24"; ctx.fillRect(sx(e.x) - p, sy(e.y) - p, p * 2, p * 2); ctx.fillStyle = "#ffe9a0"; ctx.fillRect(sx(e.x) - p / 2, sy(e.y) - p / 2, p, p); } ctx.globalCompositeOperation = "source-over";
  const list = []; for (const b of s.braziers) list.push({ k: "b", o: b, y: b.y }); for (const p of s.pillars) list.push({ k: "p", o: p, y: p.y }); for (const e of s.enemies) list.push({ k: "e", o: e, y: e.y }); list.push({ k: "h", y: h.y }); if (L.state === "ground") list.push({ k: "l", y: L.y - 0.2 }); if (R.type === "treasure" || R.type === "shop" || R.type === "shrine") list.push({ k: "n", y: hy - 0.6 });
  list.sort((a, b) => a.y - b.y); const lanternIm = s.flame > 0 ? A("lantern")[0] : tintFrame(A("lantern")[0], "#3a3848", 0.8);
  for (const it of list) {
    if (it.k === "b") { const b = it.o; blit(b.lit ? frameAt(A("prop_torch"), now / 1000, 9, b.x) : A("brazier_off")[0], b.x, b.y - 0.55, 1); }
    else if (it.k === "p") blit(A("prop_pillar")[0], it.o.x, it.o.y - 0.7, 1);
    else if (it.k === "l") blit(lanternIm, L.x, L.y, 1.1);
    else if (it.k === "n") { if (R.type === "treasure") blit(A("chest_gold")[R.used ? 1 : 0], hx, hy - 0.7, 1.3); else if (R.type === "shop") { blit(A("enemy_shadow")[0], hx, hy - 0.15, 1); blit(frameAt(A("hero_mage_idle"), now / 1000, 3), hx, hy - 0.75, 1.1); } else blit(R.used ? tintFrame(A("prop_candles")[0], "#3a3848", 0.7) : frameAt(A("prop_candles"), now / 1000, 8), hx, hy - 0.7, 1.6); }
    else if (it.k === "h") { if (s.state === "dying" && s.endT > 0.9) continue; blit(A("enemy_shadow")[0], h.x, h.y + 0.42, 1); let im = frameAt(A(h.moving ? "hero_rogue_run" : "hero_rogue_idle"), now / 1000, h.moving ? 10 : 3); if (h.hurtT > 0) im = tintFrame(im, "#ff4a5a", 0.6); blit(im, h.x, h.y - 0.1, 1, h.face < 0, h.iframes > 0 && Math.floor(now / 70) % 2 ? 0.5 : undefined); if (L.state === "held") blit(lanternIm, h.x + h.face * 0.42, h.y + 0.12 + Math.sin(now / 160) * 0.03, 0.9); }
    else { const e = it.o, d = e.d, sc = d.scale || 1; let im = frameAt(A(d.anim), e.type === "statue" && e.lit ? 0 : e.t, d.fps, e.ph); if (d.tint) im = tintFrame(im, d.tint[0], d.tint[1]); if (e.flash > 0) im = tintFrame(im, "#ffffff"); blit(A("enemy_shadow")[0], e.x, e.y + e.r + 0.1, Math.max(1, sc)); blit(im, e.x, e.y - 0.08 - (sc - 1) * 0.5, sc, e.face < 0, e.born < 0.6 ? e.born / 0.6 : undefined);
      if (e.lit && !d.boss && e.hp < e.maxHp && e.maxHp > 10) { const bw = cs * 0.7; ctx.fillStyle = "#300"; ctx.fillRect(sx(e.x) - bw / 2, sy(e.y - e.r - 0.6), bw, 3); ctx.fillStyle = "#ffb347"; ctx.fillRect(sx(e.x) - bw / 2, sy(e.y - e.r - 0.6), bw * Math.max(0, e.hp) / e.maxHp, 3); } }
  }
  for (const e of s.embers) { if (e.kind === "ember") continue; const bob = Math.sin(now / 250 + e.x * 3) * 0.05; blit(e.kind === "coin" ? frameAt(A("coin"), now / 1000, 8, e.x) : e.kind === "jar" ? frameAt(A("fireball"), now / 1000, 10) : A(e.kind)[0], e.x, e.y + bob, e.kind === "sun" || e.kind === "jar" ? 1.2 : 1, false, undefined, e.kind === "jar" ? -1.57 : 0); }
  for (const b of s.bolts) blit(frameAt(A("fireball"), now / 1000, 14), b.x, b.y, 0.8, false, undefined, Math.atan2(b.vy, b.vx));
  if (L.state === "air") { const k = Math.min(1, L.t); blit(lanternIm, L.x, L.y - Math.sin(Math.PI * k) * 0.5, 1.2, false, undefined, k * 12); } else if (L.state === "back") blit(lanternIm, L.x, L.y, 1.2, false, undefined, now / 40);
  ctx.lineWidth = Math.max(2, view.scale);
  for (const b of s.braziers) if (b.snuff > 0) { ctx.strokeStyle = "#6aa8ff"; ctx.beginPath(); ctx.arc(sx(b.x), sy(b.y - 0.4), cs * 0.75, -1.57, -1.57 + 6.283 * b.snuff); ctx.stroke(); }
  if (s.kingTarget) { const b = s.kingTarget.b, k = s.kingTarget.t / 1.5; ctx.strokeStyle = "#d07aff"; ctx.fillStyle = `rgba(208,122,255,${0.15 + 0.2 * k})`; ctx.beginPath(); ctx.arc(sx(b.x), sy(b.y - 0.3), cs * (1.6 - k * 0.8), 0, 6.283); ctx.fill(); ctx.stroke(); }
  fx("draw", ctx, view);
  s.amb += ((s.banished || s.sunT > 0 ? 0.15 : 0.9) - s.amb) * Math.min(1, dt * 2.5);
  dctx.globalCompositeOperation = "source-over"; dctx.clearRect(0, 0, dark.width, dark.height); dctx.fillStyle = `rgba(${W.dark},${s.amb})`; dctx.fillRect(0, 0, dark.width, dark.height); dctx.globalCompositeOperation = "destination-out";
  for (const q of s.src) { const fl = 1 + 0.035 * Math.sin(now / 70 + q.x * 3) * Math.sin(now / 31), r = q.r * 16 * fl, x = sx(q.x) / view.scale, y = sy(q.y) / view.scale; if (r < 1) continue; const g = dctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.55, "rgba(0,0,0,0.92)"); g.addColorStop(0.85, "rgba(0,0,0,0.45)"); g.addColorStop(1, "rgba(0,0,0,0)"); dctx.fillStyle = g; dctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.drawImage(dark, 0, 0, dark.width * view.scale, dark.height * view.scale);
  ctx.globalCompositeOperation = "lighter"; for (const q of s.src) { if (q.r < 1.2) continue; const r = q.r * cs * 0.9, g = ctx.createRadialGradient(sx(q.x), sy(q.y), 0, sx(q.x), sy(q.y), r); g.addColorStop(0, "rgba(255,150,60,0.16)"); g.addColorStop(1, "rgba(255,120,40,0)"); ctx.fillStyle = g; ctx.fillRect(sx(q.x) - r, sy(q.y) - r, r * 2, r * 2); }
  const p = view.scale;
  for (const e of s.embers) { ctx.fillStyle = e.kind === "ember" ? "rgba(255,138,36,0.8)" : e.kind === "coin" ? "rgba(255,210,90,0.55)" : "rgba(255,255,255,0.7)"; ctx.fillRect(sx(e.x) - p, sy(e.y) - p, p * 2, p * 2); }
  ctx.globalCompositeOperation = "source-over";
  for (const g of s.gusts) blit(frameAt(A("slash"), now / 1000, 12), g.x, g.y, 0.55, false, 0.85, Math.atan2(g.vy, g.vx));
  for (const e of s.enemies) { if (e.born < 0.3) continue;
    if (e.carry > 0) blit(frameAt(A("fireball"), now / 1000, 12), e.x, e.y - 0.75 + Math.sin(now / 90) * 0.05, 0.9, false, undefined, -1.57);
    if (e.lit) continue; const big = e.wind > 0 || e.lunge > 0 || e.d.boss, q = p * (big ? 3 : 2), ex = sx(e.x), ey = sy(e.y - 0.15 - ((e.d.scale || 1) - 1) * 0.6), look = Math.sign(h.x - e.x) * p * 0.5;
    for (const ox of [-p * 2.5, p * 1.0]) { ctx.fillStyle = e.d.boss ? "#d07aff" : e.wind > 0 || e.lunge > 0 ? "#ffe04a" : "#ffffff"; ctx.fillRect(Math.round(ex + ox), Math.round(ey), q, q); ctx.fillStyle = "#1a1030"; ctx.fillRect(Math.round(ex + ox + q / 2 - p / 2 + look), Math.round(ey + q / 2 - p / 2), p, p); } }
  for (const b of s.braziers) if (!b.lit && litAt(b.x, b.y) < 0) { const a = 0.35 + 0.3 * Math.sin(now / 300 + b.x); ctx.fillStyle = `rgba(160,200,255,${a})`; ctx.fillRect(Math.round(sx(b.x) - p), Math.round(sy(b.y - 0.9) - p), p * 2, p * 2); }
  const goals = R.cleared ? (R.type === "goal" ? [{ x: hx, y: hy, c: "#ffd27a" }] : Object.keys(R.nbr).filter(k => !s.dun.rooms[R.nbr[k]].visited).map(k => ({ x: doorPt(k)[0], y: doorPt(k)[1], c: "#ffd27a" }))) : R.boss ? [] : s.braziers.filter(b => !b.lit).map(b => ({ x: b.x, y: b.y, c: "#a0c8ff" })); if (L.state === "ground" && L.blown) goals.push({ x: L.x, y: L.y, c: "#ffb347" });
  for (const g of goals) { const gx = sx(g.x), gy = sy(g.y), m = 26 * view.dpr; if (gx > m && gx < cw - m && gy > m && gy < chh - m) continue; const a = Math.atan2(gy - chh / 2, gx - cw / 2), ex = clamp(gx, m, cw - m), ey = clamp(gy, m + 60 * view.dpr, chh - m); ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = g.c; ctx.globalAlpha = 0.75; const q = 9 * view.dpr; ctx.beginPath(); ctx.moveTo(q, 0); ctx.lineTo(-q, -q * 0.8); ctx.lineTo(-q, q * 0.8); ctx.fill(); ctx.restore(); }
  fx("drawOverlay", ctx, view, cw, chh);
  // minimap: rooms you have seen, and the doors leading off them
  const D = s.dun.rooms, c = 9 * view.dpr, g = 3 * view.dpr, known = D.filter(r => r.visited || Object.values(r.nbr).some(j => D[j].visited)); let maxX = -9, minY = 9; for (const r of known) { maxX = Math.max(maxX, r.gx); minY = Math.min(minY, r.gy); }
  const mx0 = cw - 14 * view.dpr - c, my0 = 58 * view.dpr; ctx.globalAlpha = 0.9;
  for (const r of known) { const x = mx0 - (maxX - r.gx) * (c + g), y = my0 + (r.gy - minY) * (c + g); ctx.fillStyle = r === R ? "#ffd27a" : r.visited ? "#8a84c0" : "#3a3468"; ctx.fillRect(x, y, c, c);
    const mark = r.type === "shop" ? "#ffb347" : r.type === "treasure" ? "#7be38a" : r.type === "shrine" ? "#7fb8ff" : r.type === "goal" ? "#d07aff" : null; if (mark && r !== R) { ctx.fillStyle = mark; ctx.fillRect(x + c * 0.3, y + c * 0.3, c * 0.4, c * 0.4); } }
  ctx.globalAlpha = 1;
}

// ---------- ui ----------
function hint(text, secs) { ui.hint = text; ui.hintT = performance.now() + secs * 1000; }
function screen(html, cls) { const el = $("#screen"); el.className = cls || ""; el.innerHTML = html; el.hidden = false; el.scrollTop = 0; const f = el.querySelector("[data-focus]"); if (f) f.focus({ preventScroll: true }); }
function hideScreen() { $("#screen").hidden = true; $("#screen").innerHTML = ""; }
const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = () => { sfx("ui_tap"); fn(); }; };
function gesture() { try { if (HAS_SOUND) { Sound.init(); Sound.setMuted(!SAVE.sound); } } catch (e) {} }
function hideHud() { for (const k of ["#hud", "#hint", "#joy"]) $(k).hidden = true; $("#banner").classList.remove("on"); }
const wallet = () => `<div class="wallet"><img class="px" src="${icon("icon_coin")}" alt="">${SAVE.coins}</div>`;
const totalStars = () => Object.values(SAVE.stars).reduce((a, b) => a + b, 0);
function showTitle() {
  ui.mode = "title"; S = null; hideHud(); music("stop"); music("menu");
  const gift = SAVE.daily !== today(), amt = 30 + 10 * Math.min(7, SAVE.streak), endless = SAVE.unlocked > 3;
  screen(`<div class="col"><h1 class="logo">Last Light</h1><div class="sub">Don't let them steal it!</div>${wallet()}
    <button class="btn go" id="b-play" data-focus>Play</button>
    ${gift ? `<button class="btn gift" id="b-gift">Daily gift: +${amt} coins</button>` : ""}
    <div class="row"><button class="btn" id="b-shop">Shop</button><button class="btn" id="b-endless" ${endless ? "" : "disabled"}>${endless ? "Endless" : "Endless (beat level 3)"}</button></div>
    <button class="btn alt" id="b-snd">Sound: ${SAVE.sound ? "on" : "off"}</button>
    <div class="pill">${totalStars()} / ${LEVELS.length * 3} stars${SAVE.bestEndless ? ` · endless best: depth <b>${SAVE.bestEndless}</b>` : ""}</div></div>`, "title");
  on("#b-play", () => { if (!SAVE.seen.intro) showStory("intro", showMap); else showMap(); }); on("#b-shop", () => showShop(showTitle)); on("#b-endless", () => startGame(-1));
  on("#b-snd", () => { SAVE.sound = !SAVE.sound; persist(); gesture(); showTitle(); });
  on("#b-gift", () => { const d = new Date(); d.setDate(d.getDate() - 1); const y = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; SAVE.streak = SAVE.daily === y ? SAVE.streak + 1 : 0; SAVE.daily = today(); SAVE.coins += amt; persist(); sfx("ui_buy"); showTitle(); });
}
function showStory(key, then) {
  ui.mode = "story"; SAVE.seen[key] = 1; persist(); const pages = STORY[key]; let i = 0;
  const draw = () => { screen(`<div class="col"><div class="portrait"><img class="px" src="${icon(pages[i][0], 6)}" alt=""></div><div class="story">${pages[i][1]}</div><button class="btn go" id="b-next" data-focus>${i < pages.length - 1 ? "Next" : "Let's go"}</button></div>`); on("#b-next", () => { if (++i < pages.length) draw(); else then(); }); };
  draw();
}
function showMap() {
  ui.mode = "map"; S = null; hideHud();
  const worlds = WORLDS.map((w, wi) => `<h3 class="w">${wi + 1}. ${w.name}</h3><div class="levels three">${[0, 1, 2].map(k => { const i = wi * 3 + k, st = SAVE.stars[i] || 0, open = i < SAVE.unlocked; return `<button class="lv ${i === SAVE.unlocked - 1 && !st ? "next" : ""} ${LEVELS[i].boss ? "boss" : ""}" data-lv="${i}" ${open ? "" : "disabled"} aria-label="Dungeon ${i + 1}">${open ? i + 1 : "🔒"}<small>${[1, 2, 3].map(n => n <= st ? "<b>★</b>" : "★").join("")}</small></button>`; }).join("")}</div>`).join("");
  screen(`<div class="col"><h2 class="t">Pick a dungeon</h2>${wallet()}${worlds}<div class="row"><button class="btn" id="b-shop">Shop</button><button class="btn alt" id="b-back">Back</button></div></div>`);
  document.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => { sfx("ui_tap"); startGame(+b.dataset.lv); }); on("#b-shop", () => showShop(showMap)); on("#b-back", showTitle);
}
function showShop(back) {
  ui.mode = "shop"; ui.shopBack = back;
  const cards = Object.keys(SHOP).map(k => { const m = SHOP[k], l = up(k), maxed = l >= m.max, p = maxed ? 0 : price(k, l); return `<button class="card ${!maxed && SAVE.coins < p ? "cant" : ""}" data-up="${k}" ${maxed ? "disabled" : ""}><div class="ic"><img class="px" src="${icon(m.icon)}" alt=""></div><div><h3>${m.name}</h3><p>${m.desc}</p><div class="pips2">${Array.from({ length: m.max }, (_, i) => `<i class="${i < l ? "on" : ""}"></i>`).join("")}</div></div><div class="price">${maxed ? "MAX" : p}</div></button>`; }).join("");
  screen(`<div class="col wide"><h2 class="t">Shop</h2>${wallet()}<div class="cards">${cards}</div><button class="btn alt" id="b-back">Back</button></div>`);
  document.querySelectorAll("[data-up]").forEach(b => b.onclick = () => { const k = b.dataset.up, l = up(k), p = price(k, l); if (l >= SHOP[k].max) return; if (SAVE.coins >= p) { SAVE.coins -= p; SAVE.up[k] = l + 1; persist(); sfx("ui_buy"); showShop(back); } else sfx("ui_deny"); });
  on("#b-back", back);
}
function startGame(levelIdx) { gesture(); hideScreen(); newRun(levelIdx); ui.mode = "run"; ui.pipSig = null; ui.choice = null; $("#hud").hidden = false; $("#coinic").src = icon("icon_coin"); resize(); }
const relicRow = () => S.relics.length ? `<div class="cards">${S.relics.map(k => `<div class="card"><div class="ic"><img class="px" src="${icon(RELICS[k].icon)}" alt=""></div><div><h3>${RELICS[k].name}</h3><p>${RELICS[k].desc}</p></div></div>`).join("")}</div>` : `<div class="pill">No relics yet. Look for treasure rooms, shops and wishing candles.</div>`;
function showPause() { if (ui.mode !== "run" || !S || S.state !== "play") return; ui.mode = "paused"; screen(`<div class="col"><h2 class="t">Paused</h2>${relicRow()}<button class="btn go" id="b-res" data-focus>Resume</button><button class="btn" id="b-retry">Restart</button><button class="btn alt" id="b-quit">Quit</button></div>`); on("#b-res", resume); on("#b-retry", () => startGame(S.level)); on("#b-quit", () => S.level >= 0 ? showMap() : showTitle()); }
function showChoice() {
  const c = ui.choice = S.choice; $("#banner").classList.remove("on");
  screen(`<div class="col"><h2 class="t">${c.title}</h2><div class="pill">${c.sub}</div><div class="cards" style="grid-template-columns:1fr">${c.opts.map((o, i) => `<button class="card ${o.disabled ? "cant" : ""}" data-opt="${i}" ${o.disabled ? "disabled" : ""}><div class="ic"><img class="px" src="${icon(o.icon)}" alt=""></div><div><h3>${o.name}</h3><p>${o.desc}</p></div><div class="price">${o.price !== undefined ? o.price : ""}</div></button>`).join("")}</div>${c.leave ? `<button class="btn alt" id="b-leave">Leave</button>` : ""}</div>`);
  document.querySelectorAll("[data-opt]").forEach(b => b.onclick = () => { sfx("ui_tap"); choose(+b.dataset.opt); }); on("#b-leave", closeChoice);
}
function resume() { ui.mode = "run"; hideScreen(); }
function showResult() {
  ui.mode = "over"; hideHud(); const s = S, r = s.result, lv = s.level;
  const rows = `<div class="summary"><span>Coins kept</span><span>+${r.coins}</span>${r.bonus ? `<span>${lv >= 0 ? (r.first ? "Dungeon bonus (first clear!)" : "Dungeon bonus") : "Depth bonus"}</span><span>+${r.bonus}</span>` : ""}<span>Rooms cleared</span><span>${s.roomsCleared}</span><span>Baddies zapped</span><span>${s.kills}</span><span>Flames won back</span><span>${s.saved}</span><span>Thieves that got away</span><span>${s.escaped}</span><span>Relics found</span><span>${s.relics.length}</span></div>`;
  if (lv >= 0 && r.win) {
    const last = lv === LEVELS.length - 1;
    screen(`<div class="col"><h2 class="t">${last ? "The lighthouse shines!" : "Dungeon clear!"}</h2><div class="stars">${[1, 2, 3].map(n => n <= r.stars ? "<b>★</b>" : "★").join("")}</div><div class="pill">${r.stars === 3 ? "Perfect!" : "For 3 stars, let at most 1 thief get away with your flame."}</div>${rows}
      <button class="btn go" id="b-next" data-focus>${last ? "The end" : "Next dungeon"}</button><div class="row"><button class="btn" id="b-shop">Shop</button><button class="btn alt" id="b-map">Dungeons</button></div></div>`);
    const next = () => startGame(lv + 1), story = lv === 2 ? "w2" : lv === 5 ? "w3" : last ? "end" : null;
    on("#b-next", () => { if (story && !SAVE.seen[story]) showStory(story, last ? showMap : next); else if (last) showMap(); else next(); }); on("#b-shop", () => showShop(showMap)); on("#b-map", showMap);
  } else {
    screen(`<div class="col"><h2 class="t">${lv < 0 ? `Reached depth ${s.ch}` : "Lights out!"}</h2><div class="pill">${lv < 0 ? `Best: depth <b>${Math.max(1, SAVE.bestEndless)}</b>` : "Pip's light went out. Catch the thieves before they run off with it!"}</div>${rows}
      <button class="btn go" id="b-again" data-focus>Try again</button><div class="row"><button class="btn" id="b-shop">Shop</button><button class="btn alt" id="b-map">${lv < 0 ? "Menu" : "Dungeons"}</button></div></div>`);
    on("#b-again", () => startGame(lv)); on("#b-shop", () => showShop(lv < 0 ? showTitle : showMap)); on("#b-map", lv < 0 ? showTitle : showMap);
  }
}
function updateHud(now) {
  const s = S, r = s.room; $("#flamefill").style.width = clamp(s.flame, 0, 100) + "%"; $("#flamebar").classList.toggle("low", s.flame < 25); $("#chlabel").textContent = (s.level >= 0 ? "Dungeon " + (s.level + 1) : "Depth " + s.ch) + (s.relics.length ? " · " + s.relics.length + " relic" + (s.relics.length > 1 ? "s" : "") : ""); $("#coinn").textContent = s.coins;
  const sig = s.ri + ":" + s.braziers.map(b => b.lit ? 1 : 0).join(""); if (sig !== ui.pipSig) { ui.pipSig = sig; $("#pips").innerHTML = s.braziers.map(b => `<i class="${b.lit ? "on" : ""}"></i>`).join(""); }
  $("#bossbar").hidden = !s.king; if (s.king) { $("#bossname").textContent = s.king.d.name; $("#bossfill").style.width = Math.max(0, 100 * s.king.hp / s.king.maxHp) + "%"; }
  let t = "";
  if (ui.hintT > now) t = ui.hint;
  else if (s.state !== "play") t = "";
  else if (s.level === 0 && !r.cleared && s.ri === 0) {
    if (s.hero.walked < 2) t = ui.coarse ? "Drag anywhere to move" : "Move with WASD or the arrow keys";
    else if (!s.threw) t = ui.coarse ? "Tap a tower to toss your lantern at it" : "Click a tower to toss your lantern at it";
    else if (!s.litOnce) t = "Hit a tower with your lantern to light it. It comes back to you.";
    else t = ui.coarse ? "Tap or flick to toss it at baddies. They steal your flame!" : "Click or press Space to toss it at baddies. They steal your flame!";
  } else if (s.level === 0 && s.roomsCleared === 1 && r.cleared && s.ri === 0) t = "Doors are open. Go explore! The map is in the corner.";
  else if (r.type === "goal" && r.cleared) t = "Step into the light to finish";
  else if (s.flame < 20) t = "Your light is almost out! Zap thieves to win it back.";
  else if (s.king && s.king.d.boss && s.chT < 8) t = "Lure the Gloom King into tower light";
  const el = $("#hint"); if (t !== ui.hintShown) { ui.hintShown = t; el.textContent = t; } el.hidden = !t;
}

// ---------- input ----------
const keys = new Set(); let ptr = null;
const keyVec = () => [((keys.has("ArrowRight") || keys.has("d")) ? 1 : 0) - ((keys.has("ArrowLeft") || keys.has("a")) ? 1 : 0), ((keys.has("ArrowDown") || keys.has("s")) ? 1 : 0) - ((keys.has("ArrowUp") || keys.has("w")) ? 1 : 0)];
function onBack() { if (ui.mode === "run" && S && S.state === "choice") { if (S.choice.leave) closeChoice(); } else if (ui.mode === "run") showPause(); else if (ui.mode === "paused") resume(); else if (ui.mode === "shop" && ui.shopBack) ui.shopBack(); else if (ui.mode === "title") { try { window.Capacitor.Plugins.App.exitApp(); } catch (e) {} } else showTitle(); }
window.addEventListener("keydown", e => { if (e.metaKey || e.ctrlKey || e.altKey) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; gesture(); if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(k) && ui.mode === "run") e.preventDefault();
  if (k === " " && !e.repeat && ui.mode === "run" && S && S.state === "play" && document.activeElement.tagName !== "BUTTON") throwDir(S.hero.fx, S.hero.fy);
  if ((k === "Escape" || k === "p") && !e.repeat && (ui.mode === "run" || ui.mode === "paused")) onBack();
  keys.add(k); });
window.addEventListener("keyup", e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
window.addEventListener("blur", () => { keys.clear(); showPause(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) { showPause(); music("stop"); } else if (ui.mode === "title") music("menu"); else if (S) music("startAction"); });
const toWorld = (cx, cy) => { const r = cv.getBoundingClientRect(); return [((cx - r.left) * view.dpr - view.ox) / view.cs, ((cy - r.top) * view.dpr - view.oy) / view.cs]; };
cv.addEventListener("pointerdown", e => { gesture(); if (ui.mode !== "run" || !S || S.state !== "play") return;
  if (ptr) { const w = toWorld(e.clientX, e.clientY); throwTo(w[0], w[1]); return; }
  const r = cv.getBoundingClientRect(); ptr = { id: e.pointerId, sx: e.clientX - r.left, sy: e.clientY - r.top, x: e.clientX - r.left, y: e.clientY - r.top, cx: e.clientX, cy: e.clientY, t0: performance.now(), bx: e.clientX - r.left, by: e.clientY - r.top }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
cv.addEventListener("pointermove", e => { if (!ptr || e.pointerId !== ptr.id) return; const r = cv.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.cx = e.clientX; ptr.cy = e.clientY;
  let dx = ptr.x - ptr.bx, dy = ptr.y - ptr.by; const m = hyp(dx, dy), max = 54; if (m > max) { ptr.bx += dx / m * (m - max); ptr.by += dy / m * (m - max); } });
function ptrEnd(e) { if (!ptr || e.pointerId !== ptr.id) return; const dt = performance.now() - ptr.t0, dx = ptr.x - ptr.sx, dy = ptr.y - ptr.sy, d = hyp(dx, dy);
  if (e.type === "pointerup" && dt < 240 && ui.mode === "run" && S && S.state === "play") { if (d > 30) throwDir(dx, dy); else { const w = toWorld(ptr.cx, ptr.cy); throwTo(w[0], w[1]); } }
  ptr = null; $("#joy").hidden = true; }
cv.addEventListener("pointerup", ptrEnd); cv.addEventListener("pointercancel", ptrEnd); cv.addEventListener("contextmenu", e => e.preventDefault());
$("#pausebtn").onclick = () => { sfx("ui_tap"); showPause(); };
function readInput(now) {
  const kv = keyVec(); input.ix = kv[0]; input.iy = kv[1];
  if (ptr && now - ptr.t0 > 120) { const dx = ptr.x - ptr.bx, dy = ptr.y - ptr.by, j = $("#joy"); j.hidden = false; j.style.left = ptr.bx + "px"; j.style.top = ptr.by + "px"; $("#knob").style.transform = `translate(${dx}px,${dy}px)`; if (hyp(dx, dy) > 8) { input.ix = dx / 54; input.iy = dy / 54; } }
}

// ---------- loop ----------
let last = 0, acc = 0;
function frame(now) {
  requestAnimationFrame(frame); let dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (S && ui.mode === "run") { if (S.state === "play") readInput(now); else { input.ix = 0; input.iy = 0; }
    acc += dt; let n = 0; while (acc >= 1 / 60 && n < 5) { step(1 / 60); acc -= 1 / 60; n++; if (!S || ui.mode !== "run") break; } if (n === 5) acc = 0; if (S && ui.mode === "run") { updateHud(now); if (S.state === "choice" && ui.choice !== S.choice) showChoice(); } }
  fx("update", dt * 1000); render(now, dt);
}
resize(); buildAnims(); showTitle(); requestAnimationFrame(frame);
try { const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App; if (App) App.addListener("backButton", onBack); } catch (e) {}
