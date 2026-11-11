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
let RW = 24, RH = 18; const MAXF = 100;
const T = { lightTime: 1.4, emberFlame: 2, boltRange: 7.5, searLantern: 3, searBrazier: 2, brazierR: 3.2, towerCd: 0.75, towerHeal: 15, towerRegen: 3, throwMax: 6.5, flick: 5.5 };
const ENEMY = {
  moth:     { name: "Nibbler",  anim: "bat",    hp: 5,   spd: 3.1, steal: 5,  r: 0.28, embers: 1, fps: 12, coin: 0.15 },
  shade:    { name: "Sneak",    anim: "ghost",  hp: 22,  spd: 2.7, steal: 15, r: 0.34, embers: 3, fps: 6,  coin: 0.6 },
  statue:   { name: "Peekaboo", anim: "mummy",  hp: 55,  spd: 2.9, steal: 22, r: 0.4,  embers: 6, fps: 6,  coin: 1, tint: ["#8d93a3", 0.75] },
  snuffer:  { name: "Snatcher", anim: "imp",    hp: 26,  spd: 2.4, steal: 10, r: 0.3,  embers: 3, fps: 12, coin: 0.7, tint: ["#3a6cff", 0.55] },
  spider:   { name: "Skitter",  anim: "spider", hp: 10,  spd: 3.9, steal: 8,  r: 0.3,  embers: 2, fps: 14, coin: 0.4 },
  slime:    { name: "Blob",     anim: "slime",  hp: 26,  spd: 1.9, steal: 12, r: 0.36, embers: 2, fps: 5,  coin: 0.6, split: "blobling" },
  blobling: { name: "Blobling", anim: "slime",  hp: 8,   spd: 2.6, steal: 5,  r: 0.26, embers: 1, fps: 7,  coin: 0.2, scale: 0.7 },
  blower:   { name: "Huff",     anim: "wraith", hp: 30,  spd: 2.0, steal: 10, r: 0.36, embers: 4, fps: 8,  coin: 1 },
  brute:    { name: "Grabby",   anim: "ogre",   hp: 170, spd: 1.5, steal: 35, r: 0.55, embers: 10, fps: 5, coin: 8, heavy: true },
  king:     { name: "The Gloom King", anim: "lich", hp: 1300, spd: 1.25, steal: 22, r: 0.7, embers: 0, fps: 6, coin: 40, heavy: true, scale: 1.5, boss: true },
};
const LV = (name, w, h, towers, roster, o = {}) => ({ name, w, h, towers, roster, rate: 2.0, cap: 14, start: 5, wave: 3, ...o });
const LEVELS = [
  LV("First Light", 18, 12, 2, { moth: 1 }, { rate: 4.2, cap: 5, start: 1, wave: 1 }),
  LV("Sneaky Eyes", 20, 14, 3, { moth: 4, shade: 3 }, { rate: 2.6, cap: 9, start: 3, wave: 2, intro: "Sneaks circle in the dark, then pounce" }),
  LV("Hands Off My Tower", 20, 14, 3, { moth: 4, shade: 3, snuffer: 3 }, { rate: 2.4, cap: 11, start: 4, intro: "Snatchers steal tower flames. Catch them!" }),
  LV("Peekaboo", 22, 14, 4, { moth: 3, shade: 3, statue: 3, snuffer: 1 }, { intro: "Peekaboos only move in the dark" }),
  LV("Grabby's Cellar", 22, 16, 4, { moth: 4, shade: 3, snuffer: 2 }, { brutes: 1, intro: "Grabby steals a LOT. Don't let him run!" }),
  LV("Skitter Shelf", 22, 16, 4, { spider: 5, moth: 3, shade: 2 }, { intro: "Skitters are fast. Really fast." }),
  LV("Blob Trouble", 22, 16, 4, { slime: 4, spider: 3, shade: 2 }, { intro: "Zap a Blob and you get two Bloblings" }),
  LV("Huff and Puff", 24, 16, 4, { blower: 3, moth: 4, shade: 3 }, { intro: "Huffs blow the lantern out of your hands" }),
  LV("Quiet Please", 24, 16, 5, { statue: 4, spider: 3, snuffer: 3, blower: 1 }, { rate: 1.9 }),
  LV("Double Grabby", 24, 18, 5, { slime: 3, spider: 3, shade: 3, snuffer: 2 }, { brutes: 2, rate: 1.8, cap: 16 }),
  LV("Up the Stairs", 24, 18, 5, { spider: 3, shade: 4, blower: 2, snuffer: 2 }, { rate: 1.7, cap: 16 }),
  LV("Stone Garden", 24, 18, 5, { statue: 6, blower: 2, moth: 3 }, { rate: 1.7, cap: 16 }),
  LV("Thief Parade", 26, 18, 6, { snuffer: 5, spider: 3, slime: 3 }, { rate: 1.6, cap: 17 }),
  LV("Almost There", 26, 18, 6, { moth: 3, shade: 3, spider: 3, slime: 2, blower: 2, statue: 2, snuffer: 2 }, { rate: 1.5, cap: 18, brutes: 1 }),
  LV("The Gloom King", 22, 16, 4, { moth: 4, shade: 3, spider: 2 }, { boss: true, rate: 3.2, cap: 9, start: 3, wave: 1, intro: "Keep the towers lit. He hates the light!" }),
];
const WORLDS = [{ name: "The Cellar", dark: "14,10,44", tint: null }, { name: "The Library", dark: "6,22,40", tint: ["#2a9a8a", 0.16] }, { name: "The Lamp Room", dark: "34,8,40", tint: ["#c0508a", 0.14] }];
function endlessDef(n) {
  const r = { moth: 4, shade: 3 }; if (n >= 2) { r.snuffer = 2; r.spider = 3; } if (n >= 3) { r.statue = 2; r.slime = 2; } if (n >= 4) r.blower = 2;
  return LV("Room " + n, 24, 18, Math.min(6, 3 + Math.floor((n - 1) / 2)), r, { rate: Math.max(1.1, 2.6 - 0.2 * n), cap: 11 + 2 * n, start: 3 + n, wave: 2 + n, brutes: n >= 5 ? Math.floor(n / 5) : 0, hpMul: 1 + 0.15 * (n - 1) });
}
const SHOP = {
  lamp:   { name: "Bigger Lantern", icon: "icon_orb",       max: 5, cost: 40,  desc: "+6% light size" },
  zap:    { name: "Hotter Zaps",    icon: "icon_fireball",  max: 5, cost: 40,  desc: "+20% zap damage" },
  quick:  { name: "Quick Zaps",     icon: "icon_haste",     max: 4, cost: 60,  desc: "Zap 8% faster" },
  tower:  { name: "Tower Power",    icon: "icon_lightning", max: 4, cost: 50,  desc: "+25% tower damage" },
  boom:   { name: "Big Toss",       icon: "icon_aura",      max: 4, cost: 45,  desc: "Bigger, stronger lantern landing" },
  boots:  { name: "Zoomy Boots",    icon: "icon_boots",     max: 3, cost: 60,  desc: "+6% run speed" },
  magnet: { name: "Ember Magnet",   icon: "icon_magnet",    max: 3, cost: 40,  desc: "Pull embers and coins from further" },
  tank:   { name: "Full Tank",      icon: "icon_regen",     max: 3, cost: 50,  desc: "Start with +10 flame" },
  heart:  { name: "Extra Heart",    icon: "icon_vitality",  max: 2, cost: 250, desc: "+1 heart" },
};
const price = (k, l) => Math.round(SHOP[k].cost * (1 + l * 0.8) / 5) * 5;
const STORY = {
  intro: [["hero_rogue_idle", "This is Pip. Pip keeps the lights on in the old lighthouse."], ["lich", "One night the Gloom King sent his baddies to steal every flame. All of them!"], ["lantern", "Pip still has one little lantern. Time to light the towers again."]],
  w2: [["hero_rogue_idle", "The cellar is bright again. Nice one, Pip!"], ["spider", "Next up: the library. Something skitters between the shelves..."]],
  w3: [["prop_torch", "Two floors glowing. The Gloom King is getting grumpy."], ["lich", "He's waiting in the lamp room, at the very top."]],
  end: [["lich", "The Gloom King pops like a soap bubble."], ["sun", "The big lamp roars back to life. Ships can see the rocks again."], ["hero_rogue_idle", "Pip gets a nap. Thanks for playing!"]],
};

