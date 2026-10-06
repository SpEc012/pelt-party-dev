# Publish this checkpoint

The rules, browser and local WebSocket checks pass. GitHub write access is restored. Cloudflare still needs deployment credentials; there is no production game URL yet.

## Get the source

```sh
git clone https://github.com/dylandev01/pelt-party.git
cd pelt-party
```

The earlier downloadable archive also includes a Git bundle as an offline checkpoint. Its history predates publication; use the GitHub clone for subsequent work.

## Publish the game

GitHub stores the source. Cloudflare runs the multiplayer server and serves the game; GitHub Pages alone cannot host its Durable Objects/WebSockets.

```sh
npm ci
npx wrangler login
npm run check
npm run deploy
```

Open the URL printed by Wrangler. The included configuration deploys static assets and both Durable Object classes together. Test solo play, then join a room from the iPhone 14 and a laptop on different networks. Use `docs/TESTING.md` before treating this as a public release.

For later releases, configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in GitHub Actions secrets, then run the included **Deploy to Cloudflare** workflow from `main`. Never paste credentials into chat or commit them.

This is an early playable checkpoint, not the complete contest specification. See `STATUS.md` for unfinished features and acceptance checks.
