# Deflexy API on SnapDeploy

Deploy as a Node.js container. The included `Dockerfile` is used automatically.

## Steps
1. New Container → deploy from GitHub (recommended) or upload this folder as a ZIP
   (project root at the top of the zip, not nested).
2. Set environment variables in the platform (do NOT commit `.env`):
   - `PINATA_JWT`
   - `PINATA_GATEWAY`
   - `AUTH_SECRET`  (long random string)
   - `WEB_ORIGIN`   = your web app origin, e.g. https://web-seven-theta-63.vercel.app
   - Do **not** set `PORT` — SnapDeploy injects it and the app reads `process.env.PORT`.
3. Deploy. Grab the container URL → set the web app's `VITE_API_URL` to it, and make
   sure this container's `WEB_ORIGIN` exactly matches the web origin (fixes CORS).

## Caveats
- **Ephemeral disk.** SnapDeploy containers (Fargate) lose local files on restart /
  redeploy / sleep-wake. `data/refs.json` (ref→CID map) is bundled in the image as a
  snapshot, but uploads made *after* deploy won't survive a restart. For durable storage
  move the refs map to a managed DB or external store. Fine as-is for demos.
- **Free tier auto-sleeps** after ~45 min idle (wakes in ~60s on traffic). Use Always-On
  ($12/mo) or a $1/24h Sprint Pack if you need it always responsive.
