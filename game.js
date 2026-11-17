// VOIDSWARM v3 - arena survivor roguelite
// Features: 6 weapons + evolutions, 7 enemy types, 2 boss types (Void Titan final boss), 4 characters,
// permanent upgrades, achievements, daily challenge, nightmare mode, music, settings, optional rewarded ads.
'use strict';
const cv = document.getElementById('c'), g = cv.getContext('2d');
const W = 1280, H = 720;
function fit() { const s = Math.min(innerWidth / W, innerHeight / H); cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; }
addEventListener('resize', fit); fit();

// ---------- tuning (difficulty) ----------
const TUNE = {
  hpGrowth: 1.003,     // regular enemy HP compounds per second (this is the late-game wall)
  hpLinear: 85,        // + linear term (seconds)
  dmgLinear: 220,      // enemy damage grows linearly
  bossLinear: 60,      // boss/elite HP grows linearly
  titanTime: 900,      // final boss at 15:00
  titanHp: 150000,
  spawnMin: .05,
};

// ---------- helpers ----------
let seedRng = null;
const rand = () => seedRng ? seedRng() : Math.random();
const rnd = (a, b) => a + rand() * (b - a);             // gameplay randomness (seedable for daily)
const vr = (a, b) => a + Math.random() * (b - a);       // visual-only randomness
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
const today = () => new Date().toISOString().slice(0, 10);

// ---------- save ----------
const save = Object.assign({ gold: 0, best: { time: 0, kills: 0 }, runs: 0, meta: {}, ach: {}, chars: { ranger: 1 }, char: 'ranger', nm: 0, wins: 0, daily: { date: '', time: 0, kills: 0 }, settings: {} }, store('vs_save') || {});
save.settings = Object.assign({ vol: .7, music: true, shake: true }, save.settings);
const persist = () => store('vs_save', save);

// ---------- audio ----------
let AC, master;
function ac() { if (!AC) { AC = new AudioContext(); master = AC.createGain(); master.gain.value = save.settings.vol; master.connect(AC.destination); } return AC; }
function setVol(v) { save.settings.vol = v; if (master) master.gain.value = v; persist(); }
function snd(f, d = .08, type = 'square', v = .04, slide = 0) {
  try {
    const A = ac(), o = A.createOscillator(), gn = A.createGain(), t = A.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(gn); gn.connect(master); o.start(t); o.stop(t + d);
  } catch (e) { }
}
const sfx = {
  shoot: () => snd(520, .05, 'square', .012, -200), hit: () => snd(180, .04, 'sawtooth', .015, -80),
  kill: () => snd(300, .08, 'triangle', .03, -200), gem: () => snd(900, .04, 'sine', .02, 300),
  coin: () => snd(1200, .08, 'sine', .035, 400), hurt: () => snd(120, .25, 'sawtooth', .07, -70),
  level: () => { snd(440, .12, 'triangle', .06); setTimeout(() => snd(660, .12, 'triangle', .06), 90); setTimeout(() => snd(880, .2, 'triangle', .06), 180); },
  nova: () => snd(200, .3, 'sine', .07, 300), boss: () => snd(70, .8, 'sawtooth', .08, 30),
  dash: () => snd(300, .12, 'sine', .05, 500), zap: () => snd(900, .1, 'sawtooth', .03, -600),
  boom: () => snd(110, .25, 'sawtooth', .06, -60), flame: () => snd(140, .05, 'sawtooth', .01),
  combo: () => { snd(700, .08, 'square', .05); setTimeout(() => snd(1000, .15, 'square', .05), 70); },
  buy: () => { snd(600, .1, 'triangle', .06); setTimeout(() => snd(900, .15, 'triangle', .06), 80); },
  ach: () => { snd(660, .1, 'triangle', .06); setTimeout(() => snd(990, .1, 'triangle', .06), 100); setTimeout(() => snd(1320, .25, 'triangle', .06), 200); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => snd(f, .3, 'triangle', .07), i * 160)); },
};
let musT = 0, musI = 0;
const BASS = [0, 0, 7, 0, 5, 5, 3, 5];
function music(dt) {
  if (!save.settings.music || (state !== 'play' && state !== 'levelup')) return;
  musT -= dt; if (musT > 0) return;
  const t = G ? G.t : 0; musT = Math.max(.13, .24 - t / 2400);
  const f = 55 * Math.pow(2, BASS[musI % 8] / 12);
  snd(f, .2, 'triangle', .05); if (musI % 2 === 0) snd(f * 2, .1, 'square', .01);
  if (t > 240 && musI % 4 === 2) snd(f * 4 * Math.pow(2, [0, 3, 7, 10][(musI >> 2) % 4] / 12), .12, 'square', .01);
  musI++;
}

// ---------- data ----------
const UPG = [
  { id: 'dmg', n: 'Sharper Bolts', d: '+25% damage (all weapons)', max: 8, f: w => w.dmg *= 1.25 },
  { id: 'rate', n: 'Rapid Fire', d: '+20% bolt fire rate', max: 8, f: w => w.rate *= 1.2 },
  { id: 'multi', n: 'Multishot', d: '+1 bolt per volley', max: 5, f: w => w.multi++ },
  { id: 'pierce', n: 'Piercing', d: 'Bolts pierce +1 enemy', max: 4, f: w => w.pierce++ },
  { id: 'blades', n: 'Spectral Blades', d: '+1 orbiting blade', max: 6, f: w => w.blades++ },
  { id: 'nova', n: 'Shockwave', d: 'Periodic pulse, stronger per level', max: 6, f: w => w.nova++ },
  { id: 'light', n: 'Chain Lightning', d: 'Zaps enemies, jumps between them', max: 6, f: w => w.light++ },
  { id: 'boom', n: 'Boomerang', d: 'Pierces going out AND back', max: 6, f: w => w.boom++ },
  { id: 'missile', n: 'Homing Missiles', d: 'Seeking explosive missiles', max: 6, f: w => w.missile++ },
  { id: 'flame', n: 'Flamethrower', d: 'Burning cone toward enemies', max: 6, f: w => w.flame++ },
  { id: 'spd', n: 'Swift Boots', d: '+12% move speed', max: 5, f: (w, p) => p.spd *= 1.12 },
  { id: 'vit', n: 'Vitality', d: '+25 max HP and heal 25', max: 6, f: (w, p) => { p.max += 25; p.hp = Math.min(p.max, p.hp + 25); } },
  { id: 'mag', n: 'Magnet', d: '+50% pickup range', max: 4, f: (w, p) => p.magnet *= 1.5 },
  { id: 'regen', n: 'Regeneration', d: '+1 HP per second', max: 5, f: w => w.regen++ },
  { id: 'crit', n: 'Critical Strike', d: '+12% crit chance (x2 damage)', max: 5, f: w => w.crit += .12 },
  { id: 'dashf', n: 'Quick Dash', d: 'Dash recharges 20% faster', max: 4, f: w => w.dashCd *= .8 },
];
const UI = {}; UPG.forEach((u, i) => UI[u.id] = i);
const EVO = [
  { id: 'storm', n: 'STORM BARRAGE', d: 'Bolts: +2 per volley, +30% fire rate', need: l => l.multi >= 3 && l.rate >= 3, f: w => { w.multi += 2; w.rate *= 1.3; } },
  { id: 'bloom', n: 'DEATH BLOSSOM', d: 'Blades: +3 blades, wider orbit', need: l => l.blades >= 3 && l.nova >= 3, f: w => { w.blades += 3; w.bladeR = 125; } },
  { id: 'tempest', n: 'TEMPEST', d: 'Lightning: +4 jumps, +60% damage', need: l => l.light >= 3 && l.crit >= 2, f: w => { w.chainX += 4; w.lightMul = 1.6; } },
  { id: 'inferno', n: 'INFERNO', d: 'Flamethrower deals double damage', need: l => l.flame >= 3 && l.vit >= 2, f: w => { w.flameMul = 2; } },
  { id: 'hunter', n: 'HUNTER SWARM', d: 'Missiles: double count, bigger blasts', need: l => l.missile >= 3 && l.pierce >= 2, f: w => { w.missMul = 2; } },
  { id: 'reaper', n: 'REAPER ARC', d: 'Boomerangs: +2 count, +60% damage', need: l => l.boom >= 3 && l.dmg >= 3, f: w => { w.boomX += 2; w.boomMul = 1.6; } },
];
const FALLBACK = [
  { n: 'Gold Cache', d: '+40 gold', f: () => { G.gold += 40 * G.goldMul; } },
  { n: 'Healing Spring', d: 'Restore all HP', f: () => { G.p.hp = G.p.max; } },
  { n: 'Overcharge', d: '+8% damage', f: () => { G.w.dmg *= 1.08; } },
];
const META = [
  { k: 'pow', n: 'Power', d: '+10% damage every run', max: 10, cost: l => 40 + l * 35 },
  { k: 'vit', n: 'Vitality', d: '+15 starting HP', max: 10, cost: l => 40 + l * 30 },
  { k: 'spd', n: 'Swiftness', d: '+5% move speed', max: 8, cost: l => 50 + l * 40 },
  { k: 'greed', n: 'Greed', d: '+15% gold from everything', max: 8, cost: l => 60 + l * 50 },
  { k: 'mag', n: 'Magnetism', d: '+20% pickup range', max: 6, cost: l => 40 + l * 35 },
  { k: 'wis', n: 'Wisdom', d: '+10% XP gain', max: 8, cost: l => 50 + l * 45 },
  { k: 'rev', n: 'Second Wind', d: '+1 free revive per run', max: 2, cost: l => 300 + l * 500 },
];
for (const m of META) save.meta[m.k] = save.meta[m.k] || 0;
const CHARS = [
  { id: 'ranger', n: 'Ranger', d: 'Balanced all-rounder.', cost: 0, start: [], hp: 1, rate: 1 },
  { id: 'mage', n: 'Stormcaller', d: 'Starts with Chain Lightning. Fragile (-20% HP).', cost: 350, start: ['light'], hp: .8, rate: 1 },
  { id: 'warden', n: 'Warden', d: 'Starts with 2 Blades, +40% HP, slower bolts.', cost: 700, start: ['blades', 'blades'], hp: 1.4, rate: .8 },
  { id: 'pyro', n: 'Pyromancer', d: 'Starts with the Flamethrower. Faster, -10% HP.', cost: 1200, start: ['flame'], hp: .9, rate: 1, spd: 1.1 },
];
const ETYPES = {
  grunt: { hp: 18, spd: 88, r: 12, dmg: 7, xp: 1, col: '#e0476b' },
  runner: { hp: 11, spd: 165, r: 9, dmg: 6, xp: 1, col: '#ff9f43' },
  brute: { hp: 80, spd: 60, r: 21, dmg: 14, xp: 4, col: '#9b59d0' },
  shooter: { hp: 30, spd: 62, r: 12, dmg: 9, xp: 3, col: '#3ddc97' },
  exploder: { hp: 25, spd: 150, r: 13, dmg: 16, xp: 2, col: '#ff5d1f' },
  bat: { hp: 7, spd: 230, r: 7, dmg: 5, xp: 1, col: '#b8b8ff' },
  elite: { hp: 320, spd: 72, r: 28, dmg: 18, xp: 12, col: '#ffd166' },
  boss: { hp: 1500, spd: 78, r: 44, dmg: 26, xp: 40, col: '#ff2e63' },
  titan: { hp: 1, spd: 46, r: 74, dmg: 40, xp: 0, col: '#b14dff' },
};
const ACH = [
  { id: 'ACH_T5', n: 'Survivor', d: 'Survive 5 minutes', chk: G => G.t >= 300, gold: 30 },
  { id: 'ACH_T10', n: 'Veteran', d: 'Survive 10 minutes', chk: G => G.t >= 600, gold: 80 },
  { id: 'ACH_K500', n: 'Exterminator', d: 'Kill 500 enemies in one run', chk: G => G.kills >= 500, gold: 60 },
  { id: 'ACH_K3000', n: 'Annihilator', d: 'Kill 3000 enemies in one run', chk: G => G.kills >= 3000, gold: 200 },
  { id: 'ACH_C100', n: 'Unstoppable', d: 'Reach a 100 kill combo', chk: G => G.bestCombo >= 100, gold: 80 },
  { id: 'ACH_BOSS', n: 'Giant Slayer', d: 'Defeat a boss', chk: G => G.bossKills >= 1, gold: 50 },
  { id: 'ACH_EVO', n: 'Evolved', d: 'Evolve a weapon', chk: G => G.evolved >= 1, gold: 100 },
  { id: 'ACH_WIN', n: 'Titan Slayer', d: 'Defeat the Void Titan', chk: G => G.won, gold: 300 },
  { id: 'ACH_NM', n: 'Nightmare Fuel', d: 'Survive 10 minutes on Nightmare', chk: G => G.nm && G.t >= 600, gold: 300 },
  { id: 'ACH_RICH', n: 'Moneybags', d: 'Hold 2000 gold', chk: () => save.gold >= 2000, gold: 0 },
];
const PALETTES = [['#0a0a18', '#15152c'], ['#14091a', '#26123a'], ['#1a0a0a', '#341414'], ['#0a1a1a', '#143434'], ['#161608', '#323214']];

