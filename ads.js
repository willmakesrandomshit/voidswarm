// Optional rewarded-ads layer. The game never forces an ad: every ad is a button the player chooses to press.
//
// Providers:
//   'mock'    - a clearly-labelled TEST overlay (no money). Default, so the game works out of the box.
//   'adsense' - Google AdSense "H5 Games Ads" (adBreak API). Needs YOUR approved AdSense account, the
//               loader <script> tag from index.html uncommented, and your publisher id. Web builds only.
// Set Ads.config.provider to switch. Add your own provider (CrazyGames, Poki, etc.) the same way.
const Ads = {
  config: { provider: 'mock' },

  showRewarded(label, onReward, onDone) {
    const fn = this.providers[this.config.provider] || this.providers.mock;
    fn(label, onReward, onDone);
  },

  providers: {
    mock(label, onReward, onDone) {
      if (typeof document.createElement !== 'function') { onReward(); onDone(); return; } // headless tests
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;background:#000d;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font:20px system-ui;z-index:99;gap:14px';
      box.innerHTML = '<div style="font-size:14px;color:#f90">TEST AD (placeholder, no revenue)</div><div style="font-size:30px;font-weight:bold">Your ad plays here</div><div id="adt"></div>';
      const claim = document.createElement('button'), no = document.createElement('button');
      for (const b of [claim, no]) b.style.cssText = 'font:18px system-ui;padding:10px 24px;border-radius:8px;border:0;cursor:pointer';
      claim.textContent = 'Claim reward'; claim.disabled = true; no.textContent = 'No thanks';
      box.append(claim, no); document.body.appendChild(box);
      const t = box.querySelector('#adt'); let n = 4;
      const iv = setInterval(() => { n--; t.textContent = n > 0 ? 'Reward in ' + n + 's...' : 'Done!'; if (n <= 0) { clearInterval(iv); claim.disabled = false; } }, 1000);
      t.textContent = 'Reward in 4s...';
      const close = ok => { clearInterval(iv); box.remove(); if (ok) onReward(); onDone(); };
      claim.onclick = () => close(true); no.onclick = () => close(false);
    },

    adsense(label, onReward, onDone) {
      if (typeof adBreak !== 'function') { onDone(); return; }
      let rewarded = false;
      adBreak({
        type: 'reward', name: label,
        beforeReward: show => show(),
        adViewed: () => { rewarded = true; },
        adDismissed: () => { },
        adBreakDone: () => { if (rewarded) onReward(); onDone(); },
      });
    },
  },
};
