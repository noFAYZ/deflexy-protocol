import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

if (existsSync(".env")) process.loadEnvFile(".env"); // Node 20.12+ — no dotenv dep needed
import { cors } from "hono/cors";
import { sign, verify } from "hono/jwt";
import { getAddress, isAddress, keccak256, verifyMessage, type Hex } from "viem";
import { PinataSDK } from "pinata";
import { type Logger } from "pino";
import { logger, requestLogger, timed, type AppEnv } from "./logger";

const {
  PINATA_JWT,
  PINATA_GATEWAY,
  WEB_ORIGIN = "http://localhost:5173",
  PORT = "8787",
} = process.env;
// `|| default` (not destructuring default) so an empty AUTH_SECRET= line also falls back.
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";

if (!PINATA_JWT || !PINATA_GATEWAY) throw new Error("PINATA_JWT and PINATA_GATEWAY are required (see .env.example)");

const pinata = new PinataSDK({ pinataJwt: PINATA_JWT, pinataGateway: PINATA_GATEWAY });

// On-chain we store `ref` = keccak256(content), a neutral 32-byte handle. Pinata is the
// source of truth: each private file is tagged with its ref, so /access looks the CID up
// by that tag — no CID<->bytes32 codec juggling. This Map just skips repeat lookups.
// ponytail: process-local cache; fine for one instance. Pinata list is the real lookup,
// so multiple instances just each warm their own cache.
// On-chain `ref` (keccak of content) -> Pinata CID. Persisted to disk because Pinata's
// keyvalue tags don't reliably round-trip on binary uploads, and the dev server restarts
// often (tsx watch) — this map is the durable source of truth, written on every upload.
const REFS_FILE = "data/refs.json";
function loadRefs(): Map<string, string> {
  try {
    return new Map(Object.entries(JSON.parse(readFileSync(REFS_FILE, "utf8")) as Record<string, string>));
  } catch {
    return new Map();
  }
}
const cidByRef = loadRefs();
function persistRefs() {
  try {
    mkdirSync("data", { recursive: true });
    writeFileSync(REFS_FILE, JSON.stringify(Object.fromEntries(cidByRef)));
  } catch (err) {
    logger.error({ err }, "persistRefs failed");
  }
}

// ref -> parsed brief JSON. Brief content is immutable (content-addressed), so this never
// goes stale: first reader warms it, everyone after is served from memory.
// ponytail: unbounded process-local map. Briefs are tiny; add an LRU cap if it ever matters.
const briefCache = new Map<string, unknown>();

// Mirror this exact string on the frontend — the signature is over it byte-for-byte.
export function loginMessage(address: string, issued: number, nonce: string) {
  return `Sign in to Deflexy\nAddress: ${address}\nIssued: ${new Date(issued).toISOString()}\nNonce: ${nonce}`;
}

const SESSION_TTL = 60 * 60 * 24; // 1 day
const SIGN_WINDOW = 5 * 60 * 1000; // signed message must be < 5 min old
const MAX_UPLOAD = 25 * 1024 * 1024; // 25 MB cap on direct (signed-url) uploads

const app = new Hono<AppEnv>();
app.use("/*", requestLogger()); // first: time + tag every request
app.use("/*", cors({ origin: WEB_ORIGIN, allowHeaders: ["Authorization", "Content-Type"] }));

app.get("/health", (c) => c.json({ ok: true }));

// --- auth: prove control of a wallet, get a short-lived session token ---------
app.post("/session", async (c) => {
  const { address, issued, nonce, signature } = await c.req.json();
  if (!isAddress(address)) return c.json({ error: "bad address" }, 400);
  if (typeof issued !== "number" || Date.now() - issued > SIGN_WINDOW || issued > Date.now() + 60_000)
    return c.json({ error: "stale request" }, 400);
  // ponytail: stateless nonce — a captured signature is replayable for up to SIGN_WINDOW.
  // Acceptable for an "any signed-in user" gate; add a one-time nonce store to close it.
  const ok = await verifyMessage({ address, message: loginMessage(address, issued, nonce), signature });
  if (!ok) {
    c.get("log").warn({ address }, "siwe signature rejected");
    return c.json({ error: "bad signature" }, 401);
  }
  const token = await sign(
    { sub: getAddress(address), exp: Math.floor(Date.now() / 1000) + SESSION_TTL },
    AUTH_SECRET,
    "HS256",
  );
  c.get("log").info({ address: getAddress(address) }, "session issued");
  return c.json({ token });
});

const requireAuth = async (c: any, next: any) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return c.json({ error: "no token" }, 401);
  try {
    await verify(token, AUTH_SECRET, "HS256");
  } catch {
    return c.json({ error: "bad token" }, 401);
  }
  return next();
};

// --- private storage ----------------------------------------------------------
async function pinPrivate(file: File, ref: Hex, log: Logger = logger): Promise<string> {
  const cached = cidByRef.get(ref);
  if (cached) {
    log.debug({ ref, cid: cached }, "pin cache hit");
    return cached;
  }
  // ponytail: file bytes proxy through this server. Swap to pinata.upload.private
  // .createSignedURL() for direct browser->Pinata uploads if bandwidth bites.
  const [res, ms] = await timed(() => pinata.upload.private.file(file).keyvalues({ ref }));
  cidByRef.set(ref, res.cid);
  persistRefs();
  log.info({ ref, cid: res.cid, bytes: file.size, ms, op: "pinata.upload" }, `pinned private file in ${ms}ms`);
  return res.cid;
}

