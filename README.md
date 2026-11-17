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

## What's new in v4
- **14 relics**: run-defining passives (Chain Reaction, Aegis Charm, Storm Caller, Glass Cannon, Phoenix Feather...). You get a choice of three every 5th level, from boss chests, and sometimes from elite chests. Discovered relics are tracked in a codex.
- **Elite affixes + Champions**: elites (and bosses after 5:00) roll an affix (Shielded, Swift, Splitter, Volatile). From 2:30 on, a few regular enemies become Champions with triple HP and bigger rewards.
- **Random events**: Blood Moon (double enemies, double XP), Meteor Storm (dodge the red circles; meteors also hurt enemies) and Treasure Goblin (a fast thief carrying loot).
- **Heat ladder (0-10)**: survive 5:00 at your top Heat to unlock the next. Each level makes enemies tougher and adds +15% gold; higher Heat adds more elites, champions and bigger hordes.
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
