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
const save = Object.assign({ gold: 0, best: { time: 0, kills: 0 }, runs: 0, meta: {}, ach: {}, chars: { ranger: 1 }, char: 'ranger', nm: 0, wins: 0, daily: { date: '', time: 0, kills: 0 }, settings: {}, heatMax: 0, heatSel: 0, codex: {}, curses: [], hof: [] }, store('vs_save') || {});
save.settings = Object.assign({ vol: .7, music: true, shake: true, gfx: (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ? 0 : 1, mini: 1, dnum: 1 }, save.settings);
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
  shoot: () => snd(520, .05, 'square', .012, -200), hit: () => snd(160 + Math.random() * 60, .04, 'sawtooth', .015, -80),
  kill: () => snd(260 + Math.random() * 140, .08, 'triangle', .03, -200), gem: () => snd(900, .04, 'sine', .02, 300),
  coin: () => snd(1200, .08, 'sine', .035, 400), hurt: () => snd(120, .25, 'sawtooth', .07, -70),
  level: () => { snd(440, .12, 'triangle', .06); setTimeout(() => snd(660, .12, 'triangle', .06), 90); setTimeout(() => snd(880, .2, 'triangle', .06), 180); },
  nova: () => snd(200, .3, 'sine', .07, 300), boss: () => snd(70, .8, 'sawtooth', .08, 30),
  dash: () => snd(300, .12, 'sine', .05, 500), zap: () => snd(900, .1, 'sawtooth', .03, -600),
  boom: () => { snd(110, .25, 'sawtooth', .06, -60); noiseHit(.3, .08, 80, 1800); }, flame: () => snd(140, .05, 'sawtooth', .01),
  combo: () => { snd(700, .08, 'square', .05); setTimeout(() => snd(1000, .15, 'square', .05), 70); },
  buy: () => { snd(600, .1, 'triangle', .06); setTimeout(() => snd(900, .15, 'triangle', .06), 80); },
  ach: () => { snd(660, .1, 'triangle', .06); setTimeout(() => snd(990, .1, 'triangle', .06), 100); setTimeout(() => snd(1320, .25, 'triangle', .06), 200); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => snd(f, .3, 'triangle', .07), i * 160)); },
};
let musT = 0, musI = 0;
const BASS = [0, 0, 7, 0, 5, 5, 3, 5];
let noiseBuf = null, musStep = 0;
function noiseBuffer() { const A = ac(); if (!noiseBuf) { noiseBuf = A.createBuffer(1, Math.floor(A.sampleRate * .5), A.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; }
function noiseHit(d = .1, v = .05, hp = 800, lp = 9000) {
  try {
    const A = ac(), t = A.currentTime, src = A.createBufferSource(), f1 = A.createBiquadFilter(), f2 = A.createBiquadFilter(), gn = A.createGain();
    src.buffer = noiseBuffer(); f1.type = 'highpass'; f1.frequency.value = hp; f2.type = 'lowpass'; f2.frequency.value = lp;
    gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(.001, t + d);
    src.connect(f1); f1.connect(f2); f2.connect(gn); gn.connect(master); src.start(t); src.stop(t + d);
  } catch (e) { }
}
function kick(v = .11) {
  try { const A = ac(), o = A.createOscillator(), gn = A.createGain(), t = A.currentTime; o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(.001, t + .22); o.connect(gn); gn.connect(master); o.start(t); o.stop(t + .24); } catch (e) { }
}
function bassNote(f, d, v = .05) {
  try { const A = ac(), o = A.createOscillator(), fl = A.createBiquadFilter(), gn = A.createGain(), t = A.currentTime; o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(180, t + d); gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(fl); fl.connect(gn); gn.connect(master); o.start(t); o.stop(t + d + .02); } catch (e) { }
}
function music(dt) {
  if (!save.settings.music || (state !== 'play' && state !== 'levelup')) return;
  musT -= dt; if (musT > 0) return;
  const t = G ? G.t : 0, boss = !!(G && G.bossAlive), bpm = Math.min(158, 112 + t / 22 + (boss ? 10 : 0)), st = 60 / bpm / 4; musT = st;
  const s = musStep++, bar = Math.floor(s / 16), beat = s % 16, root = [0, 0, 5, 7][bar % 4], f0 = 55 * Math.pow(2, root / 12);
  if (beat % 4 === 0) kick(beat === 0 ? .12 : .09);
  if (beat === 4 || beat === 12) noiseHit(.14, .045, 1500, 8000);
  if (beat % 2 === 0) noiseHit(.03, beat % 4 === 2 ? .022 : .013, 6500, 14000);
  if (t > 150 && beat % 4 === 3) noiseHit(.05, .013, 5000, 12000);
  if ([0, 3, 6, 8, 11, 14].includes(beat)) bassNote(f0 * (beat === 8 ? 1.5 : 1), st * 2.6, .05);
  if (beat === 0) for (const iv of [0, 3, 7]) snd(110 * Math.pow(2, (root + iv) / 12), st * 15, 'triangle', .014);
  if (t > 200 && beat % 2 === 1) snd(f0 * 8 * Math.pow(2, [0, 3, 7, 10][(beat >> 1) % 4] / 12), .1, 'square', .007);
  if (boss && beat % 4 === 2) snd(f0 * 4, st * 2, 'sawtooth', .011, -40);
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
  { id: 'drone', n: 'Combat Drones', d: 'Orbiting drones shoot nearby enemies', max: 6, f: w => w.drone++ },
  { id: 'mine', n: 'Proximity Mines', d: 'Drops mines that explode near enemies', max: 6, f: w => w.mine++ },
  { id: 'grav', n: 'Gravity Well', d: 'Pulls enemies together and crushes them', max: 6, f: w => w.grav++ },
  { id: 'rico', n: 'Ricochet Disc', d: 'A disc that bounces between enemies', max: 6, f: w => w.rico++ },
  { id: 'area', n: 'Wider Reach', d: '+15% area on pulses, mines, wells and missiles', max: 5, f: w => { w.area++; w.bladeR *= 1.1; } },
  { id: 'cdr', n: 'Overdrive', d: 'Special weapons recharge 12% faster', max: 5, f: w => w.cdr++ },
  { id: 'luck', n: 'Fortune', d: '+3% coin drops and richer coins', max: 5, f: w => w.luck++ },
  { id: 'armor', n: 'Plating', d: 'Take 8% less damage', max: 5, f: w => w.armor++ },
  { id: 'leech', n: 'Life Leech', d: '3% chance per kill to heal 1 HP', max: 5, f: w => w.leech++ },
  { id: 'burn', n: 'Ignite', d: 'Bolts set enemies on fire', max: 5, f: w => w.burn++ },
  { id: 'chill', n: 'Chill', d: 'Bolts slow enemies by 15%', max: 4, f: w => w.chill++ },
  { id: 'critd', n: 'Executioner', d: '+25% critical damage', max: 5, f: w => w.critD++ },
  { id: 'exec', n: 'Finisher', d: 'Badly hurt enemies die instantly', max: 4, f: w => w.exec++ },
];
const UI = {}; UPG.forEach((u, i) => UI[u.id] = i);
const EVO = [
  { id: 'storm', n: 'STORM BARRAGE', d: 'Bolts: +2 per volley, +30% fire rate', need: l => l.multi >= 3 && l.rate >= 3, f: w => { w.multi += 2; w.rate *= 1.3; } },
  { id: 'bloom', n: 'DEATH BLOSSOM', d: 'Blades: +3 blades, wider orbit', need: l => l.blades >= 3 && l.nova >= 3, f: w => { w.blades += 3; w.bladeR = 125; } },
  { id: 'tempest', n: 'TEMPEST', d: 'Lightning: +4 jumps, +60% damage', need: l => l.light >= 3 && l.crit >= 2, f: w => { w.chainX += 4; w.lightMul = 1.6; } },
  { id: 'inferno', n: 'INFERNO', d: 'Flamethrower deals double damage', need: l => l.flame >= 3 && l.vit >= 2, f: w => { w.flameMul = 2; } },
  { id: 'hunter', n: 'HUNTER SWARM', d: 'Missiles: double count, bigger blasts', need: l => l.missile >= 3 && l.pierce >= 2, f: w => { w.missMul = 2; } },
  { id: 'reaper', n: 'REAPER ARC', d: 'Boomerangs: +2 count, +60% damage', need: l => l.boom >= 3 && l.dmg >= 3, f: w => { w.boomX += 2; w.boomMul = 1.6; } },
  { id: 'swarmd', n: 'DRONE SWARM', d: 'Drones: +3 drones, they fire much faster', need: l => l.drone >= 3 && l.cdr >= 2, f: w => { w.droneX += 3; } },
  { id: 'minef', n: 'MINEFIELD', d: 'Mines chain-react and you can carry more', need: l => l.mine >= 3 && l.area >= 2, f: w => { w.mineX += 4; } },
  { id: 'singu', n: 'SINGULARITY', d: 'Gravity wells are huge and even drag bosses', need: l => l.grav >= 3 && l.area >= 2, f: w => { w.gravX = 1; } },
  { id: 'prism', n: 'PRISM DISC', d: 'Discs split in two on first hit, +3 bounces', need: l => l.rico >= 3 && l.pierce >= 2, f: w => { w.prism = 1; w.ricoX += 3; } },
  { id: 'plague', n: 'PLAGUE', d: 'Burning enemies spread fire when they die', need: l => l.burn >= 3 && l.chill >= 2, f: w => { w.plague = 1; } },
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
  { k: 'start', n: 'Head Start', d: 'Begin each run with a free random upgrade', max: 3, cost: l => 150 + l * 150 },
  { k: 'reroll', n: 'Free Rerolls', d: '+1 free level-up reroll per run (no ad)', max: 3, cost: l => 120 + l * 120 },
  { k: 'crit', n: 'Keen Eye', d: '+4% crit chance every run', max: 5, cost: l => 80 + l * 70 },
  { k: 'dash', n: 'Fleet Foot', d: 'Dash recharges 6% faster', max: 5, cost: l => 70 + l * 60 },
  { k: 'armor', n: 'Toughness', d: 'Take 4% less damage', max: 5, cost: l => 90 + l * 80 },
];
for (const m of META) save.meta[m.k] = save.meta[m.k] || 0;
const CHARS = [
  { id: 'ranger', n: 'Ranger', d: 'Balanced all-rounder.', cost: 0, start: [], hp: 1, rate: 1 },
  { id: 'mage', n: 'Stormcaller', d: 'Starts with Chain Lightning. Fragile (-20% HP).', cost: 350, start: ['light'], hp: .8, rate: 1 },
  { id: 'warden', n: 'Warden', d: 'Starts with 2 Blades, +40% HP, slower bolts.', cost: 700, start: ['blades', 'blades'], hp: 1.4, rate: .8 },
  { id: 'pyro', n: 'Pyromancer', d: 'Starts with the Flamethrower. Faster, -10% HP.', cost: 1200, start: ['flame'], hp: .9, rate: 1, spd: 1.1 },
  { id: 'hunter', n: 'Relic Hunter', d: 'Begins every run by choosing a relic. -10% HP.', cost: 900, start: [], hp: .9, rate: 1, relicStart: true },
  { id: 'jugg', n: 'Juggernaut', d: '+80% HP, starts with Shockwave + Vitality, slower.', cost: 1500, start: ['nova', 'vit'], hp: 1.8, rate: .9, spd: .85 },
  { id: 'blink', n: 'Voidwalker', d: 'Dash burns enemies you pass through. Quick Dash start.', cost: 1800, start: ['dashf'], hp: .85, rate: 1, spd: 1.05, trail: true },
  { id: 'eng', n: 'Engineer', d: 'Starts with Combat Drones and Mines. Fragile.', cost: 2200, start: ['drone', 'mine'], hp: .9, rate: 1 },
  { id: 'grav', n: 'Gravitonaut', d: 'Starts with a Gravity Well and Wider Reach.', cost: 2600, start: ['grav', 'area'], hp: 1, rate: .95 },
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
  goblin: { hp: 140, spd: 150, r: 14, dmg: 0, xp: 25, col: '#ffd166' },
  charger: { hp: 55, spd: 70, r: 15, dmg: 16, xp: 3, col: '#ff6b3d' },
  sniper: { hp: 28, spd: 55, r: 12, dmg: 22, xp: 4, col: '#7df9ff' },
  healer: { hp: 60, spd: 60, r: 14, dmg: 5, xp: 5, col: '#7dff9a' },
  warper: { hp: 36, spd: 100, r: 12, dmg: 14, xp: 3, col: '#c77dff' },
  swarmling: { hp: 5, spd: 210, r: 6, dmg: 4, xp: .5, col: '#ffb3c1' },
};
const BOSS_PATS = [
  { id: 'hive', n: 'Hive Queen', col: '#ffb347' }, { id: 'laser', n: 'Laser Warden', col: '#ff4d4d' },
  { id: 'warp', n: 'Warp Stalker', col: '#b98cff' }, { id: 'crush', n: 'The Crusher', col: '#ff7a45' },
];
const CURSES = [
  { id: 'frenzy', n: 'Frenzy', d: 'Enemies move 35% faster', bonus: .25 },
  { id: 'swarm', n: 'Swarm', d: 'Enemies spawn 60% faster', bonus: .30 },
  { id: 'fragile', n: 'Fragile', d: '-40% max HP', bonus: .25 },
  { id: 'dull', n: 'Dull Weapons', d: '-25% damage', bonus: .20 },
  { id: 'famine', n: 'Famine', d: 'No regeneration or healing drops', bonus: .15 },
  { id: 'hunt', n: 'Elite Hunt', d: 'Elites arrive every 18 seconds', bonus: .30 },
  { id: 'rush', n: 'Boss Rush', d: 'A boss every 40 seconds', bonus: .30 },
  { id: 'oneLife', n: 'One Life', d: 'No revives of any kind', bonus: .15 },
];
const CURSE_BY = {}; CURSES.forEach(c => CURSE_BY[c.id] = c);
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
  { id: 'ACH_R5', n: 'Relic Hoarder', d: 'Hold 5 relics in one run', chk: G => G.relics.length >= 5, gold: 80 },
  { id: 'ACH_H3', n: 'Feeling the Heat', d: 'Survive 5 min on Heat 3+', chk: G => G.heat >= 3 && G.t >= 300, gold: 100 },
  { id: 'ACH_H10', n: 'Inferno', d: 'Survive 5 min on Heat 10', chk: G => G.heat >= 10 && G.t >= 300, gold: 400 },
  { id: 'ACH_GOB', n: 'Goblin Hunter', d: 'Catch a Treasure Goblin', chk: G => G.goblins >= 1, gold: 50 },
  { id: 'ACH_GOB3', n: 'Gold Rush', d: 'Catch 3 goblins in one run', chk: G => G.goblins >= 3, gold: 120 },
  { id: 'ACH_CH', n: 'Champion Slayer', d: 'Slay 25 champions in one run', chk: G => G.champKills >= 25, gold: 100 },
  { id: 'ACH_MOON', n: 'Moonlit', d: 'Survive a Blood Moon', chk: G => G.moons >= 1, gold: 60 },
  { id: 'ACH_MET', n: 'Sky Dodger', d: 'Survive a meteor storm unhit', chk: G => G.clean >= 1, gold: 70 },
  { id: 'ACH_AFF', n: 'Affixed', d: 'Kill all 4 elite affixes in a run', chk: G => Object.keys(G.affKilled).length >= 4, gold: 90 },
  { id: 'ACH_CODEX', n: 'Collector', d: 'Discover every relic', chk: () => Object.keys(save.codex).length >= RELICS.length, gold: 300 },
  { id: 'ACH_TIER1', n: 'Beyond the Titan', d: 'Clear a Void Tier', chk: G => G.tiersCleared >= 1, gold: 200 },
  { id: 'ACH_TIER5', n: 'Void Walker', d: 'Clear 5 Void Tiers in a run', chk: G => G.tiersCleared >= 5, gold: 600 },
  { id: 'ACH_CURSE', n: 'Cursed', d: 'Survive 5 min with +100% curses', chk: G => G.curseMult >= 2 && G.t >= 300, gold: 250 },
  { id: 'ACH_H20', n: 'Apocalypse', d: 'Survive 7 min on Heat 20', chk: G => G.heat >= 20 && G.t >= 420, gold: 1000 },
];
// ---------- relics (run-defining passives) ----------
const RELICS = [
  { id: 'vampire', n: 'Vampiric Fang', d: '10% chance on kill to heal 2 HP', col: '#ff4d6d', f: G => { } },
  { id: 'chain', n: 'Chain Reaction', d: '22% of kills explode, hurting nearby enemies', col: '#ff9f43', f: G => { } },
  { id: 'midas', n: 'Midas Idol', d: '+50% gold and more coin drops', col: '#ffd166', f: G => { G.goldMul *= 1.5; } },
  { id: 'scholar', n: "Scholar's Tome", d: '+35% XP gain', col: '#4cc9f0', f: G => { G.xpMul *= 1.35; } },
  { id: 'wings', n: 'Winged Boots', d: '+15% move speed, dash recharges 25% faster', col: '#5eead4', f: G => { G.p.spd *= 1.15; G.w.dashCd *= .75; } },
  { id: 'aegis', n: 'Aegis Charm', d: 'Block one hit every 14 seconds', col: '#9ad1ff', f: G => { } },
  { id: 'overclock', n: 'Overclock Core', d: '+40% fire rate, -8% damage', col: '#c77dff', f: G => { G.w.rate *= 1.4; G.w.dmg *= .92; } },
  { id: 'glass', n: 'Glass Cannon', d: '+60% damage, -40% max HP', col: '#ff6b6b', f: G => { G.w.dmg *= 1.6; G.p.max = Math.round(G.p.max * .6); G.p.hp = Math.min(G.p.hp, G.p.max); } },
  { id: 'phoenix', n: 'Phoenix Feather', d: 'Gain a free revive', col: '#ff7a1a', f: G => { if (!G.cur.oneLife) G.revives++; } },
  { id: 'storm', n: 'Storm Caller', d: 'Lightning strikes a random enemy every 1.6s', col: '#a0e7ff', f: G => { } },
  { id: 'frost', n: 'Frost Aura', d: 'Enemies near you move 40% slower', col: '#9be7ff', f: G => { } },
  { id: 'thorns', n: 'Thorn Mail', d: 'Getting hit damages nearby enemies', col: '#7dff9a', f: G => { } },
  { id: 'berserk', n: 'Berserker Rage', d: 'Deal up to +90% damage as your HP drops', col: '#ff3b5c', f: G => { } },
  { id: 'trail', n: 'Blazing Dash', d: 'Your dash burns enemies you pass through', col: '#ff8a3d', f: G => { } },
  { id: 'echo', n: 'Echo Chamber', d: '15% chance a volley fires twice', col: '#9ad1ff', f: G => { } },
  { id: 'bounty', n: 'Bounty Hunter', d: 'Elites, bosses, champions and goblins drop extra gold', col: '#ffd166', f: G => { } },
  { id: 'magcore', n: 'Magnet Core', d: '+80% pickup range, gems heal a little', col: '#5eead4', f: G => { G.p.magnet *= 1.8; } },
  { id: 'timewarp', n: 'Time Warp', d: 'Enemies move 25% slower while you are below 35% HP', col: '#b8a1ff', f: G => { } },
  { id: 'ovc', n: 'Overcharge', d: 'Every 12th kill releases a damaging shockwave', col: '#ffe66d', f: G => { } },
  { id: 'lucky', n: 'Lucky Clover', d: 'Elite chests are much more likely to hold relics', col: '#7dff9a', f: G => { } },
];
const RELIC_BY = {}; RELICS.forEach(r => RELIC_BY[r.id] = r);
const AFFIX = { shield: { n: 'SHIELDED', col: '#7ad7ff' }, swift: { n: 'SWIFT', col: '#7dff9a' }, split: { n: 'SPLITTER', col: '#ffb36b' }, volatile: { n: 'VOLATILE', col: '#ff6b6b' } };
const AFF_IDS = Object.keys(AFFIX);
const PALETTES = [['#0a0a18', '#15152c'], ['#14091a', '#26123a'], ['#1a0a0a', '#341414'], ['#0a1a1a', '#143434'], ['#161608', '#323214']];

// ---------- state ----------
let state = 'menu', G = null, keys = {}, mouse = { x: 0, y: 0 }, shake = 0, last = 0, stars = [], toast = null, prevState = 'play', pops = [];
let hurtFlash = 0, levelFlash = 0, aiSpeed = 1, aiSkill = 1, aiWinT = 0;
let optDaily = false, optNM = false, optHeat = Math.min(save.heatSel || 0, save.heatMax || 0);
for (let i = 0; i < 90; i++) stars.push({ x: vr(0, W), y: vr(0, H), s: vr(.5, 2), a: vr(.2, .8) });
const curChar = () => CHARS.find(c => c.id === save.char) || CHARS[0];

function applyUpg(id) { const i = UI[id]; UPG[i].f(G.w, G.p); G.lv[id] = (G.lv[id] || 0) + 1; }
function newGame(ai = false) {
  const M = save.meta, ch = curChar();
  const nm = optNM && save.nm;
  seedRng = optDaily ? mulberry(parseInt(today().replace(/-/g, ''))) : null;
  const hp = Math.round((100 + 15 * M.vit) * ch.hp);
  G = {
    t: 0, kills: 0, lvl: 1, xp: 0, need: 4, cam: { x: 0, y: 0 }, nm, daily: optDaily,
    heat: optHeat, rel: {}, relics: [], relicOffer: false, aegisT: 0, stormT: 2, ev: { next: rnd(70, 95), kind: null, t: 0, dur: 0, mt: 0, hit: false }, meteors: [],
    goblins: 0, champKills: 0, moons: 0, clean: 0, affKilled: {}, chainD: 0,
    trail: [], mines: [], wells: [], discs: [], decals: [], intro: null, freeRerolls: 0, ai, assisted: false, aiS: { dir: { x: 1, y: 0 }, ang: 0, wander: 0, think: .3, goal: 'Starting up', wantDash: false, pickT: 0 }, cur: {}, curseMult: 1, tier: 0, nextTier: 0, tiersCleared: 0, bossN: 0, beams: [], zone: null, runId: Date.now() + Math.random(), score: 0, rank: 0, nextPack: 60,
    p: { x: 0, y: 0, r: 14, hp, max: hp, spd: 285 * (1 + .05 * M.spd) * (ch.spd || 1), magnet: 110 * (1 + .2 * M.mag), inv: 0, face: 0, regenT: 0 },
    w: { dmg: 11 * (1 + .1 * M.pow), rate: 2.2 * ch.rate, multi: 1, pierce: 0, blades: 0, bladeA: 0, bladeR: 85, nova: 0, novaT: 2, regen: 0, crit: 0, dashCd: 1.1,
      light: 0, lightT: 1, chainX: 0, lightMul: 1, boom: 0, boomT: 1, boomX: 0, boomMul: 1, missile: 0, missT: 1, missMul: 1, flame: 0, flameT: 0, flameMul: 1, aim: 0,
      drone: 0, droneT: 0, droneA: 0, droneX: 0, mine: 0, mineT: 1, mineX: 0, grav: 0, gravT: 2, gravX: 0, rico: 0, ricoT: 1, ricoX: 0, prism: 0, plague: 0,
      area: 0, cdr: 0, luck: 0, armor: 0, leech: 0, burn: 0, chill: 0, critD: 0, exec: 0 },
    goldMul: (1 + .15 * M.greed) * (nm ? 1.5 : 1) * (1 + .15 * optHeat), xpMul: 1 + .1 * M.wis, revives: M.rev,
    en: [], bul: [], eb: [], gem: [], coin: [], chest: [], part: [], txt: [], rings: [], arcs: [], boomr: [], mis: [], lv: {}, evo: {},
    cd: 0, spawn: 0, nextBoss: 75, nextElite: 35, nextHorde: 50, nextBats: 30, choices: [], bossAlive: false, titanSpawned: false, won: false,
    combo: 0, comboT: 0, bestCombo: 0, dash: 0, dashT: 0, gold: 0, banked: 0, earned: 0, bossKills: 0, evolved: 0,
    adRevived: false, doubled: false, rerolled: false, banner: null, freeze: 0, achT: 1, flameSnd: 0,
  };
  for (const id of save.curses) if (CURSE_BY[id]) { G.cur[id] = 1; G.curseMult += CURSE_BY[id].bonus; }
  if (G.cur.fragile) { G.p.max = Math.round(G.p.max * .6); G.p.hp = G.p.max; }
  if (G.cur.dull) G.w.dmg *= .75;
  if (G.cur.oneLife) G.revives = 0;
  for (const id of ch.start) applyUpg(id);
  if (ch.trail) G.rel.trail = 1;
  G.w.crit += .04 * (M.crit || 0); G.w.dashCd *= Math.pow(.94, M.dash || 0); G.freeRerolls = M.reroll || 0;
  for (let k = 0; k < (M.start || 0); k++) { const pool = UPG.filter(u => (G.lv[u.id] || 0) < u.max); if (pool.length) applyUpg(pool[Math.floor(rand() * pool.length)].id); }
  if (!ai) save.runs++; else aiSpeed = 1;
  state = 'play';
  if (ch.relicStart) offerRelics();
}
function bank() {
  if (spect()) { G.earned = 0; G.score = calcScore(); return; }
  let total = G.gold + G.t / 10 + G.kills / 20 + (G.won ? 200 : 0);
  total = Math.floor(total * (G.nm ? 1.5 : 1) * (1 + .15 * G.heat) * G.curseMult);
  recordHof();
  const delta = total - G.banked; G.banked = total; G.earned = total;
  save.gold += delta;
  if (G.t > save.best.time) save.best.time = G.t;
  if (G.kills > save.best.kills) save.best.kills = G.kills;
  if (G.daily) { const d = today(); if (save.daily.date !== d) save.daily = { date: d, time: 0, kills: 0 }; if (G.t > save.daily.time) { save.daily.time = G.t; save.daily.kills = G.kills; } }
  checkAch(); persist();
}
function say(s, col = '#ffe66d', t = 1.6) { if (G) G.banner = { s, col, t }; }
function checkAch() {
  if (spect()) return;
  for (const a of ACH) {
    if (save.ach[a.id] || !a.chk(G)) continue;
    save.ach[a.id] = 1; save.gold += a.gold; persist(); sfx.ach();
    pops.push({ s: 'Achievement: ' + a.n + (a.gold ? '  (+' + a.gold + ' gold)' : ''), t: 3.5 });
    try { if (typeof window !== 'undefined' && window.steam) window.steam.ach(a.id); } catch (e) { }
  }
}

function availEvo() { return EVO.find(e => !G.evo[e.id] && e.need(G.lv)); }
function offerRelics() {
  const pool = RELICS.filter(r => !G.rel[r.id]);
  if (!pool.length) { G.gold += 50 * G.goldMul; say('All relics found! +gold', '#ffd166'); return; }
  const out = [];
  while (out.length < 3 && pool.length) out.push({ k: 'r', ref: pool.splice(Math.floor(rand() * pool.length), 1)[0] });
  G.choices = out; G.rerolled = true; G.relicOffer = true;
  state = 'levelup'; sfx.level(); levelFlash = .5;
}
function takeRelic(r) {
  G.rel[r.id] = 1; G.relics.push(r.id); if (!spect()) save.codex[r.id] = 1; r.f(G);
  say('RELIC: ' + r.n, r.col, 2.4); shake = Math.max(shake, 6); persist(); checkAch();
}
function offerUpgrades() {
  if (G.lvl % 5 === 0 && !G.relicOffer && RELICS.some(r => !G.rel[r.id])) { offerRelics(); return; }
  const pool = UPG.map((u, i) => i).filter(i => (G.lv[UPG[i].id] || 0) < UPG[i].max);
  const out = [], ev = availEvo();
  if (ev) out.push({ k: 'e', ref: ev });
  while (out.length < 3 && pool.length) out.push({ k: 'u', i: pool.splice(Math.floor(rand() * pool.length), 1)[0] });
  for (let i = 0; out.length < 3; i++) out.push({ k: 'f', ref: FALLBACK[i % FALLBACK.length] });
  G.choices = out; G.rerolled = false;
  state = 'levelup'; sfx.level(); levelFlash = .5;
}
function cardInfo(c) {
  if (c.k === 'u') { const u = UPG[c.i], l = G.lv[u.id] || 0; return { n: u.n, d: u.d, sub: 'Level ' + l + ' → ' + (l + 1) + ' / ' + u.max, col: '#6c63ff' }; }
  if (c.k === 'e') return { n: c.ref.n, d: c.ref.d, sub: '★ EVOLUTION ★', col: '#ffd166' };
  if (c.k === 'r') return { n: c.ref.n, d: c.ref.d, sub: '♦ RELIC ♦', col: c.ref.col };
  return { n: c.ref.n, d: c.ref.d, sub: 'Bonus', col: '#3ddc97' };
}
function pick(i) {
  const c = G.choices[i]; if (!c) return;
  if (c.k === 'u') applyUpg(UPG[c.i].id);
  else if (c.k === 'e') { c.ref.f(G.w); G.evo[c.ref.id] = 1; G.evolved++; say('EVOLVED: ' + c.ref.n + '!', '#ffd166', 2.5); shake = 10; checkAch(); }
  else if (c.k === 'r') takeRelic(c.ref);
  else c.ref.f();
  G.relicOffer = false;
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
function cycleHeat() {
  const top = save.heatMax || 0; optHeat = optHeat >= top ? 0 : optHeat + 1; save.heatSel = optHeat; persist(); snd(500, .05, 'square', .04);
  if (top === 0) toast = { s: 'Survive 5:00 on Heat 0 to unlock Heat 1', t: 2 };
}
function toggleNM() { if (!save.nm) { toast = { s: 'Defeat the Void Titan to unlock Nightmare', t: 2 }; return; } optNM = !optNM; }
function toggleFS() { if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } }
function setting(i, dir = 1) {
  const s = save.settings;
  if (i === 0) { const v = dir > 0 ? Math.min(1, Math.round((s.vol + .25) * 4) / 4) : Math.max(0, Math.round((s.vol - .25) * 4) / 4); setVol(s.vol >= 1 && dir > 0 ? 0 : v); }
  if (i === 1) { s.music = !s.music; persist(); }
  if (i === 2) { s.shake = !s.shake; persist(); }
  if (i === 3) toggleFS();
  if (i === 4) { s.gfx = s.gfx ? 0 : 1; persist(); }
  if (i === 5) { s.mini = s.mini ? 0 : 1; persist(); }
  if (i === 6) { s.dnum = s.dnum ? 0 : 1; persist(); }
}

// ---------- layout / buttons ----------
const R = {
  start: { x: 440, y: 372, w: 400, h: 60 }, shop: { x: 440, y: 442, w: 195, h: 50 }, achb: { x: 645, y: 442, w: 195, h: 50 },
  sett: { x: 440, y: 498, w: 195, h: 46 }, daily: { x: 645, y: 498, w: 195, h: 46 }, nm: { x: 440, y: 550, w: 195, h: 48 }, heat: { x: 645, y: 550, w: 195, h: 48 }, curse: { x: 1040, y: 36, w: 210, h: 46 }, rec: { x: 30, y: 36, w: 210, h: 46 }, help: { x: 1040, y: 620, w: 210, h: 46 }, ai: { x: 30, y: 620, w: 210, h: 46 },
  charL: { x: 330, y: 245, w: 60, h: 100 }, charR: { x: 890, y: 245, w: 60, h: 100 }, charBox: { x: 400, y: 245, w: 480, h: 100 },
  revive: { x: 410, y: 420, w: 460, h: 52 }, dbl: { x: 410, y: 482, w: 460, h: 52 }, cont: { x: 410, y: 440, w: 460, h: 52 },
  again: { x: 410, y: 560, w: 220, h: 52 }, menu: { x: 650, y: 560, w: 220, h: 52 },
  reroll: { x: 440, y: 550, w: 400, h: 48 }, back: { x: 540, y: 650, w: 200, h: 46 }, quit: { x: 540, y: 606, w: 200, h: 48 },
};
const inR = r => mouse.x > r.x && mouse.x < r.x + r.w && mouse.y > r.y && mouse.y < r.y + r.h;
const cardRect = i => ({ x: 120 + i * 360, y: 220, w: 320, h: 280 });
const rowRect = i => ({ x: 60 + (i % 2) * 600, y: 118 + Math.floor(i / 2) * 84, w: 560, h: 74 });
const setRect = i => ({ x: 340, y: 128 + i * 68, w: 600, h: 58 });

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
function doReroll() {
  if (G.rerolled) return;
  if (G.freeRerolls > 0) { G.freeRerolls--; offerUpgrades(); G.rerolled = true; return; }
  watchAd('reroll', () => { offerUpgrades(); G.rerolled = true; });
}
function quitRun() { state = 'over'; bank(); }

// ---------- input ----------
addEventListener('keydown', e => {
  keys[e.code] = 1;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  const go = e.code === 'Enter' || e.code === 'Space', n = parseInt(e.key);
  if (state === 'menu') {
    if (go) tryStart(); else if (e.code === 'KeyS') state = 'shop'; else if (e.code === 'KeyA') state = 'ach'; else if (e.code === 'KeyT') state = 'settings';
    else if (e.code === 'KeyD') optDaily = !optDaily; else if (e.code === 'KeyN') toggleNM(); else if (e.code === 'KeyH') cycleHeat(); else if (e.code === 'KeyC') state = 'curses'; else if (e.code === 'KeyR') state = 'records'; else if (e.code === 'KeyI') state = 'help'; else if (e.code === 'KeyW') startAI();
    else if (e.code === 'ArrowLeft') selectChar(-1); else if (e.code === 'ArrowRight') selectChar(1); else if (e.code === 'KeyU') unlockChar();
  }
  else if (state === 'shop') { if (e.code === 'Escape' || e.code === 'KeyB') state = 'menu'; if (n >= 1 && n <= META.length) buyMeta(n - 1); }
  else if (state === 'ach') { if (e.code === 'Escape' || e.code === 'KeyB') state = 'menu'; }
  else if (state === 'records') { if (e.code === 'Escape' || e.code === 'KeyB') state = 'menu'; }
  else if (state === 'help') { if (e.code === 'Escape' || e.code === 'KeyB' || e.code === 'KeyI') state = 'menu'; }
  else if (state === 'curses') { if (e.code === 'Escape' || e.code === 'KeyB') state = 'menu'; if (n >= 1 && n <= CURSES.length) toggleCurse(n - 1); }
  else if (state === 'settings') {
    if (e.code === 'Escape' || e.code === 'KeyB') state = 'menu'; if (n >= 1 && n <= 7) setting(n - 1);
    if (e.code === 'ArrowLeft') setting(0, -1); if (e.code === 'ArrowRight') setting(0, 1);
  }
  else if (state === 'over' || state === 'win') { if (go && state === 'over') newGame(!!G.ai); if (e.code === 'Escape') state = 'menu'; if (e.code === 'Enter' && state === 'win') contEndless(); }
  else if (state === 'levelup' && !G.ai) { if (e.code === 'Digit1') pick(0); if (e.code === 'Digit2') pick(1); if (e.code === 'Digit3') pick(2); }
  else if (state === 'play' && !G.ai && (e.code === 'Space' || e.code === 'ShiftLeft')) tryDash();
  else if (state === 'paused' && e.code === 'KeyQ') quitRun();
  if (state === 'play' && G.ai) { if (e.code === 'KeyF') aiSpeedCycle(); else if (e.code === 'KeyK') aiSkillCycle(); else if (e.code === 'KeyE') aiTakeOver(); else if (e.code === 'KeyX') aiExit(); }
  if ((e.code === 'Escape' || e.code === 'KeyP') && (state === 'play' || state === 'paused')) state = state === 'play' ? 'paused' : 'play';
  if (e.code === 'KeyM' && (state === 'play' || state === 'paused')) { save.settings.mini = save.settings.mini ? 0 : 1; persist(); }
  if (e.code === 'F11') toggleFS();
});
addEventListener('keyup', e => keys[e.code] = 0);
function toCanvas(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }

// ---------- touch controls (floating joystick + dash + pause) ----------
const touch = { on: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches, id: null, x: 0, y: 0, ox: 0, oy: 0 };
let touchBlockUntil = 0; // swallow the synthetic click that follows a touch control action
const TB = { dash: { x: W - 120, y: H - 120, r: 72 }, pause: { x: W - 56, y: H - 262, r: 34 }, JR: 90 };
const inCirc = (b, p) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 14;
function touchStop() { touch.id = null; touch.x = touch.y = 0; }
cv.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  touch.on = true; e.preventDefault();
  if (state !== 'play' || G.ai) return;
  const p = toCanvas(e);
  if (inCirc(TB.dash, p)) { tryDash(); touchBlockUntil = performance.now() + 600; return; }
  if (inCirc(TB.pause, p)) { state = 'paused'; touchStop(); touchBlockUntil = performance.now() + 600; return; }
  if (touch.id === null && p.x < W * 0.6) {
    touch.id = e.pointerId; touch.ox = p.x; touch.oy = p.y; touch.x = touch.y = 0;
    try { cv.setPointerCapture(e.pointerId); } catch (_) { }
  }
}, { passive: false });
cv.addEventListener('pointermove', e => {
  if (e.pointerType !== 'touch' || e.pointerId !== touch.id) return;
  const p = toCanvas(e); let dx = p.x - touch.ox, dy = p.y - touch.oy; const d = Math.hypot(dx, dy);
  if (d > TB.JR) { touch.ox += dx / d * (d - TB.JR); touch.oy += dy / d * (d - TB.JR); dx = p.x - touch.ox; dy = p.y - touch.oy; } // base follows the thumb
  const m = Math.hypot(dx, dy);
  if (m < TB.JR * .12) { touch.x = touch.y = 0; } else { const k = Math.min(1, m / TB.JR) / m; touch.x = dx * k; touch.y = dy * k; }
});
const touchEnd = e => { if (e.pointerType === 'touch' && e.pointerId === touch.id) { touchStop(); touchBlockUntil = performance.now() + 350; } };
cv.addEventListener('pointerup', touchEnd); cv.addEventListener('pointercancel', touchEnd);
cv.addEventListener('contextmenu', e => e.preventDefault());
function drawTouch() {
  if (!touch.on || state !== 'play' || G.ai) return;
  g.save(); g.lineWidth = 4; g.textAlign = 'center';
  const jx = touch.id !== null ? touch.ox : 150, jy = touch.id !== null ? touch.oy : H - 150;
  g.fillStyle = 'rgba(255,255,255,' + (touch.id !== null ? .1 : .05) + ')'; g.strokeStyle = 'rgba(255,255,255,' + (touch.id !== null ? .4 : .18) + ')';
  g.beginPath(); g.arc(jx, jy, TB.JR, 0, 7); g.fill(); g.stroke();
  g.fillStyle = 'rgba(94,234,212,' + (touch.id !== null ? .55 : .2) + ')';
  g.beginPath(); g.arc(jx + touch.x * TB.JR, jy + touch.y * TB.JR, 38, 0, 7); g.fill();
  const b = TB.dash, ready = G.dashT <= 0, cd = ready ? 1 : 1 - Math.min(1, G.dashT / G.w.dashCd);
  g.fillStyle = ready ? 'rgba(94,234,212,.28)' : 'rgba(255,255,255,.1)'; g.strokeStyle = ready ? 'rgba(94,234,212,.9)' : 'rgba(255,255,255,.3)';
  g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill(); g.stroke();
  if (!ready) { g.strokeStyle = 'rgba(94,234,212,.9)'; g.beginPath(); g.arc(b.x, b.y, b.r + 8, -Math.PI / 2, -Math.PI / 2 + cd * Math.PI * 2); g.stroke(); }
  g.fillStyle = '#fff'; g.font = 'bold 26px sans-serif'; g.fillText('DASH', b.x, b.y + 9);
  const q = TB.pause; g.fillStyle = 'rgba(255,255,255,.12)'; g.strokeStyle = 'rgba(255,255,255,.4)';
  g.beginPath(); g.arc(q.x, q.y, q.r, 0, 7); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(q.x - 11, q.y - 13, 8, 26); g.fillRect(q.x + 3, q.y - 13, 8, 26);
  g.restore();
}
cv.addEventListener('mousemove', e => { mouse = toCanvas(e); });
cv.addEventListener('click', e => {
  if (performance.now() < touchBlockUntil) return;
  mouse = toCanvas(e);
  if (state === 'menu') {
    if (inR(R.start)) tryStart(); else if (inR(R.shop)) state = 'shop'; else if (inR(R.achb)) state = 'ach'; else if (inR(R.sett)) state = 'settings';
    else if (inR(R.daily)) optDaily = !optDaily; else if (inR(R.nm)) toggleNM(); else if (inR(R.heat)) cycleHeat(); else if (inR(R.curse)) state = 'curses'; else if (inR(R.rec)) state = 'records'; else if (inR(R.help)) state = 'help'; else if (inR(R.ai)) startAI();
    else if (inR(R.charL)) selectChar(-1); else if (inR(R.charR)) selectChar(1); else if (inR(R.charBox)) unlockChar();
  }
  else if (state === 'shop') { if (inR(R.back)) state = 'menu'; META.forEach((m, i) => { if (inR(rowRect(i))) buyMeta(i); }); }
  else if (state === 'ach') { if (inR(R.back)) state = 'menu'; }
  else if (state === 'records') { if (inR(R.back)) state = 'menu'; }
  else if (state === 'help') { if (inR(R.back)) state = 'menu'; }
  else if (state === 'curses') { if (inR(R.back)) state = 'menu'; CURSES.forEach((c, i) => { if (inR(curseRect(i))) toggleCurse(i); }); }
  else if (state === 'settings') { if (inR(R.back)) state = 'menu'; for (let i = 0; i < 7; i++) if (inR(setRect(i))) setting(i); }
  else if (state === 'play' && G && G.ai) aiClick();
  else if (state === 'paused') { if (inR(R.quit)) quitRun(); else state = 'play'; }
  else if (state === 'levelup' && !G.ai) {
    for (let i = 0; i < G.choices.length; i++) if (inR(cardRect(i))) pick(i);
    if (inR(R.reroll)) doReroll();
  } else if (state === 'over') {
    if (inR(R.revive)) doRevive(); else if (inR(R.dbl)) doubleGold();
    else if (inR(R.again)) newGame(!!G.ai); else if (inR(R.menu)) state = 'menu';
  } else if (state === 'win') {
    if (inR(R.cont)) contEndless(); else if (inR(R.menu)) state = 'menu';
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
  if ((a && !padPrev.a || b && !padPrev.b) && state === 'play' && !(G && G.ai)) tryDash();
  if (st && !padPrev.s && (state === 'play' || state === 'paused')) state = state === 'play' ? 'paused' : 'play';
  if (state === 'levelup') { [0, 1, 2].forEach(i => { const bt = gp.buttons[i === 0 ? 2 : i === 1 ? 0 : 1]; if (bt && bt.pressed && !padPrev['c' + i]) pick(i); padPrev['c' + i] = bt && bt.pressed; }); }
  padPrev.a = a; padPrev.s = st; padPrev.b = b;
  const dx = gp.axes[0] || 0, dy = gp.axes[1] || 0;
  return Math.hypot(dx, dy) > .2 ? { x: dx, y: dy } : { x: 0, y: 0 };
}

// ---------- gameplay ----------
const hpMul = () => (1 + G.t / TUNE.hpLinear) * Math.pow(TUNE.hpGrowth, G.t) * (G.nm ? 1.5 : 1) * (1 + .1 * G.heat) * (1 + .3 * G.tier) * (G.heat >= 18 ? 1.25 : 1);
const dmgMul = () => (1 + G.t / TUNE.dmgLinear) * (G.nm ? 1.4 : 1) * (1 + .08 * G.heat) * (1 + .12 * G.tier);
function pickType() {
  const t = G.t, hk = 1 + .08 * G.heat, table = [['grunt', 10], ['runner', t > 20 ? 5 : 0], ['shooter', t > 45 ? 3 : 0], ['exploder', t > 70 ? 3 : 0], ['brute', t > 60 ? 2 + t / 120 : 0], ['charger', t > 90 ? 2.5 * hk : 0], ['sniper', t > 120 ? 2 * hk : 0], ['healer', t > 150 ? 1.5 * hk : 0], ['warper', t > 200 ? 2 * hk : 0]];
  let tot = 0; for (const x of table) tot += x[1];
  let r = rand() * tot; for (const x of table) { r -= x[1]; if (r <= 0) return x[0]; }
  return 'grunt';
}
function spawnEnemy(type, ax, ay) {
  const T = ETYPES[type], a = rnd(0, Math.PI * 2), d = (type === 'boss' || type === 'titan') ? 650 : rnd(680, 800);
  const x = ax !== undefined ? ax : G.p.x + Math.cos(a) * d, y = ay !== undefined ? ay : G.p.y + Math.sin(a) * d;
  let hp, dmg = T.dmg * dmgMul();
  if (type === 'titan') { hp = TUNE.titanHp * (G.nm ? 1.5 : 1); dmg = T.dmg * (G.nm ? 1.4 : 1); }
  else if (type === 'boss' || type === 'elite' || type === 'goblin') hp = T.hp * (1 + G.t / TUNE.bossLinear) * (G.nm ? 1.5 : 1);
  else hp = T.hp * hpMul();
  const e = { type, x, y, r: T.r, hp, max: hp, spd: T.spd * (1 + Math.min(.55, G.t / 420)) * (1 + .03 * G.heat) * (G.cur.frenzy ? 1.35 : 1), dmg, xp: T.xp, col: T.col, flash: 0, bt: 0, atk: 2, sp: 0, spin: 0, sum: 4, ph: rnd(0, 6.28), fuse: 0, life: 24, ct: 1.5 + rnd(0, 1.5), cs: 'idle', tel: 0 };
  if (type === 'boss') { const bp = BOSS_PATS[G.bossN++ % BOSS_PATS.length]; e.pat = bp.id; e.name = bp.n; e.col = bp.col; e.ct = 3; }
  if (type === 'boss' || type === 'titan') G.intro = { n: type === 'titan' ? 'THE VOID TITAN' : e.name.toUpperCase(), t: 2.6, col: e.col, sub: type === 'titan' ? 'The end of the line' : 'A guardian awakens' };
  if (type === 'elite' && G.heat >= 10) { e.hp *= 1.5; e.max = e.hp; }
  if (type === 'elite' || (type === 'boss' && G.t > 300)) addAffix(e);
  else if (G.t > 150 && type !== 'boss' && type !== 'titan' && type !== 'goblin' && type !== 'bat' && type !== 'swarmling' && rand() < .025 * (G.heat >= 15 ? 3 : G.heat >= 5 ? 2 : 1)) makeChampion(e);
  G.en.push(e); return e;
}
function addAffix(e, id) {
  id = id || AFF_IDS[Math.floor(rand() * AFF_IDS.length)]; e.af = id;
  if (id === 'shield') { e.hp *= 1.5; e.max = e.hp; }
  if (id === 'swift') e.spd *= 1.45;
}
function makeChampion(e) { e.champ = true; e.hp *= 3; e.max = e.hp; e.xp *= 3; e.r *= 1.25; addAffix(e); }
function affixDeath(e) {
  if (e.af === 'split' && G.en.length < 600) for (let i = 0; i < 4; i++) spawnEnemy('grunt', e.x + vr(-34, 34), e.y + vr(-34, 34));
  if (e.af === 'volatile') { G.rings.push({ x: e.x, y: e.y, r: 5, max: 110, life: .3 }); burst(e.x, e.y, '#ff6b6b', 16, 220); if (dist(e, G.p) < 110 + G.p.r) hurtPlayer(e.dmg * 1.2); }
}
function burst(x, y, col, n, sp = 150) {
  for (let i = 0; i < n && G.part.length < 500; i++) { const a = vr(0, 6.28), s = vr(30, sp); G.part.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: vr(.25, .6), col, sz: vr(8, 20) }); }
}
function floatText(x, y, s, col = '#fff', size = 16) { if (!save.settings.dnum) return; if (G.txt.length < 60) G.txt.push({ x, y, s, col, size, life: .6 }); }
function damageEnemy(e, d, crit, quiet) {
  if (G.rel.berserk) d *= 1 + (1 - Math.max(0, G.p.hp) / G.p.max) * .9;
  e.hp -= d; e.flash = .08;
  if (!quiet && G.part.length < 420) G.part.push({ x: e.x, y: e.y, vx: vr(-110, 110), vy: vr(-110, 110), life: .22, col: '#fff2b0', sz: 10 });
  if (!quiet || rand() < .12) floatText(e.x + vr(-8, 8), e.y - e.r, d >= 1e6 ? (d / 1e6).toFixed(1) + 'M' : d >= 1e4 ? Math.round(d / 1e3) + 'k' : Math.round(d) + (crit ? '!' : ''), crit ? '#ff9f43' : '#ffe66d', crit ? 22 : 16);
  if (!e.dead && G.w.exec && e.type !== 'boss' && e.type !== 'titan' && e.hp / e.max < .05 + .03 * G.w.exec) e.hp = 0;
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
  if (G.rel.vampire && !G.cur.famine && rand() < .1) G.p.hp = Math.min(G.p.max, G.p.hp + 2);
  if (G.w.leech && !G.cur.famine && rand() < .03 * G.w.leech) G.p.hp = Math.min(G.p.max, G.p.hp + 1);
  if (G.rel.chain && rand() < .22 && G.chainD < 3) { G.chainD++; G.rings.push({ x: e.x, y: e.y, r: 5, max: 85, life: .3 }); for (const o of G.en) if (!o.dead && o !== e && dist(o, e) < 85 + o.r) damageEnemy(o, G.w.dmg * 1.5, false, true); G.chainD--; }
  if (e.champ) G.champKills++;
  if (G.rel.bounty && (e.type === 'elite' || e.type === 'boss' || e.champ || e.type === 'goblin')) for (let i = 0; i < 6; i++) dropCoin(e.x, e.y, 3 * G.goldMul);
  if (e.af) { G.affKilled[e.af] = 1; affixDeath(e); }
  if (e.burn > 0 && G.w.plague) for (const o of G.en) if (!o.dead && o !== e && dist(o, e) < 130) o.burn = 3;
  if (G.rel.ovc && G.kills % 12 === 0 && !G.ovcD) { G.ovcD = 1; G.rings.push({ x: G.p.x, y: G.p.y, r: 10, max: 190, life: .35 }); for (const o of G.en) if (!o.dead && o !== e && dist(o, G.p) < 190 + o.r) damageEnemy(o, G.w.dmg * 2.5, false, true); G.ovcD = 0; }
  G.combo++; G.comboT = 2.5; if (G.combo > G.bestCombo) G.bestCombo = G.combo;
  if (G.combo % 25 === 0) { sfx.combo(); say('RAMPAGE x' + G.combo + '!', '#ff9f43', 1.2); G.xp += 3; if (!G.cur.famine) G.p.hp = Math.min(G.p.max, G.p.hp + 5); shake = 6; }
  const big = e.type === 'boss' || e.type === 'elite' || e.type === 'titan';
  burst(e.x, e.y, e.col, e.type === 'titan' ? 120 : e.type === 'boss' ? 60 : big ? 24 : 9, big ? 400 : 170);
  const n = e.type === 'boss' ? 12 : 1;
  for (let i = 0; i < n; i++) G.gem.push({ x: e.x + vr(-20, 20) * (n > 1), y: e.y + vr(-20, 20) * (n > 1), v: e.type === 'boss' ? Math.ceil(e.xp / n) : e.xp });
  const cm = 1 + Math.min(1, G.combo / 100);
  if (rand() < .18 + .03 * G.w.luck + (G.rel.midas ? .14 : 0) + (e.champ ? .6 : 0)) dropCoin(e.x, e.y, 1 * G.goldMul * cm * (1 + .1 * G.w.luck) * (e.champ ? 4 : 1));
  if (e.type === 'goblin') { G.goblins++; for (let i = 0; i < 14; i++) dropCoin(e.x, e.y, 4 * G.goldMul); G.chest.push({ x: e.x, y: e.y, relic: !!G.rel.lucky && rand() < .5 }); say('GOBLIN CAUGHT! Grab the loot!', '#ffd166', 2); shake = 8; checkAch(); }
  if (e.type === 'exploder') { G.rings.push({ x: e.x, y: e.y, r: 5, max: 70, life: .3 }); }
  if (big) G.freeze = .07;
  if (e.type === 'elite') { for (let i = 0; i < 5; i++) dropCoin(e.x, e.y, 3 * G.goldMul); G.chest.push({ x: e.x, y: e.y, relic: rand() < (G.rel.lucky ? .65 : .35) }); shake = 8; say('ELITE SLAIN - take the chest!', '#ffd166'); }
  if (e.type === 'boss') { G.bossKills++; for (let i = 0; i < 14; i++) dropCoin(e.x, e.y, 5 * G.goldMul); G.chest.push({ x: e.x - 30, y: e.y, relic: true }); G.chest.push({ x: e.x + 30, y: e.y }); G.bossAlive = false; if (!G.cur.famine) G.p.hp = Math.min(G.p.max, G.p.hp + 40); shake = 18; say('BOSS DEFEATED!', '#ff2e63', 2); }
  if (e.type === 'titan' && e.tier) {
    G.bossAlive = false; G.tiersCleared++; shake = 30; sfx.win();
    for (const o of G.en) if (!o.dead && o !== e) o.dead = true;
    G.eb.length = 0; G.beams.length = 0;
    for (let i = 0; i < 24; i++) dropCoin(e.x, e.y, 6 * G.goldMul * (1 + .3 * e.tier));
    G.chest.push({ x: e.x - 30, y: e.y, relic: true }); G.chest.push({ x: e.x + 30, y: e.y });
    say('VOID TIER ' + e.tier + ' CLEARED!', '#c77dff', 3); bank(); checkAch(); return;
  }
  if (e.type === 'titan') {
    G.bossAlive = false; G.won = true; G.eb.length = 0; shake = 30; sfx.win();
    for (const o of G.en) if (!o.dead && o !== e) o.dead = true;
    for (let i = 0; i < 30; i++) dropCoin(e.x, e.y, 8 * G.goldMul);
    if (!spect()) { save.wins++; if (!save.nm) { save.nm = 1; toast = { s: 'Nightmare mode unlocked!', t: 3 }; } }
    bank(); state = 'win';
  }
}
function hurtPlayer(d) {
  const p = G.p; if (p.inv > 0 || state !== 'play') return;
  if (G.rel.aegis && G.aegisT <= 0) { G.aegisT = 14; p.inv = .7; G.rings.push({ x: p.x, y: p.y, r: 10, max: 130, life: .35 }); say('AEGIS BLOCKED IT', '#9ad1ff', 1); return; }
  if (G.ev.kind === 'meteor') G.ev.hit = true;
  d *= Math.max(.3, 1 - .08 * G.w.armor - .04 * (save.meta.armor || 0)); p.hp -= d; hurtFlash = .35; p.inv = .5; shake = Math.max(shake, 8); sfx.hurt(); G.combo = Math.floor(G.combo / 2);
  burst(p.x, p.y, '#ff6b6b', 14);
  if (G.rel.thorns) for (const o of G.en) if (!o.dead && dist(o, p) < 140) damageEnemy(o, 25 + G.w.dmg * 2.5, false, true);
  if (p.hp <= 0) {
    if (G.revives > 0) { G.revives--; reviveNow(.5); say('SECOND WIND!', '#5eead4'); }
    else { state = 'over'; bank(); }
  }
}
function ebullet(x, y, a, sp, dmg, r = 6) { sp *= 1 + .02 * Math.max(0, G.heat - 10); G.eb.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg, life: 5, r }); }

