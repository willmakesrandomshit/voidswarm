# VOIDSWARM

Arena survivor roguelite. Survive 15 minutes, slay the Void Titan, then keep going in endless/Nightmare mode.

## Play instantly in any browser (nothing to install)
https://willmakesrandomshit.github.io/voidswarm/

## Or run locally with one command (needs Node.js 16+)
```bash
npx --yes github:willmakesrandomshit/voidswarm
```
That downloads the game, starts a local server and opens it in your browser.

Or clone it:
```bash
git clone https://github.com/willmakesrandomshit/voidswarm && cd voidswarm && node play.js
```

## Play
Open `index.html` in any browser. Desktop app: `npm install` then `npm start`.

## Controls
WASD / arrows / gamepad: move · Space: dash · weapons fire automatically · P/Esc: pause · F11: fullscreen

## What's new in v6 (graphics, audio, polish)
- **Shaded enemy sprites** with eyes, armor and per-type details, instead of flat shapes.
- **Selective bloom** (halos around bullets, particles, gems and enemies), parallax stars and nebulae, and faint floor runes that change with the palette as the run goes on.
- **Better effects**: hit sparks, popping damage numbers, a player engine trail, a level-up flash, and fades between screens.
- **Off-screen arrows** point to bosses, elites, treasure goblins and chests.
- **Richer music**: a drum kit, bass and pads that speed up over a run and push harder during bosses, plus more varied sound effects.
- **Graphics setting** (Settings, key 5): HIGH or LOW. Phones default to LOW; turn HIGH on if yours runs it smoothly.

## What's new in v5 (for people who beat everything)
- **Five new enemies with telegraphed attacks**: Chargers (wind up, then dash), Snipers (laser telegraph), Healers, Warpers (teleport) and Swarmling packs.
- **Four boss patterns**: Hive Queen (spawns swarms), Laser Warden (rotating beams), Warp Stalker (teleports and bursts) and The Crusher (charges and shockwaves). They rotate each boss wave.
- **Void Closing**: a new event where the arena shrinks. Stay inside the ring and survive for a relic.
- **Endless Void Tiers**: after you slay the Void Titan, keep playing and a greater Titan rises every couple of minutes, each stronger and with laser beams. Clear them for relic chests.
- **Heat up to 20**: bigger enemy HP, faster bullets, more champions and quicker bosses at the top end.
- **Curses (C)**: 8 optional handicaps (Frenzy, Swarm, Fragile, Dull Weapons, Famine, Elite Hunt, Boss Rush, One Life) that add bonus gold and score. Stack as many as you dare.
- **Score + Hall of Fame (R)**: every run is scored (kills, time, bosses, tiers, Heat and curses) and your top 8 runs are saved.
- **Visual overhaul**: glowing effects, a redesigned HUD, and an animated menu.

## What's new in v4
- **14 relics**: run-defining passives (Chain Reaction, Aegis Charm, Storm Caller, Glass Cannon, Phoenix Feather...). You get a choice of three every 5th level, from boss chests, and sometimes from elite chests. Discovered relics are tracked in a codex.
- **Elite affixes + Champions**: elites (and bosses after 5:00) roll an affix (Shielded, Swift, Splitter, Volatile). From 2:30 on, a few regular enemies become Champions with triple HP and bigger rewards.
- **Random events**: Blood Moon (double enemies, double XP), Meteor Storm (dodge the red circles; meteors also hurt enemies) and Treasure Goblin (a fast thief carrying loot).
- **Heat ladder (0-20)**: survive 5:00 (a bit longer above Heat 10) at your top Heat to unlock the next. Each level makes enemies tougher and adds +15% gold; higher Heat adds more elites, champions and bigger hordes.
- **3 new characters**: Relic Hunter (starts with a relic pick), Juggernaut (tank) and Voidwalker (dash burns enemies).
- **10 new achievements**, mobile touch controls, and a three-column awards screen.

Menu keys: `H` cycles Heat. Saves from older versions keep working.

## Tuning difficulty
All difficulty constants live in the `TUNE` block at the top of `game.js`
(`hpGrowth` controls how fast regular enemies scale: the late-game wall; `titanTime`, `titanHp` control the final boss).

## Ads (optional, web builds only)
See `ads.js`. Default provider is a TEST overlay that earns nothing. For real revenue on a web release,
get approved for Google AdSense H5 Games Ads, uncomment the script tag in `index.html`, put in your publisher id,
and set `Ads.config.provider = 'adsense'`. Ads are always player-initiated buttons. Don't ship ads in a Steam build.

## Steam
1. Pay the Steam Direct fee, create your app, and get your App ID.
2. `npm i steamworks.js`, replace `480` in `main.js` with your App ID.
3. Create achievements in the Steamworks dashboard using the API names in `game.js` (`ACH_T5`, `ACH_WIN`, ...).
4. `npm run dist`, then upload the build with SteamPipe.
5. Before a paid release you will want real art, music and more playtesting. The game currently uses
   drawn shapes and synthesized sound.

## Not included
Key rebinding, online leaderboards (daily challenge records are stored locally), real art/music assets.
