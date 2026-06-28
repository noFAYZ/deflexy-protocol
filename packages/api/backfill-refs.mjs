// One-time recovery: rebuild data/refs.json (ref -> cid) from existing private files.
// ref = keccak256(content); we take it from the keyvalue tag if present, else recompute
// it from the raw bytes. Safe to re-run.
import { mkdirSync, writeFileSync } from "node:fs";
import { keccak256 } from "viem";
import { PinataSDK } from "pinata";

process.loadEnvFile(".env");
const pinata = new PinataSDK({ pinataJwt: process.env.PINATA_JWT, pinataGateway: process.env.PINATA_GATEWAY });

const { files } = await pinata.files.private.list().limit(1000);
const map = {};
for (const f of files ?? []) {
  let ref = f.keyvalues?.ref;
  if (!ref) {
    const url = await pinata.gateways.private.createAccessLink({ cid: f.cid, expires: 120 });
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
    ref = keccak256(buf);
  }
  map[ref] = f.cid;
  console.log(`${ref} -> ${f.cid}  (${f.name})`);
}

mkdirSync("data", { recursive: true });
writeFileSync("data/refs.json", JSON.stringify(map));
console.log(`\nWrote ${Object.keys(map).length} mappings to data/refs.json`);
