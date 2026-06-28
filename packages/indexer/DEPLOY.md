# Deflexy Indexer (Ponder) on SnapDeploy

Deploy as a Node.js container. The included `Dockerfile` runs `ponder codegen` then
`ponder start`.

## Steps
1. Add a **PostgreSQL** add-on (or a $1/12h DB Sprint Pack to test). Copy its connection
   URL — that's your `DATABASE_URL`.
2. New Container → deploy from GitHub or upload this folder as a ZIP (root at top).
3. Set environment variables:
   - `DATABASE_URL`            = the Postgres add-on connection string
   - `PONDER_RPC_URL_84532`    = a dedicated Base Sepolia RPC (Alchemy/Infura; the public
     default rate-limits the historical sync)
   - Do **not** set `PORT` — SnapDeploy injects it and Ponder reads it.
4. Deploy. First boot back-fills from block 43,394,360 — the URL serves GraphQL + `/health`
   only after the historical sync finishes (a few minutes). Set the web app's
   `VITE_INDEXER_URL` to this container URL.

## Caveats
- **Use Always-On** (or a Sprint Pack) for the indexer. On the free tier it auto-sleeps
  when idle and stops indexing until the next request wakes it (~60s cold start). The
  Postgres add-on keeps the indexed data; only the live process pauses.
- 512 MB free-tier RAM is enough for this contract set; bump the tier if sync OOMs.