// ---------- state ----------
let state = 'menu', G = null, keys = {}, mouse = { x: 0, y: 0 }, shake = 0, last = 0, stars = [], toast = null, prevState = 'play', pops = [];
let optDaily = false, optNM = false;
for (let i = 0; i < 90; i++) stars.push({ x: vr(0, W), y: vr(0, H), s: vr(.5, 2), a: vr(.2, .8) });
const curChar = () => CHARS.find(c => c.id === save.char) || CHARS[0];

function applyUpg(id) { const i = UI[id]; UPG[i].f(G.w, G.p); G.lv[id] = (G.lv[id] || 0) + 1; }
function newGame() {
  const M = save.meta, ch = curChar();
  const nm = optNM && save.nm;
  seedRng = optDaily ? mulberry(parseInt(today().replace(/-/g, ''))) : null;
  const hp = Math.round((100 + 15 * M.vit) * ch.hp);
  G = {
    t: 0, kills: 0, lvl: 1, xp: 0, need: 4, cam: { x: 0, y: 0 }, nm, daily: optDaily,
    p: { x: 0, y: 0, r: 14, hp, max: hp, spd: 285 * (1 + .05 * M.spd) * (ch.spd || 1), magnet: 110 * (1 + .2 * M.mag), inv: 0, face: 0, regenT: 0 },
    w: { dmg: 11 * (1 + .1 * M.pow), rate: 2.2 * ch.rate, multi: 1, pierce: 0, blades: 0, bladeA: 0, bladeR: 85, nova: 0, novaT: 2, regen: 0, crit: 0, dashCd: 1.1,
      light: 0, lightT: 1, chainX: 0, lightMul: 1, boom: 0, boomT: 1, boomX: 0, boomMul: 1, missile: 0, missT: 1, missMul: 1, flame: 0, flameT: 0, flameMul: 1, aim: 0 },
    goldMul: (1 + .15 * M.greed) * (nm ? 1.5 : 1), xpMul: 1 + .1 * M.wis, revives: M.rev,
    en: [], bul: [], eb: [], gem: [], coin: [], chest: [], part: [], txt: [], rings: [], arcs: [], boomr: [], mis: [], lv: {}, evo: {},
    cd: 0, spawn: 0, nextBoss: 75, nextElite: 35, nextHorde: 50, nextBats: 30, choices: [], bossAlive: false, titanSpawned: false, won: false,
    combo: 0, comboT: 0, bestCombo: 0, dash: 0, dashT: 0, gold: 0, banked: 0, earned: 0, bossKills: 0, evolved: 0,
    adRevived: false, doubled: false, rerolled: false, banner: null, freeze: 0, achT: 1, flameSnd: 0,
  };
  for (const id of ch.start) applyUpg(id);
  save.runs++;
  state = 'play';
}
function bank() {
  let total = G.gold + G.t / 10 + G.kills / 20 + (G.won ? 200 : 0);
  total = Math.floor(total * (G.nm ? 1.5 : 1));
  const delta = total - G.banked; G.banked = total; G.earned = total;
  save.gold += delta;
  if (G.t > save.best.time) save.best.time = G.t;
  if (G.kills > save.best.kills) save.best.kills = G.kills;
  if (G.daily) { const d = today(); if (save.daily.date !== d) save.daily = { date: d, time: 0, kills: 0 }; if (G.t > save.daily.time) { save.daily.time = G.t; save.daily.kills = G.kills; } }
  checkAch(); persist();
}
function say(s, col = '#ffe66d', t = 1.6) { if (G) G.banner = { s, col, t }; }
function checkAch() {
  for (const a of ACH) {
    if (save.ach[a.id] || !a.chk(G)) continue;
    save.ach[a.id] = 1; save.gold += a.gold; persist(); sfx.ach();
    pops.push({ s: 'Achievement: ' + a.n + (a.gold ? '  (+' + a.gold + ' gold)' : ''), t: 3.5 });
    try { if (typeof window !== 'undefined' && window.steam) window.steam.ach(a.id); } catch (e) { }
  }
}

