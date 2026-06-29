import { keccak256, type Hex } from "viem";
import { API_URL as API, ping } from "./health";

// Briefs/attachments live in PRIVATE Pinata storage — never on public IPFS. The backend
// holds the Pinata key and only mints upload/access links for signed-in wallets, so the
// on-chain `ref` (a keccak handle) is useless to chain scrapers. See packages/api.
const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
export const isEmptyCid = (ref?: Hex | null) => !ref || ref === ZERO32;

// Wallet signer is registered once at app mount (useRegisterSigner) so these helpers can
// prompt a sign-in on demand without threading wagmi through every call site.
type Signer = { address: Hex; signMessageAsync: (a: { message: string }) => Promise<string> };
let signer: Signer | null = null;
export function setSigner(s: Signer | null) {
  signer = s;
}
export const hasSigner = () => !!signer;

const TOKEN_KEY = "deflexy.session";

// Must match loginMessage() in packages/api/src/index.ts byte-for-byte.
const loginMessage = (address: string, issued: number, nonce: string) =>
  `Sign in to Deflexy\nAddress: ${address}\nIssued: ${new Date(issued).toISOString()}\nNonce: ${nonce}`;

function expired(jwt: string): boolean {
  try {
    const { exp } = JSON.parse(atob(jwt.split(".")[1]));
    return !exp || exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

// If the backend is unreachable, fail fast WITHOUT prompting a wallet signature. Many
// queries call ensureSession at once; signing first meant a dead backend popped an endless
// stream of sign-in dialogs. The backoff also stops every query re-pinging a down server.
let downUntil = 0;
async function assertBackendUp() {
  if (Date.now() < downUntil) throw new Error("Backend is unreachable — try again shortly");
  if (!(await ping(`${API}/health`))) {
    downUntil = Date.now() + 15_000;
    throw new Error("Backend is unreachable — try again shortly");
  }
}

let pending: Promise<string> | null = null;
/** Cached session token, or prompt one wallet signature to mint a fresh one. */
async function ensureSession(): Promise<string> {
  const cached = localStorage.getItem(TOKEN_KEY);
  if (cached && !expired(cached)) return cached;
  if (pending) return pending; // collapse concurrent sign-ins into one prompt
  pending = (async () => {
    if (!signer) throw new Error("Connect your wallet to continue");
    await assertBackendUp(); // gate the signature on a reachable backend
    const issued = Date.now();
    const nonce = crypto.randomUUID();
    const signature = await signer.signMessageAsync({ message: loginMessage(signer.address, issued, nonce) });
    const res = await fetch(`${API}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: signer.address, issued, nonce, signature }),
    });
    if (!res.ok) throw new Error("Sign-in failed");
    const { token } = (await res.json()) as { token: string };
    localStorage.setItem(TOKEN_KEY, token);
    return token;
  })().finally(() => {
    pending = null;
  });
  return pending;
}

async function authed<T>(path: string, body: BodyInit, headers: Record<string, string> = {}): Promise<T> {
  // Try once; if the token was rejected (expired / secret rotated), drop it and re-auth once.
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await ensureSession();
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { ...headers, authorization: `Bearer ${token}` },
      body,
    });
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      continue;
    }
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json() as Promise<T>;
  }
  throw new Error("Authentication failed");
}

const JSON_HEADERS = { "content-type": "application/json" };

/** Direct browser->Pinata upload via a server-minted signed URL: the file bytes
 * never touch our backend. Throws on any hiccup so uploadFile can fall back. */
async function directUploadFile(file: File, ref: Hex): Promise<Hex> {
  const sign = await authed<{ url?: string; cid?: string }>("/upload/sign", JSON.stringify({ ref }), JSON_HEADERS);
  if (sign.cid) return ref; // server already had this content pinned
  if (!sign.url) throw new Error("no signed url");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(sign.url, { method: "POST", body: form });
  if (!res.ok) throw new Error(`pinata upload ${res.status}`);
  const json = (await res.json()) as { data?: { cid?: string }; cid?: string };
  const cid = json.data?.cid ?? json.cid;
  if (!cid) throw new Error("no cid in upload response");
  await authed("/upload/commit", JSON.stringify({ ref, cid }), JSON_HEADERS);
  return ref;
}

export async function uploadFile(file: File): Promise<Hex> {
  const ref = keccak256(new Uint8Array(await file.arrayBuffer()));
  try {
    return await directUploadFile(file, ref);
  } catch {
    // Signed-url path unavailable (CORS, network, older backend) → server proxy.
    const form = new FormData();
    form.append("file", file);
    return (await authed<{ ref: Hex }>("/upload/file", form)).ref;
  }
}

export async function uploadJson(data: unknown): Promise<Hex> {
  return (await authed<{ ref: Hex }>("/upload/json", JSON.stringify(data), { "content-type": "application/json" })).ref;
}

/** Text + optional file envelope (proposals / deliverables / evidence) → on-chain ref. */
export async function uploadAttachment(text: string, file: File | null): Promise<Hex> {
  const fileRef = file ? await uploadFile(file) : null;
  return uploadJson({ text, file: fileRef, name: file?.name ?? null, ts: Date.now() });
}

export interface Brief {
  v: 1;
  title: string;
  description: string;
  category?: string; // single, from CATEGORIES
  tags?: string[]; // free-form, normalized + capped
  attachments: { ref: Hex; name: string; mime: string }[];
  ts: number;
}

/** Normalize free-form tags: trim, lowercase, drop blanks, dedupe, cap at 6. */
export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 6);
}

/** Coarse phases for upload progress UI. */
export type UploadPhase = "files" | "brief";

/** Title + description + files → private brief envelope. Returns the on-chain ref and the
 * brief object itself, so the caller can prime the react-query cache without a refetch.
 * `onPhase` fires as each (slow) stage begins so the UI can show real progress. */
export async function uploadBrief(
  title: string,
  description: string,
  files: File[],
  onPhase?: (p: UploadPhase) => void,
  meta?: { category?: string; tags?: string[] },
): Promise<{ ref: Hex; brief: Brief }> {
  let attachments: Brief["attachments"] = [];
  if (files.length) {
    onPhase?.("files");
    attachments = await Promise.all(
      files.map(async (f) => ({ ref: await uploadFile(f), name: f.name, mime: f.type })),
    );
  }
  onPhase?.("brief");
  const tags = meta?.tags?.length ? normalizeTags(meta.tags) : undefined;
  const brief: Brief = {
    v: 1,
    title,
    description,
    ...(meta?.category ? { category: meta.category } : {}),
    ...(tags?.length ? { tags } : {}),
    attachments,
    ts: Date.now(),
  };
  const ref = await uploadJson(brief);
  return { ref, brief };
}

export interface ImgOpts {
  width?: number;
  height?: number;
}

/** Temporary signed URL to fetch a private ref. Pass `img` for a server-optimized thumbnail. */
export async function accessLink(ref: Hex, img?: ImgOpts): Promise<string> {
  return (await authed<{ url: string }>("/access", JSON.stringify({ ref, img }), { "content-type": "application/json" }))
    .url;
}

/** Validates an untrusted brief envelope (from IPFS) into a safe, fully-shaped object. */
export function parseBrief(data: unknown): Brief | null {
  if (!data || typeof data !== "object") return null;
  const b = data as Record<string, unknown>;
  if (typeof b.title !== "string") return null;
  const attachments = Array.isArray(b.attachments)
    ? b.attachments
        .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
        .filter((a) => typeof a.ref === "string" && typeof a.name === "string")
        .map((a) => ({ ref: a.ref as Hex, name: a.name as string, mime: typeof a.mime === "string" ? a.mime : "" }))
    : [];
  const tags = Array.isArray(b.tags) ? normalizeTags(b.tags.filter((t): t is string => typeof t === "string")) : [];
  return {
    v: 1,
    title: b.title,
    description: typeof b.description === "string" ? b.description : "",
    ...(typeof b.category === "string" && b.category ? { category: b.category } : {}),
    ...(tags.length ? { tags } : {}),
    attachments,
    ts: typeof b.ts === "number" ? b.ts : 0,
  };
}

/** Brief JSON, served+cached by the backend (one round trip, no gateway hop). */
export async function fetchBrief(ref?: Hex | null): Promise<Brief | null> {
  if (isEmptyCid(ref)) return null;
  const { data } = await authed<{ data: unknown }>("/brief", JSON.stringify({ ref }), {
    "content-type": "application/json",
  });
  return parseBrief(data);
}

/** Text + optional file envelope (proposals / deliverables / evidence). */
export interface AttachmentEnvelope {
  text: string;
  file: Hex | null;
  name: string | null;
}

/** Public profile metadata (name + bio). */
export interface ProfileMeta {
  name: string;
  bio: string;
}

export async function uploadProfileMeta(name: string, bio: string): Promise<Hex> {
  return uploadJson({ v: 1, name, bio, ts: Date.now() });
}

export async function fetchProfileMeta(ref?: Hex | null): Promise<ProfileMeta | null> {
  if (isEmptyCid(ref)) return null;
  const { data } = await authed<{ data: unknown }>("/brief", JSON.stringify({ ref }), {
    "content-type": "application/json",
  });
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  return { name: typeof d.name === "string" ? d.name : "", bio: typeof d.bio === "string" ? d.bio : "" };
}

/** Reads an attachment envelope's JSON (same backend path/cache as briefs). */
export async function fetchAttachment(ref?: Hex | null): Promise<AttachmentEnvelope | null> {
  if (isEmptyCid(ref)) return null;
  const { data } = await authed<{ data: unknown }>("/brief", JSON.stringify({ ref }), {
    "content-type": "application/json",
  });
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  return {
    text: typeof d.text === "string" ? d.text : "",
    file: typeof d.file === "string" ? (d.file as Hex) : null,
    name: typeof d.name === "string" ? d.name : null,
  };
}
