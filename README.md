# VOIDSWARM

Arena survivor roguelite. Survive 15 minutes, slay the Void Titan, then keep going in endless/Nightmare mode.

## Play in one command (needs Node.js 16+)
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