function availEvo() { return EVO.find(e => !G.evo[e.id] && e.need(G.lv)); }
function offerUpgrades() {
  const pool = UPG.map((u, i) => i).filter(i => (G.lv[UPG[i].id] || 0) < UPG[i].max);
  const out = [], ev = availEvo();
  if (ev) out.push({ k: 'e', ref: ev });
  while (out.length < 3 && pool.length) out.push({ k: 'u', i: pool.splice(Math.floor(rand() * pool.length), 1)[0] });
  for (let i = 0; out.length < 3; i++) out.push({ k: 'f', ref: FALLBACK[i % FALLBACK.length] });
  G.choices = out; G.rerolled = false;
  state = 'levelup'; sfx.level();
}
function cardInfo(c) {
  if (c.k === 'u') { const u = UPG[c.i], l = G.lv[u.id] || 0; return { n: u.n, d: u.d, sub: 'Level ' + l + ' → ' + (l + 1) + ' / ' + u.max, col: '#6c63ff' }; }
  if (c.k === 'e') return { n: c.ref.n, d: c.ref.d, sub: '★ EVOLUTION ★', col: '#ffd166' };
  return { n: c.ref.n, d: c.ref.d, sub: 'Bonus', col: '#3ddc97' };
}
function pick(i) {
  const c = G.choices[i]; if (!c) return;
  if (c.k === 'u') applyUpg(UPG[c.i].id);
  else if (c.k === 'e') { c.ref.f(G.w); G.evo[c.ref.id] = 1; G.evolved++; say('EVOLVED: ' + c.ref.n + '!', '#ffd166', 2.5); shake = 10; checkAch(); }
  else c.ref.f();
  state = 'play';
  levelCheck();
}
function levelCheck() {
  if (G.xp >= G.need && state === 'play') { G.xp -= G.need; G.need = Math.floor(G.need * 1.28 + 2); G.lvl++; offerUpgrades(); }
}
function watchAd(label, reward) {
  prevState = state; state = 'ad';
  Ads.showRewarded(label, reward, () => { if (state === 'ad') state = prevState; });
}
function buyMeta(i) {
  const m = META[i]; if (!m) return;
  const lv = save.meta[m.k], c = m.cost(lv);
  if (lv >= m.max) return;
  if (save.gold >= c) { save.gold -= c; save.meta[m.k]++; persist(); sfx.buy(); toast = { s: m.n + ' upgraded to level ' + (lv + 1) + '!', t: 1.5 }; }
  else { toast = { s: 'Not enough gold (need ' + c + ')', t: 1.5 }; snd(150, .15, 'square', .05); }
}
function selectChar(d) {
  let i = CHARS.findIndex(c => c.id === save.char); i = (i + d + CHARS.length) % CHARS.length;
  save.char = CHARS[i].id; persist(); snd(500, .05, 'square', .04);
}
function unlockChar() {
  const c = curChar(); if (save.chars[c.id]) return;
  if (save.gold >= c.cost) { save.gold -= c.cost; save.chars[c.id] = 1; persist(); sfx.buy(); toast = { s: c.n + ' unlocked!', t: 1.5 }; }
  else toast = { s: 'Need ' + c.cost + ' gold to unlock', t: 1.5 };
}
function tryStart() { if (save.chars[curChar().id]) newGame(); else unlockChar(); }
function toggleNM() { if (!save.nm) { toast = { s: 'Defeat the Void Titan to unlock Nightmare', t: 2 }; return; } optNM = !optNM; }
function toggleFS() { if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } }
function setting(i, dir = 1) {
  const s = save.settings;
  if (i === 0) { const v = dir > 0 ? Math.min(1, Math.round((s.vol + .25) * 4) / 4) : Math.max(0, Math.round((s.vol - .25) * 4) / 4); setVol(s.vol >= 1 && dir > 0 ? 0 : v); }
  if (i === 1) { s.music = !s.music; persist(); }
  if (i === 2) { s.shake = !s.shake; persist(); }
  if (i === 3) toggleFS();
}

// ---------- layout / buttons ----------
const R = {
  start: { x: 440, y: 372, w: 400, h: 60 }, shop: { x: 440, y: 442, w: 195, h: 50 }, achb: { x: 645, y: 442, w: 195, h: 50 },
  sett: { x: 440, y: 498, w: 195, h: 46 }, daily: { x: 645, y: 498, w: 195, h: 46 }, nm: { x: 440, y: 552, w: 400, h: 42 },
  charL: { x: 330, y: 245, w: 60, h: 100 }, charR: { x: 890, y: 245, w: 60, h: 100 }, charBox: { x: 400, y: 245, w: 480, h: 100 },
  revive: { x: 410, y: 420, w: 460, h: 52 }, dbl: { x: 410, y: 482, w: 460, h: 52 }, cont: { x: 410, y: 440, w: 460, h: 52 },
  again: { x: 410, y: 560, w: 220, h: 52 }, menu: { x: 650, y: 560, w: 220, h: 52 },
  reroll: { x: 440, y: 550, w: 400, h: 48 }, back: { x: 540, y: 650, w: 200, h: 46 }, quit: { x: 540, y: 430, w: 200, h: 48 },
};
const inR = r => mouse.x > r.x && mouse.x < r.x + r.w && mouse.y > r.y && mouse.y < r.y + r.h;
const cardRect = i => ({ x: 120 + i * 360, y: 220, w: 320, h: 280 });
const rowRect = i => ({ x: 240, y: 120 + i * 71, w: 800, h: 62 });
const setRect = i => ({ x: 340, y: 190 + i * 80, w: 600, h: 64 });

function doRevive() {
  if (G.adRevived) return;
  watchAd('revive', () => { G.adRevived = true; reviveNow(.6); });
}
function reviveNow(frac) {
  const p = G.p; p.hp = p.max * frac; p.inv = 2.5;
  G.rings.push({ x: p.x, y: p.y, r: 10, max: 420, life: .4 });
  for (const e of G.en) if (dist(e, p) < 430) { if (e.type === 'boss' || e.type === 'titan') e.hp *= .95; else e.dead = true; }
  G.eb.length = 0;
  state = 'play'; say('REVIVED!', '#5eead4'); sfx.nova();
}
function doubleGold() { if (G.doubled) return; watchAd('double_gold', () => { G.doubled = true; save.gold += G.earned; persist(); }); }
function doReroll() { if (G.rerolled) return; watchAd('reroll', () => { offerUpgrades(); G.rerolled = true; }); }
function quitRun() { state = 'over'; bank(); }