function addDecal(x, y, r) { if (!G) return; G.decals.push({ x, y, r, l: 1 }); if (G.decals.length > 40) G.decals.shift(); }
function chargeAI(e, dt, ang, d, o) {
  if (e.cs === 'wind') { if (e.ct <= 0) { e.cs = 'dash'; e.ct = o.dash; } return { mv: e.cdir, sp: 0 }; }
  if (e.cs === 'dash') {
    if (e.ct <= 0) { e.cs = 'idle'; e.ct = o.cd; if (o.shock) { G.rings.push({ x: e.x, y: e.y, r: 5, max: o.shock, life: .35 }); shake = Math.max(shake, 8); sfx.boom(); if (dist(e, G.p) < o.shock + G.p.r) hurtPlayer(e.dmg * 1.1); } return; }
    return { mv: e.cdir, sp: o.sp };
  }
  if (e.ct <= 0 && d < o.range) { e.cs = 'wind'; e.ct = o.wind; e.cdir = ang; return { mv: ang, sp: 0 }; }
}
function special(e, dt, ang, d) {
  e.ct -= dt;
  if (e.type === 'charger') return chargeAI(e, dt, ang, d, { range: 430, wind: .75, dash: .55, sp: 560, cd: 2.2 });
  if (e.type === 'sniper') {
    if (e.tel > 0) { e.tel -= dt; if (e.tel <= 0) { ebullet(e.x, e.y, e.aim, 900, e.dmg, 5); e.atk = 3.4; sfx.zap(); } return { mv: ang, sp: 0 }; }
    e.atk -= dt; if (e.atk <= 0 && d < 780) { e.tel = .85; e.aim = ang; }
    return { mv: d < 380 ? ang + Math.PI : ang, sp: d < 380 ? e.spd : d < 520 ? 0 : e.spd };
  }
  if (e.type === 'healer') {
    if (e.ct <= 0) { e.ct = 1.1; G.rings.push({ x: e.x, y: e.y, r: 5, max: 170, life: .3 }); for (const o of G.en) if (!o.dead && o !== e && dist(o, e) < 170) o.hp = Math.min(o.max, o.hp + o.max * .05); }
    return d < 320 ? { mv: ang + Math.PI, sp: e.spd } : undefined;
  }
  if (e.type === 'warper') {
    if (e.ct <= 0) { e.ct = 3.2; burst(e.x, e.y, '#c77dff', 10); const a = rnd(0, 6.28); e.x = G.p.x + Math.cos(a) * 190; e.y = G.p.y + Math.sin(a) * 190; burst(e.x, e.y, '#c77dff', 10); }
    return;
  }
  if (e.type === 'boss' && e.pat) {
    if (e.pat === 'hive') { if (e.ct <= 0) { e.ct = 4.5; for (let k = 0; k < 6; k++) spawnEnemy('swarmling', e.x + vr(-60, 60), e.y + vr(-60, 60)); sfx.boom(); } }
    else if (e.pat === 'laser') { if (e.ct <= 0) { e.ct = 7.5; const a0 = rnd(0, 6.28); for (let k = 0; k < 3; k++) G.beams.push({ owner: e, a: a0 + k * 2.0944, t: 0, warn: 1.3, dur: 2.2, rot: (rand() < .5 ? 1 : -1) * .55 }); sfx.boss(); } }
    else if (e.pat === 'warp') {
      if (e.ct <= 0) { e.ct = 4.2; burst(e.x, e.y, e.col, 20, 260); const a = rnd(0, 6.28); e.x = G.p.x + Math.cos(a) * 330; e.y = G.p.y + Math.sin(a) * 330; burst(e.x, e.y, e.col, 20, 260); const off = rnd(0, 6.28); for (let k = 0; k < 18; k++) ebullet(e.x, e.y, off + k / 18 * 6.28, 260, e.dmg * .4, 7); sfx.boom(); }
    } else if (e.pat === 'crush') return chargeAI(e, dt, ang, d, { range: 520, wind: 1.0, dash: .75, sp: 700, cd: 4.2, shock: 150 });
    return;
  }
  if (e.type === 'titan' && e.tier && e.ct <= 0) { e.ct = 9; const a0 = rnd(0, 6.28); for (let k = 0; k < 4; k++) G.beams.push({ owner: e, a: a0 + k * 1.5708, t: 0, warn: 1.5, dur: 2.6, rot: (k % 2 ? 1 : -1) * .5 }); sfx.boss(); }
}
function beamsTick(dt) {
  const p = G.p;
  for (const b of G.beams) {
    b.t += dt; if (b.owner.dead) { b.done = true; continue; }
    if (b.t > b.warn) {
      b.a += b.rot * dt;
      const dx = Math.cos(b.a), dy = Math.sin(b.a), px = p.x - b.owner.x, py = p.y - b.owner.y, proj = px * dx + py * dy;
      if (proj > 0 && Math.abs(px * dy - py * dx) < 20 + p.r) hurtPlayer(b.owner.dmg * .9);
    }
    if (b.t > b.warn + b.dur) b.done = true;
  }
  G.beams = G.beams.filter(b => !b.done);
}
function endZone() {
  if (G.zone && state === 'play') { G.chest.push({ x: G.zone.x, y: G.zone.y, relic: true }); say('VOID CLOSING SURVIVED - relic dropped!', '#c77dff', 2.4); }
  G.zone = null;
}
function calcScore() { return Math.floor((G.kills * 10 + G.t * 5 + G.bossKills * 500 + G.tiersCleared * 5000 + (G.won ? 20000 : 0)) * (1 + .25 * G.heat) * G.curseMult); }
function recordHof() {
  G.score = calcScore(); const e = { id: G.runId, s: G.score, heat: G.heat, ch: save.char, t: Math.floor(G.t), k: G.kills, cu: Object.keys(G.cur).length, tier: G.tiersCleared };
  const i = save.hof.findIndex(x => x.id === e.id); if (i >= 0) save.hof[i] = e; else save.hof.push(e);
  save.hof.sort((a, b) => b.s - a.s); save.hof = save.hof.slice(0, 8); G.rank = save.hof.findIndex(x => x.id === e.id) + 1;
}
function contEndless() { G.nextTier = G.t + 75; state = 'play'; }
function toggleCurse(i) {
  const c = CURSES[i]; if (!c) return; const k = save.curses.indexOf(c.id);
  if (k >= 0) save.curses.splice(k, 1); else save.curses.push(c.id);
  persist(); snd(k >= 0 ? 380 : 620, .06, 'square', .04);
}
function startEvent() {
  const kinds = G.t > 120 ? ['moon', 'meteor', 'goblin', 'zone'] : ['moon', 'meteor', 'goblin'], k = kinds[Math.floor(rand() * kinds.length)], ev = G.ev;
  ev.kind = k; ev.t = 0; ev.hit = false; ev.mt = 0;
  if (k === 'moon') { ev.dur = 25; say('BLOOD MOON  -  double enemies, double XP', '#ff3b5c', 2.6); sfx.boss(); }
  else if (k === 'meteor') { ev.dur = 20; say('METEOR STORM  -  stay out of the red circles', '#ff9f43', 2.6); sfx.boss(); }
  else if (k === 'zone') { ev.dur = 30; ev.zt = .5; G.zone = { x: G.p.x, y: G.p.y, r: 780 }; say('VOID CLOSING  -  stay inside the ring!', '#b14dff', 2.6); sfx.boss(); }
  else { ev.dur = 1; spawnEnemy('goblin'); say('TREASURE GOBLIN  -  catch it for loot!', '#ffd166', 2.6); sfx.coin(); }
}
function events(dt) {
  const ev = G.ev, p = G.p;
  if (!ev.kind) { if (G.t >= ev.next && !G.bossAlive && G.t < TUNE.titanTime - 40) startEvent(); }
  else {
    ev.t += dt;
    if (ev.kind === 'zone' && G.zone) { G.zone.r = 780 - 550 * Math.min(1, ev.t / 20); ev.zt -= dt; if (ev.zt <= 0) { ev.zt = .5; if (dist(p, G.zone) > G.zone.r) hurtPlayer(8 + 6 * dmgMul()); } }
    if (ev.kind === 'meteor') { ev.mt -= dt; if (ev.mt <= 0) { ev.mt = .5; const a = rnd(0, 6.28), d = rnd(0, 360), near = rand() < .3; G.meteors.push({ x: p.x + (near ? 0 : Math.cos(a) * d), y: p.y + (near ? 0 : Math.sin(a) * d), t: 0, warn: 1.1, r: 80 }); } }
    if (ev.t >= ev.dur) { if (ev.kind === 'zone') endZone(); if (ev.kind === 'moon') G.moons++; if (ev.kind === 'meteor' && !ev.hit) G.clean++; ev.kind = null; ev.next = G.t + rnd(55, 85); checkAch(); }
  }
  for (const m of G.meteors) {
    m.t += dt;
    if (m.t >= m.warn && !m.done) {
      m.done = true; G.rings.push({ x: m.x, y: m.y, r: 5, max: m.r, life: .35 }); shake = Math.max(shake, 6); sfx.boom(); burst(m.x, m.y, '#ff9f43', 14, 200); addDecal(m.x, m.y, m.r * .75);
      for (const e of G.en) if (!e.dead && dist(e, m) < m.r + e.r) damageEnemy(e, 120 + G.w.dmg * 5, false, true);
      if (dist(p, m) < m.r + p.r) hurtPlayer(12 + 8 * dmgMul());
    }
  }
  G.meteors = G.meteors.filter(m => !m.done);
}
function relicTick(dt) {
  const p = G.p, w = G.w;
  if (G.aegisT > 0) G.aegisT -= dt;
  if (G.rel.storm) {
    G.stormT -= dt;
    if (G.stormT <= 0) { G.stormT = 1.6; const c = G.en.filter(e => !e.dead && dist(e, p) < 560); if (c.length) { const e = c[Math.floor(rand() * c.length)]; G.arcs.push({ pts: [{ x: e.x + vr(-30, 30), y: e.y - 260 }, { x: e.x, y: e.y }], life: .18 }); damageEnemy(e, w.dmg * 3.5); sfx.zap(); } }
  }
  if (G.rel.trail && G.dash > 0) for (const e of G.en) if (!e.dead && (e.tb || 0) < G.t && dist(e, p) < 52 + e.r) { damageEnemy(e, w.dmg * 3, false, true); e.tb = G.t + .25; }
}
function update(dt) {
  const p = G.p, w = G.w;
  const wdt = dt * (1 + .12 * w.cdr);
  hurtFlash = Math.max(0, hurtFlash - dt);
  G.t += dt; p.inv -= dt; G.dashT -= dt; G.dash -= dt;
  G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  G.achT -= dt; if (G.achT <= 0) { G.achT = 1; checkAch(); if (!spect() && G.heat === (save.heatMax || 0) && G.t >= 300 + Math.max(0, G.heat - 10) * 12 && save.heatMax < 20) { save.heatMax++; persist(); pops.push({ s: 'Heat ' + save.heatMax + ' unlocked!', t: 3.5 }); sfx.ach(); } }
  // movement
  const gp = pad();
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + gp.x + touch.x;
  let iy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + gp.y + touch.y;
  if (G.ai) { const ac = aiControl(dt); ix = ac.x; iy = ac.y; if (ac.dash) tryDash(); }
  const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
  if (m > .1) p.face = Math.atan2(iy, ix);
  if (G.dash > 0) { p.x += Math.cos(p.face) * 850 * dt; p.y += Math.sin(p.face) * 850 * dt; }
  else { p.x += ix * p.spd * dt; p.y += iy * p.spd * dt; }
  if (m > .1 || G.dash > 0) { G.trail.push({ x: p.x, y: p.y, l: .35 }); if (G.trail.length > 24) G.trail.shift(); }
  for (const tr of G.trail) tr.l -= dt; G.trail = G.trail.filter(tr => tr.l > 0);
  G.cam.x += (p.x - G.cam.x) * Math.min(1, dt * 9); G.cam.y += (p.y - G.cam.y) * Math.min(1, dt * 9);
  if (w.regen && !G.cur.famine) { p.regenT += dt; if (p.regenT >= 1) { p.regenT = 0; p.hp = Math.min(p.max, p.hp + w.regen); } }

  // spawning
  G.spawn -= dt;
  const titanAlive = G.en.some(e => e.type === 'titan');
  const interval = Math.max(TUNE.spawnMin, .6 - G.t / 150) * (titanAlive ? 2.5 : 1) * (G.nm ? .8 : 1) * (G.ev.kind === 'moon' ? .5 : 1) * (1 - .03 * G.heat) * (G.cur.swarm ? .62 : 1);
  const per = 1 + Math.floor(G.t / 200);
  while (G.spawn <= 0 && G.en.length < 420) { G.spawn += interval; for (let k = 0; k < per; k++) spawnEnemy(pickType()); }
  if (G.t >= G.nextHorde) {
    G.nextHorde += 50; say('!! HORDE INCOMING !!', '#ff6b6b', 2); sfx.boss();
    const hn = 36 + (G.heat >= 7 ? 18 : 0);
    for (let i = 0; i < hn; i++) { if (G.en.length > 900) break; const a = i / hn * 6.28; spawnEnemy(rand() < .2 ? pickType() : 'grunt', p.x + Math.cos(a) * 620, p.y + Math.sin(a) * 620); }
  }
  if (G.t >= G.nextBats && G.t > 30) {
    G.nextBats += 28; say('Bat swarm!', '#b8b8ff', 1.4);
    const a = rnd(0, 6.28), n = 10 + Math.floor(G.t / 40);
    for (let i = 0; i < n && G.en.length < 900; i++) spawnEnemy('bat', p.x + Math.cos(a) * 700 + vr(-60, 60), p.y + Math.sin(a) * 700 + vr(-60, 60));
  }
  if (G.t >= G.nextPack && G.t > 50) { G.nextPack += 38; say('Swarmling pack!', '#ffb3c1', 1.2); const pa = rnd(0, 6.28), pn = 14 + Math.floor(G.t / 60); for (let i = 0; i < pn && G.en.length < 900; i++) spawnEnemy('swarmling', p.x + Math.cos(pa) * 700 + vr(-90, 90), p.y + Math.sin(pa) * 700 + vr(-90, 90)); }
  if (G.t >= G.nextElite) { G.nextElite += G.cur.hunt ? 18 : G.heat >= 3 ? 32 : 40; spawnEnemy('elite'); say('An ELITE approaches...', '#ffd166'); }
  if (G.t >= G.nextBoss) {
    G.nextBoss += G.cur.rush ? 40 : G.heat >= 18 ? 55 : 75;
    if (!(G.t > TUNE.titanTime - 60 && !G.won)) { spawnEnemy('boss'); G.bossAlive = true; sfx.boss(); shake = 10; say('!! BOSS !!', '#ff2e63', 2); }
  }
  if (G.t >= TUNE.titanTime && !G.titanSpawned && !G.won) {
    G.titanSpawned = true; spawnEnemy('titan'); G.bossAlive = true; sfx.boss(); shake = 20; say('THE VOID TITAN AWAKENS', '#b14dff', 3.5);
  }
  if (G.won && G.nextTier > 0 && G.t >= G.nextTier && !G.bossAlive) {
    G.tier++; const te = spawnEnemy('titan'); te.tier = G.tier; te.hp = te.max = TUNE.titanHp * (1 + .7 * G.tier) * (G.nm ? 1.5 : 1) * (1 + .1 * G.heat); te.dmg *= 1 + .15 * G.tier; te.ct = 4;
    G.bossAlive = true; G.nextTier = G.t + 120; sfx.boss(); shake = 20; say('VOID TIER ' + G.tier + '  -  A GREATER TITAN RISES', '#c77dff', 3.5);
  }

  events(dt); relicTick(dt); beamsTick(dt);

  // enemies
  for (const e of G.en) {
    if (e.dead) continue;
    if (e.burn > 0) { e.burn -= dt; e.bt2 = (e.bt2 || 0) - dt; if (e.bt2 <= 0) { e.bt2 = .5; damageEnemy(e, w.dmg * .35 * (1 + .25 * w.burn), false, true); if (e.dead) continue; } }
    const ang = Math.atan2(p.y - e.y, p.x - e.x), d = dist(e, p);
    let mv = ang, sp = e.spd;
    if (e.type === 'bat') mv = ang + Math.sin(G.t * 6 + e.ph) * 1.0;
    else if (e.type === 'shooter') {
      if (d < 260) mv = ang + Math.PI; else if (d < 380) sp = 0;
      e.atk -= dt; if (e.atk <= 0 && d < 700) { e.atk = 2.2; ebullet(e.x, e.y, ang, 250, e.dmg * .8); }
    } else if (e.type === 'exploder') {
      if (d < e.r + p.r + 34 || e.fuse > 0) {
        e.fuse += dt; sp = 0;
        if (e.fuse > .45) { e.dead = true; G.rings.push({ x: e.x, y: e.y, r: 5, max: 95, life: .3 }); burst(e.x, e.y, '#ff5d1f', 22, 220); addDecal(e.x, e.y, 55); sfx.boom(); if (dist(e, p) < 95 + p.r) hurtPlayer(e.dmg * 1.6); continue; }
      }
    } else if (e.type === 'goblin') {
      mv = ang + Math.PI + Math.sin(G.t * 3 + e.ph) * .6; e.life -= dt;
      if (e.life <= 0 || d > 1100) { e.dead = true; continue; }
    } else if (e.type === 'boss' || e.type === 'titan') {
      const ti = e.type === 'titan';
      e.atk -= dt; if (e.atk <= 0) { e.atk = ti ? 1.8 : 3; const n = ti ? 22 : 12, off = rnd(0, 6.28); for (let k = 0; k < n; k++) ebullet(e.x, e.y, off + k / n * 6.28, ti ? 240 : 220, e.dmg * (ti ? .45 : .4), 7); sfx.boom(); }
      if (ti) {
        e.sp -= dt; if (e.sp <= 0) { e.sp = .17; e.spin += .47; ebullet(e.x, e.y, e.spin, 290, e.dmg * .35, 6); }
        e.sum -= dt; if (e.sum <= 0) { e.sum = 6; for (let k = 0; k < 4; k++) spawnEnemy('exploder', e.x + vr(-80, 80), e.y + vr(-80, 80)); }
      }
    }
    { const sr = special(e, dt, ang, d); if (sr) { mv = sr.mv; sp = sr.sp; } }
    if (G.rel.frost && d < 200) sp *= .6;
    if (G.rel.timewarp && p.hp < p.max * .35) sp *= .75;
    if (e.chill > 0) { e.chill -= dt; sp *= 1 - Math.min(.6, .15 * w.chill); }
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
    if (a.type !== 'exploder' && a.dmg > 0 && dist(a, p) < a.r + p.r) hurtPlayer(a.dmg);
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
        G.bul.push({ x: p.x, y: p.y, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, life: 1, pierce: w.pierce, hit: new Set(), dmg: w.dmg * (crit ? 2 + .25 * w.critD : 1), crit });
      }
      if (G.rel.echo && rand() < .15) for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * spread + .07; G.bul.push({ x: p.x, y: p.y, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, life: 1, pierce: w.pierce, hit: new Set(), dmg: w.dmg, crit: false }); }
      sfx.shoot(); G.cd = 1 / w.rate;
    } else G.cd = .08;
  }
  for (const b of G.bul) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const e of G.en) {
      if (e.dead || b.hit.has(e) || b.life <= 0) continue;
      if (Math.abs(e.x - b.x) > e.r + 8 || Math.abs(e.y - b.y) > e.r + 8) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 6) {
        b.hit.add(e); damageEnemy(e, b.dmg, b.crit); sfx.hit(); if (w.burn) e.burn = 3; if (w.chill) e.chill = 1.6;
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
    w.novaT -= wdt;
    if (w.novaT <= 0) {
      w.novaT = Math.max(1.4, 3.6 - w.nova * .3);
      const Rr = (120 + w.nova * 38) * (1 + .15 * w.area); G.rings.push({ x: p.x, y: p.y, r: 10, max: Rr, life: .4 });
      for (const e of G.en) if (!e.dead && dist(e, p) < Rr + e.r) damageEnemy(e, w.dmg * .9 + w.nova * 8);
      sfx.nova();
    }
  }
  if (w.light) {
    w.lightT -= wdt;
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
    w.boomT -= wdt;
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
    w.missT -= wdt;
    if (w.missT <= 0) { w.missT = 2.4; const n = Math.min(10, Math.ceil(w.missile * w.missMul)); for (let i = 0; i < n; i++) G.mis.push({ x: p.x, y: p.y, a: rnd(0, 6.28), life: 3, hit: false }); sfx.nova(); }
  }
  for (const m of G.mis) {
    m.life -= dt;
    const tgt = nearest(900, m);
    if (tgt) { const da = angDiff(Math.atan2(tgt.y - m.y, tgt.x - m.x), m.a); m.a += Math.max(-7 * dt, Math.min(7 * dt, da)); }
    m.x += Math.cos(m.a) * 380 * dt; m.y += Math.sin(m.a) * 380 * dt;
    if (G.en.some(e => !e.dead && Math.hypot(e.x - m.x, e.y - m.y) < e.r + 8)) {
      const rad = 75 * (w.missMul > 1 ? 1.4 : 1) * (1 + .15 * w.area); G.rings.push({ x: m.x, y: m.y, r: 5, max: rad, life: .25 });
      for (const e of G.en) if (!e.dead && Math.hypot(e.x - m.x, e.y - m.y) < rad + e.r) damageEnemy(e, w.dmg * 2.2);
      m.life = 0; sfx.boom();
    }
  }
  G.mis = G.mis.filter(m => m.life > 0);
  if (w.flame) {
    const tgt = nearest(320), aim = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : p.face; w.aim = aim;
    w.flameT -= dt;
    if (w.flameT <= 0) {
      w.flameT = .1; const range = (140 + w.flame * 18) * (1 + .1 * w.area);
      for (const e of G.en) {
        if (e.dead) continue; const d = dist(e, p); if (d > range + e.r) continue;
        if (Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), aim)) < .55) damageEnemy(e, w.dmg * .3 * w.flame * w.flameMul, false, true);
      }
      for (let i = 0; i < 4 && G.part.length < 500; i++) { const a = aim + vr(-.35, .35), s = vr(200, 380); G.part.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: vr(.2, .4), col: Math.random() < .5 ? '#ff7a1a' : '#ffd166' }); }
      G.flameSnd -= .1; if (G.flameSnd <= 0) { sfx.flame(); G.flameSnd = .3; }
    }
  }
  if (w.drone) {
    w.droneA += dt * 2.2; w.droneT -= wdt;
    const dn = w.drone + w.droneX;
    if (w.droneT <= 0) {
      w.droneT = Math.max(.22, (.9 - w.drone * .08) * (w.droneX ? .6 : 1));
      for (let i = 0; i < dn; i++) {
        const a = w.droneA + i * 6.2832 / dn, dx = p.x + Math.cos(a) * 62, dy = p.y + Math.sin(a) * 62, tgt = nearest(520, { x: dx, y: dy });
        if (tgt) { const ang = Math.atan2(tgt.y - dy, tgt.x - dx); G.bul.push({ x: dx, y: dy, vx: Math.cos(ang) * 820, vy: Math.sin(ang) * 820, life: .8, pierce: 0, hit: new Set(), dmg: w.dmg * .7, crit: false }); }
      }
    }
  }
  if (w.mine) {
    w.mineT -= wdt;
    if (w.mineT <= 0 && G.mines.length < 4 + w.mine * 2 + w.mineX) { w.mineT = Math.max(.7, 2.4 - w.mine * .25); G.mines.push({ x: p.x, y: p.y, t: 0 }); }
    for (const m of G.mines) { m.t += dt; if (m.t < .5) continue; for (const e of G.en) if (!e.dead && Math.hypot(e.x - m.x, e.y - m.y) < e.r + 34) { m.boom = true; break; } }
    for (const m of G.mines) if (m.boom) {
      const rad = (95 + w.mine * 8) * (1 + .15 * w.area); G.rings.push({ x: m.x, y: m.y, r: 5, max: rad, life: .3 }); burst(m.x, m.y, '#ffb347', 12, 200); addDecal(m.x, m.y, 45); sfx.boom();
      for (const e of G.en) if (!e.dead && Math.hypot(e.x - m.x, e.y - m.y) < rad + e.r) damageEnemy(e, w.dmg * (2.4 + .3 * w.mine));
      if (w.mineX >= 1) for (const o of G.mines) if (!o.boom && Math.hypot(o.x - m.x, o.y - m.y) < rad) o.boom = true;
    }
    G.mines = G.mines.filter(m => !m.boom);
  }
  if (w.grav) {
    w.gravT -= wdt;
    if (w.gravT <= 0) { w.gravT = Math.max(3.5, 8 - w.grav * .6); const gt = nearest(620); if (gt) G.wells.push({ x: gt.x, y: gt.y, life: 2.6 + w.grav * .25, tk: 0 }); }
    const GR = (190 + w.grav * 14) * (1 + .15 * w.area) * (w.gravX ? 1.4 : 1);
    for (const wl of G.wells) {
      wl.life -= dt; wl.tk -= dt;
      for (const e of G.en) {
        if (e.dead) continue; const dx = wl.x - e.x, dy = wl.y - e.y, dd = Math.hypot(dx, dy);
        if (dd < GR && dd > 1) { const heavy = e.type === 'boss' || e.type === 'titan', pull = heavy ? (w.gravX ? 60 : 0) : 210; e.x += dx / dd * pull * dt; e.y += dy / dd * pull * dt; }
      }
      if (wl.tk <= 0) { wl.tk = .25; for (const e of G.en) if (!e.dead && Math.hypot(wl.x - e.x, wl.y - e.y) < GR * .7 + e.r) damageEnemy(e, w.dmg * .45 * (1 + .1 * w.grav), false, true); }
    }
    G.wells = G.wells.filter(wl => wl.life > 0);
  }
  if (w.rico) {
    w.ricoT -= wdt;
    if (w.ricoT <= 0) { w.ricoT = Math.max(.9, 2.6 - w.rico * .25); const rt = nearest(650); if (rt) { G.discs.push({ x: p.x, y: p.y, tx: rt, n: 3 + w.rico + w.ricoX, hit: new Set(), life: 4, a: 0 }); sfx.shoot(); } }
  }
  if (G.discs.length) {
    const pickT = d => { let t = null, bd = 520; for (const e of G.en) { if (e.dead || d.hit.has(e)) continue; const dd = Math.hypot(e.x - d.x, e.y - d.y); if (dd < bd) { bd = dd; t = e; } } return t; };
    for (const d of G.discs) {
      d.life -= dt; if (!d.tx || d.tx.dead) d.tx = pickT(d);
      if (!d.tx) { d.life = 0; continue; }
      const ang = Math.atan2(d.tx.y - d.y, d.tx.x - d.x); d.x += Math.cos(ang) * 760 * dt; d.y += Math.sin(ang) * 760 * dt; d.a += dt * 18;
      if (Math.hypot(d.tx.x - d.x, d.tx.y - d.y) < d.tx.r + 12) {
        damageEnemy(d.tx, w.dmg * 1.4 * (1 + .1 * w.rico)); d.hit.add(d.tx); sfx.hit();
        if (w.prism && !d.split) { d.split = true; for (let k = 0; k < 2; k++) { const nt = pickT(d); if (nt) G.discs.push({ x: d.x, y: d.y, tx: nt, n: 2, hit: new Set(d.hit), life: 3, a: 0, split: true }); } }
        d.n--; d.tx = d.n > 0 ? pickT(d) : null; if (d.n <= 0) d.life = 0;
      }
    }
    G.discs = G.discs.filter(d => d.life > 0);
  }
  G.en = G.en.filter(e => !e.dead);
  G.bul = G.bul.filter(b => b.life > 0);

  // pickups
  for (const gm of G.gem) {
    const d = dist(gm, p);
    if (d < p.magnet || gm.fly) { gm.fly = true; const a = Math.atan2(p.y - gm.y, p.x - gm.x); gm.x += Math.cos(a) * 520 * dt; gm.y += Math.sin(a) * 520 * dt; }
    if (d < p.r + 9) { gm.got = true; G.xp += gm.v * G.xpMul * (G.ev.kind === 'moon' ? 2 : 1); sfx.gem(); if (G.rel.magcore && !G.cur.famine) G.p.hp = Math.min(G.p.max, G.p.hp + .15); }
  }
  G.gem = G.gem.filter(x => !x.got);
  for (const c of G.coin) {
    const d = dist(c, p);
    if (d < p.magnet * 1.3 || c.fly) { c.fly = true; const a = Math.atan2(p.y - c.y, p.x - c.x); c.x += Math.cos(a) * 520 * dt; c.y += Math.sin(a) * 520 * dt; }
    if (d < p.r + 10) { c.got = true; G.gold += c.v; sfx.coin(); floatText(p.x, p.y - 20, '+' + Math.max(1, Math.round(c.v)), '#ffd166', 14); }
  }
  G.coin = G.coin.filter(x => !x.got);
  for (const c of G.chest) if (!c.got && state === 'play' && dist(c, p) < p.r + 22) { c.got = true; sfx.level(); if (c.relic && RELICS.some(r => !G.rel[r.id])) offerRelics(); else { say('CHEST! Free upgrade', '#ffd166'); G.xp += G.need; } }
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
  for (const d of G.decals) d.l -= dt / 30; G.decals = G.decals.filter(d => d.l > 0);
  G.arcs = G.arcs.filter(a => a.life > 0);
  shake = Math.max(0, shake - dt * 30);
}

