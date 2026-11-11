/* audio.js - Lost Chambers procedural audio (Web Audio API, no files).
 * Defines one global: Sound.
 *   Sound.init()                 create/resume AudioContext (call from a user gesture; idempotent)
 *   Sound.play(name, opts)       fire-and-forget SFX, opts { volume: 0..1, pitch: multiplier }
 *   Sound.setMuted(b) / Sound.muted
 *   Sound.setVolume(v)           master 0..1 (default 0.6)
 *   Sound.music.start(depth) / setDepth(depth) / boss(bool) / stop()   (original dread drone)
 *   Sound.music.startAction() / setIntensity(0..1) / menu()            (survivors action loop / title loop)
 *   Sound.names                  every SFX name; Sound.play rate-limits hit_enemy/gem/kill/coin_get/knife/aura_tick to ~12/s each
 * Every call is a silent no-op if Web Audio is missing or not started. Nothing throws.
 */
var Sound = (function () {
  'use strict';

  var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  var ctx = null, master = null, limiter = null, sfxBus = null, musicBus = null;
  var volume = 0.6, mutedFlag = false;
  var activeVoices = 0, MAX_VOICES = 28;
  var SFX_GAIN = 1.6;   // SFX bus make-up gain (definitions are authored conservatively)
  var lastPlayed = {};

  // Per-voice build state (play() is synchronous, so module-level is safe).
  var OUT = null, P = 1, CUR = null;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function getNoise(c) {
    if (c.__lcNoise) return c.__lcNoise;
    var len = Math.floor(c.sampleRate * 1.0);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    c.__lcNoise = buf;
    return buf;
  }

  // Register a source with the current voice so nodes get disconnected when done.
  function track(src, nodes) {
    var V = CUR;
    if (V) V.n++;
    src.onended = function () {
      for (var i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) {} }
      if (V) { V.n--; if (V.n <= 0) V.done(); }
    };
  }

  function envelope(g, t, a, vol, dur, hold) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (hold) g.gain.setValueAtTime(vol, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + (hold || 0) + 0.01));
  }

  /* Oscillator voice.
   * o: { f2, glide, lin, a, hold, filter, ff, ff2, q, vib, vibDepth, detune, out } */
  function tone(type, f, t, dur, vol, o) {
    o = o || {};
    var c = ctx, os = c.createOscillator(), g = c.createGain();
    var nodes = [os, g];
    os.type = type;
    os.frequency.setValueAtTime(Math.max(1, f * P), t);
    if (o.f2) {
      var tt = t + (o.glide || dur), f2 = Math.max(1, o.f2 * P);
      if (o.lin) os.frequency.linearRampToValueAtTime(f2, tt);
      else os.frequency.exponentialRampToValueAtTime(f2, tt);
    }
    if (o.detune) os.detune.value = o.detune;
    envelope(g, t, o.a != null ? o.a : 0.004, vol, dur, o.hold);
    os.connect(g);
    var last = g;
    if (o.filter) {
      var fl = c.createBiquadFilter();
      fl.type = o.filter;
      fl.frequency.setValueAtTime(o.ff * P, t);
      if (o.ff2) fl.frequency.exponentialRampToValueAtTime(o.ff2 * P, t + dur);
      fl.Q.value = o.q || 0.8;
      g.connect(fl); last = fl; nodes.push(fl);
    }
    last.connect(o.out || OUT);
    if (o.vib) {
      var lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = o.vib;
      lg.gain.value = (o.vibDepth || 10) * P;
      lfo.connect(lg); lg.connect(os.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.05);
      nodes.push(lfo, lg);
    }
    os.start(t);
    os.stop(t + dur + 0.03);
    track(os, nodes);
    return os;
  }

  /* Filtered noise burst. o: { type, f, f2, q, a, hold, out } */
  function noise(t, dur, vol, o) {
    o = o || {};
    var c = ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = getNoise(c);
    s.loop = true;
    fl.type = o.type || 'lowpass';
    fl.frequency.setValueAtTime(clamp((o.f || 1000) * P, 20, 20000), t);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(clamp(o.f2 * P, 20, 20000), t + (o.glide || dur));
    fl.Q.value = o.q != null ? o.q : 0.7;
    envelope(g, t, o.a != null ? o.a : 0.003, vol, dur, o.hold);
    s.connect(fl); fl.connect(g); g.connect(o.out || OUT);
    s.start(t, Math.random() * 0.8);
    s.stop(t + dur + 0.03);
    track(s, [s, fl, g]);
    return s;
  }

  // Inharmonic metallic strike.
  function metal(f, t, dur, vol, ratios) {
    ratios = ratios || [1, 2.76, 5.4];
    for (var i = 0; i < ratios.length; i++) {
      tone(i === 0 ? 'triangle' : 'sine', f * ratios[i], t, dur / (1 + i * 0.6), vol / (1 + i * 0.8));
    }
  }

  function chime(f, t, dur, vol) {
    tone('sine', f, t, dur, vol, { a: 0.003 });
    tone('sine', f * 2.01, t, dur * 0.5, vol * 0.35, { a: 0.003 });
  }

  /* ---------------- SFX definitions: fn(t) ---------------- */
  var SFX = {
    step: function (t) {
      var f = rnd(260, 420);
      noise(t, rnd(0.04, 0.065), rnd(0.10, 0.15), { type: 'lowpass', f: f, f2: f * 0.5, q: 1.2 });
      tone('sine', rnd(70, 95), t, 0.05, 0.10, { f2: 45 });
    },
    hit: function (t) {
      noise(t, 0.07, 0.45, { type: 'bandpass', f: 1800, f2: 600, q: 1.2 });
      tone('square', 320, t, 0.11, 0.16, { f2: 70, filter: 'lowpass', ff: 2400 });
      tone('sine', 160, t, 0.16, 0.45, { f2: 45 });
    },
    hurt: function (t) {
      tone('sawtooth', 240, t, 0.28, 0.22, { f2: 80, filter: 'lowpass', ff: 1800, ff2: 400 });
      tone('square', 120, t, 0.25, 0.10, { f2: 55, detune: 25, filter: 'lowpass', ff: 900 });
      noise(t, 0.12, 0.30, { type: 'bandpass', f: 900, f2: 300, q: 1 });
      tone('sine', 110, t, 0.2, 0.35, { f2: 40 });
    },
    miss: function (t) {
      noise(t, 0.03, 0.18, { type: 'highpass', f: 2500 });
      tone('triangle', 410, t, 0.14, 0.18, { filter: 'lowpass', ff: 1100 });
      tone('triangle', 643, t, 0.10, 0.12, { filter: 'lowpass', ff: 1100 });
      tone('sine', 140, t, 0.08, 0.15, { f2: 90 });
    },
    enemy_die: function (t) {
      tone('square', 620, t, 0.38, 0.14, { f2: 55, filter: 'lowpass', ff: 3000, ff2: 300, vib: 30, vibDepth: 40 });
      noise(t, 0.35, 0.32, { type: 'lowpass', f: 3000, f2: 150, q: 1 });
      tone('sine', 140, t + 0.02, 0.3, 0.35, { f2: 35 });
    },
    player_die: function (t) {
      var notes = [64, 60, 57, 53, 52];
      for (var i = 0; i < notes.length; i++) {
        var tt = t + i * 0.22, last = i === notes.length - 1;
        tone('triangle', midi(notes[i]), tt, last ? 0.9 : 0.3, 0.2, { vib: last ? 6 : 0, vibDepth: 6 });
        tone('square', midi(notes[i] - 12), tt, last ? 0.8 : 0.26, 0.05, { filter: 'lowpass', ff: 1200 });
      }
      tone('sawtooth', 200, t, 1.5, 0.16, { f2: 38, filter: 'lowpass', ff: 900, ff2: 120, a: 0.05 });
      noise(t, 1.4, 0.18, { type: 'lowpass', f: 600, f2: 80, a: 0.1 });
      tone('sine', 90, t, 1.2, 0.3, { f2: 30, a: 0.02 });
    },
    pickup: function (t) {
      tone('square', 660, t, 0.06, 0.12, { filter: 'lowpass', ff: 4000 });
      tone('square', 990, t + 0.06, 0.12, 0.12, { filter: 'lowpass', ff: 5000 });
    },
    gold: function (t) {
      var j = rnd(0.98, 1.03);
      tone('square', 988 * j, t, 0.07, 0.11, { filter: 'lowpass', ff: 5000 });
      tone('square', 1319 * j, t + 0.06, 0.28, 0.11, { filter: 'lowpass', ff: 6000 });
      tone('triangle', 2637 * j, t + 0.1, 0.18, 0.05);
      if (Math.random() < 0.5) tone('square', 1568 * j, t + 0.13, 0.15, 0.05, { filter: 'lowpass', ff: 6000 });
    },
    potion: function (t) {
      for (var i = 0; i < 3; i++) {
        var tt = t + i * 0.09, b = rnd(180, 240);
        tone('sine', b, tt, 0.08, 0.32, { f2: b * 2.4, a: 0.01 });
      }
      noise(t, 0.28, 0.08, { type: 'bandpass', f: 500, q: 3 });
      var sp = [1568, 2093, 2637, 3136];
      for (var k = 0; k < sp.length; k++) chime(sp[k], t + 0.3 + k * 0.05, 0.35, 0.07);
    },
    equip: function (t) {
      noise(t, 0.02, 0.2, { type: 'highpass', f: 4000 });
      metal(1250, t, 0.25, 0.16, [1, 2.2, 3.1]);
      metal(1650, t + 0.08, 0.2, 0.09, [1, 2.2, 3.1]);
      tone('sine', 200, t, 0.06, 0.12, { f2: 120 });
    },
    fireball: function (t) {
      noise(t, 0.32, 0.22, { type: 'bandpass', f: 350, f2: 2200, q: 1.5, a: 0.12 });
      tone('sawtooth', 120, t, 0.3, 0.05, { f2: 320, filter: 'lowpass', ff: 800, a: 0.1 });
      var b = t + 0.28;
      noise(b, 0.7, 0.5, { type: 'lowpass', f: 2500, f2: 90, q: 0.9 });
      tone('sine', 110, b, 0.6, 0.5, { f2: 28 });
      tone('square', 70, b, 0.3, 0.08, { f2: 30, filter: 'lowpass', ff: 500 });
    },
    lightning: function (t) {
      var o = tone('square', 900, t, 0.26, 0.10, { filter: 'highpass', ff: 600 });
      for (var i = 1; i < 24; i++) o.frequency.setValueAtTime(rnd(200, 2600) * P, t + i * 0.01);
      noise(t, 0.12, 0.38, { type: 'highpass', f: 3000, f2: 1200 });
      noise(t + 0.02, 0.07, 0.3, { type: 'bandpass', f: 1500, q: 0.5 });
      noise(t + 0.1, 0.8, 0.28, { type: 'lowpass', f: 400, f2: 60, a: 0.05 });
      tone('sine', 70, t + 0.08, 0.6, 0.25, { f2: 30 });
    },
    confusion: function (t) {
      var a = tone('sine', 500, t, 0.7, 0.14, { vib: 7, vibDepth: 60, a: 0.05 });
      a.frequency.linearRampToValueAtTime(300 * P, t + 0.35);
      a.frequency.linearRampToValueAtTime(700 * P, t + 0.7);
      var b = tone('triangle', 750, t, 0.7, 0.08, { vib: 11, vibDepth: 90, a: 0.08, detune: 30 });
      b.frequency.linearRampToValueAtTime(1000 * P, t + 0.35);
      b.frequency.linearRampToValueAtTime(450 * P, t + 0.7);
      noise(t, 0.6, 0.04, { type: 'bandpass', f: 1200, f2: 3000, q: 6, a: 0.1 });
    },
    teleport: function (t) {
      tone('triangle', 300, t, 0.6, 0.14, { f2: 2000, vib: 18, vibDepth: 30, a: 0.02 });
      var n = [72, 76, 79, 84, 88, 91];
      for (var i = 0; i < n.length; i++) chime(midi(n[i]), t + i * 0.06, 0.3, 0.06);
      noise(t, 0.5, 0.06, { type: 'highpass', f: 2000, f2: 8000, a: 0.2 });
    },
    mapping: function (t) {
      for (var i = 0; i < 4; i++) {
        noise(t + i * 0.06 + rnd(0, 0.02), 0.06, 0.12, { type: 'bandpass', f: rnd(2500, 4500), q: 1.5, a: 0.01 });
      }
      chime(1047, t + 0.28, 0.6, 0.12);
      chime(1568, t + 0.36, 0.7, 0.10);
    },
    arrow: function (t) {
      tone('triangle', 230, t, 0.14, 0.25, { f2: 150, glide: 0.06 });
      tone('sawtooth', 115, t, 0.08, 0.06, { filter: 'lowpass', ff: 900 });
      noise(t + 0.03, 0.2, 0.16, { type: 'bandpass', f: 2200, f2: 600, q: 2, a: 0.03 });
    },
    bolt: function (t) {
      tone('square', 900, t, 0.28, 0.09, { f2: 260, filter: 'lowpass', ff: 3500, vib: 25, vibDepth: 40 });
      tone('sine', 1800, t, 0.25, 0.10, { f2: 520, vib: 30, vibDepth: 80 });
      noise(t, 0.25, 0.06, { type: 'bandpass', f: 5000, f2: 2000, q: 3 });
    },
    stairs: function (t) {
      for (var i = 0; i < 4; i++) {
        var tt = t + i * 0.18, v = 0.28 * (1 - i * 0.18), f = 420 - i * 60;
        noise(tt, 0.07, v, { type: 'lowpass', f: f, f2: f * 0.5, q: 1.5 });
        tone('sine', 95 - i * 8, tt, 0.07, v * 0.8, { f2: 45 });
        noise(tt + 0.11, 0.06, v * 0.25, { type: 'lowpass', f: f * 0.8, q: 1.5 }); // echo
      }
      tone('sine', 140, t + 0.1, 0.8, 0.12, { f2: 50, a: 0.15 });
      noise(t, 0.9, 0.05, { type: 'bandpass', f: 300, f2: 120, q: 2, a: 0.3 });
    },
    levelup: function (t) {
      var n = [72, 76, 79, 84];
      for (var i = 0; i < n.length; i++) {
        tone('square', midi(n[i]), t + i * 0.07, 0.1, 0.10, { filter: 'lowpass', ff: 4000 });
      }
      var h = t + 0.3;
      tone('square', midi(84), h, 0.55, 0.09, { filter: 'lowpass', ff: 3500, vib: 6, vibDepth: 8, hold: 0.15 });
      tone('triangle', midi(76), h, 0.55, 0.12, { hold: 0.15 });
      tone('triangle', midi(79), h, 0.55, 0.10, { hold: 0.15 });
      tone('triangle', midi(60), h, 0.55, 0.15, { hold: 0.15 });
      chime(midi(96), h + 0.05, 0.4, 0.04);
    },
    chest: function (t) {
      var c = tone('sawtooth', 85, t, 0.38, 0.10, { filter: 'bandpass', ff: 700, q: 4, a: 0.03 });
      c.frequency.linearRampToValueAtTime(130 * P, t + 0.12);
      c.frequency.linearRampToValueAtTime(95 * P, t + 0.22);
      c.frequency.linearRampToValueAtTime(150 * P, t + 0.36);
      noise(t, 0.35, 0.05, { type: 'bandpass', f: 1200, q: 6, a: 0.05 });
      tone('sine', 120, t + 0.36, 0.1, 0.25, { f2: 60 });
      var r = t + 0.42, n = [79, 83, 86, 91];
      for (var i = 0; i < n.length; i++) {
        tone('triangle', midi(n[i]), r + i * 0.05, 0.5 - i * 0.05, 0.11);
      }
      chime(midi(98), r + 0.2, 0.4, 0.05);
    },
    trap: function (t) {
      noise(t, 0.035, 0.5, { type: 'highpass', f: 2500 });
      metal(1800, t, 0.25, 0.14, [1, 1.47, 2.9]);
      tone('square', 2600, t, 0.06, 0.05, { f2: 1200, filter: 'lowpass', ff: 6000 });
      tone('sine', 130, t, 0.15, 0.35, { f2: 45 });
    },
    fountain: function (t) {
      for (var i = 0; i < 7; i++) {
        var f = rnd(350, 900);
        tone('sine', f, t + i * 0.055 + rnd(0, 0.02), 0.06, 0.13, { f2: f * 1.8, a: 0.008 });
      }
      noise(t, 0.45, 0.06, { type: 'bandpass', f: 1200, q: 1.5, a: 0.05 });
      var n = [84, 88, 91];
      for (var k = 0; k < n.length; k++) chime(midi(n[k]), t + 0.42 + k * 0.08, 0.8, 0.08);
    },
    blocked: function (t) {
      tone('sine', 130, t, 0.09, 0.3, { f2: 60 });
      noise(t, 0.05, 0.1, { type: 'lowpass', f: 400 });
    },
    ui: function (t) {
      tone('square', 1250, t, 0.035, 0.07, { filter: 'lowpass', ff: 5000 });
      tone('sine', 2500, t, 0.02, 0.04);
    },
    summon: function (t) {
      tone('sawtooth', 55, t, 1.1, 0.16, { filter: 'lowpass', ff: 150, ff2: 500, a: 0.2, q: 4 });
      tone('sawtooth', 58.3, t, 1.1, 0.14, { filter: 'lowpass', ff: 150, ff2: 500, a: 0.2, q: 4 });
      noise(t, 1.0, 0.2, { type: 'lowpass', f: 180, f2: 90, a: 0.25 });
      tone('sine', 440, t + 0.1, 0.9, 0.06, { f2: 185, vib: 5, vibDepth: 12, a: 0.2 });
      tone('sine', 466, t + 0.1, 0.9, 0.05, { f2: 196, vib: 4, vibDepth: 12, a: 0.2 });
    },
    victory: function (t) {
      var lead = [[67, 0, 0.1], [72, 0.11, 0.1], [76, 0.22, 0.1], [79, 0.33, 0.28],
                  [76, 0.66, 0.1], [79, 0.78, 0.1], [84, 0.9, 1.5]];
      for (var i = 0; i < lead.length; i++) {
        var L = lead[i], long = L[2] > 1;
        tone('square', midi(L[0]), t + L[1], L[2] + 0.06, 0.10,
             { filter: 'lowpass', ff: 3500, hold: long ? 0.8 : 0, vib: long ? 5.5 : 0, vibDepth: 7 });
      }
      var bass = [[48, 0, 0.3], [43, 0.33, 0.3], [48, 0.66, 0.2], [36, 0.9, 1.5]];
      for (var b = 0; b < bass.length; b++) {
        tone('triangle', midi(bass[b][0]), t + bass[b][1], bass[b][2] + 0.05, 0.22, { hold: bass[b][2] > 1 ? 0.8 : 0 });
      }
      var ch = [64, 67, 72];
      for (var c = 0; c < ch.length; c++) tone('triangle', midi(ch[c]), t + 0.9, 1.55, 0.08, { hold: 0.8, a: 0.03 });
      noise(t + 0.9, 0.25, 0.12, { type: 'highpass', f: 6000 }); // cymbal
      var sp = [96, 100, 103, 108];
      for (var s = 0; s < sp.length; s++) chime(midi(sp[s]), t + 1.6 + s * 0.09, 0.6, 0.035);
    },
    bat: function (t) {
      for (var i = 0; i < 2; i++) {
        var tt = t + i * 0.09, f = rnd(2300, 2800);
        tone('sawtooth', f, tt, 0.07, 0.05, { f2: f * 1.35, filter: 'bandpass', ff: 3000, q: 2, vib: 60, vibDepth: 300 });
        tone('square', f * 0.5, tt, 0.05, 0.03, { f2: f * 0.7, filter: 'highpass', ff: 1000 });
      }
    },
    slime_split: function (t) {
      tone('sine', 320, t, 0.18, 0.32, { f2: 70 });
      noise(t, 0.16, 0.2, { type: 'lowpass', f: 900, f2: 200, q: 4 });
      tone('sine', 180, t + 0.1, 0.12, 0.25, { f2: 520 });
      tone('sine', 220, t + 0.16, 0.1, 0.18, { f2: 600 });
    },
    ogre_windup: function (t) {
      var g = tone('sawtooth', 62, t, 0.7, 0.2, { f2: 85, filter: 'lowpass', ff: 380, q: 3, a: 0.08, hold: 0.25, vib: 24, vibDepth: 9 });
      void g;
      tone('square', 31, t, 0.7, 0.10, { f2: 42, filter: 'lowpass', ff: 200, a: 0.1, hold: 0.25 });
      noise(t, 0.65, 0.14, { type: 'bandpass', f: 250, f2: 400, q: 2, a: 0.1 });
    },

    /* ---------- Survivors SFX (short, quiet-ish, built for heavy repetition) ---------- */
    hit_enemy: function (t) {
      var f = rnd(1900, 2600);
      noise(t, 0.025, 0.22, { type: 'bandpass', f: f, f2: f * 0.5, q: 1.5, a: 0.001 });
      tone('square', rnd(520, 640), t, 0.04, 0.07, { f2: 220, filter: 'lowpass', ff: 3000, a: 0.001 });
    },
    kill: function (t) {
      tone('sine', rnd(380, 460), t, 0.1, 0.30, { f2: 70, a: 0.002 });
      noise(t, 0.08, 0.2, { type: 'lowpass', f: 3200, f2: 300, q: 0.9, a: 0.002 });
      tone('square', 900, t, 0.05, 0.05, { f2: 300, filter: 'lowpass', ff: 3000, a: 0.001 });
    },
    gem: function (t) {
      tone('square', 1568, t, 0.05, 0.08, { filter: 'lowpass', ff: 6000, a: 0.002 });
      tone('triangle', 2093, t + 0.04, 0.12, 0.16, { a: 0.002 });
      tone('sine', 4186, t + 0.04, 0.07, 0.04, { a: 0.002 });
    },
    coin_get: function (t) {
      tone('square', 1319, t, 0.05, 0.10, { filter: 'lowpass', ff: 6000, a: 0.002 });
      tone('square', 1760, t + 0.05, 0.16, 0.10, { filter: 'lowpass', ff: 6000, a: 0.002 });
      tone('triangle', 3520, t + 0.06, 0.1, 0.04, { a: 0.002 });
    },
    heal: function (t) {
      var n = [67, 71, 74, 79];
      for (var i = 0; i < n.length; i++) tone('triangle', midi(n[i]), t + i * 0.09, 0.3, 0.13, { a: 0.01 });
      tone('sine', midi(55), t, 0.5, 0.12, { a: 0.05 });
      chime(midi(91), t + 0.4, 0.4, 0.05);
      chime(midi(95), t + 0.46, 0.4, 0.04);
    },
    magnet: function (t) {
      noise(t, 0.55, 0.2, { type: 'bandpass', f: 2800, f2: 250, q: 2, a: 0.12 });
      tone('sine', 1200, t, 0.5, 0.08, { f2: 200, a: 0.1, vib: 14, vibDepth: 40 });
      tone('sine', 160, t + 0.47, 0.12, 0.2, { f2: 60 });
    },
    nuke: function (t) {
      noise(t, 0.04, 0.4, { type: 'highpass', f: 2000, a: 0.001 });
      noise(t, 0.9, 0.38, { type: 'lowpass', f: 3000, f2: 70, q: 0.9, a: 0.005 });
      tone('sine', 100, t, 0.9, 0.4, { f2: 25, a: 0.005 });
      tone('sawtooth', 48, t + 0.05, 0.85, 0.08, { f2: 30, filter: 'lowpass', ff: 200, a: 0.05 });
      noise(t + 0.1, 0.8, 0.12, { type: 'bandpass', f: 90, q: 3, a: 0.2 });
    },
    knife: function (t) {
      noise(t, 0.1, 0.18, { type: 'bandpass', f: 2000, f2: 5200, q: 1.2, a: 0.02 });
      tone('triangle', 800, t, 0.08, 0.06, { f2: 1800, a: 0.01 });
    },
    slash: function (t) {
      noise(t, 0.2, 0.3, { type: 'bandpass', f: 800, f2: 3500, q: 1.2, a: 0.05 });
      tone('sawtooth', 300, t, 0.16, 0.05, { f2: 900, filter: 'lowpass', ff: 2000, a: 0.04 });
    },
    orb_fire: function (t) {
      tone('sine', 900, t, 0.14, 0.15, { f2: 1500, a: 0.005, vib: 30, vibDepth: 30 });
      tone('triangle', 1800, t + 0.02, 0.1, 0.06, { f2: 2400, a: 0.005 });
    },
    orbit_hit: function (t) {
      noise(t, 0.02, 0.25, { type: 'highpass', f: 3000, a: 0.001 });
      tone('sine', 820, t, 0.06, 0.28, { f2: 480, a: 0.001 });
      tone('square', 600, t, 0.05, 0.06, { f2: 300, filter: 'lowpass', ff: 2500, a: 0.001 });
      tone('triangle', 1150, t + 0.01, 0.07, 0.07, { a: 0.001 });
    },
    aura_tick: function (t) {
      tone('sine', 180, t, 0.14, 0.3, { f2: 110, a: 0.005 });
      noise(t, 0.12, 0.06, { type: 'bandpass', f: 600, q: 4, a: 0.01 });
      tone('sine', 1500, t, 0.05, 0.04, { a: 0.002 });
    },
    thunder: function (t) {
      noise(t, 0.1, 0.35, { type: 'highpass', f: 2500, f2: 800, a: 0.001 });
      var o = tone('square', 900, t, 0.1, 0.06, { filter: 'highpass', ff: 600, a: 0.001 });
      for (var i = 1; i < 10; i++) o.frequency.setValueAtTime(rnd(200, 2600) * P, t + i * 0.01);
      noise(t + 0.06, 0.7, 0.3, { type: 'lowpass', f: 500, f2: 60, a: 0.06 });
      tone('sine', 65, t + 0.06, 0.6, 0.25, { f2: 30, a: 0.03 });
    },
    fireball_throw: function (t) {
      noise(t, 0.3, 0.2, { type: 'bandpass', f: 300, f2: 1800, q: 1.5, a: 0.1 });
      tone('sawtooth', 150, t, 0.28, 0.05, { f2: 400, filter: 'lowpass', ff: 900, a: 0.08 });
    },
    fireball_boom: function (t) {
      noise(t, 0.5, 0.4, { type: 'lowpass', f: 2500, f2: 100, q: 0.9, a: 0.003 });
      tone('sine', 120, t, 0.5, 0.4, { f2: 35, a: 0.003 });
      tone('square', 70, t, 0.25, 0.06, { f2: 30, filter: 'lowpass', ff: 500 });
    },
    axe_throw: function (t) {
      for (var i = 0; i < 3; i++) {
        var tt = t + i * 0.09;
        noise(tt, 0.1, 0.13, { type: 'bandpass', f: 900, f2: 1500, q: 2, a: 0.02 });
        tone('sawtooth', 220 + i * 20, tt, 0.1, 0.05, { f2: 330, filter: 'lowpass', ff: 1400, a: 0.02 });
      }
    },
    levelup_open: function (t) {
      var n = [72, 76, 79, 84];
      for (var i = 0; i < n.length; i++) tone('triangle', midi(n[i]), t + i * 0.06, 0.25, 0.10, { a: 0.005 });
      chime(midi(96), t + 0.24, 0.3, 0.05);
    },
    pick_card: function (t) {
      tone('sine', 150, t, 0.08, 0.25, { f2: 90 });
      tone('square', midi(72), t, 0.08, 0.09, { filter: 'lowpass', ff: 4000 });
      tone('square', midi(79), t + 0.07, 0.08, 0.09, { filter: 'lowpass', ff: 4000 });
      tone('triangle', midi(84), t + 0.14, 0.25, 0.12);
      chime(midi(96), t + 0.16, 0.25, 0.05);
    },
    evolve: function (t) {
      tone('sawtooth', 200, t, 0.55, 0.06, { f2: 1600, filter: 'lowpass', ff: 1500, a: 0.1 });
      noise(t, 0.55, 0.06, { type: 'highpass', f: 1500, f2: 8000, a: 0.3 });
      var n = [60, 64, 67, 72, 76, 79, 84];
      for (var i = 0; i < n.length; i++) tone('square', midi(n[i]), t + i * 0.07, 0.12, 0.07, { filter: 'lowpass', ff: 4000 });
      var h = t + 0.55, ch = [72, 76, 79, 84];
      for (var k = 0; k < ch.length; k++) tone('triangle', midi(ch[k]), h, 0.65, 0.09, { hold: 0.25, a: 0.02 });
      tone('triangle', midi(48), h, 0.65, 0.16, { hold: 0.25 });
      tone('square', midi(88), h, 0.6, 0.05, { filter: 'lowpass', ff: 3500, hold: 0.2, vib: 6, vibDepth: 8 });
      noise(h, 0.25, 0.08, { type: 'highpass', f: 6000 });
      var sp = [96, 100, 103, 108, 103, 108];
      for (var s = 0; s < sp.length; s++) chime(midi(sp[s]), h + 0.1 + s * 0.07, 0.4, 0.04);
    },
    chest_open: function (t) {
      SFX.chest(t);
      var sp = [103, 100, 96, 105];
      for (var s = 0; s < sp.length; s++) chime(midi(sp[s]), t + 0.75 + s * 0.06, 0.35, 0.035);
    },
    reroll: function (t) {
      for (var i = 0; i < 7; i++) {
        var tt = t + i * 0.04 + rnd(0, 0.015);
        noise(tt, 0.025, 0.15, { type: 'bandpass', f: rnd(2500, 4500), q: 2, a: 0.001 });
        tone('sine', rnd(500, 900), tt, 0.03, 0.12, { f2: rnd(300, 500), a: 0.001 });
      }
    },
    revive: function (t) {
      var lo = [60, 64, 67];
      for (var i = 0; i < lo.length; i++) {
        tone('sine', midi(lo[i]), t, 0.95, 0.10, { f2: midi(lo[i] + 12), lin: true, a: 0.15, hold: 0.2 });
        tone('sine', midi(lo[i] + 12) * 1.004, t + 0.1, 0.85, 0.05, { f2: midi(lo[i] + 24), lin: true, a: 0.15, vib: 5, vibDepth: 4 });
      }
      noise(t, 0.8, 0.04, { type: 'highpass', f: 3000, f2: 9000, a: 0.3 });
      var sp = [84, 88, 91, 96];
      for (var s = 0; s < sp.length; s++) chime(midi(sp[s]), t + 0.6 + s * 0.08, 0.45, 0.06);
    },
    boss_warn: function (t) {
      for (var i = 0; i < 2; i++) {
        var tt = t + i * 0.6, m = i ? 1.122 : 1;
        tone('sawtooth', 73.4 * m, tt, 0.55, 0.11, { filter: 'lowpass', ff: 350, ff2: 900, q: 2, a: 0.08, hold: 0.25 });
        tone('sawtooth', 77.8 * m, tt, 0.55, 0.09, { filter: 'lowpass', ff: 350, ff2: 900, q: 2, a: 0.08, hold: 0.25 });
        tone('square', 36.7 * m, tt, 0.55, 0.09, { filter: 'lowpass', ff: 200, a: 0.1, hold: 0.25 });
        noise(tt, 0.5, 0.05, { type: 'bandpass', f: 300, f2: 600, q: 2, a: 0.1 });
      }
    },
    boss_die: function (t) {
      var b = [[0, 1], [0.25, 0.75], [0.55, 0.6]];
      for (var i = 0; i < b.length; i++) {
        var tt = t + b[i][0], v = b[i][1];
        noise(tt, 0.03, 0.3 * v, { type: 'highpass', f: 2000, a: 0.001 });
        noise(tt, 0.9, 0.3 * v, { type: 'lowpass', f: 2800, f2: 80, q: 0.9, a: 0.004 });
        tone('sine', 110 - i * 15, tt, 0.8, 0.3 * v, { f2: 25, a: 0.004 });
      }
      noise(t + 0.3, 1.2, 0.15, { type: 'lowpass', f: 500, f2: 50, a: 0.1 });
      tone('sawtooth', 55, t + 0.2, 1.3, 0.07, { f2: 22, filter: 'lowpass', ff: 220, ff2: 60, a: 0.1 });
      for (var k = 0; k < 8; k++) {
        noise(t + 0.7 + k * 0.09 + rnd(0, 0.04), 0.05, 0.07 * (1 - k / 10), { type: 'bandpass', f: rnd(500, 2500), q: 2, a: 0.002 });
      }
      tone('sine', 70, t + 0.9, 0.6, 0.25, { f2: 20, a: 0.01 });
    },
    swarm_horn: function (t) {
      var seq = [[58, 0, 0.2], [58, 0.24, 0.14], [65, 0.42, 0.38]];
      for (var i = 0; i < seq.length; i++) {
        var m = seq[i][0], tt = t + seq[i][1], d = seq[i][2];
        tone('sawtooth', midi(m), tt, d, 0.09, { filter: 'lowpass', ff: 500, ff2: 2200, a: 0.03, hold: d * 0.5 });
        tone('square', midi(m) * 1.005, tt, d, 0.04, { filter: 'lowpass', ff: 800, ff2: 2000, a: 0.03, hold: d * 0.5 });
        tone('sawtooth', midi(m + 7), tt, d, 0.04, { filter: 'lowpass', ff: 600, ff2: 1800, a: 0.03, hold: d * 0.5 });
      }
    },
    hero_hurt: function (t) {
      tone('sine', 200, t, 0.14, 0.35, { f2: 90, a: 0.003 });
      noise(t, 0.1, 0.2, { type: 'lowpass', f: 600, f2: 200, q: 0.8, a: 0.002 });
      tone('square', 150, t, 0.12, 0.08, { f2: 70, filter: 'lowpass', ff: 500, a: 0.002 });
    },
    ui_tap: function (t) {
      tone('triangle', 1000, t, 0.045, 0.14, { f2: 1400, a: 0.002 });
      tone('sine', 2000, t, 0.025, 0.03, { a: 0.001 });
    },
    ui_buy: function (t) {
      for (var i = 0; i < 7; i++) {
        var tt = t + i * 0.045, f = (i % 2 ? 1760 : 1319) * (1 + i * 0.04);
        tone('square', f, tt, 0.06, 0.07, { filter: 'lowpass', ff: 6000, a: 0.002 });
        tone('triangle', f * 2, tt, 0.08, 0.03, { a: 0.002 });
      }
      chime(midi(96), t + 0.34, 0.5, 0.07);
      chime(midi(100), t + 0.4, 0.5, 0.05);
    },
    ui_deny: function (t) {
      for (var i = 0; i < 2; i++) {
        tone('square', 200 - i * 40, t + i * 0.11, 0.09, 0.12, { f2: 150 - i * 30, filter: 'lowpass', ff: 800, a: 0.003 });
      }
    }
  };

  // Per-name rate limits (min seconds between accepted plays); extras are dropped silently.
  var RATE = { hit_enemy: 0.082, gem: 0.082, kill: 0.082, coin_get: 0.082, knife: 0.082, aura_tick: 0.082 };
  var lastAccepted = {};

  // Per-sound loudness trims.
  var TRIM = { fireball: 0.7, trap: 0.6, lightning: 0.8, step: 0.8, ui: 0.8, blocked: 0.8, pickup: 1.5, gold: 1.5, bat: 1.8, confusion: 1.4, teleport: 1.4,
              nuke: 0.7, orbit_hit: 0.8, hit_enemy: 1.3, gem: 1.2, coin_get: 1.5, knife: 1.6, fireball_throw: 2, axe_throw: 2,
              orb_fire: 1.5, levelup_open: 1.4, ui_buy: 1.5, ui_tap: 1.2, ui_deny: 1.3, swarm_horn: 1.3, kill: 0.9 };

  function runVoice(fn, out, t, pitch, counted, keepOut) {
    var V = { n: 0, d: false };
    if (counted) activeVoices++;
    V.done = function () {
      if (V.d) return;
      V.d = true;
      if (counted) activeVoices = Math.max(0, activeVoices - 1);
      if (!keepOut) { try { out.disconnect(); } catch (e) {} }   // shared music buses must stay connected
    };
    var pc = CUR, po = OUT, pp = P;
    CUR = V; OUT = out; P = pitch;
    try { fn(t); } finally { CUR = pc; OUT = po; P = pp; }
    if (V.n === 0) V.done();
  }

  function applyMaster(tc) {
    if (!master) return;
    var g = mutedFlag ? 0 : volume;
    try {
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(g, now, tc || 0.03);
    } catch (e) { try { master.gain.value = g; } catch (e2) {} }
  }

  function unlockOnGesture() {
    if (typeof window === 'undefined') return;
    var evs = ['pointerdown', 'keydown', 'touchstart', 'mousedown'];
    var h = function () {
      try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {}
      if (ctx && ctx.state === 'running') {
        for (var i = 0; i < evs.length; i++) window.removeEventListener(evs[i], h, true);
      }
    };
    for (var i = 0; i < evs.length; i++) window.addEventListener(evs[i], h, true);
  }

  /* ---------------- Music ---------------- */
  // mode: 'dread' (original depth drone), 'action' (survivor loop), 'menu' (calm title loop)
  var M = { on: false, depth: 1, boss: false, timer: null, next: 0, step: 0, n: null, pending: null, deg: 0,
            mode: 'dread', iT: 0, iS: 0 };
  function curP() { return mp(M.mode === 'menu' ? 3 : M.mode === 'action' ? 1 : M.depth); }
  var CHORDS = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]];   // Am F C G
  var BASSR = [45, 41, 48, 43];
  var LEAD = [5, -1, -1, 4, -1, 3, -1, -1, 5, -1, 4, -1, 2, -1, 3, -1];
  var MENU_MEL = [0, null, null, 3, null, 7, null, null, 5, null, 3, null, null, 2, null, null,
                  0, null, null, 3, null, 8, null, 7, null, null, 5, null, 3, null, null, null];
  var SCALE_MINOR = [0, 2, 3, 5, 7, 8, 10];
  var SCALE_PHRYG = [0, 1, 3, 5, 6, 8, 10];

  function mp(d) {
    d = clamp(Math.round(d) || 1, 1, 10);
    var k = (d - 1) / 9;
    return {
      k: k,
      root: 110 * Math.pow(2, -(d - 1) / 12),   // A2 down to C2
      stepDur: 60 / (70 - 10 * k) / 2,          // eighth notes, slower deeper
      density: 0.16 + 0.24 * k,
      cutoff: 520 - 260 * k,
      droneVol: 0.05 + 0.035 * k,
      tritone: Math.max(0, k - 0.5) * 0.08,
      heartbeat: d >= 4 ? 0.12 + 0.18 * k : 0
    };
  }

  function makeIR(c, secs) {
    var len = Math.floor(c.sampleRate * secs), ir = c.createBuffer(2, len, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return ir;
  }

  function buildMusic() {
    var c = ctx, now = c.currentTime, n = {};
    n.out = c.createGain();
    n.out.gain.setValueAtTime(0.0001, now);
    n.out.gain.exponentialRampToValueAtTime(1, now + 2.5);
    n.out.connect(musicBus);

    // Feedback delay with darkening filter in the loop.
    n.delay = c.createDelay(2);
    n.delay.delayTime.value = 0.42;
    n.fb = c.createGain(); n.fb.gain.value = 0.38;
    n.dlp = c.createBiquadFilter(); n.dlp.type = 'lowpass'; n.dlp.frequency.value = 1800;
    n.delay.connect(n.dlp); n.dlp.connect(n.fb); n.fb.connect(n.delay);
    n.dwet = c.createGain(); n.dwet.gain.value = 0.5;
    n.dlp.connect(n.dwet); n.dwet.connect(n.out);
    n.dsend = c.createGain(); n.dsend.gain.value = 1; n.dsend.connect(n.delay);

    // Reverb.
    n.rev = c.createConvolver();
    try { n.rev.buffer = makeIR(c, 2.4); } catch (e) {}
    n.rwet = c.createGain(); n.rwet.gain.value = 0.45;
    n.rev.connect(n.rwet); n.rwet.connect(n.out);
    n.rsend = c.createGain(); n.rsend.gain.value = 1; n.rsend.connect(n.rev);

    // Dry bus for notes.
    n.dry = c.createGain(); n.dry.gain.value = 1;
    n.dry.connect(n.out); n.dry.connect(n.dsend); n.dry.connect(n.rsend);

    // Drone.
    n.dFilter = c.createBiquadFilter(); n.dFilter.type = 'lowpass'; n.dFilter.Q.value = 2;
    n.dGain = c.createGain(); n.dGain.gain.value = 0.0001;
    n.dFilter.connect(n.dGain); n.dGain.connect(n.out); n.dGain.connect(n.rsend);
    n.o1 = c.createOscillator(); n.o1.type = 'sawtooth';
    n.o2 = c.createOscillator(); n.o2.type = 'sawtooth'; n.o2.detune.value = 9;
    n.o3 = c.createOscillator(); n.o3.type = 'sine';
    n.o4 = c.createOscillator(); n.o4.type = 'triangle';            // tritone, fades in deep
    n.g4 = c.createGain(); n.g4.gain.value = 0;
    n.o1.connect(n.dFilter); n.o2.connect(n.dFilter); n.o3.connect(n.dFilter);
    n.o4.connect(n.g4); n.g4.connect(n.dFilter);
    n.lfo = c.createOscillator(); n.lfo.frequency.value = 0.07;
    n.lfoG = c.createGain(); n.lfoG.gain.value = 90;
    n.lfo.connect(n.lfoG); n.lfoG.connect(n.dFilter.frequency);
    var p = curP();
    n.o1.frequency.value = p.root; n.o2.frequency.value = p.root;
    n.o3.frequency.value = p.root / 2; n.o4.frequency.value = p.root * Math.SQRT2;
    n.dFilter.frequency.value = p.cutoff;
    n.oscs = [n.o1, n.o2, n.o3, n.o4, n.lfo];
    for (var i = 0; i < n.oscs.length; i++) n.oscs[i].start(now);
    M.n = n;
    applyDrone(1.2);
  }

  function applyDrone(tau) {
    var n = M.n; if (!n) return;
    var p = curP(), now = ctx.currentTime;
    var cut = M.boss ? p.cutoff + 420 : p.cutoff;
    var vol = M.boss ? p.droneVol * 1.3 : p.droneVol;
    var act = M.mode === 'action';
    if (act && !M.boss) vol = 0.0001;                       // action loop has no drone until a boss shows up
    n.dsend.gain.setTargetAtTime(act ? 0.4 : 1, now, tau);
    n.rsend.gain.setTargetAtTime(act ? 0.2 : 1, now, tau);
    n.delay.delayTime.setTargetAtTime(act ? 60 / 126 * 0.75 : M.mode === 'menu' ? 0.6 : 0.42, now, Math.max(tau, 0.3));
    n.o1.frequency.setTargetAtTime(p.root, now, tau);
    n.o2.frequency.setTargetAtTime(p.root, now, tau);
    n.o3.frequency.setTargetAtTime(p.root / 2, now, tau);
    n.o4.frequency.setTargetAtTime(p.root * Math.SQRT2, now, tau);
    n.g4.gain.setTargetAtTime(M.boss ? 0.5 : p.tritone * 6, now, tau);
    n.dFilter.frequency.setTargetAtTime(cut, now, tau);
    n.dGain.gain.setTargetAtTime(vol, now, tau);
    n.lfo.frequency.setTargetAtTime(M.boss ? 0.5 : 0.07 + p.k * 0.08, now, tau);
    n.fb.gain.setTargetAtTime(M.boss ? 0.25 : 0.38, now, tau);
  }

  function mStepDur() {
    if (M.boss) return 60 / 138 / 2;
    if (M.mode === 'action') return 60 / (122 + 8 * M.iS) / 4;   // 16th notes
    if (M.mode === 'menu') return 0.5;                            // eighths at 60 bpm
    return curP().stepDur;
  }

  // Music note voices (not counted against SFX voice cap). Shared bus stays connected.
  function mNote(fn, t) { runVoice(fn, M.n.dry, t, 1, false, true); }

  // Driving 8-bit action loop. s = 16th-note step, I = smoothed intensity 0..1.
  function actionStep(tt, s, I) {
    var D = M.n.out, bar = Math.floor(s / 16) % 4, st = s % 16, ch = CHORDS[bar], br = BASSR[bar];
    var i8 = st >> 1;
    // Bass (eighths) + sub.
    if (st % 2 === 0) {
      var bm = br + [0, 0, 12, 0, 0, 0, 12, 7][i8];
      tone('square', midi(bm), tt, 0.11, 0.05, { filter: 'lowpass', ff: 800, out: D, a: 0.003 });
      tone('triangle', midi(bm), tt, 0.13, 0.11, { out: D, a: 0.003 });
    }
    // Kick.
    if (st % 8 === 0 || (I > 0.2 && st % 4 === 0) || (I > 0.6 && st === 10)) {
      tone('sine', 125, tt, 0.16, 0.2, { f2: 42, out: D, a: 0.002 });
    }
    // Snare + fill.
    if ((I > 0.35 && (st === 4 || st === 12)) || (I > 0.5 && bar === 3 && st >= 13)) {
      noise(tt, 0.09, 0.05, { type: 'bandpass', f: 1900, q: 0.8, out: D, a: 0.002 });
      tone('triangle', 210, tt, 0.07, 0.06, { f2: 120, out: D, a: 0.002 });
    }
    // Hats.
    if ((I > 0.1 && st % 4 === 2) || (I > 0.45 && st % 2 === 0) || (I > 0.75 && st % 2 === 1)) {
      noise(tt, 0.03, st % 2 ? 0.012 : 0.022, { type: 'highpass', f: 7000, out: D, a: 0.001 });
    }
    // Arp (eighths, then sixteenths).
    if (I >= 0.15 && (st % 2 === 0 || I >= 0.5)) {
      var ai = I >= 0.5 ? [0, 1, 2, 1, 0, 1, 2, 3][st % 8] : [0, 1, 2, 1][i8 % 4];
      var am = ai === 3 ? ch[0] + 24 : ch[ai] + 12;
      tone('square', midi(am), tt, I >= 0.5 ? 0.09 : 0.14, (st % 4 === 0 ? 0.04 : 0.028) * (0.7 + 0.3 * I),
           { filter: 'lowpass', ff: 2200 + 2000 * I, a: 0.003 });
    }
    // Lead.
    if (I >= 0.55 && LEAD[st] >= 0) {
      var ext = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12, ch[2] + 12], lm = ext[LEAD[st]] + 12;
      var lv = 0.03 * Math.min(1, (I - 0.5) * 3);
      tone('square', midi(lm), tt, 0.2, lv, { filter: 'lowpass', ff: 4000, a: 0.006 });
      if (I > 0.8) tone('triangle', midi(lm + 12), tt, 0.16, lv * 0.5, { a: 0.006 });
    }
    // Pad once a bar.
    if (st === 0) {
      for (var k = 0; k < 3; k++) tone('triangle', midi(ch[k]), tt, 16 * mStepDur() * 0.95, 0.018, { a: 0.12, out: D });
    }
  }

  // Calm spooky title loop (eighths at 60 bpm, 32-step phrase).
  function menuStep(tt, s) {
    var p = curP(), ph = s % 32, m = MENU_MEL[ph];
    if (m != null && Math.random() > 0.15) {
      var f = p.root * 4 * Math.pow(2, m / 12);
      bell(f, tt, 0.04, 2.2);
      if (Math.random() < 0.12) bell(f * Math.pow(2, 1 / 12), tt + 0.25, 0.02, 1.6);   // dissonant shadow
    }
    if (ph % 16 === 0) tone('sine', p.root * 2, tt, 4, 0.03, { a: 0.6 });
    if (ph === 16) noise(tt, 2.4, 0.025, { type: 'bandpass', f: 200, f2: 500, q: 3, a: 1.0 });
  }

  function bell(f, t, vol, dur) {
    tone('sine', f, t, dur, vol, { a: 0.01 });
    tone('sine', f * 2.76, t, dur * 0.35, vol * 0.25, { a: 0.005 });
    tone('triangle', f * 0.5, t, dur * 0.6, vol * 0.3, { a: 0.02 });
  }

  function scheduleStep(t) {
    var p = curP(), s = M.step;
    if (M.boss) {
      var root = p.root * 2, pat = [0, 0, 12, 0, 1, 0, 7, 6], sem = pat[s % 8];
      mNote(function (tt) {
        tone('square', root * Math.pow(2, sem / 12), tt, 0.17, 0.05, { filter: 'lowpass', ff: 1100, ff2: 300, q: 3 });
        if (s % 4 === 0) tone('sine', 120, tt, 0.18, 0.22, { f2: 40 });              // kick
        if (s % 2 === 1) noise(tt, 0.03, 0.025, { type: 'highpass', f: 7000 });       // hat
        if (s % 16 === 8) noise(tt, 0.12, 0.05, { type: 'bandpass', f: 1800, q: 0.8 }); // snare-ish
        if (s % 16 === 0) {
          bell(root * 4, tt, 0.035, 1.2);
          bell(root * 4 * Math.pow(2, 1 / 12), tt + 0.01, 0.03, 1.2);              // minor 2nd stab
        }
        if (s % 32 === 24) tone('sawtooth', root * 8, tt, 0.9, 0.02, { f2: root * 4, filter: 'lowpass', ff: 2000, a: 0.1 });
      }, t);
      return;
    }
    if (M.mode === 'action') { mNote(function (tt) { actionStep(tt, s, M.iS); }, t); return; }
    if (M.mode === 'menu') { mNote(function (tt) { menuStep(tt, s); }, t); return; }
    mNote(function (tt) {
      // Heartbeat pulse deeper down (lub-dub at bar start).
      if (p.heartbeat && s % 8 === 0) {
        tone('sine', 62, tt, 0.22, p.heartbeat, { f2: 38 });
        tone('sine', 58, tt + 0.22, 0.2, p.heartbeat * 0.7, { f2: 36 });
      }
      // Sparse bell melody, random walk over the scale.
      if (Math.random() < p.density) {
        var sc = p.k > 0.5 ? SCALE_PHRYG : SCALE_MINOR;
        M.deg = clamp(M.deg + Math.floor(rnd(-2, 3)), -3, 9);
        var idx = ((M.deg % 7) + 7) % 7, oct = Math.floor(M.deg / 7);
        var f = p.root * 4 * Math.pow(2, (sc[idx] + 12 * oct) / 12);
        bell(f, tt, 0.045, rnd(1.4, 2.6));
        if (p.k > 0.6 && Math.random() < 0.25) bell(f * Math.pow(2, 1 / 12), tt + 0.18, 0.025, 1.6); // dissonant shadow
      }
      // Occasional low swell.
      if (s % 32 === 16 && Math.random() < 0.5 + p.k * 0.4) {
        noise(tt, 2.2, 0.03 + p.k * 0.03, { type: 'bandpass', f: 200, f2: 500, q: 3, a: 1.0 });
      }
    }, t);
  }

  function mTick() {
    try {
      if (!M.on || !M.n || !ctx || ctx.state !== 'running') return;
      var now = ctx.currentTime;
      if (M.next < now) M.next = now + 0.05;   // recover after tab throttling
      var guard = 0;
      while (M.next < now + 0.3 && guard++ < 32) {
        M.iS += (M.iT - M.iS) * 0.08;           // smooth intensity (per scheduled step, ~1s settle)
        if (!mutedFlag) scheduleStep(M.next);
        M.next += mStepDur();
        M.step++;
      }
    } catch (e) {}
  }

  function teardownMusic(fade) {
    var n = M.n; M.n = null;
    if (M.timer) { clearInterval(M.timer); M.timer = null; }
    if (!n || !ctx) return;
    try {
      var now = ctx.currentTime, end = now + (fade || 1);
      n.out.gain.cancelScheduledValues(now);
      n.out.gain.setValueAtTime(Math.max(0.0001, n.out.gain.value), now);
      n.out.gain.exponentialRampToValueAtTime(0.0001, end);
      for (var i = 0; i < n.oscs.length; i++) { try { n.oscs[i].stop(end + 0.05); } catch (e) {} }
      n.o1.onended = function () {
        for (var k in n) {
          if (n[k] && typeof n[k].disconnect === 'function') { try { n[k].disconnect(); } catch (e) {} }
        }
      };
    } catch (e) {}
  }

  function begin(mode, depth) {
    try {
      if (depth != null) M.depth = clamp(Math.round(depth) || 1, 1, 10);
      if (!ctx || !master) { M.pending = { mode: mode, depth: M.depth }; return; }
      M.pending = null;
      var changed = M.mode !== mode;
      M.mode = mode;
      if (M.on && M.n) {
        if (changed) { M.step = 0; M.deg = 0; M.iS = M.iT; M.next = Math.max(M.next, ctx.currentTime + 0.05); }
        applyDrone(changed ? 1.5 : 2);
        return;
      }
      M.on = true; M.step = 0; M.deg = 0; M.iS = M.iT;
      buildMusic();
      M.next = ctx.currentTime + 0.1;
      M.timer = setInterval(mTick, 60);
      mTick();
    } catch (e) {}
  }

  var music = {
    start: function (depth) { begin('dread', depth); },
    startAction: function () { begin('action', null); },
    menu: function () { begin('menu', null); },
    setIntensity: function (x) {
      try {
        x = Number(x);
        if (!isFinite(x)) return;
        M.iT = clamp(x, 0, 1);
      } catch (e) {}
    },
    setDepth: function (depth) {
      try {
        M.depth = clamp(Math.round(depth) || 1, 1, 10);
        if (M.pending) M.pending.depth = M.depth;
        if (M.on && M.n && ctx) applyDrone(2.5);
      } catch (e) {}
    },
    boss: function (on) {
      try {
        on = !!on;
        if (M.boss === on) return;
        M.boss = on;
        if (M.on && M.n && ctx) {
          var sd = mStepDur();
          M.step = Math.ceil(M.step / 16) * 16;   // re-align pattern to a bar
          if (M.next < ctx.currentTime + sd) M.next = Math.max(M.next, ctx.currentTime + 0.05);
          applyDrone(0.6);
        }
      } catch (e) {}
    },
    stop: function () {
      try {
        M.pending = null;
        if (!M.on) return;
        M.on = false;
        teardownMusic(1.2);
      } catch (e) {}
    }
  };

  /* ---------------- Public API ---------------- */
  var api = {
    muted: false,
    names: Object.keys(SFX),
    music: music,

    init: function () {
      try {
        if (!AC) return;
        if (!ctx) {
          ctx = new AC();
          // Soft clipper as a safety net (DynamicsCompressor adds unpredictable make-up gain in Chrome).
          limiter = ctx.createWaveShaper();
          var curve = new Float32Array(2048);
          for (var ci = 0; ci < 2048; ci++) {
            var x = ci / 1023.5 - 1, ax = Math.abs(x);
            curve[ci] = ax < 0.7 ? x : (x > 0 ? 1 : -1) * (0.7 + 0.3 * Math.tanh((ax - 0.7) / 0.3));
          }
          limiter.curve = curve;
          master = ctx.createGain();
          master.gain.value = mutedFlag ? 0 : volume;
          sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_GAIN;
          musicBus = ctx.createGain(); musicBus.gain.value = 0.55;
          sfxBus.connect(master); musicBus.connect(master);
          master.connect(limiter); limiter.connect(ctx.destination);
          getNoise(ctx);
          unlockOnGesture();
        }
        if (ctx.state === 'suspended' && ctx.resume) {
          var pr = ctx.resume();
          if (pr && pr.catch) pr.catch(function () {});
        }
        if (M.pending) begin(M.pending.mode, M.pending.depth);
      } catch (e) {}
    },

    play: function (name, opts) {
      try {
        if (!ctx || mutedFlag || ctx.state !== 'running') return;
        var fn = SFX[name];
        if (!fn || activeVoices >= MAX_VOICES) return;
        var vol = 1, pitch = 1;
        if (opts) {
          if (typeof opts.volume === 'number' && isFinite(opts.volume)) vol = clamp(opts.volume, 0, 1);
          if (typeof opts.pitch === 'number' && isFinite(opts.pitch) && opts.pitch > 0) pitch = clamp(opts.pitch, 0.25, 4);
        }
        if (vol <= 0) return;
        var now = ctx.currentTime, t = now + 0.008;
        var rate = RATE[name];
        if (rate) {
          var la = lastAccepted[name];
          if (la != null && now >= la && now < la + rate) return;   // rate-limited: drop silently
          lastAccepted[name] = now;
        }
        // Stagger identical sounds fired in the same frame instead of stacking them.
        var lp = lastPlayed[name];
        if (lp != null && t < lp + 0.035) {
          t = lp + 0.035;
          if (t > now + 0.15) return;
        }
        lastPlayed[name] = t;
        var vg = ctx.createGain();
        vg.gain.value = vol * (TRIM[name] || 1);
        vg.connect(sfxBus);
        runVoice(fn, vg, t, pitch, true);
      } catch (e) {}
    },

    setMuted: function (b) {
      try {
        mutedFlag = !!b;
        api.muted = mutedFlag;
        applyMaster(0.02);
      } catch (e) {}
    },

    setVolume: function (v) {
      try {
        v = Number(v);
        if (!isFinite(v)) return;
        volume = clamp(v, 0, 1);
        applyMaster(0.03);
      } catch (e) {}
    },

    _voices: function () { return activeVoices; },
    _maxVoices: MAX_VOICES,

    // Test helper: render one SFX into an OfflineAudioContext. Resolves to an AudioBuffer (or null).
    _renderOffline: function (name, secs, opts) {
      try {
        var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        var fn = SFX[name];
        if (!OAC || !fn) return Promise.resolve(null);
        secs = secs || 3;
        var oc = new OAC(1, Math.ceil(44100 * secs), 44100);
        var out = oc.createGain();
        var mv = opts && opts.master != null ? opts.master : volume;
        out.gain.value = (opts && opts.volume != null ? opts.volume : 1) * (TRIM[name] || 1) * SFX_GAIN * mv;
        out.connect(oc.destination);
        var saved = ctx;
        ctx = oc;
        try { runVoice(fn, out, 0.01, (opts && opts.pitch) || 1, false); }
        finally { ctx = saved; }
        return oc.startRendering();
      } catch (e) { return Promise.resolve(null); }
    }
  };

  return api;
})();
