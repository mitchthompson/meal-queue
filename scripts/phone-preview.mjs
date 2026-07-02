#!/usr/bin/env node
// Prints the LAN URL for the dev server plus a QR code to scan from a phone.
// Used by `npm run dev:phone`, which runs this and then `next dev -H 0.0.0.0`.
// No dependencies: the QR code comes from qrcode-terminal via npx at runtime,
// with a graceful fallback to just printing the URL.

import os from "node:os";
import { spawnSync } from "node:child_process";

const port = process.env.PORT || "3000";

function lanAddress() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return null;
}

const ip = lanAddress();
if (!ip) {
  console.log(
    "phone-preview: no LAN IPv4 address found (is this machine on Wi-Fi?)."
  );
  console.log("Starting the dev server anyway; use http://localhost:" + port);
  process.exit(0); // never block the dev server
}

const url = `http://${ip}:${port}`;
console.log("");
console.log(`  Phone preview URL: ${url}`);
console.log("  (iPhone and this Mac must be on the same Wi-Fi network.)");
console.log("");

let qrPrinted = false;
try {
  const result = spawnSync("npx", ["--yes", "qrcode-terminal", url], {
    stdio: "inherit",
    timeout: 20000,
  });
  qrPrinted = result.status === 0;
} catch {
  // npx missing or blocked; fall through to the plain-URL fallback
}
if (!qrPrinted) {
  console.log("  (QR code unavailable: type the URL into Safari instead.)");
  console.log("");
}