async function resolveCid(ref: string, log: Logger = logger): Promise<string | null> {
  if (cidByRef.has(ref)) return cidByRef.get(ref)!;
  // Re-read the persisted map (a backfill or another instance may have added it).
  for (const [k, v] of loadRefs()) if (!cidByRef.has(k)) cidByRef.set(k, v);
  if (cidByRef.has(ref)) return cidByRef.get(ref)!;
  // Last resort: Pinata's keyvalue index (only reliable for files that got tagged).
  const [{ files }, ms] = await timed(() => pinata.files.private.list().keyvalues({ ref }));
  log.warn({ ref, ms, op: "pinata.files.list" }, `ref missing from cache — Pinata list ${ms}ms`);
  const cid = files?.[0]?.cid ?? null;
  if (cid) {
    cidByRef.set(ref, cid);
    persistRefs();
  }
  return cid;
}

app.post("/upload/file", requireAuth, async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "no file" }, 400);
  const ref = keccak256(new Uint8Array(await file.arrayBuffer()));
  await pinPrivate(file, ref, c.get("log"));
  return c.json({ ref });
});

// --- direct browser->Pinata uploads (signed URLs) -----------------------------
// Bytes skip this server entirely: the client computes ref = keccak256(content),
// asks us to mint a short-lived signed URL, uploads straight to Pinata, then
// registers the resulting cid. Halves transfer for large files and keeps file
// bytes off our bandwidth. (Tiny JSON briefs stay on /upload/json — no transfer
// win there, and they need server-side cache warming + a trustworthy ref.)
app.post("/upload/sign", requireAuth, async (c) => {
  const { ref } = await c.req.json();
  if (typeof ref !== "string" || !ref.startsWith("0x")) return c.json({ error: "bad ref" }, 400);
  const cached = cidByRef.get(ref);
  if (cached) return c.json({ cid: cached }); // already pinned — client skips the upload
  // keyvalues={ref} keeps the resolveCid list-fallback working for direct uploads.
  const [url, ms] = await timed(() =>
    pinata.upload.private.createSignedURL({ expires: 60, keyvalues: { ref }, maxFileSize: MAX_UPLOAD }),
  );
  c.get("log").info({ ref, ms, op: "pinata.signedUrl" }, `signed upload url in ${ms}ms`);
  return c.json({ url });
});

app.post("/upload/commit", requireAuth, async (c) => {
  const { ref, cid } = await c.req.json();
  if (typeof ref !== "string" || typeof cid !== "string") return c.json({ error: "bad input" }, 400);
  // First-writer-wins. Refs are content hashes, so overwriting a known mapping
  // would only matter to someone who already holds that exact content.
  // ponytail: we trust the authenticated client's cid<->ref pairing; re-hash the
  // fetched content to verify if this ever gates anything valuable.
  if (!cidByRef.has(ref)) {
    cidByRef.set(ref, cid);
    persistRefs();
    c.get("log").info({ ref, cid, op: "upload.commit" }, "registered direct upload");
  }
  return c.json({ ref });
});

app.post("/upload/json", requireAuth, async (c) => {
  const data = await c.req.json();
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const ref = keccak256(bytes);
  await pinPrivate(new File([bytes], "data.json", { type: "application/json" }), ref, c.get("log"));
  // Warm the read cache now: the JSON is content-addressed and immutable, so the
  // first /brief reader (often a different user) skips the slow cold gateway fetch.
  briefCache.set(ref, data);
  return c.json({ ref });
});

// Returns the brief JSON directly (one round trip, no separate gateway fetch) and caches
// it server-side. Small immutable payload → safe to memoize indefinitely.
app.post("/brief", requireAuth, async (c) => {
  const log = c.get("log");
  const { ref } = await c.req.json();
  if (typeof ref !== "string") return c.json({ error: "bad ref" }, 400);
  if (briefCache.has(ref)) return c.json({ data: briefCache.get(ref) });
  // Cold path (cache miss): two Pinata round-trips. Time each so the slow log
  // shows whether `resolve` (files.list) or `gateway` (content fetch) dominates.
  const [cid, resolveMs] = await timed(() => resolveCid(ref, log));
  if (!cid) return c.json({ error: "not found" }, 404);
  const [{ data }, gatewayMs] = await timed(() => pinata.gateways.private.get(cid)); // SDK parses JSON
  log.info({ ref, cid, resolveMs, gatewayMs, op: "brief.cold" }, `cold brief: resolve ${resolveMs}ms + gateway ${gatewayMs}ms`);
  briefCache.set(ref, data ?? null);
  return c.json({ data: data ?? null });
});

app.post("/access", requireAuth, async (c) => {
  const { ref, img } = await c.req.json();
  if (typeof ref !== "string") return c.json({ error: "bad ref" }, 400);
  const cid = await resolveCid(ref, c.get("log"));
  if (!cid) return c.json({ error: "not found" }, 404);
  let link = pinata.gateways.private.createAccessLink({ cid, expires: 120 });
  // Optimized thumbnails: Pinata resizes/transcodes server-side, so the browser only
  // downloads a small webp instead of the full original.
  if (img && (img.width || img.height)) {
    link = link.optimizeImage({ width: img.width, height: img.height, fit: "scaleDown", format: "auto", quality: 80 });
  }
  return c.json({ url: await link });
});

serve({ fetch: app.fetch, port: Number(PORT) }, (i) =>
  logger.info({ port: i.port, origin: WEB_ORIGIN }, `@deflexy/api listening on :${i.port}`),
);