// ---------- input ----------
addEventListener('keydown', e => {
  keys[e.code] = 1;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  const go = e.code === 'Enter' || e.code === 'Space', n = parseInt(e.key);
  if (state === 'menu') {
    if (go) tryStart(); else if (e.code === 'KeyS') state = 'shop'; else if (e.code === 'KeyA') state = 'ach'; else if (e.code === 'KeyT') state = 'settings';
    else if (e.code === 'KeyD') optDaily = !optDaily; else if (e.code === 'KeyN') toggleNM();
    else if (e.code === 'ArrowLeft') selectChar(-1); else if (e.code === 'ArrowRight') selectChar(1); else if (e.code === 'KeyU') unlockChar();
  }
  else if (state === 'shop') { if (e.code === 'Escape' || e.code === 'KeyB') state = 'menu'; if (n >= 1 && n <= META.length) buyMeta(n - 1); }
  else if (state === 'ach') { if (e.code === 'Escape' || e.code === 'KeyB') state = 'menu'; }
  else if (state === 'settings') {
    if (e.code === 'Escape' || e.code === 'KeyB') state = 'menu'; if (n >= 1 && n <= 4) setting(n - 1);
    if (e.code === 'ArrowLeft') setting(0, -1); if (e.code === 'ArrowRight') setting(0, 1);
  }
  else if (state === 'over' || state === 'win') { if (go && state === 'over') newGame(); if (e.code === 'Escape') state = 'menu'; if (e.code === 'Enter' && state === 'win') { state = 'play'; } }
  else if (state === 'levelup') { if (e.code === 'Digit1') pick(0); if (e.code === 'Digit2') pick(1); if (e.code === 'Digit3') pick(2); }
  else if (state === 'play' && (e.code === 'Space' || e.code === 'ShiftLeft')) tryDash();
  else if (state === 'paused' && e.code === 'KeyQ') quitRun();
  if ((e.code === 'Escape' || e.code === 'KeyP') && (state === 'play' || state === 'paused')) state = state === 'play' ? 'paused' : 'play';
  if (e.code === 'F11') toggleFS();
});
addEventListener('keyup', e => keys[e.code] = 0);
function toCanvas(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
cv.addEventListener('mousemove', e => { mouse = toCanvas(e); });
cv.addEventListener('click', e => {
  mouse = toCanvas(e);
  if (state === 'menu') {
    if (inR(R.start)) tryStart(); else if (inR(R.shop)) state = 'shop'; else if (inR(R.achb)) state = 'ach'; else if (inR(R.sett)) state = 'settings';
    else if (inR(R.daily)) optDaily = !optDaily; else if (inR(R.nm)) toggleNM();
    else if (inR(R.charL)) selectChar(-1); else if (inR(R.charR)) selectChar(1); else if (inR(R.charBox)) unlockChar();
  }
  else if (state === 'shop') { if (inR(R.back)) state = 'menu'; META.forEach((m, i) => { if (inR(rowRect(i))) buyMeta(i); }); }
  else if (state === 'ach') { if (inR(R.back)) state = 'menu'; }
  else if (state === 'settings') { if (inR(R.back)) state = 'menu'; for (let i = 0; i < 4; i++) if (inR(setRect(i))) setting(i); }
  else if (state === 'paused') { if (inR(R.quit)) quitRun(); else state = 'play'; }
  else if (state === 'levelup') {
    for (let i = 0; i < G.choices.length; i++) if (inR(cardRect(i))) pick(i);
    if (inR(R.reroll)) doReroll();
  } else if (state === 'over') {
    if (inR(R.revive)) doRevive(); else if (inR(R.dbl)) doubleGold();
    else if (inR(R.again)) newGame(); else if (inR(R.menu)) state = 'menu';
  } else if (state === 'win') {
    if (inR(R.cont)) state = 'play'; else if (inR(R.menu)) state = 'menu';
  }
});
function tryDash() {
  const p = G.p, w = G.w;
  if (G.dashT > 0) return;
  G.dash = .17; G.dashT = w.dashCd; p.inv = Math.max(p.inv, .3); sfx.dash();
  burst(p.x, p.y, '#5eead4', 12, 120);
}
let padPrev = {};
function pad() {
  const pads = (typeof navigator !== 'undefined' && navigator.getGamepads) ? navigator.getGamepads() : [];
  const gp = pads && pads[0]; if (!gp) return { x: 0, y: 0 };
  const a = gp.buttons[0] && gp.buttons[0].pressed, st = gp.buttons[9] && gp.buttons[9].pressed, b = gp.buttons[1] && gp.buttons[1].pressed;
  if (a && !padPrev.a && state === 'menu') tryStart();
  if (a && !padPrev.a && state === 'over') newGame();
  if ((a && !padPrev.a || b && !padPrev.b) && state === 'play') tryDash();
  if (st && !padPrev.s && (state === 'play' || state === 'paused')) state = state === 'play' ? 'paused' : 'play';
  if (state === 'levelup') { [0, 1, 2].forEach(i => { const bt = gp.buttons[i === 0 ? 2 : i === 1 ? 0 : 1]; if (bt && bt.pressed && !padPrev['c' + i]) pick(i); padPrev['c' + i] = bt && bt.pressed; }); }
  padPrev.a = a; padPrev.s = st; padPrev.b = b;
  const dx = gp.axes[0] || 0, dy = gp.axes[1] || 0;
  return Math.hypot(dx, dy) > .2 ? { x: dx, y: dy } : { x: 0, y: 0 };
}

// ---------- gameplay ----------
const hpMul = () => (1 + G.t / TUNE.hpLinear) * Math.pow(TUNE.hpGrowth, G.t) * (G.nm ? 1.5 : 1);
const dmgMul = () => (1 + G.t / TUNE.dmgLinear) * (G.nm ? 1.4 : 1);
function pickType() {
  const t = G.t, table = [['grunt', 10], ['runner', t > 20 ? 5 : 0], ['shooter', t > 45 ? 3 : 0], ['exploder', t > 70 ? 3 : 0], ['brute', t > 60 ? 2 + t / 120 : 0]];
  let tot = 0; for (const x of table) tot += x[1];
  let r = rand() * tot; for (const x of table) { r -= x[1]; if (r <= 0) return x[0]; }
  return 'grunt';
}
function spawnEnemy(type, ax, ay) {
  const T = ETYPES[type], a = rnd(0, Math.PI * 2), d = (type === 'boss' || type === 'titan') ? 650 : rnd(680, 800);
  const x = ax !== undefined ? ax : G.p.x + Math.cos(a) * d, y = ay !== undefined ? ay : G.p.y + Math.sin(a) * d;
  let hp, dmg = T.dmg * dmgMul();
  if (type === 'titan') { hp = TUNE.titanHp * (G.nm ? 1.5 : 1); dmg = T.dmg * (G.nm ? 1.4 : 1); }
  else if (type === 'boss' || type === 'elite') hp = T.hp * (1 + G.t / TUNE.bossLinear) * (G.nm ? 1.5 : 1);
  else hp = T.hp * hpMul();
  const e = { type, x, y, r: T.r, hp, max: hp, spd: T.spd * (1 + Math.min(.55, G.t / 420)), dmg, xp: T.xp, col: T.col, flash: 0, bt: 0, atk: 2, sp: 0, spin: 0, sum: 4, ph: rnd(0, 6.28), fuse: 0 };
  G.en.push(e); return e;
}
function burst(x, y, col, n, sp = 150) {
  for (let i = 0; i < n && G.part.length < 500; i++) { const a = vr(0, 6.28), s = vr(30, sp); G.part.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: vr(.25, .6), col }); }
}
function floatText(x, y, s, col = '#fff', size = 16) { if (G.txt.length < 60) G.txt.push({ x, y, s, col, size, life: .6 }); }
function damageEnemy(e, d, crit, quiet) {
  e.hp -= d; e.flash = .08;
  if (!quiet || rand() < .12) floatText(e.x + vr(-8, 8), e.y - e.r, d >= 1e6 ? (d / 1e6).toFixed(1) + 'M' : d >= 1e4 ? Math.round(d / 1e3) + 'k' : Math.round(d) + (crit ? '!' : ''), crit ? '#ff9f43' : '#ffe66d', crit ? 22 : 16);
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}
function dropCoin(x, y, v) { G.coin.push({ x: x + vr(-14, 14), y: y + vr(-14, 14), v }); }
function nearest(maxd, from) {
  const p = from || G.p; let tgt = null, bd = maxd;
  for (const e of G.en) { if (e.dead) continue; const d = dist(e, p); if (d < bd) { bd = d; tgt = e; } }
  return tgt;
}
function killEnemy(e) {
  e.dead = true; G.kills++; sfx.kill();
  G.combo++; G.comboT = 2.5; if (G.combo > G.bestCombo) G.bestCombo = G.combo;
  if (G.combo % 25 === 0) { sfx.combo(); say('RAMPAGE x' + G.combo + '!', '#ff9f43', 1.2); G.xp += 3; G.p.hp = Math.min(G.p.max, G.p.hp + 5); shake = 6; }
  const big = e.type === 'boss' || e.type === 'elite' || e.type === 'titan';
  burst(e.x, e.y, e.col, e.type === 'titan' ? 120 : e.type === 'boss' ? 60 : big ? 24 : 9, big ? 400 : 170);
  const n = e.type === 'boss' ? 12 : 1;
  for (let i = 0; i < n; i++) G.gem.push({ x: e.x + vr(-20, 20) * (n > 1), y: e.y + vr(-20, 20) * (n > 1), v: e.type === 'boss' ? Math.ceil(e.xp / n) : e.xp });
  const cm = 1 + Math.min(1, G.combo / 100);
  if (rand() < .18) dropCoin(e.x, e.y, 1 * G.goldMul * cm);
  if (e.type === 'exploder') { G.rings.push({ x: e.x, y: e.y, r: 5, max: 70, life: .3 }); }
  if (big) G.freeze = .07;
  if (e.type === 'elite') { for (let i = 0; i < 5; i++) dropCoin(e.x, e.y, 3 * G.goldMul); G.chest.push({ x: e.x, y: e.y }); shake = 8; say('ELITE SLAIN - take the chest!', '#ffd166'); }
  if (e.type === 'boss') { G.bossKills++; for (let i = 0; i < 14; i++) dropCoin(e.x, e.y, 5 * G.goldMul); G.chest.push({ x: e.x - 30, y: e.y }); G.chest.push({ x: e.x + 30, y: e.y }); G.bossAlive = false; G.p.hp = Math.min(G.p.max, G.p.hp + 40); shake = 18; say('BOSS DEFEATED!', '#ff2e63', 2); }
  if (e.type === 'titan') {
    G.bossAlive = false; G.won = true; G.eb.length = 0; shake = 30; sfx.win();
    for (const o of G.en) if (!o.dead && o !== e) o.dead = true;
    for (let i = 0; i < 30; i++) dropCoin(e.x, e.y, 8 * G.goldMul);
    save.wins++; if (!save.nm) { save.nm = 1; toast = { s: 'Nightmare mode unlocked!', t: 3 }; }
    bank(); state = 'win';
  }
}
function hurtPlayer(d) {
  const p = G.p; if (p.inv > 0 || state !== 'play') return;
  p.hp -= d; p.inv = .5; shake = Math.max(shake, 8); sfx.hurt(); G.combo = Math.floor(G.combo / 2);
  burst(p.x, p.y, '#ff6b6b', 14);
  if (p.hp <= 0) {
    if (G.revives > 0) { G.revives--; reviveNow(.5); say('SECOND WIND!', '#5eead4'); }
    else { state = 'over'; bank(); }
  }
}
function ebullet(x, y, a, sp, dmg, r = 6) { G.eb.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg, life: 5, r }); }

