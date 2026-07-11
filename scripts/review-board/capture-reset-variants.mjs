// AR1 link-placement variants for the M11 board. The as-built sign-in screen
// renders "Need an account? Create one" and "Forgot password?" mashed together
// on one line (two inline .text-btns, no separation). Mock two arrangements via
// DOM wrapping (screenshot-only; no code change) so Mitchell picks a letter.
// Local stack only.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = "http://localhost:3123";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "shots-reset");
fs.mkdirSync(OUT, { recursive: true });

const arrange = (css) => {
  const panel = document.querySelector(".auth-panel");
  const btns = [...panel.querySelectorAll(".text-btn")];
  const wrap = document.createElement("div");
  wrap.setAttribute("style", css);
  btns.forEach((b) => wrap.appendChild(b));
  panel.appendChild(wrap);
};

const run = async () => {
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  await ctx.route(/supabase\.co/, (route) => route.abort());

  const variants = [
    ["AR1-A-stacked.jpg", "display:flex;flex-direction:column;align-items:flex-start;gap:0.6rem;margin-top:0.5rem"],
    ["AR1-B-spaced-row.jpg", "display:flex;flex-direction:row;justify-content:space-between;align-items:center;gap:1rem;width:100%;margin-top:0.5rem"],
  ];

  for (const [name, css] of variants) {
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="email"]', { timeout: 20000 });
    await page.waitForTimeout(500);
    await page.evaluate(arrange, css);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, name), type: "jpeg", quality: 88 });
    console.log("shot", name);
    await page.close();
  }

  await ctx.close();
  await browser.close();
  console.log("done");
};

run().catch((e) => { console.error("CAPTURE FAILED:", e); process.exitCode = 1; });
