# Pixel Tug War - TikTok LIVE Game

Pixel-art tug-of-war contest implemented as a standalone theme. Core, provider and SDK files stay unchanged.

## Run

1. Install: pnpm install
2. Start: pnpm start
3. Open http://localhost:3939/ and select Pixel Tug War in the control panel.
4. Demo: http://localhost:3939/overlay?demo
5. Safe-zone guide: http://localhost:3939/overlay?safe
6. OBS Browser Source: http://localhost:3939/overlay at 1080 x 1920.

## Rules

| Comment | Action |
| --- | --- |
| RED, DO, ĐỎ | Join red |
| BLUE, XANH | Join blue |
| PUSH, KEO, KÉO | Pull once every 3s |
| BOOST, TANG LUC, TĂNG LỰC | Spend 100 shared team energy for larger pull |

Each round lasts 60 seconds or ends early at a rope position of +/-0.9. A new round begins after a 7-second intermission. Each PUSH gains 9 team energy. Gifts trigger cosmetic effects, not competitive points.

## Structure

- game-engine.js: team registration, command parsing, scoring, rules, cooldowns, round management, snapshots.
- renderer.js: original procedural pixel-art canvas rendering and bounded particles.
- index.html and style.css: 9:16 HTML HUD, scoreboards, leaderboard, status overlays.
- main.js: Live SDK integration, demo bots and test buttons, local session restore.
- theme.json and scene.json: framework theme metadata.
- test/pixel-tug-war.test.js: game logic tests.

## Verification

Run pnpm test. Use the overlay demo controls to test RED/BLUE, PUSH, BOOST, GIFT, AUTO and RESET. AUTO is simulated inside the overlay; never stream with ?demo. Confirm mobile TikTok safe zones with ?safe and OBS output before publishing.

## MVP limitations

- State lives in the browser tab, not the Node server. Multiple browser sources are not synchronized.
- sessionStorage reload recovery is best-effort and valid for 10 minutes, and not a long-term durable database.
- The 2D art is original procedural placeholder art, not a pixel-perfect extraction from the reference image.
- Test events from the normal control panel currently simulate gifts; the built-in ?demo path simulates gameplay comments.
- Font is loaded from Google Fonts when available; system fallbacks are provided.

## Credits

All sprite shapes are drawn programmatically in renderer.js. No third-party images or commercial sprite packs are bundled.