function update(dt) {
  const p = G.p, w = G.w;
  G.t += dt; p.inv -= dt; G.dashT -= dt; G.dash -= dt;
  G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  G.achT -= dt; if (G.achT <= 0) { G.achT = 1; checkAch(); }
  // movement
  const gp = pad();
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + gp.x;
  let iy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + gp.y;
  const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
  if (m > .1) p.face = Math.atan2(iy, ix);
  if (G.dash > 0) { p.x += Math.cos(p.face) * 850 * dt; p.y += Math.sin(p.face) * 850 * dt; }
  else { p.x += ix * p.spd * dt; p.y += iy * p.spd * dt; }
  G.cam.x += (p.x - G.cam.x) * Math.min(1, dt * 9); G.cam.y += (p.y - G.cam.y) * Math.min(1, dt * 9);
  if (w.regen) { p.regenT += dt; if (p.regenT >= 1) { p.regenT = 0; p.hp = Math.min(p.max, p.hp + w.regen); } }

  // spawning
  G.spawn -= dt;
  const titanAlive = G.en.some(e => e.type === 'titan');
  const interval = Math.max(TUNE.spawnMin, .6 - G.t / 150) * (titanAlive ? 2.5 : 1) * (G.nm ? .8 : 1);
  const per = 1 + Math.floor(G.t / 200);
  while (G.spawn <= 0 && G.en.length < 420) { G.spawn += interval; for (let k = 0; k < per; k++) spawnEnemy(pickType()); }
  if (G.t >= G.nextHorde) {
    G.nextHorde += 50; say('!! HORDE INCOMING !!', '#ff6b6b', 2); sfx.boss();
    for (let i = 0; i < 36; i++) { const a = i / 36 * 6.28; spawnEnemy(rand() < .2 ? pickType() : 'grunt', p.x + Math.cos(a) * 620, p.y + Math.sin(a) * 620); }
  }
  if (G.t >= G.nextBats && G.t > 30) {
    G.nextBats += 28; say('Bat swarm!', '#b8b8ff', 1.4);
    const a = rnd(0, 6.28), n = 10 + Math.floor(G.t / 40);
    for (let i = 0; i < n; i++) spawnEnemy('bat', p.x + Math.cos(a) * 700 + vr(-60, 60), p.y + Math.sin(a) * 700 + vr(-60, 60));
  }
  if (G.t >= G.nextElite) { G.nextElite += 40; spawnEnemy('elite'); say('An ELITE approaches...', '#ffd166'); }
  if (G.t >= G.nextBoss) {
    G.nextBoss += 75;
    if (!(G.t > TUNE.titanTime - 60 && !G.won)) { spawnEnemy('boss'); G.bossAlive = true; sfx.boss(); shake = 10; say('!! BOSS !!', '#ff2e63', 2); }
  }
  if (G.t >= TUNE.titanTime && !G.titanSpawned && !G.won) {
    G.titanSpawned = true; spawnEnemy('titan'); G.bossAlive = true; sfx.boss(); shake = 20; say('THE VOID TITAN AWAKENS', '#b14dff', 3.5);
  }

  // enemies
  for (const e of G.en) {
    if (e.dead) continue;
    const ang = Math.atan2(p.y - e.y, p.x - e.x), d = dist(e, p);
    let mv = ang, sp = e.spd;
    if (e.type === 'bat') mv = ang + Math.sin(G.t * 6 + e.ph) * 1.0;
    else if (e.type === 'shooter') {
      if (d < 260) mv = ang + Math.PI; else if (d < 380) sp = 0;
      e.atk -= dt; if (e.atk <= 0 && d < 700) { e.atk = 2.2; ebullet(e.x, e.y, ang, 250, e.dmg * .8); }
    } else if (e.type === 'exploder') {
      if (d < e.r + p.r + 34 || e.fuse > 0) {
        e.fuse += dt; sp = 0;
        if (e.fuse > .45) { e.dead = true; G.rings.push({ x: e.x, y: e.y, r: 5, max: 95, life: .3 }); burst(e.x, e.y, '#ff5d1f', 22, 220); sfx.boom(); if (dist(e, p) < 95 + p.r) hurtPlayer(e.dmg * 1.6); continue; }
      }
    } else if (e.type === 'boss' || e.type === 'titan') {
      const ti = e.type === 'titan';
      e.atk -= dt; if (e.atk <= 0) { e.atk = ti ? 1.8 : 3; const n = ti ? 22 : 12, off = rnd(0, 6.28); for (let k = 0; k < n; k++) ebullet(e.x, e.y, off + k / n * 6.28, ti ? 240 : 220, e.dmg * (ti ? .45 : .4), 7); sfx.boom(); }
      if (ti) {
        e.sp -= dt; if (e.sp <= 0) { e.sp = .17; e.spin += .47; ebullet(e.x, e.y, e.spin, 290, e.dmg * .35, 6); }
        e.sum -= dt; if (e.sum <= 0) { e.sum = 6; for (let k = 0; k < 4; k++) spawnEnemy('exploder', e.x + vr(-80, 80), e.y + vr(-80, 80)); }
      }
    }
    e.x += Math.cos(mv) * sp * dt; e.y += Math.sin(mv) * sp * dt;
    e.flash -= dt;
  }
  const en = G.en;
  for (let i = 0; i < en.length; i++) {
    const a = en[i]; if (a.dead) continue;
    for (let j = i + 1; j < en.length; j++) {
      const b = en[j]; if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > 70 || Math.abs(dy) > 70) continue;
      const d = Math.hypot(dx, dy), min = (a.r + b.r) * .8;
      if (d > 0 && d < min) { const f = (min - d) / d * .5; a.x -= dx * f; a.y -= dy * f; b.x += dx * f; b.y += dy * f; }
    }
    if (a.type !== 'exploder' && dist(a, p) < a.r + p.r) hurtPlayer(a.dmg);
  }
  // enemy bullets
  for (const b of G.eb) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r) { hurtPlayer(b.dmg); b.life = 0; }
  }
  G.eb = G.eb.filter(b => b.life > 0);

  // --- weapons ---
  G.cd -= dt;
  if (G.cd <= 0) {
    const tgt = nearest(720);
    if (tgt) {
      const base = Math.atan2(tgt.y - p.y, tgt.x - p.x), n = w.multi, spread = .16;
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * spread, crit = rand() < w.crit;
        G.bul.push({ x: p.x, y: p.y, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, life: 1, pierce: w.pierce, hit: new Set(), dmg: w.dmg * (crit ? 2 : 1), crit });
      }
      sfx.shoot(); G.cd = 1 / w.rate;
    } else G.cd = .08;
  }
  for (const b of G.bul) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const e of G.en) {
      if (e.dead || b.hit.has(e) || b.life <= 0) continue;
      if (Math.abs(e.x - b.x) > e.r + 8 || Math.abs(e.y - b.y) > e.r + 8) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 6) {
        b.hit.add(e); damageEnemy(e, b.dmg, b.crit); sfx.hit();
        if (b.pierce-- <= 0) b.life = 0;
      }
    }
  }
  if (w.blades) {
    w.bladeA += dt * 4;
    for (let i = 0; i < w.blades; i++) {
      const a = w.bladeA + i * Math.PI * 2 / w.blades, bx = p.x + Math.cos(a) * w.bladeR, by = p.y + Math.sin(a) * w.bladeR;
      for (const e of G.en) {
        if (e.dead || (e.bt || 0) > G.t) continue;
        if (Math.hypot(e.x - bx, e.y - by) < e.r + 13) { damageEnemy(e, w.dmg * .9); e.bt = G.t + .3; sfx.hit(); }
      }
    }
  }
  if (w.nova) {
    w.novaT -= dt;
    if (w.novaT <= 0) {
      w.novaT = Math.max(1.4, 3.6 - w.nova * .3);
      const Rr = 120 + w.nova * 38; G.rings.push({ x: p.x, y: p.y, r: 10, max: Rr, life: .4 });
      for (const e of G.en) if (!e.dead && dist(e, p) < Rr + e.r) damageEnemy(e, w.dmg * .9 + w.nova * 8);
      sfx.nova();
    }
  }
  if (w.light) {
    w.lightT -= dt;
    if (w.lightT <= 0) {
      w.lightT = Math.max(.3, 1.2 - w.light * .1);
      let cur = nearest(560);
      if (cur) {
        const seen = new Set(), pts = [{ x: p.x, y: p.y }], n = 2 + w.light + w.chainX;
        for (let i = 0; i < n && cur; i++) {
          seen.add(cur); pts.push({ x: cur.x, y: cur.y });
          damageEnemy(cur, w.dmg * (1 + .2 * w.light) * w.lightMul);
          let nx = null, bd = 260;
          for (const e of G.en) { if (e.dead || seen.has(e)) continue; const d = dist(e, cur); if (d < bd) { bd = d; nx = e; } }
          cur = nx;
        }
        G.arcs.push({ pts, life: .15 }); sfx.zap();
      }
    }
  }
  if (w.boom) {
    w.boomT -= dt;
    if (w.boomT <= 0) {
      w.boomT = 2.2; const n = 1 + Math.floor(w.boom / 2) + w.boomX, tgt = nearest(650), base = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : p.face;
      for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * .45; G.boomr.push({ x: p.x, y: p.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, t: 0, back: false, hit: new Set() }); }
    }
  }
  for (const b of G.boomr) {
    b.t += dt;
    if (!b.back && b.t > .7) { b.back = true; b.hit = new Set(); }
    if (b.back) { const a = Math.atan2(p.y - b.y, p.x - b.x); b.vx = Math.cos(a) * 620; b.vy = Math.sin(a) * 620; if (dist(b, p) < 26) b.done = true; }
    b.x += b.vx * dt; b.y += b.vy * dt; if (b.t > 4) b.done = true;
    for (const e of G.en) {
      if (e.dead || b.hit.has(e)) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 15) { b.hit.add(e); damageEnemy(e, w.dmg * 1.4 * w.boomMul); sfx.hit(); }
    }
  }
  G.boomr = G.boomr.filter(b => !b.done);
  if (w.missile) {
    w.missT -= dt;
    if (w.missT <= 0) { w.missT = 2.4; const n = Math.min(10, Math.ceil(w.missile * w.missMul)); for (let i = 0; i < n; i++) G.mis.push({ x: p.x, y: p.y, a: rnd(0, 6.28), life: 3, hit: false }); sfx.nova(); }
  }
  for (const m of G.mis) {
    m.life -= dt;
    const tgt = nearest(900, m);
    if (tgt) { const da = angDiff(Math.atan2(tgt.y - m.y, tgt.x - m.x), m.a); m.a += Math.max(-7 * dt, Math.min(7 * dt, da)); }
    m.x += Math.cos(m.a) * 380 * dt; m.y += Math.sin(m.a) * 380 * dt;
    if (G.en.some(e => !e.dead && Math.hypot(e.x - m.x, e.y - m.y) < e.r + 8)) {
      const rad = 75 * (w.missMul > 1 ? 1.4 : 1); G.rings.push({ x: m.x, y: m.y, r: 5, max: rad, life: .25 });
      for (const e of G.en) if (!e.dead && Math.hypot(e.x - m.x, e.y - m.y) < rad + e.r) damageEnemy(e, w.dmg * 2.2);
      m.life = 0; sfx.boom();
    }
  }
  G.mis = G.mis.filter(m => m.life > 0);
  if (w.flame) {
    const tgt = nearest(320), aim = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : p.face; w.aim = aim;
    w.flameT -= dt;
    if (w.flameT <= 0) {
      w.flameT = .1; const range = 140 + w.flame * 18;
      for (const e of G.en) {
        if (e.dead) continue; const d = dist(e, p); if (d > range + e.r) continue;
        if (Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), aim)) < .55) damageEnemy(e, w.dmg * .3 * w.flame * w.flameMul, false, true);
      }
      for (let i = 0; i < 4 && G.part.length < 500; i++) { const a = aim + vr(-.35, .35), s = vr(200, 380); G.part.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: vr(.2, .4), col: Math.random() < .5 ? '#ff7a1a' : '#ffd166' }); }
      G.flameSnd -= .1; if (G.flameSnd <= 0) { sfx.flame(); G.flameSnd = .3; }
    }
  }
  G.en = G.en.filter(e => !e.dead);
  G.bul = G.bul.filter(b => b.life > 0);

  // pickups
  for (const gm of G.gem) {
    const d = dist(gm, p);
    if (d < p.magnet || gm.fly) { gm.fly = true; const a = Math.atan2(p.y - gm.y, p.x - gm.x); gm.x += Math.cos(a) * 520 * dt; gm.y += Math.sin(a) * 520 * dt; }
    if (d < p.r + 9) { gm.got = true; G.xp += gm.v * G.xpMul; sfx.gem(); }
  }
  G.gem = G.gem.filter(x => !x.got);
  for (const c of G.coin) {
    const d = dist(c, p);
    if (d < p.magnet * 1.3 || c.fly) { c.fly = true; const a = Math.atan2(p.y - c.y, p.x - c.x); c.x += Math.cos(a) * 520 * dt; c.y += Math.sin(a) * 520 * dt; }
    if (d < p.r + 10) { c.got = true; G.gold += c.v; sfx.coin(); floatText(p.x, p.y - 20, '+' + Math.max(1, Math.round(c.v)), '#ffd166', 14); }
  }
  G.coin = G.coin.filter(x => !x.got);
  for (const c of G.chest) if (dist(c, p) < p.r + 22) { c.got = true; sfx.level(); say('CHEST! Free upgrade', '#ffd166'); G.xp += G.need; }
  G.chest = G.chest.filter(x => !x.got);
  if (state === 'play') levelCheck();

  // effects
  for (const q of G.part) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= .94; q.vy *= .94; q.life -= dt; }
  G.part = G.part.filter(q => q.life > 0);
  for (const t of G.txt) { t.y -= 40 * dt; t.life -= dt; }
  G.txt = G.txt.filter(t => t.life > 0);
  for (const r of G.rings) { if (!r.l0) r.l0 = r.life; r.life -= dt; r.r = r.max * (1 - Math.max(0, r.life) / r.l0); }
  G.rings = G.rings.filter(r => r.life > 0);
  for (const a of G.arcs) a.life -= dt;
  G.arcs = G.arcs.filter(a => a.life > 0);
  shake = Math.max(0, shake - dt * 30);
}