// ---------- save ----------
const SAVE_KEY = "last-light-save-v2"; let SAVE = { coins: 0, up: {}, stars: {}, unlocked: 1, bestEndless: 0, sound: true, seen: {}, daily: "", streak: 0 };
try { SAVE = { ...SAVE, ...(JSON.parse(localStorage.getItem(SAVE_KEY) || "{}")) }; } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} };
const up = k => SAVE.up[k] || 0;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ---------- state ----------
let S = null;
const input = { ix: 0, iy: 0 };
const ui = { mode: "title", hint: "", bannerT: 0, coarse: matchMedia("(pointer: coarse)").matches };
const lightR = () => (1.5 + 3.3 * clamp(S.flame / MAXF, 0, 1)) * S.st.light;

function newRun(levelIdx) { // levelIdx: 0..14, or -1 for endless
  const st = { light: 1 + 0.06 * up("lamp"), boltDmg: 9 * (1 + 0.2 * up("zap")), boltCd: 0.42 * (1 - 0.08 * up("quick")), hearts: 3 + up("heart"), towerDmg: 12 * (1 + 0.25 * up("tower")), landDmg: 14 * (1 + 0.2 * up("boom")), landR: 1.8 + 0.2 * up("boom"), spd: 3.7 * (1 + 0.06 * up("boots")), mag: 2.3 * (1 + 0.35 * up("magnet")) };
  S = { state: "play", level: levelIdx, ch: 0, st, flame: Math.min(MAXF, 70 + 10 * up("tank")), hearts: st.hearts, lostHearts: 0, escaped: 0, stolen: 0, saved: 0, coins: 0, t: 0, kills: 0, lit: 0, snuffed: 0,
    hero: { x: 0, y: 0, r: 0.3, face: 1, fx: 0, fy: -1, moving: false, iframes: 0, hurtT: 0, walked: 0 }, lantern: { state: "held", x: 0, y: 0, sx: 0, sy: 0, dx: 0, dy: 0, t: 0, dur: 0.3, landT: 0 },
    enemies: [], embers: [], bolts: [], gusts: [], braziers: [], pillars: [], src: [], boltT: 0, spawnT: 0, banished: false, amb: 0.9, doorOpen: false, endT: 0, threw: false, picked: false, litOnce: false, lightProg: 0, lightB: null, sunT: 0, king: null, kingTarget: null, def: null, world: 0 };
  nextRoom(); music("startAction");
}
function nextRoom() {
  const s = S; s.ch++; const def = s.def = s.level >= 0 ? LEVELS[s.level] : endlessDef(s.ch); s.world = s.level >= 0 ? Math.floor(s.level / 5) : (s.ch - 1) % 3;
  RW = def.w; RH = def.h; for (const k of ["enemies", "embers", "bolts", "gusts", "braziers", "pillars"]) s[k].length = 0;
  const h = s.hero; h.x = RW / 2; h.y = RH - 2; h.iframes = 1; s.lantern.state = "held"; s.banished = false; s.doorOpen = false; s.amb = 0.9; s.spawnT = 2.5; s.chT = 0; s.sunT = 0; s.king = null; s.kingTarget = null;
  if (s.ch > 1) s.flame = Math.min(MAXF, s.flame + 10);
  const far = (x, y, list, d) => list.every(o => hyp(o.x - x, o.y - y) >= d);
  for (let tries = 0; s.braziers.length < def.towers && tries < 600; tries++) { const x = rnd(2.5, RW - 2.5), y = rnd(2.5, RH - 3); if (far(x, y, s.braziers, tries < 300 ? 5.5 : 4) && hyp(x - h.x, y - h.y) > 4 && hyp(x - RW / 2, y) > 2.5) s.braziers.push({ x, y, r: 0.42, lit: false, snuff: 0, cd: 0, healed: false }); }
  for (let tries = 0; s.pillars.length < Math.round(RW * RH / 90) && tries < 200; tries++) { const x = rnd(2, RW - 2), y = rnd(2, RH - 3.5); if (far(x, y, s.braziers, 2) && far(x, y, s.pillars, 3.5) && hyp(x - h.x, y - h.y) > 2.5 && hyp(x - RW / 2, y) > 2.5) s.pillars.push({ x, y, r: 0.45 }); }
  rebuildSources(); for (let i = 0; i < def.start; i++) spawnEnemy();
  for (let i = 0; i < (def.brutes || 0); i++) spawnEnemy("brute");
  if (def.boss) { spawnEnemy("king"); s.king = s.enemies[s.enemies.length - 1]; s.king.x = RW / 2; s.king.y = 2.5; s.king.born = 1; music("boss", true); } else music("boss", false);
  fx("clear"); cam.x = h.x; cam.y = h.y; music("setIntensity", Math.min(0.9, 0.15 + (s.level >= 0 ? s.level * 0.05 : s.ch * 0.08)));
  banner(s.level >= 0 ? `${s.level + 1}. ${def.name}` : def.name, def.intro || (s.level === 0 ? "Light every tower" : ""));
}
function banner(title, sub) { const el = $("#banner"); el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ""}`; el.classList.add("on"); clearTimeout(ui.bt); ui.bt = setTimeout(() => el.classList.remove("on"), 2400); }

// ---------- light ----------
function rebuildSources() {
  const s = S, L = s.lantern, h = s.hero, src = s.src; src.length = 0;
  const r = s.flame > 0 ? lightR() * (s.state === "dying" ? Math.max(0, 1 - s.endT * 1.2) : 1) : 0;
  if (L.state === "held") { if (r > 0) src.push({ x: h.x, y: h.y, r, sear: T.searLantern, lantern: true, safe: true }); else src.push({ x: h.x, y: h.y, r: 0.95, sear: 0 }); }
  else { if (r > 0) src.push({ x: L.x, y: L.y, r: r * (L.state === "air" ? 0.6 : 1), sear: T.searLantern, lantern: true, safe: true }); src.push({ x: h.x, y: h.y, r: 0.95, sear: 0 }); }
  for (const b of s.braziers) if (b.lit) src.push({ x: b.x, y: b.y, r: T.brazierR, sear: T.searBrazier, brazier: true, safe: true });
  for (const e of s.enemies) if (e.carry > 0 && e.type !== "statue") src.push({ x: e.x, y: e.y, r: 1.15, sear: 0 });
  if (s.doorOpen) src.push({ x: RW / 2, y: 0, r: 2.6, sear: 0, safe: true });
}
function litAt(x, y) { let sear = S.sunT > 0 ? 1 : -1; for (const q of S.src) { const dx = q.x - x, dy = q.y - y, rr = q.r * 0.94; if (dx * dx + dy * dy < rr * rr && q.sear > sear) sear = q.sear; } return sear; }
function heroSafe() { if (S.sunT > 0) return true; const h = S.hero; for (const q of S.src) { if (!q.safe) continue; const dx = q.x - h.x, dy = q.y - h.y; if (dx * dx + dy * dy < q.r * q.r) return true; } return false; }

// ---------- enemies ----------
function spawnEnemy(type, at) {
  const s = S, h = s.hero, def = s.def;
  if (!type) { let tot = 0; for (const k in def.roster) tot += def.roster[k]; let x = Math.random() * tot; for (const k in def.roster) { type = k; x -= def.roster[k]; if (x < 0) break; }
    const count = t => s.enemies.filter(e => e.type === t).length;
    if (type === "snuffer" && (count("snuffer") >= 2 || !s.braziers.some(b => b.lit))) type = "shade"; if (type === "blower" && count("blower") >= 2) type = "shade"; if (type === "shade" && !def.roster.shade) type = Object.keys(def.roster)[0]; }
  let px = 0, py = 0; if (at) { px = at.x; py = at.y; } else for (let i = 0; i < 30; i++) { px = rnd(0.8, RW - 0.8); py = rnd(0.8, RH - 0.8); if (hyp(px - h.x, py - h.y) > 6 && litAt(px, py) < 0) break; }
  const d = ENEMY[type], n = type === "moth" ? 3 : type === "spider" ? 2 : 1, mul = d.boss ? 1 : (def.hpMul || 1 + 0.05 * Math.max(0, s.level));
  for (let i = 0; i < n; i++) s.enemies.push({ type, d, x: clamp(px + rnd(-0.6, 0.6), 0.5, RW - 0.5), y: clamp(py + rnd(-0.6, 0.6), 0.5, RH - 0.5), hp: d.hp * mul, maxHp: d.hp * mul, r: d.r, kx: 0, ky: 0, flash: 0, lit: false, t: rnd(0, 9), ph: rnd(0, 6.28), face: 1, cd: rnd(1.5, 3.5), wind: 0, lunge: 0, lx: 0, ly: 0, chan: 0, dead: false, born: at ? 0.6 : 0, carry: 0, fleeT: 0, tower: null, a1: 5, a2: 6 });
}
function damage(e, dmg, kx = 0, ky = 0) { if (e.dead) return; e.hp -= dmg; e.flash = 0.08; if (!e.d.heavy && e.type !== "statue" && !(e.chan > 0)) { e.kx += kx; e.ky += ky; } if (e.hp <= 0) kill(e); }
function drop(kind, x, y, o) { const a = rnd(0, 6.28), sp = rnd(1, 3); S.embers.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, mag: S.banished && kind !== "sun", ...o }); }
function kill(e) {
  const s = S, d = e.d; e.dead = true; s.kills++; sfx("kill"); fx("burst", e.x, e.y, d.anim === "slime" ? "#7ad66a" : "#ffb347", { count: d.heavy ? 30 : 8, speed: d.heavy ? 1.5 : 0.9, glow: true });
  for (let i = 0; i < d.embers; i++) { if (e.type === "moth" && Math.random() < 0.5) continue; drop("ember", e.x, e.y); }
  let c = Math.floor(d.coin) + (Math.random() < d.coin % 1 ? 1 : 0); for (let i = 0; i < c; i++) drop("coin", e.x, e.y);
  if (!d.boss && !s.banished) { const r = Math.random(); if (r < 0.02 && s.hearts < s.st.hearts) drop("heart", e.x, e.y); else if (r < 0.045 && s.sunT <= 0 && !s.embers.some(x => x.kind === "sun")) drop("sun", e.x, e.y); }
  if (e.tower) { e.tower.lit = true; e.tower.snuff = 0; s.saved++; sfx("levelup_open"); fx("ring", e.tower.x, e.tower.y, T.brazierR, "#ffb347"); say(e.tower.x, e.tower.y - 1.2, "BACK ON!", "#ffd27a"); }
  else if (e.carry > 0) { s.embers.push({ kind: "ember", x: e.x, y: e.y, vx: 0, vy: 0, t: 0, mag: true, v: e.carry, big: true }); s.saved++; say(e.x, e.y - 0.6, "GOT IT!", "#ffd27a"); }
  if (d.split) for (let i = 0; i < 2; i++) spawnEnemy(d.split, { x: e.x, y: e.y });
  if (d.boss) { s.king = null; s.kingTarget = null; sfx("boss_die"); fx("shake", 1); fx("ring", e.x, e.y, 6, "#d07aff"); music("boss", false); for (const o of s.enemies.slice()) if (!o.dead) kill(o); s.banished = true; s.state = "won"; s.endT = 0; banner("You did it!", "The Gloom King is gone"); }
}
function say(x, y, text, color) { fx("damageNumber", x, y, text, color); }
function touch(e, dx, dy) {
  const s = S, h = s.hero; if (h.iframes > 0 || s.state !== "play" || e.carry > 0) return;
  if (s.lantern.state === "held" && s.flame > 0) { stealFlame(e, s.flame); h.iframes = 0.6; fx("shake", 0.2); say(h.x, h.y - 0.7, e.d.boss ? "MINE!" : "HEY!", "#ffd27a"); }
  else if (!heroSafe()) {
    s.hearts--; s.lostHearts++; h.iframes = 1.3; h.hurtT = 0.3; fx("hurtFlash"); fx("shake", 0.5); sfx("hero_hurt"); say(h.x, h.y - 0.7, "OUCH!", "#ff6a6a"); if (!e.d.heavy) { e.kx = -dx * 9; e.ky = -dy * 9; }
    try { navigator.vibrate && navigator.vibrate(30); } catch (er) {}
    if (s.hearts <= 0) { s.state = "dying"; s.endT = 0; sfx("player_die"); music("stop"); }
  } else if (!e.d.heavy) { e.kx = -dx * 7; e.ky = -dy * 7; }
}
function stealFlame(e, avail) { const amt = Math.min(avail, e.d.steal); S.flame -= amt; S.stolen++; sfx("hero_hurt", { pitch: 1.5, volume: 0.7 }); e.lunge = 0; e.wind = 0; if (e.d.boss) return; e.carry = amt; e.fleeT = e.d.heavy ? 7 : 4.5; }
function updateEnemies(dt) {
  const s = S, h = s.hero, L = s.lantern, held = L.state === "held", LR = lightR();
  for (const e of s.enemies) {
    if (e.dead) continue; e.t += dt; e.born += dt; e.flash = Math.max(0, e.flash - dt);
    const sear = litAt(e.x, e.y); e.lit = sear >= 0; if (sear > 0) { e.hp -= sear * dt; if (e.hp <= 0) { kill(e); continue; } }
    let dx = h.x - e.x, dy = h.y - e.y; const d = hyp(dx, dy) || 0.001; dx /= d; dy /= d;
    let mx = dx, my = dy, spd = e.d.spd, contact = true; const type = e.type;
    if (e.carry > 0) {
      contact = false; e.fleeT -= dt; mx = -dx; my = -dy; spd = type === "statue" ? (e.lit ? 0 : 2) : e.d.spd * 1.1;
      if (e.x < 0.6 || e.x > RW - 0.6) { mx = 0; my = Math.sign(my || 1); } if (e.y < 0.6 || e.y > RH - 0.6) { my = 0; mx = Math.sign(mx || 1); }
      if (e.fleeT <= 0) { e.dead = true; s.escaped++; fx("burst", e.x, e.y, "#8a7cff", { count: 10 }); say(e.x, e.y - 0.5, "GOT AWAY", "#b8a8ff"); sfx("ui_deny"); continue; }
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

// ---------- lantern ----------
function launch(tx, ty) { const L = S.lantern, h = S.hero, d = hyp(tx - h.x, ty - h.y); L.sx = h.x; L.sy = h.y; L.dx = clamp(tx, 0.6, RW - 0.6); L.dy = clamp(ty, 0.6, RH - 0.6); L.t = 0; L.dur = 0.16 + d * 0.035; L.state = "air"; L.x = h.x; L.y = h.y; }
function throwTo(wx, wy) {
  const s = S; if (!s || s.state !== "play") return; const L = s.lantern, h = s.hero;
  if (L.state !== "held") { hint("Grab your lantern first", 1.6); return; }
  let dx = wx - h.x, dy = wy - h.y, d = hyp(dx, dy); if (d < 0.5) { dx = h.fx * 3; dy = h.fy * 3; d = 3; }
  if (d > T.throwMax) { dx *= T.throwMax / d; dy *= T.throwMax / d; }
  launch(h.x + dx, h.y + dy); s.threw = true; sfx("fireball_throw"); if (Math.abs(dx) > 0.2) h.face = dx > 0 ? 1 : -1;
}
function throwDir(dx, dy) { const d = hyp(dx, dy) || 1; throwTo(S.hero.x + dx / d * T.flick, S.hero.y + dy / d * T.flick); }
function updateLantern(dt) {
  const s = S, L = s.lantern, h = s.hero;
  if (L.state === "air") {
    L.t += dt / L.dur; const k = Math.min(1, L.t); L.x = L.sx + (L.dx - L.sx) * k; L.y = L.sy + (L.dy - L.sy) * k;
    if (k >= 1) { L.state = "ground"; L.landT = s.t; if (s.flame > 0 && !L.blown) { sfx("fireball_boom", { volume: 0.5 }); fx("shake", 0.22); fx("ring", L.x, L.y, s.st.landR, "#ffb347"); fx("burst", L.x, L.y, "#ffd27a", { count: 16, speed: 1.3, glow: true });
      for (const e of s.enemies) { const q = hyp(e.x - L.x, e.y - L.y); if (q < s.st.landR + e.r) damage(e, s.st.landDmg, (e.x - L.x) / (q || 1) * 5, (e.y - L.y) / (q || 1) * 5); } } L.blown = false; }
  } else if (L.state === "ground" && s.t - L.landT > 0.25 && hyp(h.x - L.x, h.y - L.y) < 0.8) { L.state = "held"; s.picked = true; sfx("pickup"); }
}

// ---------- step ----------
function step(dt) {
  const s = S; if (!s) return;
  if (s.state === "dying") { s.endT += dt; rebuildSources(); if (s.endT > 1.7) endRun(false); return; }
  if (s.state === "won") { s.endT += dt; collectDrops(dt, true); if (s.endT > 2.6) endRun(true); return; }
  if (s.state !== "play") return;
  s.t += dt; s.chT += dt; s.sunT = Math.max(0, s.sunT - dt); const h = s.hero, L = s.lantern;
  let ix = input.ix, iy = input.iy; const m = hyp(ix, iy); if (m > 1) { ix /= m; iy /= m; }
  h.moving = m > 0.12; if (h.moving) { h.x += ix * s.st.spd * dt; h.y += iy * s.st.spd * dt; h.walked += s.st.spd * dt * Math.min(1, m); const n = hyp(ix, iy); h.fx = ix / n; h.fy = iy / n; if (Math.abs(ix) > 0.15) h.face = ix > 0 ? 1 : -1; }
  const inDoor = s.doorOpen && Math.abs(h.x - RW / 2) < 0.9;
  h.x = clamp(h.x, 0.4, RW - 0.4); h.y = clamp(h.y, inDoor ? -0.8 : 0.4, RH - 0.4);
  for (const o of s.pillars) pushOut(h, o); for (const o of s.braziers) pushOut(h, o);
  h.iframes = Math.max(0, h.iframes - dt); h.hurtT = Math.max(0, h.hurtT - dt);
  if (inDoor && h.y < -0.3) { sfx("stairs"); if (s.level >= 0) { endRun(true); } else { s.coins += 5; nextRoom(); } return; }
  updateLantern(dt); rebuildSources();
  for (const b of s.braziers) { if (!b.lit) continue;
    if (L.state === "held" && hyp(b.x - h.x, b.y - h.y) < T.brazierR) s.flame = Math.min(MAXF, s.flame + T.towerRegen * dt);
    b.cd -= dt; if (b.cd <= 0) { let best = null, bd = T.brazierR; for (const e of s.enemies) { const q = hyp(e.x - b.x, e.y - b.y) - e.r; if (q < bd) { bd = q; best = e; } }
      if (best) { b.cd = T.towerCd; const ox = b.x, oy = b.y - 1.0, a = Math.atan2(best.y - oy, best.x - ox); s.bolts.push({ x: ox, y: oy, vx: Math.cos(a) * 11, vy: Math.sin(a) * 11, life: 0.6, dmg: s.st.towerDmg }); sfx("orb_fire", { volume: 0.3, pitch: 0.7 }); } } }
  let nb = null, nd = 1.35; for (const b of s.braziers) if (!b.lit) { const d = hyp(b.x - h.x, b.y - h.y); if (d < nd) { nd = d; nb = b; } }
  if (nb && L.state === "held") { if (s.lightB !== nb) { s.lightB = nb; s.lightProg = 0; } s.lightProg += dt; if (s.lightProg >= T.lightTime) lightBrazier(nb); }
  else { if (nb) hint("Bring your lantern to light the tower", 0.3); s.lightB = null; s.lightProg = 0; }
  s.boltT -= dt; if (s.boltT <= 0) { let best = null, bd = T.boltRange; for (const e of s.enemies) { if (!e.lit) continue; const d = hyp(e.x - h.x, e.y - h.y); if (d < bd) { bd = d; best = e; } }
    if (best) { s.boltT = s.st.boltCd; const a = Math.atan2(best.y - h.y, best.x - h.x); s.bolts.push({ x: h.x, y: h.y - 0.1, vx: Math.cos(a) * 14, vy: Math.sin(a) * 14, life: 0.7 }); sfx("orb_fire", { volume: 0.35 }); } }
  for (let i = s.bolts.length - 1; i >= 0; i--) { const b = s.bolts[i]; b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; let hit = false;
    for (const e of s.enemies) { if (e.dead || !e.lit) continue; if (hyp(e.x - b.x, e.y - b.y) < e.r + 0.18) { damage(e, b.dmg || s.st.boltDmg, b.vx * 0.2, b.vy * 0.2); sfx("hit_enemy"); fx("burst", b.x, b.y, "#ffd27a", { count: 4, speed: 0.7 }); hit = true; break; } }
    if (hit || b.life <= 0 || b.x < 0 || b.y < 0 || b.x > RW || b.y > RH) s.bolts.splice(i, 1); }
  for (let i = s.gusts.length - 1; i >= 0; i--) { const g = s.gusts[i]; g.life -= dt; g.x += g.vx * dt; g.y += g.vy * dt;
    if (hyp(g.x - h.x, g.y - h.y) < 0.55) { s.gusts.splice(i, 1); if (L.state === "held") { const d = hyp(g.vx, g.vy); L.blown = true; launch(h.x + g.vx / d * 3.8, h.y + g.vy / d * 3.8); say(h.x, h.y - 0.7, "WHOOSH!", "#bfe0ff"); sfx("slash", { pitch: 0.5 }); fx("shake", 0.3); } continue; }
    if (g.life <= 0) s.gusts.splice(i, 1); }
  updateEnemies(dt); if (s.state !== "play") return;
  collectDrops(dt, false);
  if (!s.banished) { s.spawnT -= dt; if (s.spawnT <= 0) { s.spawnT = Math.max(1.2, s.def.rate - s.chT * 0.015); if (s.enemies.length < s.def.cap) spawnEnemy(); } }
  if (s.flame <= 0) { s.flame = 0; hint("Your lantern is out! Grab embers or stand by a lit tower.", 0.3); }
}
function collectDrops(dt, all) {
  const s = S, h = s.hero;
  for (let i = s.embers.length - 1; i >= 0; i--) { const e = s.embers[i]; e.t += dt; const dx = h.x - e.x, dy = h.y - e.y, d = hyp(dx, dy) || 0.001;
    if (all || e.mag || d < s.st.mag) { e.mag = true; const sp = Math.min(16, 4 + e.t * 14); e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; } else { e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= Math.exp(-4 * dt); e.vy *= Math.exp(-4 * dt); }
    e.x = clamp(e.x, 0.3, RW - 0.3); e.y = clamp(e.y, -0.5, RH - 0.3);
    if (d < 0.5) { s.embers.splice(i, 1);
      if (e.kind === "coin") { s.coins++; sfx("coin_get"); }
      else if (e.kind === "heart") { s.hearts = Math.min(s.st.hearts, s.hearts + 1); sfx("heal"); say(h.x, h.y - 0.7, "+1 HEART", "#ff8a9a"); }
      else if (e.kind === "sun") { s.sunT = 6; sfx("evolve"); fx("levelUp", h.x, h.y); banner("Sunshine!", "Everything is lit for a moment"); }
      else { s.flame = Math.min(MAXF, s.flame + (e.v || T.emberFlame)); sfx(e.big ? "heal" : "gem", { pitch: 0.8 + Math.random() * 0.3 }); } }
    else if (e.t > 30) s.embers.splice(i, 1); }
}
function lightBrazier(b) {
  const s = S; b.lit = true; b.cd = 0.3; s.lightProg = 0; s.lightB = null; s.litOnce = true; s.lit++;
  if (!b.healed) { b.healed = true; s.flame = Math.min(MAXF, s.flame + T.towerHeal); if (s.hearts < s.st.hearts) { s.hearts++; say(b.x, b.y - 1.6, "+1 HEART", "#ff8a9a"); } else say(b.x, b.y - 1.6, "+FLAME", "#ffd27a"); sfx("heal"); }
  sfx("fireball_boom", { volume: 0.6, pitch: 0.9 }); sfx("levelup_open"); fx("ring", b.x, b.y, T.brazierR, "#ffb347"); fx("burst", b.x, b.y - 0.8, "#ffd27a", { count: 24, speed: 1.4, glow: true }); fx("shake", 0.25);
  if (s.def.boss) return;
  if (s.braziers.every(x => x.lit)) { s.banished = true; s.doorOpen = true; rebuildSources(); for (const e of s.enemies.slice()) kill(e); s.enemies.length = 0; for (const e of s.embers) if (e.kind !== "sun") e.mag = true; sfx("levelup"); fx("shake", 0.5); banner("All lit up!", "The door is open"); }
  else for (let i = 0; i < s.def.wave; i++) spawnEnemy();
}
function endRun(win) {
  const s = S; s.state = "over"; s.won = win; music("boss", false); music("stop"); const r = s.result = { win, coins: s.coins, bonus: 0, stars: 0, first: false };
  if (s.level >= 0) { if (win) { r.stars = Math.max(1, 3 - (s.lostHearts > 0 ? 1 : 0) - (s.escaped >= 2 ? 1 : 0)); r.first = !SAVE.stars[s.level]; r.bonus = 10 + r.stars * 5 + (r.first ? 20 : 0) + Math.max(0, r.stars - (SAVE.stars[s.level] || 0)) * 5; SAVE.stars[s.level] = Math.max(SAVE.stars[s.level] || 0, r.stars); SAVE.unlocked = Math.max(SAVE.unlocked, Math.min(LEVELS.length, s.level + 2)); sfx("victory"); } }
  else { r.rooms = s.ch - 1; r.bonus = r.rooms * 3; SAVE.bestEndless = Math.max(SAVE.bestEndless, r.rooms); }
  SAVE.coins += r.coins + r.bonus; persist(); showResult();
}

// ---------- test bot ----------
let botThrowT = 0;
const heroNearTower = h => S.braziers.some(b => b.lit && hyp(b.x - h.x, b.y - h.y) < T.brazierR + 2);
function bot() {
  const s = S, h = s.hero, L = s.lantern; let tx = h.x, ty = h.y;
  if (L.state === "ground") { tx = L.x; ty = L.y; }
  else if (s.doorOpen) { tx = RW / 2; ty = -1; }
  else { let best = null, bd = 1e9; if (s.flame < 45) for (const e of s.embers) { const d = hyp(e.x - h.x, e.y - h.y); if (d < bd && d < 7) { bd = d; best = e; } }
    if (!best) { bd = 1e9; for (const b of s.braziers) if (!b.lit) { const d = hyp(b.x - h.x, b.y - h.y); if (d < bd) { bd = d; best = b; } } }
    if (!best && s.king) { bd = -1; for (const b of s.braziers) { const d = hyp(b.x - s.king.x, b.y - s.king.y); if (d > bd && d < 9) { bd = d; best = { x: b.x + 1.2, y: b.y + 0.6 }; } } if (!best) best = s.braziers[0]; }
    if (best) { tx = best.x; ty = best.y; } }
  let ax = 0, ay = 0, dark = 0, near = null, nd = 99;
  for (const e of s.enemies) { const dx = h.x - e.x, dy = h.y - e.y, d = hyp(dx, dy) + 0.01; if (!e.lit && d < 6.5 && e.type !== "moth") { dark++; if (d < nd) { nd = d; near = e; } } if (d < (e.d.boss ? 3.2 : 2) && e.type !== "moth") { const w = (e.d.boss ? 4 : e.type === "statue" && !e.lit ? 2 : 1) / d; ax += dx / d * w; ay += dy / d * w; } }
  for (const g of s.gusts) { const dx = h.x - g.x, dy = h.y - g.y, d = hyp(dx, dy) + 0.01; if (d < 3) { ax += -g.vy / 6 * 1.5; ay += g.vx / 6 * 1.5; } }
  if (L.state === "held" && near && s.t > botThrowT && s.flame > 20 && heroNearTower(h) && (dark >= 2 || near.type === "statue")) { botThrowT = s.t + 3.5; throwTo(near.x, near.y); }
  const dx = tx - h.x, dy = ty - h.y, d = hyp(dx, dy) || 1; let ix = (d > 0.3 ? dx / d : 0) + ax * 1.3, iy = (d > 0.3 ? dy / d : 0) + ay * 1.3; const m = hyp(ix, iy) || 1; input.ix = ix / m; input.iy = iy / m;
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
  for (let j = Math.max(j0, -2); j <= Math.min(j1, RH + 1); j++) for (let i = Math.max(i0, -2); i <= Math.min(i1, RW + 1); i++) {
    const inside = i >= 0 && j >= 0 && i < RW && j < RH, door = j === -1 && (i === RW / 2 - 1 || i === RW / 2);
    if (inside || (door && s.doorOpen)) { const hv = hash2(i, j + s.ch * 31 + s.level * 7), v = hv < 0.7 ? 0 : 1 + Math.floor((hv - 0.7) / 0.1); ctx.drawImage(tw(A("floor" + Math.min(3, v))[0]), view.ox + i * cs, view.oy + j * cs, cs + 1, cs + 1); }
    else if (door) { ctx.fillStyle = "#0a0a10"; ctx.fillRect(view.ox + i * cs, view.oy + j * cs, cs + 1, cs + 1); ctx.fillStyle = "#3a3640"; for (let k = 0; k < 3; k++) ctx.fillRect(view.ox + i * cs + cs * (0.15 + k * 0.3), view.oy + j * cs, cs * 0.1, cs); }
    else ctx.drawImage(tw(A("wall")[0]), view.ox + i * cs, view.oy + j * cs, cs + 1, cs + 1);
  }
  ctx.globalCompositeOperation = "lighter"; for (const e of s.embers) { if (e.kind !== "ember") continue; const p = cs * (e.big ? 0.16 : 0.09) * (1 + 0.3 * Math.sin(now / 90 + e.x * 7)); ctx.fillStyle = "#ff8a24"; ctx.fillRect(sx(e.x) - p, sy(e.y) - p, p * 2, p * 2); ctx.fillStyle = "#ffe9a0"; ctx.fillRect(sx(e.x) - p / 2, sy(e.y) - p / 2, p, p); } ctx.globalCompositeOperation = "source-over";
  const list = []; for (const b of s.braziers) list.push({ k: "b", o: b, y: b.y }); for (const p of s.pillars) list.push({ k: "p", o: p, y: p.y }); for (const e of s.enemies) list.push({ k: "e", o: e, y: e.y }); list.push({ k: "h", y: h.y }); if (L.state === "ground") list.push({ k: "l", y: L.y - 0.2 });
  list.sort((a, b) => a.y - b.y); const lanternIm = s.flame > 0 ? A("lantern")[0] : tintFrame(A("lantern")[0], "#3a3848", 0.8);
  for (const it of list) {
    if (it.k === "b") { const b = it.o; blit(b.lit ? frameAt(A("prop_torch"), now / 1000, 9, b.x) : A("brazier_off")[0], b.x, b.y - 0.55, 1); }
    else if (it.k === "p") blit(A("prop_pillar")[0], it.o.x, it.o.y - 0.7, 1);
    else if (it.k === "l") blit(lanternIm, L.x, L.y, 1.1);
    else if (it.k === "h") { if (s.state === "dying" && s.endT > 0.9) continue; blit(A("enemy_shadow")[0], h.x, h.y + 0.42, 1); let im = frameAt(A(h.moving ? "hero_rogue_run" : "hero_rogue_idle"), now / 1000, h.moving ? 10 : 3); if (h.hurtT > 0) im = tintFrame(im, "#ff4a5a", 0.6); blit(im, h.x, h.y - 0.1, 1, h.face < 0, h.iframes > 0 && Math.floor(now / 70) % 2 ? 0.5 : undefined); if (L.state === "held") blit(lanternIm, h.x + h.face * 0.42, h.y + 0.12 + Math.sin(now / 160) * 0.03, 0.9); }
    else { const e = it.o, d = e.d, sc = d.scale || 1; let im = frameAt(A(d.anim), e.type === "statue" && e.lit ? 0 : e.t, d.fps, e.ph); if (d.tint) im = tintFrame(im, d.tint[0], d.tint[1]); if (e.flash > 0) im = tintFrame(im, "#ffffff"); blit(A("enemy_shadow")[0], e.x, e.y + e.r + 0.1, Math.max(1, sc)); blit(im, e.x, e.y - 0.08 - (sc - 1) * 0.5, sc, e.face < 0, e.born < 0.6 ? e.born / 0.6 : undefined);
      if (e.lit && !d.boss && e.hp < e.maxHp && e.maxHp > 10) { const bw = cs * 0.7; ctx.fillStyle = "#300"; ctx.fillRect(sx(e.x) - bw / 2, sy(e.y - e.r - 0.6), bw, 3); ctx.fillStyle = "#ffb347"; ctx.fillRect(sx(e.x) - bw / 2, sy(e.y - e.r - 0.6), bw * Math.max(0, e.hp) / e.maxHp, 3); } }
  }
  for (const e of s.embers) { if (e.kind === "ember") continue; const bob = Math.sin(now / 250 + e.x * 3) * 0.05; blit(e.kind === "coin" ? frameAt(A("coin"), now / 1000, 8, e.x) : A(e.kind)[0], e.x, e.y + bob, e.kind === "sun" ? 1.2 : 1); }
  for (const b of s.bolts) blit(frameAt(A("fireball"), now / 1000, 14), b.x, b.y, 0.8, false, undefined, Math.atan2(b.vy, b.vx));
  if (L.state === "air") { const k = Math.min(1, L.t); blit(lanternIm, L.x, L.y - Math.sin(Math.PI * k) * 1.1, 1.1, false, undefined, k * 9); }
  ctx.lineWidth = Math.max(2, view.scale); if (s.lightB) { ctx.strokeStyle = "#ffd27a"; ctx.beginPath(); ctx.arc(sx(s.lightB.x), sy(s.lightB.y - 0.4), cs * 0.75, -1.57, -1.57 + 6.283 * s.lightProg / T.lightTime); ctx.stroke(); }
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
  const goals = s.doorOpen ? [{ x: RW / 2, y: -0.5, c: "#ffd27a" }] : s.braziers.filter(b => !b.lit).map(b => ({ x: b.x, y: b.y, c: "#a0c8ff" })); if (L.state === "ground") goals.push({ x: L.x, y: L.y, c: "#ffb347" });
  for (const g of goals) { const gx = sx(g.x), gy = sy(g.y), m = 26 * view.dpr; if (gx > m && gx < cw - m && gy > m && gy < chh - m) continue; const a = Math.atan2(gy - chh / 2, gx - cw / 2), ex = clamp(gx, m, cw - m), ey = clamp(gy, m + 60 * view.dpr, chh - m); ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = g.c; ctx.globalAlpha = 0.75; const q = 9 * view.dpr; ctx.beginPath(); ctx.moveTo(q, 0); ctx.lineTo(-q, -q * 0.8); ctx.lineTo(-q, q * 0.8); ctx.fill(); ctx.restore(); }
  fx("drawOverlay", ctx, view, cw, chh);
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
  const gift = SAVE.daily !== today(), amt = 30 + 10 * Math.min(7, SAVE.streak), endless = SAVE.unlocked > 5;
  screen(`<div class="col"><h1 class="logo">Last Light</h1><div class="sub">Don't let them steal it!</div>${wallet()}
    <button class="btn go" id="b-play" data-focus>Play</button>
    ${gift ? `<button class="btn gift" id="b-gift">Daily gift: +${amt} coins</button>` : ""}
    <div class="row"><button class="btn" id="b-shop">Shop</button><button class="btn" id="b-endless" ${endless ? "" : "disabled"}>${endless ? "Endless" : "Endless (beat level 5)"}</button></div>
    <button class="btn alt" id="b-snd">Sound: ${SAVE.sound ? "on" : "off"}</button>
    <div class="pill">${totalStars()} / ${LEVELS.length * 3} stars${SAVE.bestEndless ? ` · endless best: <b>${SAVE.bestEndless}</b> rooms` : ""}</div></div>`, "title");
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
  const worlds = WORLDS.map((w, wi) => `<h3 class="w">${wi + 1}. ${w.name}</h3><div class="levels">${[0, 1, 2, 3, 4].map(k => { const i = wi * 5 + k, st = SAVE.stars[i] || 0, open = i < SAVE.unlocked; return `<button class="lv ${i === SAVE.unlocked - 1 && !st ? "next" : ""} ${LEVELS[i].boss ? "boss" : ""}" data-lv="${i}" ${open ? "" : "disabled"} aria-label="Level ${i + 1}">${open ? i + 1 : "🔒"}<small>${[1, 2, 3].map(n => n <= st ? "<b>★</b>" : "★").join("")}</small></button>`; }).join("")}</div>`).join("");
  screen(`<div class="col"><h2 class="t">Pick a level</h2>${wallet()}${worlds}<div class="row"><button class="btn" id="b-shop">Shop</button><button class="btn alt" id="b-back">Back</button></div></div>`);
  document.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => { sfx("ui_tap"); startGame(+b.dataset.lv); }); on("#b-shop", () => showShop(showMap)); on("#b-back", showTitle);
}
function showShop(back) {
  ui.mode = "shop"; ui.shopBack = back;
  const cards = Object.keys(SHOP).map(k => { const m = SHOP[k], l = up(k), maxed = l >= m.max, p = maxed ? 0 : price(k, l); return `<button class="card ${!maxed && SAVE.coins < p ? "cant" : ""}" data-up="${k}" ${maxed ? "disabled" : ""}><div class="ic"><img class="px" src="${icon(m.icon)}" alt=""></div><div><h3>${m.name}</h3><p>${m.desc}</p><div class="pips2">${Array.from({ length: m.max }, (_, i) => `<i class="${i < l ? "on" : ""}"></i>`).join("")}</div></div><div class="price">${maxed ? "MAX" : p}</div></button>`; }).join("");
  screen(`<div class="col wide"><h2 class="t">Shop</h2>${wallet()}<div class="cards">${cards}</div><button class="btn alt" id="b-back">Back</button></div>`);
  document.querySelectorAll("[data-up]").forEach(b => b.onclick = () => { const k = b.dataset.up, l = up(k), p = price(k, l); if (l >= SHOP[k].max) return; if (SAVE.coins >= p) { SAVE.coins -= p; SAVE.up[k] = l + 1; persist(); sfx("ui_buy"); showShop(back); } else sfx("ui_deny"); });
  on("#b-back", back);
}
function startGame(levelIdx) { gesture(); hideScreen(); newRun(levelIdx); ui.mode = "run"; ui.pipSig = ui.heartSig = null; $("#hud").hidden = false; $("#coinic").src = icon("icon_coin"); resize(); }
function showPause() { if (ui.mode !== "run" || !S || S.state !== "play") return; ui.mode = "paused"; screen(`<div class="col"><h2 class="t">Paused</h2><button class="btn go" id="b-res" data-focus>Resume</button><button class="btn" id="b-retry">Restart</button><button class="btn alt" id="b-quit">Quit</button></div>`); on("#b-res", resume); on("#b-retry", () => startGame(S.level)); on("#b-quit", () => S.level >= 0 ? showMap() : showTitle()); }
function resume() { ui.mode = "run"; hideScreen(); }
function showResult() {
  ui.mode = "over"; hideHud(); const s = S, r = s.result, lv = s.level;
  const rows = `<div class="summary"><span>Coins picked up</span><span>+${r.coins}</span>${r.bonus ? `<span>${lv >= 0 ? (r.first ? "Level bonus (first clear!)" : "Level bonus") : "Room bonus"}</span><span>+${r.bonus}</span>` : ""}<span>Baddies zapped</span><span>${s.kills}</span><span>Flames won back</span><span>${s.saved}</span><span>Thieves that got away</span><span>${s.escaped}</span></div>`;
  if (lv >= 0 && r.win) {
    const last = lv === LEVELS.length - 1;
    screen(`<div class="col"><h2 class="t">${last ? "The lighthouse shines!" : "Level clear!"}</h2><div class="stars">${[1, 2, 3].map(n => n <= r.stars ? "<b>★</b>" : "★").join("")}</div><div class="pill">${r.stars === 3 ? "Perfect!" : "For 3 stars: lose no hearts and let at most 1 thief get away."}</div>${rows}
      <button class="btn go" id="b-next" data-focus>${last ? "The end" : "Next level"}</button><div class="row"><button class="btn" id="b-shop">Shop</button><button class="btn alt" id="b-map">Levels</button></div></div>`);
    const next = () => startGame(lv + 1), story = lv === 4 ? "w2" : lv === 9 ? "w3" : last ? "end" : null;
    on("#b-next", () => { if (story && !SAVE.seen[story]) showStory(story, last ? showMap : next); else if (last) showMap(); else next(); }); on("#b-shop", () => showShop(showMap)); on("#b-map", showMap);
  } else {
    screen(`<div class="col"><h2 class="t">${lv < 0 ? `${r.rooms} room${r.rooms === 1 ? "" : "s"} cleared` : "Lights out!"}</h2><div class="pill">${lv < 0 ? `Best: <b>${SAVE.bestEndless}</b> rooms` : "The baddies got you in the dark. A shop upgrade might help."}</div>${rows}
      <button class="btn go" id="b-again" data-focus>Try again</button><div class="row"><button class="btn" id="b-shop">Shop</button><button class="btn alt" id="b-map">${lv < 0 ? "Menu" : "Levels"}</button></div></div>`);
    on("#b-again", () => startGame(lv)); on("#b-shop", () => showShop(lv < 0 ? showTitle : showMap)); on("#b-map", lv < 0 ? showTitle : showMap);
  }
}
function updateHud(now) {
  const s = S; $("#flamefill").style.width = clamp(s.flame, 0, 100) + "%"; $("#flamebar").classList.toggle("low", s.flame < 25); $("#chlabel").textContent = s.level >= 0 ? "Level " + (s.level + 1) : "Room " + s.ch; $("#coinn").textContent = s.coins;
  if (ui.heartSig !== s.hearts) { ui.heartSig = s.hearts; $("#hearts").innerHTML = Array.from({ length: s.st.hearts }, (_, i) => `<i class="${i < s.hearts ? "on" : ""}">♥</i>`).join(""); }
  const sig = s.braziers.map(b => b.lit ? 1 : 0).join(""); if (sig !== ui.pipSig) { ui.pipSig = sig; $("#pips").innerHTML = s.braziers.map(b => `<i class="${b.lit ? "on" : ""}"></i>`).join(""); }
  $("#bossbar").hidden = !s.king; if (s.king) $("#bossfill").style.width = Math.max(0, 100 * s.king.hp / s.king.maxHp) + "%";
  let t = "";
  if (ui.hintT > now) t = ui.hint;
  else if (s.level === 0 && s.state === "play") {
    if (s.hero.walked < 2) t = ui.coarse ? "Drag anywhere to move" : "Move with WASD or the arrow keys";
    else if (!s.litOnce) t = "Walk up to a tower to light it. It heals you and zaps baddies.";
    else if (!s.threw) t = ui.coarse ? "Flick or tap to toss your lantern at the eyes in the dark" : "Click or press Space to toss your lantern at the eyes in the dark";
    else if (!s.picked) t = "Go grab your lantern! Baddies can hurt you in the dark.";
    else if (s.doorOpen) t = "Head through the door up top";
  } else if (s.doorOpen && s.state === "play") t = "Head through the door up top";
  else if (s.king && s.state === "play" && s.chT < 8) t = "Lure the Gloom King into tower light";
  const el = $("#hint"); if (t !== ui.hintShown) { ui.hintShown = t; el.textContent = t; } el.hidden = !t;
}

// ---------- input ----------
const keys = new Set(); let ptr = null;
const keyVec = () => [((keys.has("ArrowRight") || keys.has("d")) ? 1 : 0) - ((keys.has("ArrowLeft") || keys.has("a")) ? 1 : 0), ((keys.has("ArrowDown") || keys.has("s")) ? 1 : 0) - ((keys.has("ArrowUp") || keys.has("w")) ? 1 : 0)];
function onBack() { if (ui.mode === "run") showPause(); else if (ui.mode === "paused") resume(); else if (ui.mode === "shop" && ui.shopBack) ui.shopBack(); else if (ui.mode === "title") { try { window.Capacitor.Plugins.App.exitApp(); } catch (e) {} } else showTitle(); }
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
    acc += dt; let n = 0; while (acc >= 1 / 60 && n < 5) { step(1 / 60); acc -= 1 / 60; n++; if (!S || ui.mode !== "run") break; } if (n === 5) acc = 0; if (S && ui.mode === "run") updateHud(now); }
  fx("update", dt * 1000); render(now, dt);
}
resize(); buildAnims(); showTitle(); requestAnimationFrame(frame);
try { const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App; if (App) App.addListener("backButton", onBack); } catch (e) {}