// ---------- rendering ----------
// ---------- visual helpers ----------
const _glow = {}, _off = {};
function glowSprite(col) {
  if (!col || col[0] !== '#' || col.length !== 7) col = '#ffffff';
  let c = _glow[col]; if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, col + 'ff'); gr.addColorStop(.3, col + '88'); gr.addColorStop(.65, col + '22'); gr.addColorStop(1, col + '00');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return _glow[col] = c;
}
function glowAdd(x, y, r, col, a) { if (BLm) bloomBlob(x, y, r * 2.2, col, a * .5); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; g.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
function vigSprite() {
  if (_off.vig) return _off.vig;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), gr = x.createRadialGradient(W / 2, H / 2, H * .38, W / 2, H / 2, H * .98);
  gr.addColorStop(0, 'rgba(0,0,8,0)'); gr.addColorStop(1, 'rgba(0,0,8,.62)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); return _off.vig = c;
}
function vigRedSprite() {
  if (_off.vigr) return _off.vigr;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), gr = x.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .9);
  gr.addColorStop(0, 'rgba(255,20,60,0)'); gr.addColorStop(1, 'rgba(255,20,60,.75)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); return _off.vigr = c;
}
function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function panel(r, border, hov, rad = 10) {
  rr(r.x, r.y, r.w, r.h, rad);
  const gr = g.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, hov ? '#33336d' : '#222250'); gr.addColorStop(1, hov ? '#1f1f48' : '#12122e');
  g.fillStyle = gr; g.fill(); g.lineWidth = 2.5; g.strokeStyle = hov ? '#ffe66d' : border; g.stroke();
  if (hov) { g.save(); g.globalCompositeOperation = 'lighter'; g.shadowColor = '#ffe66d'; g.shadowBlur = 18; g.stroke(); g.restore(); }
}
function bar(x, y, w, h, frac, c1, c2) {
  frac = Math.max(0, Math.min(1, frac));
  rr(x, y, w, h, h / 2); g.fillStyle = 'rgba(0,0,10,.62)'; g.fill();
  if (frac > 0) { g.save(); rr(x, y, w, h, h / 2); g.clip(); const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(x, y, w * frac, h); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, y, w * frac, h * .4); g.restore(); }
  rr(x, y, w, h, h / 2); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.28)'; g.stroke();
}
function title(s, y, size = 44, c1 = '#ffe66d', c2 = '#ff9f43') {
  g.font = 'bold ' + size + 'px system-ui, sans-serif'; g.textAlign = 'center';
  const gr = g.createLinearGradient(W / 2 - 220, y - size, W / 2 + 220, y); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
  g.save(); g.shadowColor = c2; g.shadowBlur = 20; g.lineWidth = 7; g.lineJoin = 'round'; g.strokeStyle = '#0a0a18'; g.strokeText(s, W / 2, y); g.fillStyle = gr; g.fillText(s, W / 2, y); g.restore();
}
const CHAR_COL = { ranger: '#5eead4', mage: '#a0e7ff', warden: '#ffd166', pyro: '#ff8a3d', hunter: '#c77dff', jugg: '#9ad1ff', blink: '#ff5db1', eng: '#7df9ff', grav: '#a06bff' };
const charCol = id => CHAR_COL[id || save.char] || '#5eead4';
const HQ = () => save.settings.gfx === 1;
const PAL_TINT = ['#3a2bff', '#b14dff', '#ff2e63', '#00d9b8', '#d9c200'];
const bgStars = []; for (let i = 0; i < 150; i++) bgStars.push({ x: vr(0, W), y: vr(0, H), z: vr(.05, .38), s: vr(1, 2.6), a: vr(.3, .9) });
const _blc = document.createElement('canvas'); _blc.width = 320; _blc.height = 180; const _blg = _blc.getContext('2d');
let BLm = null, _box = 0, _boy = 0;
function bloomBegin(ox, oy) { _blg.globalCompositeOperation = 'source-over'; _blg.globalAlpha = 1; _blg.clearRect(0, 0, 320, 180); _blg.globalCompositeOperation = 'screen'; BLm = _blg; _box = ox; _boy = oy; }
function bloomBlob(x, y, r, col, a) { if (!BLm) return; const sx = (x + _box) * .25, sy = (y + _boy) * .25, rr = r * .25; if (sx < -rr || sy < -rr || sx > 320 + rr || sy > 180 + rr) return; BLm.globalAlpha = a; BLm.drawImage(glowSprite(col), sx - rr, sy - rr, rr * 2, rr * 2); }
function bloomEnd() { if (!BLm) return; BLm = null; g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = .7 * Math.max(.45, 1 - G.en.length / 650); g.imageSmoothingEnabled = true; g.drawImage(_blc, 0, 0, W, H); g.restore(); }
const _spr = {};
function enemySprite(type, col, r) {
  const key = type + col + Math.round(r); let c = _spr[key]; if (c) return c;
  const S = Math.ceil(r * 3.6) + 6, R = r; c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.translate(S / 2, S / 2);
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  const polyP = (rad, n, rot) => () => { x.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * 6.2832; x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad); } x.closePath(); };
  const circP = rad => () => { x.beginPath(); x.arc(0, 0, rad, 0, 6.2832); };
  const body = path => { const gr = x.createRadialGradient(-R * .35, -R * .35, R * .1, 0, 0, R * 1.5); gr.addColorStop(0, shade(col, .6)); gr.addColorStop(.55, col); gr.addColorStop(1, shade(col, -.6)); x.fillStyle = gr; path(); x.fill(); x.lineJoin = 'round'; x.lineWidth = 2.4; x.strokeStyle = shade(col, -.75); x.stroke(); x.lineWidth = 1; x.strokeStyle = 'rgba(255,255,255,.32)'; x.stroke(); };
  const dot = (px, py, rad, fill) => { x.fillStyle = fill; x.beginPath(); x.arc(px, py, rad, 0, 6.2832); x.fill(); };
  const eye = (px, py, er) => { dot(px, py, er, '#fff'); dot(px + er * .35, py, er * .55, '#12121c'); };
  switch (type) {
    case 'runner': body(polyP(R * 1.4, 3, 0)); x.fillStyle = shade(col, -.45); polyP(R * .7, 3, 0)(); x.fill(); eye(R * .2, 0, R * .3); break;
    case 'brute': body(polyP(R * 1.15, 4, .785)); x.fillStyle = shade(col, -.4); polyP(R * .7, 4, .785)(); x.fill(); x.fillStyle = '#ff5d5d'; x.fillRect(R * .1, -R * .36, R * .3, R * .12); x.fillRect(R * .1, R * .24, R * .3, R * .12); break;
    case 'shooter': body(polyP(R * 1.3, 4, 0)); dot(0, 0, R * .5, '#0b3a20'); dot(0, 0, R * .34, '#3dff9a'); dot(-R * .08, -R * .08, R * .12, '#eafff4'); break;
    case 'exploder': { x.fillStyle = shade(col, -.25); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; x.beginPath(); x.moveTo(Math.cos(a - .22) * R * .9, Math.sin(a - .22) * R * .9); x.lineTo(Math.cos(a) * R * 1.45, Math.sin(a) * R * 1.45); x.lineTo(Math.cos(a + .22) * R * .9, Math.sin(a + .22) * R * .9); x.fill(); } body(circP(R)); dot(0, 0, R * .42, '#ffd66b'); dot(0, 0, R * .22, '#fff7c9'); break; }
    case 'bat': x.beginPath(); x.moveTo(R * .6, 0); x.lineTo(-R * 1.3, -R * 1.5); x.lineTo(-R * .5, -R * .1); x.lineTo(-R * .5, R * .1); x.lineTo(-R * 1.3, R * 1.5); x.closePath(); { const gr = x.createLinearGradient(-R * 1.3, 0, R * .6, 0); gr.addColorStop(0, shade(col, -.5)); gr.addColorStop(1, shade(col, .35)); x.fillStyle = gr; x.fill(); x.lineWidth = 2; x.strokeStyle = shade(col, -.75); x.stroke(); } dot(R * .1, -R * .22, R * .16, '#ff4d6d'); dot(R * .1, R * .22, R * .16, '#ff4d6d'); break;
    case 'charger': x.fillStyle = shade(col, -.35); x.beginPath(); x.moveTo(R * 1.6, 0); x.lineTo(R * .6, -R * .5); x.lineTo(R * .6, R * .5); x.closePath(); x.fill(); body(polyP(R * 1.2, 5, 0)); dot(R * .15, 0, R * .4, '#2a0d05'); dot(R * .25, 0, R * .2, '#ff9a5c'); break;
    case 'sniper': body(polyP(R * 1.4, 4, 0)); dot(R * .2, 0, R * .5, '#06222a'); dot(R * .2, 0, R * .32, '#7df9ff'); x.fillStyle = '#fff'; x.fillRect(R * .2, -R * .05, R * 1.1, R * .1); break;
    case 'healer': body(circP(R)); x.fillStyle = '#eafff0'; x.fillRect(-R * .16, -R * .6, R * .32, R * 1.2); x.fillRect(-R * .6, -R * .16, R * 1.2, R * .32); break;
    case 'warper': body(polyP(R * 1.2, 6, 0)); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; circP(R * .6)(); x.stroke(); dot(0, 0, R * .22, '#fff'); break;
    case 'swarmling': body(circP(R)); dot(R * .3, 0, R * .28, '#fff'); break;
    case 'goblin': body(polyP(R * 1.35, 5, 0)); dot(0, 0, R * .55, '#fff3b0'); dot(0, 0, R * .35, '#e0a516'); x.fillStyle = '#7a4d00'; x.font = 'bold ' + Math.round(R * .6) + 'px sans-serif'; x.textAlign = 'center'; x.fillText('$', 0, R * .22); break;
    case 'elite': body(polyP(R * 1.2, 6, 0)); x.strokeStyle = shade(col, -.6); x.lineWidth = 3; circP(R * .62)(); x.stroke(); dot(0, 0, R * .3, 'rgba(0,0,0,.45)'); eye(R * .05, 0, R * .26); break;
    case 'boss': body(polyP(R * 1.2, 8, 0)); x.strokeStyle = shade(col, -.6); x.lineWidth = 4; circP(R * .72)(); x.stroke(); dot(0, 0, R * .5, '#14040a'); dot(R * .08, 0, R * .34, '#fff'); dot(R * .18, 0, R * .17, '#ff2e63'); break;
    case 'titan': body(polyP(R * 1.25, 12, 0)); x.fillStyle = 'rgba(255,255,255,.14)'; polyP(R * .9, 6, 0)(); x.fill(); dot(0, 0, R * .5, '#12041f'); dot(0, 0, R * .26, '#ff2e63'); dot(-R * .06, -R * .06, R * .09, '#ffd0dc'); break;
    default: body(circP(R)); eye(R * .38, -R * .34, R * .26); eye(R * .38, R * .34, R * .26);
  }
  return _spr[key] = c;
}
const swarmDeco = []; for (let i = 0; i < 80; i++) swarmDeco.push({ a: vr(0, 6.28), r: vr(.35, 1), sp: vr(.04, .16) * (i % 2 ? 1 : -1), sz: vr(4, 10), k: i % 4, col: ['#e0476b', '#ff9f43', '#9b59d0', '#3ddc97'][i % 4] });
function text(s, x, y, size, col = '#fff', align = 'center', bold = true) {
  g.font = (bold ? 'bold ' : '') + size + 'px system-ui, sans-serif'; g.textAlign = align;
  if (size >= 13) { g.lineWidth = Math.max(2, size / 7); g.strokeStyle = 'rgba(0,0,10,.6)'; g.lineJoin = 'round'; g.strokeText(s, x, y); }
  g.fillStyle = col; g.fillText(s, x, y);
}
function circle(x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); }
function poly(x, y, r, n, rot, col) { g.fillStyle = col; g.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * 6.2832; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); }
function button(r, label, col = '#6c63ff', sub, labelCol = '#fff') {
  const hov = inR(r);
  panel(r, col, hov, 12);
  g.fillStyle = col; g.globalAlpha = hov ? .9 : .6; rr(r.x + 6, r.y + 8, 4, r.h - 16, 2); g.fill(); g.globalAlpha = 1;
  text(label, r.x + r.w / 2, r.y + r.h / 2 + (sub ? -2 : 7), r.w < 250 || r.h < 50 ? 18 : 22, labelCol);
  if (sub) text(sub, r.x + r.w / 2, r.y + r.h / 2 + 17, 13, '#9ab', 'center', false);
}
function drawEnemy(e, pl) {
  const a = Math.atan2(pl.y - e.y, pl.x - e.x), spr = enemySprite(e.type, e.col, e.r);
  let rot = a;
  switch (e.type) { case 'elite': rot = G.t * 2; break; case 'boss': rot = G.t; break; case 'titan': rot = -G.t * .6; break; case 'warper': rot = G.t * 4; break; case 'goblin': rot = G.t * 5; break; case 'healer': case 'swarmling': case 'exploder': case 'brute': case 'shooter': rot = 0; }
  const sc = e.type === 'exploder' && e.fuse > 0 ? 1 + e.fuse * .8 : 1, bob = e.type === 'bat' ? Math.sin(G.t * 12 + e.ph) * 2 : 0;
  g.save(); g.translate(e.x, e.y + bob); g.rotate(rot); if (sc !== 1) g.scale(sc, sc); g.drawImage(spr, -spr.width / 2, -spr.height / 2); g.restore();
  if (e.type === 'exploder') { g.save(); g.translate(e.x, e.y); g.rotate(G.t * 3); poly(0, 0, e.r * 1.55, 8, 0, 'rgba(255,200,0,.22)'); g.restore(); }
  if (e.flash > 0) glowAdd(e.x, e.y, e.r * 1.7, '#ffffff', .8);
  if (e.type === 'exploder' && e.fuse > 0 && Math.floor(e.fuse * 20) % 2) glowAdd(e.x, e.y, e.r * 2.4, '#ffffff', .9);
  if (e.type === 'charger' && e.cs === 'wind') glowAdd(e.x, e.y, e.r * 2.2, '#ffffff', .7);
  if (e.type === 'sniper' && e.tel > 0) glowAdd(e.x, e.y, e.r * 2.2, '#7df9ff', .8);
}
function drawWorld() {
  const cam = G.cam, pal = PALETTES[Math.floor(G.t / 300) % PALETTES.length], sk = save.settings.shake ? shake : 0;
  const ox = W / 2 - cam.x + (sk ? vr(-sk, sk) : 0), oy = H / 2 - cam.y + (sk ? vr(-sk, sk) : 0);
  { const bgG = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 820); bgG.addColorStop(0, pal[1]); bgG.addColorStop(1, pal[0]); g.fillStyle = bgG; g.fillRect(0, 0, W, H); }
  if (G.ev.kind === 'moon') { g.fillStyle = 'rgba(140,0,30,.24)'; g.fillRect(0, 0, W, H); }
  const tint = PAL_TINT[Math.floor(G.t / 300) % PAL_TINT.length];
  if (HQ()) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = .13; for (let i = 0; i < 3; i++) { const bw = W + 700, bh = H + 500, px = ((i * 533 - cam.x * .12) % bw + bw) % bw - 350, py = ((i * 317 - cam.y * .12) % bh + bh) % bh - 250; g.drawImage(glowSprite(tint), px - 380, py - 380, 760, 760); } g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  for (const st of bgStars) { const x = ((st.x - cam.x * st.z) % W + W) % W, y = ((st.y - cam.y * st.z) % H + H) % H; g.globalAlpha = st.a * (.55 + .45 * Math.sin(G.t * 2 + st.x)); g.fillStyle = '#fff'; g.fillRect(x, y, st.s, st.s); }
  g.globalAlpha = 1;
  g.strokeStyle = pal[1]; g.lineWidth = 1; g.beginPath();
  const gs = 80, sx = -((cam.x - W / 2) % gs), sy = -((cam.y - H / 2) % gs);
  for (let x = sx; x < W; x += gs) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = sy; y < H; y += gs) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();
  if (HQ()) {
    const rs = 280, rx0 = Math.floor((cam.x - W / 2) / rs) - 1, ry0 = Math.floor((cam.y - H / 2) / rs) - 1;
    g.strokeStyle = tint; g.globalAlpha = .14; g.lineWidth = 2;
    for (let ix = rx0; ix < rx0 + Math.ceil(W / rs) + 3; ix++) for (let iy = ry0; iy < ry0 + Math.ceil(H / rs) + 3; iy++) {
      const h = ((ix * 73856093) ^ (iy * 19349663)) >>> 0; if (h % 5) continue;
      const cx = ix * rs + (h % 97) - cam.x + W / 2, cy = iy * rs + ((h >> 8) % 97) - cam.y + H / 2;
      g.beginPath(); g.arc(cx, cy, 38 + (h % 3) * 14, 0, 6.2832); g.stroke(); g.beginPath();
      for (let k = 0; k < 6; k++) { const aa = k / 6 * 6.2832 + (h % 7); g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(aa) * 26, cy + Math.sin(aa) * 26); } g.closePath(); g.stroke();
    }
    g.globalAlpha = 1;
  }
  if (HQ()) bloomBegin(ox, oy);
  g.save(); g.translate(ox, oy);
  const p = G.p;
  for (const d of G.decals) { g.fillStyle = `rgba(0,0,0,${.35 * d.l})`; g.beginPath(); g.arc(d.x, d.y, d.r, 0, 6.2832); g.fill(); g.strokeStyle = `rgba(255,120,40,${.25 * d.l})`; g.lineWidth = 3; g.beginPath(); g.arc(d.x, d.y, d.r * .8, 0, 6.2832); g.stroke(); }
  g.globalCompositeOperation = 'lighter'; for (const r of G.rings) { const al = Math.max(0, r.life) / (r.l0 || .4); g.strokeStyle = `rgba(130,205,255,${al})`; g.lineWidth = 8 * al + 2; g.beginPath(); g.arc(r.x, r.y, Math.max(1, r.r), 0, 6.2832); g.stroke(); g.fillStyle = `rgba(130,205,255,${al * .1})`; g.fill(); } g.globalCompositeOperation = 'source-over';
  for (const gm of G.gem) { if (HQ()) glowAdd(gm.x, gm.y, 15, '#4cc9f0', .55); g.save(); g.translate(gm.x, gm.y); g.rotate(.785); g.fillStyle = '#4cc9f0'; g.fillRect(-5, -5, 10, 10); g.fillStyle = '#fff'; g.fillRect(-2, -2, 4, 4); g.restore(); }
  for (const c of G.coin) { if (HQ()) glowAdd(c.x, c.y, 16, '#ffd166', .5); circle(c.x, c.y, 7, '#ffd166'); circle(c.x, c.y, 4, '#e09f1f'); }
  for (const m of G.meteors) { const k = Math.min(1, m.t / m.warn); g.fillStyle = `rgba(255,80,60,${.12 + .3 * k})`; g.beginPath(); g.arc(m.x, m.y, m.r, 0, 6.2832); g.fill(); g.strokeStyle = `rgba(255,140,80,${.5 + .5 * k})`; g.lineWidth = 3; g.beginPath(); g.arc(m.x, m.y, m.r * (1 - .15 * k), 0, 6.2832); g.stroke(); }
  if (G.zone) {
    g.fillStyle = 'rgba(50,0,100,.42)'; g.beginPath(); g.rect(G.cam.x - 900, G.cam.y - 600, 1800, 1200); g.arc(G.zone.x, G.zone.y, G.zone.r, 0, 6.2832, true); g.fill('evenodd');
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(190,120,255,.9)'; g.lineWidth = 7; g.shadowColor = '#b14dff'; g.shadowBlur = 22; g.beginPath(); g.arc(G.zone.x, G.zone.y, G.zone.r, 0, 6.2832); g.stroke(); g.restore();
  }
  for (const c of G.chest) {
    const col = c.relic ? '#c77dff' : '#ffd166', pulse = .5 + .5 * Math.sin(G.t * 4 + c.x);
    g.save(); g.globalCompositeOperation = 'lighter'; const pg = g.createLinearGradient(0, c.y - 280, 0, c.y); pg.addColorStop(0, 'rgba(0,0,0,0)'); pg.addColorStop(1, c.relic ? 'rgba(199,125,255,.6)' : 'rgba(255,209,102,.5)'); g.fillStyle = pg; g.fillRect(c.x - 10 - 4 * pulse, c.y - 280, 20 + 8 * pulse, 280); g.restore();
    glowAdd(c.x, c.y, 58 + 8 * pulse, col, .55);
    g.strokeStyle = col; g.globalAlpha = .6; g.lineWidth = 3; g.beginPath(); g.arc(c.x, c.y, 26 + 10 * pulse, 0, 6.2832); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = c.relic ? '#8f5bd6' : '#c98a1b'; g.fillRect(c.x - 16, c.y - 12, 32, 24); g.fillStyle = '#ffd166'; g.fillRect(c.x - 16, c.y - 4, 32, 6); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(c.x - 16, c.y - 12, 32, 24);
    text(c.relic ? '♦ RELIC' : 'CHEST', c.x, c.y - 30 - 4 * pulse, 13, col);
  }
  const glowK = Math.min(1, 70 / Math.max(1, G.en.length));
  for (const e of G.en) {
    if (HQ()) glowAdd(e.x, e.y, e.r * 2.1, e.col, (e.flash > 0 ? .45 : .24) * glowK);
    drawEnemy(e, p);
    if (e.burn > 0) glowAdd(e.x, e.y, e.r * 1.7, '#ff7a1a', .5);
    if (e.chill > 0) glowAdd(e.x, e.y, e.r * 1.7, '#9be7ff', .45);
    if (e.af) { g.strokeStyle = AFFIX[e.af].col; g.lineWidth = 3; g.beginPath(); g.arc(e.x, e.y, e.r * 1.35, 0, 6.2832); g.stroke(); }
    if (e.champ) { g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.beginPath(); g.arc(e.x, e.y, e.r * 1.65, 0, 6.2832); g.stroke(); }
    if (e.af && (e.type === 'elite' || e.type === 'boss' || e.champ)) text(AFFIX[e.af].n, e.x, e.y - e.r - 24, 11, AFFIX[e.af].col);
    if (e.type === 'boss' || e.type === 'elite' || e.type === 'titan' || e.champ) { const bw = Math.min(160, e.r * 2.2); g.fillStyle = '#000'; g.fillRect(e.x - bw / 2, e.y - e.r - 16, bw, 7); g.fillStyle = e.col; g.fillRect(e.x - bw / 2, e.y - e.r - 16, bw * Math.max(0, e.hp / e.max), 7); }
  }
  g.globalCompositeOperation = 'lighter';
  for (const e of G.en) {
    if (e.cs === 'wind') { g.strokeStyle = 'rgba(255,110,60,.42)'; g.lineWidth = e.type === 'boss' ? 26 : 8; g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x + Math.cos(e.cdir) * 650, e.y + Math.sin(e.cdir) * 650); g.stroke(); }
    if (e.type === 'sniper' && e.tel > 0) { g.strokeStyle = `rgba(125,249,255,${.25 + .6 * (1 - e.tel / .85)})`; g.lineWidth = 3; g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x + Math.cos(e.aim) * 1000, e.y + Math.sin(e.aim) * 1000); g.stroke(); }
  }
  for (const b of G.beams) {
    const act = b.t > b.warn, x2 = b.owner.x + Math.cos(b.a) * 1500, y2 = b.owner.y + Math.sin(b.a) * 1500;
    g.strokeStyle = act ? 'rgba(255,80,80,.9)' : `rgba(255,120,120,${.15 + .4 * (b.t / b.warn)})`; g.lineWidth = act ? 26 : 4;
    g.beginPath(); g.moveTo(b.owner.x, b.owner.y); g.lineTo(x2, y2); g.stroke();
    if (act) { g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 9; g.stroke(); }
  }
  g.globalCompositeOperation = 'source-over';
  for (const b of G.eb) { glowAdd(b.x, b.y, b.r * 3, '#ff4d6d', .6); circle(b.x, b.y, b.r, '#ff4d6d'); circle(b.x, b.y, b.r * .5, '#fff'); }
  g.lineCap = 'round';
  g.globalCompositeOperation = 'lighter'; for (const b of G.bul) { g.strokeStyle = b.crit ? '#ff9f43' : '#ffe66d'; g.lineWidth = b.crit ? 7 : 5; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * .03, b.y - b.vy * .03); g.stroke(); bloomBlob(b.x, b.y, 40, b.crit ? '#ff9f43' : '#ffe66d', .3); } g.globalCompositeOperation = 'source-over';
  for (const b of G.boomr) { g.save(); g.translate(b.x, b.y); g.rotate(G.t * 14); g.fillStyle = '#c7f9ff'; g.fillRect(-14, -4, 28, 8); g.fillRect(-4, -14, 8, 28); g.restore(); }
  for (const m of G.mis) { g.save(); g.translate(m.x, m.y); g.rotate(m.a); g.fillStyle = '#ff9f43'; g.fillRect(-9, -3, 18, 6); g.fillStyle = '#fff'; g.fillRect(5, -2, 5, 4); g.restore(); }
  for (const a of G.arcs) { g.strokeStyle = `rgba(160,220,255,${a.life / .15})`; g.lineWidth = 4; g.beginPath(); a.pts.forEach((q, i) => { const jx = i ? vr(-8, 8) : 0, jy = i ? vr(-8, 8) : 0; g[i ? 'lineTo' : 'moveTo'](q.x + jx, q.y + jy); }); g.stroke(); }
  for (let i = 0; i < G.w.blades; i++) { const a = G.w.bladeA + i * Math.PI * 2 / G.w.blades, bx = p.x + Math.cos(a) * G.w.bladeR, by = p.y + Math.sin(a) * G.w.bladeR; glowAdd(bx, by, 28, '#c7f9ff', .6); circle(bx, by, 12, '#c7f9ff'); circle(bx, by, 5, '#fff'); }
  if (G.w.drone) { const dn = G.w.drone + G.w.droneX; for (let i = 0; i < dn; i++) { const a = G.w.droneA + i * 6.2832 / dn, dx = p.x + Math.cos(a) * 62, dy = p.y + Math.sin(a) * 62; glowAdd(dx, dy, 24, '#7df9ff', .65); circle(dx, dy, 7, '#bff7ff'); circle(dx, dy, 3, '#06363d'); } }
  for (const m of G.mines) { const arm = m.t > .5, bl = arm && Math.floor(G.t * 4) % 2; glowAdd(m.x, m.y, 26, arm ? '#ffb347' : '#999999', bl ? .75 : .35); circle(m.x, m.y, 9, '#3a2a10'); circle(m.x, m.y, 4, arm ? '#ff7a1a' : '#665'); }
  for (const wl of G.wells) {
    const R = (190 + G.w.grav * 14) * (1 + .15 * G.w.area) * (G.w.gravX ? 1.4 : 1), k = Math.min(1, wl.life / .5);
    g.globalCompositeOperation = 'lighter'; for (let r = 0; r < 3; r++) { g.strokeStyle = `rgba(160,100,255,${.4 * k})`; g.lineWidth = 3; g.beginPath(); g.arc(wl.x, wl.y, R * ((G.t * .8 + r / 3) % 1), 0, 6.2832); g.stroke(); } g.globalCompositeOperation = 'source-over';
    glowAdd(wl.x, wl.y, 70, '#8a4dff', .85 * k); circle(wl.x, wl.y, 14, '#10051f');
  }
  for (const d of G.discs) { glowAdd(d.x, d.y, 30, '#ffd166', .75); g.save(); g.translate(d.x, d.y); g.rotate(d.a); g.fillStyle = '#ffe9a8'; g.fillRect(-13, -3, 26, 6); g.fillRect(-3, -13, 6, 26); g.restore(); circle(d.x, d.y, 5, '#fff'); }
  if (G.rel.aegis && G.aegisT <= 0 && state !== 'over') { g.strokeStyle = 'rgba(154,209,255,.55)'; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, p.r * 2.1, 0, 6.2832); g.stroke(); }
  if (state !== 'over') {
    const blink = p.inv > 0 && Math.floor(G.t * 20) % 2;
    if (!blink) {
      const pc = charCol(); glowAdd(p.x, p.y, 50, pc, .6);
      for (const tr of G.trail) glowAdd(tr.x, tr.y, 8 + tr.l * 40, pc, tr.l * 1.2);
      if (G.dash > 0) circle(p.x, p.y, p.r * 1.8, 'rgba(94,234,212,.3)');
      circle(p.x, p.y, p.r + 3, 'rgba(255,255,255,.16)');
      { const pg = g.createRadialGradient(p.x - 4, p.y - 4, 1, p.x, p.y, p.r); pg.addColorStop(0, '#fff'); pg.addColorStop(.45, pc); pg.addColorStop(1, '#0d2f33'); g.fillStyle = pg; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.2832); g.fill(); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.stroke(); }
      g.save(); g.translate(p.x, p.y); g.rotate(p.face); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(p.r + 10, 0); g.lineTo(p.r, -6); g.lineTo(p.r, 6); g.closePath(); g.fill(); g.restore();
    }
  }
  g.globalCompositeOperation = 'lighter'; for (const q of G.part) { const k = Math.min(1, q.life * 2.5), sz = (q.sz || 14) * (.4 + .6 * k); g.globalAlpha = Math.min(1, q.life * 3); g.drawImage(glowSprite(q.col), q.x - sz / 2, q.y - sz / 2, sz, sz); bloomBlob(q.x, q.y, sz * 2, q.col, Math.min(.3, q.life * .8)); } g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  for (const t of G.txt) { g.globalAlpha = Math.min(1, t.life * 3); const k = 1 + Math.max(0, t.life - .42) * 3.2; text(t.s, t.x, t.y, Math.round(t.size * k), t.col); }
  g.globalAlpha = 1;
  g.restore();
  bloomEnd();
  g.drawImage(vigSprite(), 0, 0);
  if (levelFlash > 0) { g.fillStyle = `rgba(200,230,255,${levelFlash * .55})`; g.fillRect(0, 0, W, H); }
  if (hurtFlash > 0) { g.globalAlpha = Math.min(1, hurtFlash * 2.4); g.drawImage(vigRedSprite(), 0, 0); g.globalAlpha = 1; }
}
function drawIndicators() {
  const cam = G.cam, mx = 40, my = 46, T = [];
  for (const e of G.en) if (!e.dead && (e.type === 'boss' || e.type === 'titan' || e.type === 'goblin' || e.type === 'elite')) T.push({ x: e.x, y: e.y, col: e.type === 'goblin' ? '#ffd166' : e.type === 'elite' ? '#ffb347' : e.col, big: e.type === 'boss' || e.type === 'titan', gl: e.type === 'goblin' ? '$' : e.type === 'elite' ? '✦' : '☠', pri: e.type === 'boss' || e.type === 'titan' ? 5 : e.type === 'goblin' ? 4 : 2 });
  for (const c of G.chest) T.push({ x: c.x, y: c.y, col: c.relic ? '#c77dff' : '#ffd166', big: !!c.relic, gl: c.relic ? '♦' : '▣', pri: c.relic ? 4.5 : 3 });
  const off = T.filter(t => { const dx = t.x - cam.x, dy = t.y - cam.y; return !(Math.abs(dx) < W / 2 - 10 && Math.abs(dy) < H / 2 - 10); }).sort((a, b) => b.pri - a.pri).slice(0, 12);
  for (const t of off) {
    const dx = t.x - cam.x, dy = t.y - cam.y, dd = Math.hypot(dx, dy), pulse = .5 + .5 * Math.sin(G.t * 5 + dx);
    const k = Math.min((W / 2 - mx) / Math.max(1e-6, Math.abs(dx)), (H / 2 - my) / Math.max(1e-6, Math.abs(dy))), px = W / 2 + dx * k, py = H / 2 + dy * k, a = Math.atan2(dy, dx), sz = (t.big ? 16 : 11) + (t.pri >= 4 ? 2 * pulse : 0);
    glowAdd(px, py, sz * 2.8, t.col.length === 7 ? t.col : '#ffffff', .7 + .2 * pulse);
    g.save(); g.translate(px, py); g.rotate(a); g.fillStyle = t.col; g.strokeStyle = 'rgba(0,0,10,.75)'; g.lineWidth = 2; g.beginPath(); g.moveTo(sz, 0); g.lineTo(-sz * .7, -sz * .75); g.lineTo(-sz * .35, 0); g.lineTo(-sz * .7, sz * .75); g.closePath(); g.fill(); g.stroke(); g.restore();
    const lx = px - Math.cos(a) * (sz + 22), ly = py - Math.sin(a) * (sz + 16) + 4;
    text(t.gl + ' ' + Math.round(dd / 10) + 'm', lx, ly, 12, t.col);
  }
}
function drawMinimap() {
  if (!save.settings.mini) return;
  const S = 156, x0 = W - S - 20, y0 = 166, cx = x0 + S / 2, cy = y0 + S / 2, sc = (S / 2 - 6) / 1150, p = G.p;
  g.save(); rr(x0, y0, S, S, 14); g.fillStyle = 'rgba(4,6,22,.62)'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(140,160,255,.45)'; g.stroke(); g.clip();
  g.strokeStyle = 'rgba(140,160,255,.14)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, S * .22, 0, 6.2832); g.moveTo(cx + S * .42, cy); g.arc(cx, cy, S * .42, 0, 6.2832); g.stroke();
  const pt = (x, y) => [cx + (x - p.x) * sc, cy + (y - p.y) * sc], cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (G.zone) { const [zx, zy] = pt(G.zone.x, G.zone.y); g.strokeStyle = 'rgba(190,120,255,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(zx, zy, G.zone.r * sc, 0, 6.2832); g.stroke(); }
  for (const m of G.meteors) { const [qx, qy] = pt(m.x, m.y); g.fillStyle = 'rgba(255,110,60,.7)'; g.beginPath(); g.arc(qx, qy, Math.max(2, m.r * sc), 0, 6.2832); g.fill(); }
  g.fillStyle = 'rgba(255,90,110,.75)';
  for (const e of G.en) { if (e.dead || e.type === 'boss' || e.type === 'titan' || e.type === 'elite' || e.type === 'goblin') continue; const [qx, qy] = pt(e.x, e.y); if (qx < x0 || qy < y0 || qx > x0 + S || qy > y0 + S) continue; g.fillRect(qx - 1, qy - 1, 2, 2); }
  for (const c of G.chest) { const [qx, qy] = pt(c.x, c.y); g.fillStyle = c.relic ? '#c77dff' : '#ffd166'; g.save(); g.translate(cl(qx, x0 + 8, x0 + S - 8), cl(qy, y0 + 8, y0 + S - 8)); g.rotate(.785); g.fillRect(-3.5, -3.5, 7, 7); g.restore(); }
  for (const e of G.en) { if (e.dead || !(e.type === 'boss' || e.type === 'titan' || e.type === 'elite' || e.type === 'goblin')) continue; const [qx, qy] = pt(e.x, e.y), big = e.type === 'boss' || e.type === 'titan'; g.fillStyle = e.type === 'goblin' ? '#ffd166' : e.type === 'elite' ? '#ffb347' : '#ff4d8d'; g.beginPath(); g.arc(cl(qx, x0 + 8, x0 + S - 8), cl(qy, y0 + 8, y0 + S - 8), big ? 5 + 1.5 * Math.sin(G.t * 6) : 3.5, 0, 6.2832); g.fill(); }
  g.fillStyle = charCol(); g.beginPath(); g.arc(cx, cy, 3.5, 0, 6.2832); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke();
  g.restore();
}
const WEAPON_IDS = new Set(['multi', 'pierce', 'blades', 'nova', 'light', 'boom', 'missile', 'flame', 'drone', 'mine', 'grav', 'rico']);
const STATUS_IDS = new Set(['burn', 'chill', 'exec', 'critd', 'crit']);
const abbr = n => { const w = n.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean); return (w[0][0] + (w[1] ? w[1][0] : (w[0][1] || ''))).toUpperCase(); };
function drawTray() {
  const items = [];
  for (const u of UPG) if (G.lv[u.id]) items.push({ t: abbr(u.n), lv: G.lv[u.id], mx: u.max, col: WEAPON_IDS.has(u.id) ? '#4cc9f0' : STATUS_IDS.has(u.id) ? '#ff9f43' : '#5eead4' });
  for (const e of EVO) if (G.evo[e.id]) items.push({ t: '★', lv: 0, col: '#ffd166', big: true });
  for (const id of G.relics) items.push({ t: RELIC_BY[id].n[0], lv: 0, col: RELIC_BY[id].col, big: true });
  const sz = 30, gap = 5, perRow = 15;
  items.forEach((it, i) => {
    const row = Math.floor(i / perRow), c = i % perRow, x = 20 + c * (sz + gap), y = H - 20 - sz - row * (sz + gap);
    rr(x, y, sz, sz, 8); g.fillStyle = 'rgba(8,8,28,.82)'; g.fill(); g.lineWidth = 2; g.strokeStyle = it.col; g.stroke();
    text(it.t, x + sz / 2, y + sz / 2 + 5, it.big ? 15 : 13, it.col);
    if (it.lv) text(String(it.lv), x + sz - 3, y + sz - 3, 10, it.lv >= it.mx ? '#ffd166' : '#fff', 'right');
  });
}
function drawHUD() {
  const p = G.p;
  g.fillStyle = 'rgba(0,0,10,.6)'; g.fillRect(0, 0, W, 20);
  { const xf = Math.min(1, G.xp / G.need), xg = g.createLinearGradient(0, 0, W, 0); xg.addColorStop(0, '#4cc9f0'); xg.addColorStop(1, '#b14dff'); g.fillStyle = xg; g.fillRect(0, 0, W * xf, 20); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, 0, W * xf, 7); }
  text('LV ' + G.lvl, W / 2, 16, 14, '#fff');
  bar(20, 34, 270, 24, p.hp / p.max, p.hp / p.max > .3 ? '#ff6b8a' : '#ff2a2a', p.hp / p.max > .3 ? '#d6264f' : '#a80000');
  text(Math.ceil(Math.max(0, p.hp)) + ' / ' + Math.round(p.max), 155, 52, 14);
  bar(20, 64, 270, 9, G.dashT <= 0 ? 1 : 1 - G.dashT / G.w.dashCd, G.dashT <= 0 ? '#7ff5e1' : '#2b8f84', G.dashT <= 0 ? '#2bb8a6' : '#1d5c55');
  text((G.ai ? 'AI SPECTATOR' : touch.on ? 'DASH button: dodge' : 'SPACE: dash') + (G.nm ? '   ☠ NIGHTMARE' : '') + (G.daily ? '   ★ DAILY' : '') + (G.heat ? '   HEAT ' + G.heat : ''), 20, 92, 12, G.nm ? '#ff6b6b' : '#98a', 'left', false);
  if (G.ai || G.assisted) text('Spectator runs earn no gold or records', 20, 108, 12, '#7fb0d8', 'left', false);
  text(fmt(G.t), W / 2, 62, 34);
  if (!G.won && G.t < TUNE.titanTime) text('Void Titan in ' + fmt(TUNE.titanTime - G.t), W / 2, 84, 13, '#b14dff', 'center', false);
  text('Kills ' + G.kills, W - 24, 56, 20, '#fff', 'right');
  text('Gold ' + Math.floor(G.gold), W - 24, 82, 18, '#ffd166', 'right');
  text('Score ' + calcScore() + (G.curseMult > 1 ? '  (x' + G.curseMult.toFixed(2) + ')' : ''), W - 24, 104, 14, '#9ab', 'right', false);
  if (G.combo >= 5) { text('x' + G.combo + ' COMBO', W - 24, 130, 26 + Math.min(14, G.combo / 8), G.combo >= 50 ? '#ff9f43' : '#fff', 'right'); const cw = 140 * Math.max(0, G.comboT / 2.5); g.fillStyle = '#ff9f43'; g.fillRect(W - 24 - cw, 138, cw, 4); }
  const bs = G.en.find(e => (e.type === 'boss' || e.type === 'titan') && !e.dead);
  if (bs) { bar(W / 2 - 220, 98, 440, 14, bs.hp / bs.max, bs.type === 'titan' ? '#c77dff' : '#ff6b8a', bs.type === 'titan' ? '#6b2bbd' : '#b1123a'); text(bs.type === 'titan' ? (bs.tier ? 'VOID TITAN  -  TIER ' + bs.tier : 'THE VOID TITAN') : (bs.name || '!! BOSS !!').toUpperCase(), W / 2, 94, 13, bs.type === 'titan' ? '#c77dff' : '#ff6b8a'); }
  if (G.ev.kind === 'moon' || G.ev.kind === 'meteor' || G.ev.kind === 'zone') text({ moon: 'BLOOD MOON', meteor: 'METEOR STORM', zone: 'VOID CLOSING' }[G.ev.kind] + '  ' + Math.ceil(G.ev.dur - G.ev.t) + 's', W / 2, 134, 15, '#ff9f43');
  if (G.banner) { g.globalAlpha = Math.min(1, G.banner.t * 2); text(G.banner.s, W / 2, 178, 36, G.banner.col); g.globalAlpha = 1; }
  drawTray(); drawMinimap(); drawIndicators();
  if (G.ai && typeof drawSpectator === 'function') drawSpectator();
  if (G.intro) {
    const k = Math.max(0, Math.min(1, (2.6 - G.intro.t) / .4, G.intro.t / .4)), bh = 54 * k;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, bh); g.fillRect(0, H - bh, W, bh);
    g.globalAlpha = Math.min(1, k * 1.4); title(G.intro.n, 340, 58, '#ffffff', G.intro.col && G.intro.col.length === 7 ? G.intro.col : '#ff4d6d'); text(G.intro.sub, W / 2, 378, 18, '#cbd', 'center', false); g.globalAlpha = 1;
  }
}
function drawLevelUp() {
  g.fillStyle = 'rgba(2,2,14,.78)'; g.fillRect(0, 0, W, H);
  title(G.relicOffer ? 'RELIC FOUND!' : 'LEVEL UP!', 150, 60, G.relicOffer ? '#e0b0ff' : '#ffe66d', G.relicOffer ? '#9b5cff' : '#ff9f43');
  text('Choose an upgrade  (click / tap or press 1 / 2 / 3)', W / 2, 192, 20, '#ccd');
  G.choices.forEach((c, i) => {
    const r = cardRect(i), hov = inR(r), ci = cardInfo(c), lift = hov ? -8 : 0;
    g.save(); g.translate(0, lift);
    glowAdd(r.x + r.w / 2, r.y + r.h / 2, 230, ci.col.length === 7 ? ci.col : '#6c63ff', hov ? .35 : .16);
    panel(r, ci.col, hov, 18);
    g.fillStyle = ci.col; g.globalAlpha = .9; rr(r.x + 18, r.y + 18, 36, 36, 18); g.fill(); g.globalAlpha = 1;
    text(String(i + 1), r.x + 36, r.y + 45, 22, '#0a0a18', 'center', true);
    const ic = c.k === 'e' ? '★' : c.k === 'r' ? '♦' : c.k === 'f' ? '✚' : '✦';
    text(ic, r.x + r.w / 2, r.y + 92, 40, ci.col);
    text(ci.n, r.x + r.w / 2, r.y + 138, ci.n.length > 14 ? 22 : 26, c.k === 'e' ? '#ffd166' : '#fff');
    wrapText(ci.d, r.x + r.w / 2, r.y + 175, 17, '#ccd', 280);
    text(ci.sub, r.x + r.w / 2, r.y + 255, 16, c.k === 'e' ? '#ffd166' : c.k === 'r' ? ci.col : '#4cc9f0');
    g.restore();
  });
  if (!G.rerolled && !G.relicOffer) button(R.reroll, G.freeRerolls > 0 ? '↻ Reroll  (' + G.freeRerolls + ' free left)' : '▶ Watch an ad to reroll (optional)', '#2b8a3e');
}
function wrapText(s, x, y, size, col, maxW) {
  g.font = size + 'px system-ui, sans-serif'; const words = s.split(' '); let line = '', yy = y;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { text(line, x, yy, size, col, 'center', false); line = w; yy += size + 4; } else line = t; }
  if (line) text(line, x, yy, size, col, 'center', false);
}
function drawBackdrop(t) {
  const tt = t / 1000, cx = W / 2, cy = H / 2 + 10;
  const bg = g.createRadialGradient(cx, H * .42, 40, cx, cy, 860); bg.addColorStop(0, '#171745'); bg.addColorStop(.55, '#0b0b24'); bg.addColorStop(1, '#04040c');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  [['#4b2bff', .26, .22, .38, 540], ['#ff2e63', .15, .82, .68, 480], ['#00d9b8', .13, .12, .86, 440], ['#b14dff', .14, .6, .12, 380]].forEach(([c, a, fx, fy, r], i) => {
    const x = W * fx + Math.sin(tt * .13 + i * 2) * 70, y = H * fy + Math.cos(tt * .11 + i) * 45; g.globalAlpha = a; g.drawImage(glowSprite(c), x - r, y - r, r * 2, r * 2);
  });
  g.globalAlpha = 1;
  for (const s of stars) { const tw = .5 + .5 * Math.sin(tt * 1.6 + s.x); g.globalAlpha = s.a * (.35 + .65 * tw); g.fillStyle = '#fff'; g.fillRect((s.x + tt * 6 * s.s) % W, s.y, s.s * 1.4, s.s * 1.4); }
  g.globalAlpha = 1;
  // decorative swarm orbiting the menu
  for (const d of swarmDeco) {
    const a = d.a + tt * d.sp, rx = d.r * W * .52, ry = d.r * H * .46, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    g.globalAlpha = .55; g.drawImage(glowSprite(d.col), x - d.sz * 2.4, y - d.sz * 2.4, d.sz * 4.8, d.sz * 4.8);
    const a2 = a - .05 * Math.sign(d.sp); g.globalAlpha = .18; g.drawImage(glowSprite(d.col), cx + Math.cos(a2) * rx - d.sz * 1.8, cy + Math.sin(a2) * ry - d.sz * 1.8, d.sz * 3.6, d.sz * 3.6);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  for (const d of swarmDeco) { const a = d.a + tt * d.sp, x = cx + Math.cos(a) * d.r * W * .52, y = cy + Math.sin(a) * d.r * H * .46; g.fillStyle = d.col; g.globalAlpha = .75; if (d.k % 2) circle(x, y, d.sz * .6, d.col); else poly(x, y, d.sz, 3, a + tt, d.col); }
  g.globalAlpha = 1;
  g.drawImage(vigSprite(), 0, 0);
}
function affordable() { return META.find(m => save.meta[m.k] < m.max && save.gold >= m.cost(save.meta[m.k])); }
function renderMenu(ts) {
  const t = ts / 1000, word = 'VOIDSWARM', sp = 8;
  g.font = 'bold 104px system-ui, sans-serif'; g.textAlign = 'left';
  let tw = sp * (word.length - 1); for (const ch of word) tw += g.measureText(ch).width;
  let x = W / 2 - tw / 2;
  const grad = g.createLinearGradient(W / 2 - 340, 70, W / 2 + 340, 180); grad.addColorStop(0, '#5eead4'); grad.addColorStop(.5, '#8b7bff'); grad.addColorStop(1, '#ff4d8d');
  for (let i = 0; i < word.length; i++) {
    const ch = word[i], cw = g.measureText(ch).width, y = 148 + Math.sin(t * 2.2 + i * .55) * 5;
    g.save(); g.shadowColor = '#8b7bff'; g.shadowBlur = 30 + 10 * Math.sin(t * 3 + i); g.lineWidth = 9; g.lineJoin = 'round'; g.strokeStyle = '#080818'; g.strokeText(ch, x, y); g.fillStyle = grad; g.fillText(ch, x, y); g.restore();
    x += cw + sp;
  }
  text('Survive 15 minutes. Slay the Void Titan.', W / 2, 190, 22, '#ccd', 'center', false);
  text('◆ Gold: ' + save.gold, W / 2, 232, 22, '#ffd166');
  const c = curChar(), un = save.chars[c.id], cc = charCol(c.id), bx = R.charBox;
  glowAdd(bx.x + 62, bx.y + 50, 70, cc, .5 + .15 * Math.sin(t * 3));
  panel(bx, un ? cc : '#ffd166', false, 14);
  const ox = bx.x + 62, oy = bx.y + 50; glowAdd(ox, oy, 46, cc, .7); circle(ox, oy, 24, un ? cc : '#6a6a88'); circle(ox, oy, 13, '#0f1f2e');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(ox + Math.cos(t * 1.5) * 20, oy + Math.sin(t * 1.5) * 20, 4, 0, 6.2832); g.fill();
  text('◀', R.charL.x + 30, R.charL.y + 62, 40, inR(R.charL) ? '#ffe66d' : '#aab'); text('▶', R.charR.x + 30, R.charR.y + 62, 40, inR(R.charR) ? '#ffe66d' : '#aab');
  text(c.n, W / 2 + 30, 285, 32, un ? '#fff' : '#ffd166');
  text(c.d, W / 2 + 30, 315, 15, '#9ab', 'center', false);
  text(un ? 'Unlocked' : 'LOCKED - click or press U to unlock for ' + c.cost + ' gold', W / 2 + 30, 336, 14, un ? '#5eead4' : '#ffd166', 'center', false);
  button(R.start, un ? 'PLAY  (Enter)' : 'UNLOCK ' + c.n + ' (' + c.cost + ' gold)', un ? '#5eead4' : '#ffd166');
  const a = affordable();
  button(R.shop, 'UPGRADES (S)' + (a ? ' ★' : ''), a ? '#ffd166' : '#6c63ff');
  const na = Object.keys(save.ach).length;
  button(R.achb, 'AWARDS (A)  ' + na + '/' + ACH.length);
  button(R.sett, 'SETTINGS (T)');
  button(R.daily, 'Daily: ' + (optDaily ? 'ON' : 'OFF') + ' (D)', optDaily ? '#5eead4' : '#6c63ff');
  button(R.nm, save.nm ? 'Nightmare: ' + (optNM ? 'ON' : 'OFF') + ' (N)' : 'Nightmare: LOCKED', optNM && save.nm ? '#ff6b6b' : '#444477', save.nm ? 'harder, x1.5 gold' : 'beat the Void Titan');
  button(R.heat, 'Heat ' + optHeat + ' (H)', optHeat ? '#ff9f43' : '#6c63ff', optHeat ? '+' + optHeat * 15 + '% gold, tougher foes' : 'unlocked: ' + (save.heatMax || 0) + ' / 20');
  { const cm = save.curses.reduce((a, id) => a + (CURSE_BY[id] ? CURSE_BY[id].bonus : 0), 0); button(R.curse, 'CURSES (C)', save.curses.length ? '#ff4d6d' : '#6c63ff', save.curses.length ? '+' + Math.round(cm * 100) + '% reward' : 'optional, big rewards'); button(R.rec, 'RECORDS (R)', '#6c63ff', save.hof.length ? 'best ' + save.hof[0].s : 'no runs yet'); }
  button(R.ai, 'WATCH AI (W)', '#5eead4', 'see an AI play a run'); button(R.help, 'HOW TO PLAY (I)', '#6c63ff', 'controls and tips');
  if (save.best.time) text('Best: ' + fmt(save.best.time) + '  ·  Most kills: ' + save.best.kills + '  ·  Runs: ' + save.runs + '  ·  Wins: ' + save.wins, W / 2, 625, 18, '#99a');
  if (save.daily.date === today()) text('Today\'s daily best: ' + fmt(save.daily.time) + ' · ' + save.daily.kills + ' kills', W / 2, 650, 15, '#889', 'center', false);
  text('Relics discovered ' + Object.keys(save.codex).length + '/' + RELICS.length + '  ·  Heat unlocked ' + (save.heatMax || 0) + '/20  ·  Survive 5:00 at your top Heat to unlock the next', W / 2, 676, 14, '#778', 'center', false);
  text(touch.on ? 'Touch: drag the left side to move  ·  tap DASH to dodge  ·  weapons fire automatically' : 'WASD / Arrows / Gamepad: move  ·  Space: dash  ·  Weapons fire automatically  ·  P / Esc: pause  ·  F11: fullscreen', W / 2, 697, 14, '#778', 'center', false);
  if (toast) text(toast.s, W / 2, 606, 18, '#5eead4');
}
function renderShop() {
  title('PERMANENT UPGRADES', 62, 44);
  text('◆ Gold: ' + save.gold, W / 2, 94, 24, '#ffd166');
  META.forEach((m, i) => {
    const r = rowRect(i), lv = save.meta[m.k], maxed = lv >= m.max, c = m.cost(lv), can = !maxed && save.gold >= c;
    panel(r, can ? '#ffd166' : '#444477', inR(r), 12);
    text((i < 9 ? (i + 1) + '. ' : '') + m.n, r.x + 18, r.y + 28, 21, '#fff', 'left');
    text(m.d, r.x + 18, r.y + 48, 13, '#9ab', 'left', false);
    for (let k = 0; k < m.max; k++) { g.fillStyle = k < lv ? '#5eead4' : '#2c2c52'; rr(r.x + 18 + k * 18, r.y + 56, 14, 8, 3); g.fill(); }
    text(maxed ? 'MAXED' : c + ' gold', r.x + r.w - 18, r.y + 36, 20, maxed ? '#5eead4' : can ? '#ffd166' : '#777', 'right');
  });
  button(R.back, 'BACK (Esc)');
  if (toast) text(toast.s, W / 2, 635, 20, '#5eead4');
}
function renderAch() {
  title('AWARDS  ' + Object.keys(save.ach).length + '/' + ACH.length + '   ·   Relics ' + Object.keys(save.codex).length + '/' + RELICS.length, 62, 34);
  ACH.forEach((a, i) => {
    const r = { x: 50 + (i % 3) * 405, y: 90 + Math.floor(i / 3) * 70, w: 385, h: 62 }, got = save.ach[a.id];
    panel(r, got ? '#5eead4' : '#444477', false, 12);
    text((got ? '✔ ' : '') + a.n, r.x + 14, r.y + 27, 19, got ? '#5eead4' : '#fff', 'left');
    text(a.d + (a.gold ? '  (+' + a.gold + ')' : ''), r.x + 14, r.y + 52, 13, '#9ab', 'left', false);
  });
  button(R.back, 'BACK (Esc)');
}
function renderSettings() {
  title('SETTINGS', 78, 46);
  const s = save.settings, rows = [['Volume', Math.round(s.vol * 100) + '%   (click to change, ←/→)'], ['Music', s.music ? 'ON' : 'OFF'], ['Screen shake', s.shake ? 'ON' : 'OFF'], ['Fullscreen (F11)', 'click to toggle'], ['Graphics', s.gfx ? 'HIGH  (bloom + glow)' : 'LOW  (faster, for phones)'], ['Minimap (M)', s.mini ? 'ON' : 'OFF'], ['Damage numbers', s.dnum ? 'ON' : 'OFF']];
  rows.forEach((rw, i) => {
    const r = setRect(i); panel(r, '#6c63ff', inR(r), 12);
    text((i + 1) + '. ' + rw[0], r.x + 20, r.y + 37, 22, '#fff', 'left'); text(rw[1], r.x + r.w - 20, r.y + 37, 19, '#5eead4', 'right');
  });
  button(R.back, 'BACK (Esc)');
}
const curseRect = i => ({ x: 240, y: 106 + i * 62, w: 800, h: 54 });
function renderCurses() {
  title('CURSES', 60, 44, '#ff8fa3', '#c0004e');
  text('Take curses for bonus gold and score. Stack as many as you dare.', W / 2, 88, 16, '#bbc', 'center', false);
  let tot = 0;
  CURSES.forEach((c, i) => {
    const r = curseRect(i), on = save.curses.indexOf(c.id) >= 0; if (on) tot += c.bonus;
    panel(r, on ? '#ff4d6d' : '#444477', inR(r), 12);
    text((i + 1) + '. ' + c.n, r.x + 20, r.y + 24, 21, on ? '#ff8fa3' : '#fff', 'left');
    text(c.d, r.x + 20, r.y + 44, 14, '#9ab', 'left', false);
    text(on ? 'ACTIVE' : 'off', r.x + r.w - 150, r.y + 34, 18, on ? '#ff4d6d' : '#667', 'right');
    text('+' + Math.round(c.bonus * 100) + '%', r.x + r.w - 20, r.y + 34, 20, '#ffd166', 'right');
  });
  text('Total bonus: +' + Math.round(tot * 100) + '% gold and score   (applies to every run until you change it)', W / 2, 622, 18, tot ? '#ffd166' : '#889');
  button(R.back, 'BACK (Esc)');
}
function renderRecords() {
  title('HALL OF FAME', 66, 44);
  if (!save.hof.length) text('No runs recorded yet. Go set a score!', W / 2, 300, 24, '#9ab', 'center', false);
  save.hof.forEach((h, i) => {
    const r = { x: 160, y: 100 + i * 66, w: 960, h: 58 }, c = CHARS.find(x => x.id === h.ch);
    panel(r, i === 0 ? '#ffd166' : '#444477', false, 12);
    text('#' + (i + 1), r.x + 18, r.y + 37, 24, i === 0 ? '#ffd166' : '#fff', 'left');
    text(String(h.s), r.x + 100, r.y + 37, 26, '#5eead4', 'left');
    text((c ? c.n : h.ch) + '  ·  Heat ' + h.heat + '  ·  ' + h.cu + ' curse' + (h.cu === 1 ? '' : 's') + (h.tier ? '  ·  Tier ' + h.tier : ''), r.x + 330, r.y + 26, 16, '#ccd', 'left', false);
    text(fmt(h.t) + '  ·  ' + h.k + ' kills', r.x + 330, r.y + 47, 14, '#889', 'left', false);
  });
  button(R.back, 'BACK (Esc)');
}
function renderCore(ts) {
  g.clearRect(0, 0, W, H);
  if (state === 'menu' || state === 'shop' || state === 'ach' || state === 'settings' || state === 'curses' || state === 'records' || state === 'help') {
    drawBackdrop(ts);
    if (state === 'menu') renderMenu(ts); else if (state === 'shop') renderShop(); else if (state === 'ach') renderAch(); else if (state === 'curses') renderCurses(); else if (state === 'records') renderRecords(); else if (state === 'help') renderHelp(); else renderSettings();
  } else {
    drawWorld(); drawHUD(); drawTouch();
    if (state === 'levelup') drawLevelUp();
    if (state === 'paused') drawPause();
    if (false) { g.fillStyle = '#000b'; g.fillRect(0, 0, W, H); text('PAUSED', W / 2, 330, 64); text('Press P / Esc, or click / tap to resume', W / 2, 380, 22, '#ccd', 'center', false); button(R.quit, 'Quit run (Q)', '#ef476f'); }
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
    if (state === 'over' && spect()) drawSpectOver();
    else if (state === 'over') {
      g.fillStyle = '#000d'; g.fillRect(0, 0, W, H);
      text('YOU DIED', W / 2, 130, 72, '#ef476f');
      text('Survived ' + fmt(G.t) + '  ·  ' + G.kills + ' kills  ·  Level ' + G.lvl + '  ·  Best combo x' + G.bestCombo, W / 2, 190, 24);
      text('+' + G.earned + ' gold banked' + (G.doubled ? '  (x2!)' : ''), W / 2, 250, 40, '#ffd166');
      text('Total gold: ' + save.gold + '   ·   SCORE ' + G.score + (G.rank ? '  (#' + G.rank + ')' : ''), W / 2, 290, 22, '#ffd166', 'center', false);
      const a = affordable();
      if (a) text('★ You can afford "' + a.n + '" in the upgrade shop!', W / 2, 340, 22, '#5eead4');
      else { const next = META.filter(m => save.meta[m.k] < m.max).map(m => m.cost(save.meta[m.k])).sort((x, y) => x - y)[0]; if (next) text(Math.max(0, next - save.gold) + ' more gold for your next upgrade', W / 2, 340, 20, '#889'); }
      text('Best: ' + fmt(save.best.time) + '  ·  Most kills: ' + save.best.kills, W / 2, 380, 18, '#889', 'center', false);
      if (!G.adRevived) button(R.revive, '▶ Watch an ad to revive (optional)', '#2b8a3e');
      if (!G.doubled) button(R.dbl, '▶ Watch an ad for DOUBLE gold (optional)', '#2b8a3e');
      button(R.again, 'PLAY AGAIN (Enter)', '#5eead4'); button(R.menu, 'MENU / SHOP', '#6c63ff');
    }
  }
  pops.slice(-2).forEach((p, i) => { const y = 690 - i * 50; g.globalAlpha = Math.min(1, p.t * 2); rr(W / 2 - 300, y - 30, 600, 40, 12); g.fillStyle = 'rgba(14,14,40,.93)'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#ffd166'; g.stroke(); text('★', W / 2 - 276, y - 2, 20, '#ffd166'); text(p.s, W / 2 + 10, y - 3, 17, '#ffe9a8'); g.globalAlpha = 1; });
}

let lastRS = 'menu', fadeA = 0;
function renderHelp() {
  title('HOW TO PLAY', 62, 44);
  const col = (x, head, lines, hc) => { panel({ x, y: 96, w: 380, h: 500 }, hc, false, 14); text(head, x + 190, 130, 22, hc); lines.forEach((l, i) => text(l, x + 20, 166 + i * 27, 15, '#cfd6f5', 'left', false)); };
  col(40, 'CONTROLS', ['Move: WASD / arrows / gamepad stick', 'Dash: Space (brief invincibility)', 'Pause: P or Esc  (build stats inside)', 'Minimap: M     Fullscreen: F11', '', 'Phone: drag the left side to move,', 'tap DASH, tap the pause button.', '', 'Weapons fire automatically.', 'Your job: stay alive and move well.', '', 'Menu keys: S shop, A awards,', 'C curses, R records, H heat,', 'D daily, N nightmare, W watch AI'], '#5eead4');
  col(450, 'GOALS AND LOOT', ['Survive 15:00, then slay the Void Titan.', 'Then Void Tiers keep going forever.', '', 'Blue gems = XP. Gold coins = money.', 'Chests: gold = free upgrade,', 'purple (RELIC) = pick a run-wide relic.', 'Arrows and the minimap point to them.', '', 'Level-ups: choose 1 of 3 upgrades.', 'Every 5th level offers a relic.', 'Matching upgrades evolve weapons.', '', 'Treasure Goblins flee: catch them', 'for a pile of gold and a chest.'], '#ffd166');
  col(860, 'DIFFICULTY AND SCORE', ['Heat 0-20: tougher enemies, more gold.', 'Survive 5:00 at your top Heat to', 'unlock the next level.', '', 'Curses (C): optional handicaps that', 'multiply gold and score.', '', 'Events: Blood Moon, Meteor Storm,', 'Void Closing (shrinking ring),', 'Treasure Goblin.', '', 'Watch AI: see a bot play a run.', 'Spectator runs earn no gold or records.', 'Press E while watching to take over.'], '#ff9f43');
  button(R.back, 'BACK (Esc)');
}
function drawPause() {
  g.fillStyle = 'rgba(2,2,14,.82)'; g.fillRect(0, 0, W, H);
  title('PAUSED', 66, 50);
  const p = G.p, w = G.w, ar = Math.round(Math.min(.7, .08 * w.armor + .04 * (save.meta.armor || 0)) * 100);
  const stats = [['Damage', w.dmg.toFixed(1)], ['Fire rate', w.rate.toFixed(2) + '/s'], ['Bolts per volley', w.multi], ['Crit chance', Math.round(w.crit * 100) + '%'], ['Crit damage', 'x' + (2 + .25 * w.critD).toFixed(2)], ['Move speed', Math.round(p.spd)], ['Max HP', Math.round(p.max)], ['Damage reduction', ar + '%'], ['Pickup range', Math.round(p.magnet)], ['Dash cooldown', w.dashCd.toFixed(2) + 's']];
  panel({ x: 90, y: 104, w: 420, h: 440 }, '#6c63ff', false, 16); text('BUILD STATS', 300, 142, 20, '#ffe66d');
  stats.forEach((st, i) => { text(st[0], 116, 184 + i * 34, 16, '#9ab', 'left', false); text(String(st[1]), 484, 184 + i * 34, 17, '#fff', 'right'); });
  panel({ x: 540, y: 104, w: 650, h: 440 }, '#6c63ff', false, 16); text('UPGRADES & RELICS', 865, 142, 20, '#ffe66d');
  const rows = [];
  for (const u of UPG) if (G.lv[u.id]) rows.push([u.n, G.lv[u.id] + '/' + u.max, '#fff']);
  for (const e of EVO) if (G.evo[e.id]) rows.push(['★ ' + e.n, '', '#ffd166']);
  for (const id of G.relics) rows.push(['♦ ' + RELIC_BY[id].n, '', RELIC_BY[id].col]);
  if (!rows.length) text('Nothing yet - level up to pick upgrades!', 865, 300, 16, '#889', 'center', false);
  rows.slice(0, 20).forEach((r, i) => { const c = Math.floor(i / 10), row = i % 10; text(r[0], 566 + c * 320, 184 + row * 34, 15, r[2], 'left', false); if (r[1]) text(r[1], 566 + c * 320 + 280, 184 + row * 34, 15, '#4cc9f0', 'right', false); });
  if (rows.length > 20) text('+' + (rows.length - 20) + ' more', 865, 530, 14, '#889');
  text('Press P / Esc, or click / tap to resume', W / 2, 586, 20, '#ccd', 'center', false);
  button(R.quit, 'Quit run (Q)', '#ef476f');
}
const spect = () => !!(G && (G.ai || G.assisted));
const AI_SKILLS = [{ n: 'Rookie', rt: .3, noise: .5, dash: .35, N: 12, T: .35 }, { n: 'Veteran', rt: .12, noise: .12, dash: .85, N: 20, T: .42 }, { n: 'Master', rt: .06, noise: .03, dash: 1, N: 32, T: .52 }];
const AI_TUNE = { sMin: 1.1, gem: 3, contact: 2.4, soft: .5, dashAt: 75 };
const AI_DANGER = { boss: 3, titan: 3, brute: 1.6, elite: 2, exploder: 2.5, shooter: 1.2, charger: 1.5, sniper: 1, healer: .6, warper: 1.2, swarmling: .35, bat: .6, runner: .9, goblin: 0, grunt: 1 };
const AI_UPG = { dmg: 10, rate: 9, multi: 9, pierce: 6, blades: 8, nova: 8, light: 8, boom: 6, missile: 8, flame: 7, drone: 7, mine: 6, grav: 7, rico: 7, vit: 8, regen: 6, armor: 8, spd: 6, mag: 5, crit: 7, critd: 5, dashf: 5, area: 4, cdr: 6, luck: 3, leech: 6, burn: 5, chill: 4, exec: 5 };
const AI_RELIC = { aegis: 9, phoenix: 8, storm: 8, chain: 8, frost: 8, berserk: 5, glass: 3, vampire: 7, thorns: 6, midas: 5, scholar: 7, wings: 7, overclock: 7, trail: 4, echo: 7, bounty: 5, magcore: 6, timewarp: 6, ovc: 7, lucky: 5 };
const SP = { speed: { x: W - 428, y: H - 63, w: 96, h: 36 }, skill: { x: W - 326, y: H - 63, w: 96, h: 36 }, take: { x: W - 224, y: H - 63, w: 96, h: 36 }, exit: { x: W - 122, y: H - 63, w: 96, h: 36 } };
function startAI() {
  if (!save.chars[curChar().id]) { toast = { s: 'Unlock this character first (or pick another) to watch it', t: 2.2 }; return; }
  aiSkill = save.settings.aiSkill == null ? 1 : save.settings.aiSkill; aiSpeed = 1; newGame(true);
}
function aiSpeedCycle() { aiSpeed = aiSpeed >= 4 ? 1 : aiSpeed * 2; snd(500, .05, 'square', .04); }
function aiSkillCycle() { aiSkill = (aiSkill + 1) % AI_SKILLS.length; save.settings.aiSkill = aiSkill; persist(); snd(500, .05, 'square', .04); }
function aiTakeOver() { G.ai = false; G.assisted = true; aiSpeed = 1; say('YOU HAVE CONTROL', '#5eead4', 2); for (const k of Object.keys(keys)) keys[k] = 0; }
function aiExit() { state = 'menu'; }
function aiClick() { if (inR(SP.speed)) aiSpeedCycle(); else if (inR(SP.skill)) aiSkillCycle(); else if (inR(SP.take)) aiTakeOver(); else if (inR(SP.exit)) aiExit(); }
function aiControl(dt) {
  const A = G.aiS, sk = AI_SKILLS[aiSkill];
  A.think -= dt;
  if (A.think <= 0) { A.think = sk.rt * (.7 + Math.random() * .6); aiPlan(sk); }
  if (A.wantDash && G.dashT <= 0) { A.wantDash = false; return { x: A.dashDir.x, y: A.dashDir.y, dash: true }; }
  return { x: A.dir.x, y: A.dir.y, dash: false };
}
function aiPlan(sk) {
  const p = G.p, A = G.aiS, spd = p.spd, T = sk.T, N = sk.N, en = [], bul = [], hpF = p.hp / p.max, safety = Math.max(AI_TUNE.sMin, Math.min(1.5, 1.5 - hpF));
  for (const e of G.en) { if (e.dead) continue; const dx = e.x - p.x, dy = e.y - p.y; if (dx * dx + dy * dy < 560 * 560) en.push(e); }
  for (const b of G.eb) { const dx = b.x - p.x, dy = b.y - p.y; if (dx * dx + dy * dy < 520 * 520) bul.push(b); }
  let tgt = null, tw = 0;
  const consider = (x, y, v, label) => { const d = Math.hypot(x - p.x, y - p.y), val = v / (1 + d / 220); if (val > tw) { tw = val; tgt = { x, y, label }; } };
  for (const c of G.chest) consider(c.x, c.y, c.relic ? 14 : 8, 'Grabbing a chest');
  for (const e of G.en) if (!e.dead && e.type === 'goblin') consider(e.x, e.y, 10, 'Chasing the goblin');
  for (const gm of G.gem) if (Math.abs(gm.x - p.x) < 380 && Math.abs(gm.y - p.y) < 380) consider(gm.x, gm.y, AI_TUNE.gem, 'Collecting XP');
  for (const c of G.coin) if (Math.abs(c.x - p.x) < 380 && Math.abs(c.y - p.y) < 380) consider(c.x, c.y, 1.6, 'Collecting gold');
  if (G.zone && Math.hypot(p.x - G.zone.x, p.y - G.zone.y) > G.zone.r * .7) { tgt = { x: G.zone.x, y: G.zone.y, label: 'Staying in the ring' }; tw = 30; }
  A.wander += (Math.random() - .5) * .6;
  const TS = sk.T > .5 ? [.1, .2, .3, .4, .5, .6, .7, .8] : [.12, .24, .36, .48, .6], mdm = dmgMul();
  let best = -1e9, bestA = A.ang, bestDanger = 0, stayBest = false, bestMove = -1e9, bestMoveA = A.ang;
  for (let k = 0; k <= N; k++) {
    const stay = k === N, a = stay ? A.ang : k / N * 6.2832, vx = stay ? 0 : Math.cos(a), vy = stay ? 0 : Math.sin(a);
    const at = t => [p.x + vx * spd * t, p.y + vy * spd * t];
    const [cx, cy] = at(T), [cx2, cy2] = at(T * 2);
    let s2 = 0, danger = 0, cone = 0;
    for (const e of en) {
      const dm = e.dmg * (e.type === 'exploder' ? 1.8 : 1); if (dm <= 0) continue;
      { const ex0 = e.x - p.x, ey0 = e.y - p.y, dd0 = Math.hypot(ex0, ey0); if (dd0 < 320 && dd0 > 1 && (ex0 * vx + ey0 * vy) / dd0 > .77) cone += dm / 7; }
      const R = e.r + p.r + 16 + (e.type === 'exploder' ? 55 : 0) + (e.type === 'boss' || e.type === 'titan' ? 90 : 0);
      for (const q of [[cx, cy, 1], [cx2, cy2, .6]]) {
        const ang = Math.atan2(q[1] - e.y, q[0] - e.x), mv = (e.type === 'exploder' && e.fuse > 0 ? 0 : e.spd) * T * q[2], ex = e.x + Math.cos(ang) * mv, ey = e.y + Math.sin(ang) * mv, d = Math.hypot(ex - q[0], ey - q[1]);
        if (d < R) { const c = AI_TUNE.contact * dm * safety * (1 + (R - d) / R); danger += c; s2 -= c; } else if (d < R + 110) { const c = AI_TUNE.soft * dm * safety * ((R + 110 - d) / 110) ** 2; s2 -= c; danger += c * .2; }
      }
    }
    s2 -= Math.min(25, cone * .6 * safety);
    for (const b of bul) {
      let worst = 1e9;
      for (const t of TS) { const q = at(t), d = Math.hypot(b.x + b.vx * t - q[0], b.y + b.vy * t - q[1]); if (d < worst) worst = d; }
      if (worst < b.r + p.r + 14) { const c = 4 * b.dmg + 15; s2 -= c; danger += c; } else if (worst < b.r + p.r + 55) s2 -= 8;
    }
    for (const bm of G.beams) {
      if (bm.owner.dead) continue; const bd = bm.owner.dmg * .9;
      for (const t of TS) {
        const bt = bm.t + t; if (bt > bm.warn + bm.dur) continue;
        const ang = bm.a + bm.rot * Math.max(0, bt - Math.max(bm.t, bm.warn)), dx = Math.cos(ang), dy = Math.sin(ang), q = at(t), px = q[0] - bm.owner.x, py = q[1] - bm.owner.y, proj = px * dx + py * dy, perp = Math.abs(px * dy - py * dx);
        if (proj > -40 && perp < 50 + p.r) { const c = (bt > bm.warn ? 6 : 3.5) * bd; s2 -= c; danger += c; break; }
      }
    }
    for (const m of G.meteors) if (!m.done && Math.hypot(cx - m.x, cy - m.y) < m.r + 35 && m.t > m.warn - .85) { const c = 4 * (12 + 8 * mdm); s2 -= c; danger += c; }
    for (const e of en) {
      if (e.cs === 'wind' && e.cdir !== undefined) { const dx = Math.cos(e.cdir), dy = Math.sin(e.cdir), px = cx - e.x, py = cy - e.y, proj = px * dx + py * dy, perp = Math.abs(px * dy - py * dx); if (proj > 0 && proj < 700 && perp < 42) { const c = 3 * e.dmg; s2 -= c; danger += c * .7; } }
      if (e.type === 'sniper' && e.tel > 0) { const dx = Math.cos(e.aim), dy = Math.sin(e.aim), px = cx - e.x, py = cy - e.y, proj = px * dx + py * dy, perp = Math.abs(px * dy - py * dx); if (proj > 0 && perp < 34) { const c = 3.5 * e.dmg; s2 -= c; danger += c * .7; } }
    }
    if (G.zone) { const over = Math.hypot(cx2 - G.zone.x, cy2 - G.zone.y) - (G.zone.r - 60); if (over > 0) s2 -= over * .6; }
    if (tgt) { const d0 = Math.hypot(tgt.x - p.x, tgt.y - p.y), d1 = Math.hypot(tgt.x - cx, tgt.y - cy); s2 += (d0 - d1) / (spd * T) * Math.min(24, 6 + tw * 4); }
    else if (!stay) s2 += Math.cos(a - A.wander);
    if (stay) s2 -= 1.5; else s2 += 2.5 * Math.cos(a - A.ang);
    s2 += (Math.random() - .5) * sk.noise * 8;
    if (s2 > best) { best = s2; bestA = a; bestDanger = danger; stayBest = stay; }
    if (!stay && s2 > bestMove) { bestMove = s2; bestMoveA = a; }
  }
  if (stayBest) { A.dir = { x: 0, y: 0 }; } else { A.ang = bestA; A.dir = { x: Math.cos(bestA), y: Math.sin(bestA) }; }
  A.dashDir = { x: Math.cos(bestMoveA), y: Math.sin(bestMoveA) };
  A.goal = bestDanger > 80 ? 'Dodging!' : stayBest ? 'Holding position' : (tgt ? tgt.label : 'Kiting the swarm');
  let near = 0, nd = 1e9;
  for (const e of en) { if (e.dmg <= 0) continue; const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r - p.r; if (d < nd) nd = d; if (d < 38) near++; }
  if (G.dashT <= 0 && (bestDanger > AI_TUNE.dashAt || near >= 3 || (hpF < .5 && nd < 30)) && Math.random() < sk.dash) { A.wantDash = true; A.goal = 'Dashing out!'; }
}
function aiChoose() {
  let bi = 0, bs = -1e9;
  G.choices.forEach((c, i) => {
    let sc = 0;
    if (c.k === 'e') sc = 100;
    else if (c.k === 'r') sc = AI_RELIC[c.ref.id] || 6;
    else if (c.k === 'u') { const u = UPG[c.i], lv = G.lv[u.id] || 0; sc = (AI_UPG[u.id] || 5) + (lv > 0 ? 3 : 0) - lv * .55; if (G.p.hp < G.p.max * .5 && (u.id === 'vit' || u.id === 'regen' || u.id === 'armor' || u.id === 'leech')) sc += 3; }
    else sc = c.ref.n === 'Healing Spring' && G.p.hp < G.p.max * .6 ? 9 : 2;
    sc += Math.random() * .4; if (sc > bs) { bs = sc; bi = i; }
  });
  return bi;
}
function aiPickTick(dt) {
  const A = G.aiS; A.pickT += dt;
  if (A.pickT > .7) { A.pickT = 0; pick(aiChoose()); }
}
function miniBtn(r, label, key) { const hov = inR(r); panel(r, hov ? '#ffe66d' : '#6c63ff', hov, 8); text(label, r.x + r.w / 2, r.y + 17, 13, '#fff'); text('[' + key + ']', r.x + r.w / 2, r.y + 31, 10, '#9ab', 'center', false); }
function drawSpectator() {
  const A = G.aiS, sk = AI_SKILLS[aiSkill];
  panel({ x: W - 644, y: H - 74, w: 630, h: 58 }, '#5eead4', false, 12);
  circle(W - 624, H - 45, 6, Math.floor(G.t * 2) % 2 ? '#ff4d6d' : '#7a1f33');
  text('AI  ·  ' + sk.n, W - 610, H - 49, 15, '#5eead4', 'left');
  text(A.goal || '', W - 610, H - 28, 13, '#cfd6f5', 'left', false);
  miniBtn(SP.speed, 'Speed x' + aiSpeed, 'F'); miniBtn(SP.skill, sk.n, 'K'); miniBtn(SP.take, 'Take over', 'E'); miniBtn(SP.exit, 'Exit', 'X');
}
function drawSpectOver() {
  g.fillStyle = 'rgba(2,2,14,.85)'; g.fillRect(0, 0, W, H);
  title(G.ai ? 'AI RUN ENDED' : 'RUN ENDED', 130, 60, '#7ff5e1', '#2bb8a6');
  text('Survived ' + fmt(G.t) + '  ·  ' + G.kills + ' kills  ·  Level ' + G.lvl + '  ·  Best combo x' + G.bestCombo, W / 2, 200, 24);
  text('Score ' + (G.score || calcScore()) + '   ·   ' + G.relics.length + ' relics   ·   Heat ' + G.heat, W / 2, 245, 22, '#ffd166');
  text(G.ai ? 'AI skill: ' + AI_SKILLS[aiSkill].n : 'You took over this run', W / 2, 285, 18, '#9ab', 'center', false);
  text('Spectator runs earn no gold, records or achievements.', W / 2, 330, 18, '#7fb0d8', 'center', false);
  button(R.again, G.ai ? 'WATCH AGAIN (Enter)' : 'PLAY AGAIN (Enter)', '#5eead4'); button(R.menu, 'MENU', '#6c63ff');
}
function render(ts) {
  renderCore(ts);
  if (state !== lastRS) { const mi = s => s === 'menu' || s === 'shop' || s === 'ach' || s === 'settings' || s === 'curses' || s === 'records' || s === 'help'; if (mi(state) || mi(lastRS) || state === 'over' || state === 'win') fadeA = .9; lastRS = state; }
  if (fadeA > 0) { g.fillStyle = `rgba(4,4,14,${fadeA})`; g.fillRect(0, 0, W, H); fadeA = Math.max(0, fadeA - .05); }
}
function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  if (toast) { toast.t -= dt; if (toast.t <= 0) toast = null; }
  levelFlash = Math.max(0, levelFlash - dt);
  for (const p of pops) p.t -= dt; pops = pops.filter(p => p.t > 0);
  if (state === 'play') {
    if (G.intro) { G.intro.t -= dt; if (G.intro.t <= 0) G.intro = null; }
    if (G.freeze > 0) G.freeze -= dt;
    else { const sl = G.intro && G.intro.t > 1.9 ? .35 : 1, rep = G.ai ? aiSpeed : 1; for (let s2 = 0; s2 < rep; s2++) { if (state !== 'play') break; update(dt * sl); } }
  } else {
    if (G && G.ai && state === 'levelup') aiPickTick(dt * aiSpeed);
    if (G && G.ai && state === 'win') { aiWinT += dt; if (aiWinT > 4) { aiWinT = 0; contEndless(); } }
    pad();
  }
  music(dt);
  render(ts);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