// ---------- rendering ----------
function text(s, x, y, size, col = '#fff', align = 'center', bold = true) {
  g.font = (bold ? 'bold ' : '') + size + 'px system-ui, sans-serif'; g.fillStyle = col; g.textAlign = align; g.fillText(s, x, y);
}
function circle(x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); }
function poly(x, y, r, n, rot, col) { g.fillStyle = col; g.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * 6.2832; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); }
function button(r, label, col = '#6c63ff', sub, labelCol = '#fff') {
  const hov = inR(r);
  g.fillStyle = hov ? '#2a2a55' : '#1a1a38'; g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeStyle = hov ? '#ffe66d' : col; g.lineWidth = 3; g.strokeRect(r.x, r.y, r.w, r.h);
  text(label, r.x + r.w / 2, r.y + r.h / 2 + (sub ? -2 : 7), r.h < 50 ? 18 : 22, labelCol);
  if (sub) text(sub, r.x + r.w / 2, r.y + r.h / 2 + 20, 14, '#9ab', 'center', false);
}
function drawEnemy(e, pl) {
  const col = e.flash > 0 ? '#fff' : e.col, a = Math.atan2(pl.y - e.y, pl.x - e.x);
  switch (e.type) {
    case 'runner': poly(e.x, e.y, e.r * 1.4, 3, a, col); break;
    case 'brute': poly(e.x, e.y, e.r * 1.15, 4, .785, col); circle(e.x, e.y, e.r * .5, 'rgba(0,0,0,.4)'); break;
    case 'shooter': poly(e.x, e.y, e.r * 1.3, 4, 0, col); circle(e.x, e.y, e.r * .45, '#0b3'); break;
    case 'exploder': { const f = e.fuse > 0 && Math.floor(e.fuse * 20) % 2; circle(e.x, e.y, e.r * (1 + e.fuse * .8), f ? '#fff' : col); poly(e.x, e.y, e.r * 1.5, 8, G.t * 3, 'rgba(255,200,0,.35)'); break; }
    case 'bat': poly(e.x, e.y, e.r * 1.5, 3, a + 3.14, col); break;
    case 'elite': poly(e.x, e.y, e.r * 1.2, 6, G.t * 2, col); circle(e.x, e.y, e.r * .6, 'rgba(0,0,0,.35)'); break;
    case 'boss': poly(e.x, e.y, e.r * 1.2, 8, G.t, col); circle(e.x, e.y, e.r * .6, 'rgba(0,0,0,.4)'); circle(e.x, e.y, e.r * .25, '#fff'); break;
    case 'titan': poly(e.x, e.y, e.r * 1.25, 12, -G.t * .6, col); poly(e.x, e.y, e.r * .9, 6, G.t * .9, 'rgba(255,255,255,.18)'); circle(e.x, e.y, e.r * .5, 'rgba(0,0,0,.5)'); circle(e.x, e.y, e.r * .2, '#ff2e63'); break;
    default: circle(e.x, e.y, e.r, col); circle(e.x, e.y, e.r * .55, 'rgba(0,0,0,.35)');
  }
}
function drawWorld() {
  const cam = G.cam, pal = PALETTES[Math.floor(G.t / 300) % PALETTES.length], sk = save.settings.shake ? shake : 0;
  const ox = W / 2 - cam.x + (sk ? vr(-sk, sk) : 0), oy = H / 2 - cam.y + (sk ? vr(-sk, sk) : 0);
  g.fillStyle = pal[0]; g.fillRect(0, 0, W, H);
  g.strokeStyle = pal[1]; g.lineWidth = 1; g.beginPath();
  const gs = 80, sx = -((cam.x - W / 2) % gs), sy = -((cam.y - H / 2) % gs);
  for (let x = sx; x < W; x += gs) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = sy; y < H; y += gs) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();
  g.save(); g.translate(ox, oy);
  const p = G.p;
  for (const r of G.rings) { g.strokeStyle = `rgba(120,200,255,${Math.max(0, r.life) / .4})`; g.lineWidth = 6; g.beginPath(); g.arc(r.x, r.y, Math.max(1, r.r), 0, 6.2832); g.stroke(); }
  for (const gm of G.gem) { g.save(); g.translate(gm.x, gm.y); g.rotate(.785); g.fillStyle = '#4cc9f0'; g.fillRect(-5, -5, 10, 10); g.restore(); }
  for (const c of G.coin) { circle(c.x, c.y, 7, '#ffd166'); circle(c.x, c.y, 4, '#e09f1f'); }
  for (const c of G.chest) { g.fillStyle = '#c98a1b'; g.fillRect(c.x - 16, c.y - 12, 32, 24); g.fillStyle = '#ffd166'; g.fillRect(c.x - 16, c.y - 4, 32, 6); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(c.x - 16, c.y - 12, 32, 24); }
  for (const e of G.en) {
    drawEnemy(e, p);
    if (e.type === 'boss' || e.type === 'elite' || e.type === 'titan') { const bw = Math.min(160, e.r * 2.2); g.fillStyle = '#000'; g.fillRect(e.x - bw / 2, e.y - e.r - 16, bw, 7); g.fillStyle = e.col; g.fillRect(e.x - bw / 2, e.y - e.r - 16, bw * Math.max(0, e.hp / e.max), 7); }
  }
  for (const b of G.eb) { circle(b.x, b.y, b.r, '#ff4d6d'); circle(b.x, b.y, b.r * .5, '#fff'); }
  g.lineCap = 'round';
  for (const b of G.bul) { g.strokeStyle = b.crit ? '#ff9f43' : '#ffe66d'; g.lineWidth = b.crit ? 6 : 4; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * .025, b.y - b.vy * .025); g.stroke(); }
  for (const b of G.boomr) { g.save(); g.translate(b.x, b.y); g.rotate(G.t * 14); g.fillStyle = '#c7f9ff'; g.fillRect(-14, -4, 28, 8); g.fillRect(-4, -14, 8, 28); g.restore(); }
  for (const m of G.mis) { g.save(); g.translate(m.x, m.y); g.rotate(m.a); g.fillStyle = '#ff9f43'; g.fillRect(-9, -3, 18, 6); g.fillStyle = '#fff'; g.fillRect(5, -2, 5, 4); g.restore(); }
  for (const a of G.arcs) { g.strokeStyle = `rgba(160,220,255,${a.life / .15})`; g.lineWidth = 4; g.beginPath(); a.pts.forEach((q, i) => { const jx = i ? vr(-8, 8) : 0, jy = i ? vr(-8, 8) : 0; g[i ? 'lineTo' : 'moveTo'](q.x + jx, q.y + jy); }); g.stroke(); }
  for (let i = 0; i < G.w.blades; i++) { const a = G.w.bladeA + i * Math.PI * 2 / G.w.blades; circle(p.x + Math.cos(a) * G.w.bladeR, p.y + Math.sin(a) * G.w.bladeR, 12, '#c7f9ff'); }
  if (state !== 'over') {
    const blink = p.inv > 0 && Math.floor(G.t * 20) % 2;
    if (!blink) {
      if (G.dash > 0) circle(p.x, p.y, p.r * 1.8, 'rgba(94,234,212,.3)');
      circle(p.x, p.y, p.r, '#5eead4'); circle(p.x, p.y, p.r * .55, '#0f766e');
      g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x + Math.cos(p.face) * p.r * .8, p.y + Math.sin(p.face) * p.r * .8, 4, 0, 6.2832); g.fill();
    }
  }
  for (const q of G.part) { g.globalAlpha = Math.min(1, q.life * 3); circle(q.x, q.y, 3, q.col); }
  g.globalAlpha = 1;
  for (const t of G.txt) { g.globalAlpha = Math.min(1, t.life * 3); text(t.s, t.x, t.y, t.size, t.col); }
  g.globalAlpha = 1;
  g.restore();
}
function drawHUD() {
  const p = G.p;
  g.fillStyle = '#000a'; g.fillRect(0, 0, W, 22);
  g.fillStyle = '#4cc9f0'; g.fillRect(0, 0, W * Math.min(1, G.xp / G.need), 22);
  text('LV ' + G.lvl, W / 2, 17, 15, '#fff');
  g.fillStyle = '#000a'; g.fillRect(20, 36, 260, 22);
  g.fillStyle = p.hp / p.max > .3 ? '#ef476f' : '#ff0044'; g.fillRect(20, 36, 260 * Math.max(0, p.hp / p.max), 22);
  text(Math.ceil(Math.max(0, p.hp)) + ' / ' + Math.round(p.max), 150, 53, 14);
  g.fillStyle = '#000a'; g.fillRect(20, 64, 260, 8);
  g.fillStyle = G.dashT <= 0 ? '#5eead4' : '#2b6f68'; g.fillRect(20, 64, 260 * (G.dashT <= 0 ? 1 : 1 - G.dashT / G.w.dashCd), 8);
  text('SPACE: dash' + (G.nm ? '   ☠ NIGHTMARE' : '') + (G.daily ? '   ★ DAILY' : ''), 20, 90, 12, G.nm ? '#ff6b6b' : '#889', 'left', false);
  text(fmt(G.t), W / 2, 62, 34);
  if (!G.won && G.t < TUNE.titanTime) text('Void Titan in ' + fmt(TUNE.titanTime - G.t), W / 2, 84, 13, '#b14dff', 'center', false);
  text('Kills ' + G.kills, W - 24, 56, 20, '#fff', 'right');
  text('Gold ' + Math.floor(G.gold), W - 24, 82, 18, '#ffd166', 'right');
  if (G.combo >= 5) { text('x' + G.combo + ' COMBO', W - 24, 130, 26 + Math.min(14, G.combo / 8), G.combo >= 50 ? '#ff9f43' : '#fff', 'right'); g.fillStyle = '#ff9f43'; g.fillRect(W - 24 - 140 * Math.max(0, G.comboT / 2.5), 138, 140 * Math.max(0, G.comboT / 2.5), 4); }
  if (G.bossAlive) text('!! BOSS !!', W / 2, 104, 20, '#ff2e63');
  if (G.banner) { g.globalAlpha = Math.min(1, G.banner.t * 2); text(G.banner.s, W / 2, 170, 36, G.banner.col); g.globalAlpha = 1; }
  const wl = UPG.filter(u => G.lv[u.id]).map(u => u.n.split(' ')[0] + ' ' + G.lv[u.id]).join('  ·  ');
  if (wl) text(wl, 20, H - 14, 13, '#778', 'left', false);
  const ev = EVO.filter(e => G.evo[e.id]).map(e => e.n).join('  ');
  if (ev) text('★ ' + ev, 20, H - 34, 14, '#ffd166', 'left');
}
function drawLevelUp() {
  g.fillStyle = '#000b'; g.fillRect(0, 0, W, H);
  text('LEVEL UP!', W / 2, 150, 56, '#ffe66d');
  text('Choose an upgrade  (click or press 1 / 2 / 3)', W / 2, 190, 20, '#ccd');
  G.choices.forEach((c, i) => {
    const r = cardRect(i), hov = inR(r), ci = cardInfo(c);
    g.fillStyle = hov ? '#2a2a55' : '#1a1a38'; g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = hov ? '#fff' : ci.col; g.lineWidth = c.k === 'e' ? 6 : 3; g.strokeRect(r.x, r.y, r.w, r.h);
    text(String(i + 1), r.x + 28, r.y + 40, 26, '#ffe66d');
    text(ci.n, r.x + r.w / 2, r.y + 100, ci.n.length > 14 ? 22 : 26, c.k === 'e' ? '#ffd166' : '#fff');
    wrapText(ci.d, r.x + r.w / 2, r.y + 145, 17, '#ccd', 280);
    text(ci.sub, r.x + r.w / 2, r.y + 240, 16, c.k === 'e' ? '#ffd166' : '#4cc9f0');
  });
  if (!G.rerolled) button(R.reroll, '▶ Watch an ad to reroll (optional)', '#2b8a3e');
}
function wrapText(s, x, y, size, col, maxW) {
  g.font = size + 'px system-ui, sans-serif'; const words = s.split(' '); let line = '', yy = y;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { text(line, x, yy, size, col, 'center', false); line = w; yy += size + 4; } else line = t; }
  if (line) text(line, x, yy, size, col, 'center', false);
}
function drawBackdrop(t) {
  g.fillStyle = '#0a0a18'; g.fillRect(0, 0, W, H);
  for (const s of stars) { g.globalAlpha = s.a * (.6 + .4 * Math.sin(t / 700 + s.x)); g.fillStyle = '#fff'; g.fillRect((s.x + t * .01 * s.s) % W, s.y, s.s, s.s); }
  g.globalAlpha = 1;
}
function affordable() { return META.find(m => save.meta[m.k] < m.max && save.gold >= m.cost(save.meta[m.k])); }
function renderMenu(ts) {
  text('VOIDSWARM', W / 2, 150, 100, '#5eead4');
  text('Survive 15 minutes. Slay the Void Titan.', W / 2, 190, 22, '#ccd', 'center', false);
  text('Gold: ' + save.gold, W / 2, 232, 22, '#ffd166');
  const c = curChar(), un = save.chars[c.id];
  g.fillStyle = '#1a1a38'; g.fillRect(R.charBox.x, R.charBox.y, R.charBox.w, R.charBox.h);
  g.strokeStyle = un ? '#5eead4' : '#ffd166'; g.lineWidth = 3; g.strokeRect(R.charBox.x, R.charBox.y, R.charBox.w, R.charBox.h);
  text('◀', R.charL.x + 30, R.charL.y + 62, 40, inR(R.charL) ? '#ffe66d' : '#aab'); text('▶', R.charR.x + 30, R.charR.y + 62, 40, inR(R.charR) ? '#ffe66d' : '#aab');
  text(c.n, W / 2, 285, 32, un ? '#fff' : '#ffd166');
  text(c.d, W / 2, 315, 16, '#9ab', 'center', false);
  text(un ? 'Unlocked' : 'LOCKED - click or press U to unlock for ' + c.cost + ' gold', W / 2, 336, 14, un ? '#5eead4' : '#ffd166', 'center', false);
  button(R.start, un ? 'PLAY  (Enter)' : 'UNLOCK ' + c.n + ' (' + c.cost + ' gold)', un ? '#5eead4' : '#ffd166');
  const a = affordable();
  button(R.shop, 'UPGRADES (S)' + (a ? ' ★' : ''), a ? '#ffd166' : '#6c63ff');
  const na = Object.keys(save.ach).length;
  button(R.achb, 'ACHIEVEMENTS (A)  ' + na + '/' + ACH.length);
  button(R.sett, 'SETTINGS (T)');
  button(R.daily, 'Daily: ' + (optDaily ? 'ON' : 'OFF') + ' (D)', optDaily ? '#5eead4' : '#6c63ff');
  button(R.nm, save.nm ? 'Nightmare: ' + (optNM ? 'ON' : 'OFF') + ' (N)  - harder, x1.5 gold' : 'Nightmare: LOCKED (beat the Void Titan)', optNM && save.nm ? '#ff6b6b' : '#444477');
  if (save.best.time) text('Best: ' + fmt(save.best.time) + '  ·  Most kills: ' + save.best.kills + '  ·  Runs: ' + save.runs + '  ·  Wins: ' + save.wins, W / 2, 625, 18, '#889');
  if (save.daily.date === today()) text('Today\'s daily best: ' + fmt(save.daily.time) + ' · ' + save.daily.kills + ' kills', W / 2, 650, 15, '#889', 'center', false);
  text('WASD / Arrows / Gamepad: move  ·  Space: dash  ·  Weapons fire automatically  ·  P / Esc: pause  ·  F11: fullscreen', W / 2, 695, 14, '#778', 'center', false);
  if (toast) text(toast.s, W / 2, 606, 18, '#5eead4');
}
function renderShop() {
  text('PERMANENT UPGRADES', W / 2, 60, 42, '#ffe66d');
  text('Gold: ' + save.gold, W / 2, 95, 24, '#ffd166');
  META.forEach((m, i) => {
    const r = rowRect(i), lv = save.meta[m.k], maxed = lv >= m.max, c = m.cost(lv), can = !maxed && save.gold >= c;
    g.fillStyle = inR(r) ? '#2a2a55' : '#1a1a38'; g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = can ? '#ffd166' : '#444477'; g.lineWidth = 3; g.strokeRect(r.x, r.y, r.w, r.h);
    text((i + 1) + '. ' + m.n, r.x + 20, r.y + 28, 22, '#fff', 'left');
    text(m.d, r.x + 20, r.y + 50, 14, '#9ab', 'left', false);
    for (let k = 0; k < m.max; k++) { g.fillStyle = k < lv ? '#5eead4' : '#333355'; g.fillRect(r.x + 380 + k * 18, r.y + 22, 14, 16); }
    text(maxed ? 'MAXED' : c + ' gold', r.x + r.w - 20, r.y + 38, 20, maxed ? '#5eead4' : can ? '#ffd166' : '#777', 'right');
  });
  button(R.back, 'BACK (Esc)');
  if (toast) text(toast.s, W / 2, 635, 20, '#5eead4');
}
function renderAch() {
  text('ACHIEVEMENTS', W / 2, 70, 44, '#ffe66d');
  ACH.forEach((a, i) => {
    const x = 160 + (i % 2) * 500, y = 120 + Math.floor(i / 2) * 90, got = save.ach[a.id];
    g.fillStyle = '#1a1a38'; g.fillRect(x, y, 460, 76); g.strokeStyle = got ? '#5eead4' : '#444477'; g.lineWidth = 3; g.strokeRect(x, y, 460, 76);
    text((got ? '✔ ' : '') + a.n, x + 16, y + 30, 22, got ? '#5eead4' : '#fff', 'left');
    text(a.d + (a.gold ? '  (+' + a.gold + ' gold)' : ''), x + 16, y + 56, 15, '#9ab', 'left', false);
  });
  button(R.back, 'BACK (Esc)');
}
function renderSettings() {
  text('SETTINGS', W / 2, 90, 48, '#ffe66d');
  const s = save.settings, rows = [['Volume', Math.round(s.vol * 100) + '%   (click to change, ←/→)'], ['Music', s.music ? 'ON' : 'OFF'], ['Screen shake', s.shake ? 'ON' : 'OFF'], ['Fullscreen (F11)', 'click to toggle']];
  rows.forEach((rw, i) => {
    const r = setRect(i); g.fillStyle = inR(r) ? '#2a2a55' : '#1a1a38'; g.fillRect(r.x, r.y, r.w, r.h); g.strokeStyle = '#6c63ff'; g.lineWidth = 3; g.strokeRect(r.x, r.y, r.w, r.h);
    text((i + 1) + '. ' + rw[0], r.x + 20, r.y + 40, 24, '#fff', 'left'); text(rw[1], r.x + r.w - 20, r.y + 40, 20, '#5eead4', 'right');
  });
  button(R.back, 'BACK (Esc)');
}
function render(ts) {
  g.clearRect(0, 0, W, H);
  if (state === 'menu' || state === 'shop' || state === 'ach' || state === 'settings') {
    drawBackdrop(ts);
    if (state === 'menu') renderMenu(ts); else if (state === 'shop') renderShop(); else if (state === 'ach') renderAch(); else renderSettings();
  } else {
    drawWorld(); drawHUD();
    if (state === 'levelup') drawLevelUp();
    if (state === 'paused') { g.fillStyle = '#000b'; g.fillRect(0, 0, W, H); text('PAUSED', W / 2, 330, 64); text('Press P / Esc or click to resume', W / 2, 380, 22, '#ccd', 'center', false); button(R.quit, 'Quit run (Q)', '#ef476f'); }
    if (state === 'ad') { g.fillStyle = '#000b'; g.fillRect(0, 0, W, H); text('Ad playing...', W / 2, H / 2, 40, '#ccd'); }
    if (state === 'win') {
      g.fillStyle = '#000d'; g.fillRect(0, 0, W, H);
      text('VICTORY!', W / 2, 150, 90, '#ffd166');
      text('The Void Titan has fallen.', W / 2, 210, 28, '#b14dff');
      text('Time ' + fmt(G.t) + '  ·  ' + G.kills + ' kills  ·  Level ' + G.lvl, W / 2, 270, 24);
      text('+' + G.earned + ' gold banked', W / 2, 330, 40, '#ffd166');
      text(save.nm ? 'Nightmare mode unlocked (toggle it on the main menu)' : '', W / 2, 380, 20, '#ff6b6b');
      button(R.cont, 'CONTINUE IN ENDLESS MODE (Enter)', '#5eead4'); button(R.menu, 'MENU / SHOP', '#6c63ff');
    }
    if (state === 'over') {
      g.fillStyle = '#000d'; g.fillRect(0, 0, W, H);
      text('YOU DIED', W / 2, 130, 72, '#ef476f');
      text('Survived ' + fmt(G.t) + '  ·  ' + G.kills + ' kills  ·  Level ' + G.lvl + '  ·  Best combo x' + G.bestCombo, W / 2, 190, 24);
      text('+' + G.earned + ' gold banked' + (G.doubled ? '  (x2!)' : ''), W / 2, 250, 40, '#ffd166');
      text('Total gold: ' + save.gold, W / 2, 290, 22, '#ffd166', 'center', false);
      const a = affordable();
      if (a) text('★ You can afford "' + a.n + '" in the upgrade shop!', W / 2, 340, 22, '#5eead4');
      else { const next = META.filter(m => save.meta[m.k] < m.max).map(m => m.cost(save.meta[m.k])).sort((x, y) => x - y)[0]; if (next) text(Math.max(0, next - save.gold) + ' more gold for your next upgrade', W / 2, 340, 20, '#889'); }
      text('Best: ' + fmt(save.best.time) + '  ·  Most kills: ' + save.best.kills, W / 2, 380, 18, '#889', 'center', false);
      if (!G.adRevived) button(R.revive, '▶ Watch an ad to revive (optional)', '#2b8a3e');
      if (!G.doubled) button(R.dbl, '▶ Watch an ad for DOUBLE gold (optional)', '#2b8a3e');
      button(R.again, 'PLAY AGAIN (Enter)', '#5eead4'); button(R.menu, 'MENU / SHOP', '#6c63ff');
    }
  }
  pops.forEach((p, i) => { g.globalAlpha = Math.min(1, p.t); g.fillStyle = '#000c'; g.fillRect(W / 2 - 280, 700 - i * 40 - 30, 560, 32); text(p.s, W / 2, 700 - i * 40 - 8, 18, '#ffd166'); g.globalAlpha = 1; });
}

function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  if (toast) { toast.t -= dt; if (toast.t <= 0) toast = null; }
  for (const p of pops) p.t -= dt; pops = pops.filter(p => p.t > 0);
  if (state === 'play') { if (G.freeze > 0) G.freeze -= dt; else update(dt); }
  else pad();
  music(dt);
  render(ts);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
