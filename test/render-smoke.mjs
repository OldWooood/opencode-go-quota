// Headless render smoke test for the sidebar panel.
//
// Runs the real @opentui renderer (Bun only) with the same @opentui/solid
// transform the host applies to plugin sources. Invoked via `pnpm test:render`,
// which preloads @opentui/solid/preload; every scenario runs in its own process
// so leaked timers or renderer state cannot affect the next one.
import { fileURLToPath } from "node:url";

const SCENARIOS = ["ready", "partial", "stale", "error", "slow", "status", "status-filtered"];

if (typeof Bun === "undefined") {
  console.error("test:render needs bun; run `pnpm test:render`");
  process.exit(1);
}

if (!process.argv[2]) {
  const preload = fileURLToPath(
    new URL("../node_modules/@opentui/solid/scripts/preload.js", import.meta.url),
  );
  let failed = 0;
  for (const scenario of SCENARIOS) {
    const result = Bun.spawnSync(
      [process.execPath, "--preload", preload, import.meta.filename, scenario],
      { stdio: ["inherit", "inherit", "inherit"], cwd: process.cwd() },
    );
    if (result.exitCode !== 0) {
      failed += 1;
      console.error(`[${scenario}] FAILED (exit ${result.exitCode})`);
    }
  }
  process.exit(failed === 0 ? 0 : 1);
}

const scenario = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

process.on("uncaughtException", (error) => {
  console.error(error);
  process.exit(1);
});
process.on("unhandledRejection", (error) => {
  console.error(error);
  process.exit(1);
});

const [{ PluginContextProvider }, { createComponent, testRender }, { default: tui }] =
  await Promise.all([
    import("@opencode/plugin/tui"),
    import("@opentui/solid"),
    import("../src/tui.tsx"),
  ]);

const theme = {
  text: {
    base: "#ffffff",
    muted: "#888888",
    feedback: {
      error: { base: "#ff5555", muted: "#ff5555" },
      warning: { base: "#ffff55", muted: "#ffff55" },
      success: { base: "#55ff55", muted: "#55ff55" },
    },
  },
  border: { base: "#333333" },
};

const iso = (ms) => new Date(Date.now() + ms).toISOString();
const sample = {
  usage: {
    rolling: { status: "ok", percent: 2, resetsAt: iso(3600_000) },
    weekly: { status: "ok", percent: 18, resetsAt: iso(2 * 86400_000) },
    monthly: { status: "ok", percent: 43, resetsAt: iso(23 * 86400_000) },
  },
};
const partial = { usage: { rolling: sample.usage.rolling } };

let calls = 0;
const respond = (payload) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
globalThis.fetch = async () => {
  calls += 1;
  if (scenario === "slow") {
    await sleep(12_000);
    return respond(sample);
  }
  if (scenario === "ready" || scenario.startsWith("status")) return respond(sample);
  if (scenario === "partial") return respond(partial);
  if (scenario === "stale" && calls === 1) return respond(sample);
  return new Response("boom", { status: 500 });
};

const claims = new Map();
const context = {
  options:
    scenario === "stale" || scenario === "slow"
      ? { refreshSec: 10 }
      : scenario === "status-filtered"
        ? { statusWindows: ["w", "monthly"] }
        : {},
  theme,
  ui: {
    slot: (c) => {
      claims.set(c.append, c);
      return () => {};
    },
  },
};

tui.setup(context);

const sidebar = claims.get("sidebar.content");
const status = claims.get("prompt.footer.status");
const homeStatus = claims.get("home.footer.status");
if (!sidebar) throw new Error(`[${scenario}] sidebar.content claim missing`);
if (!status) throw new Error(`[${scenario}] prompt.footer.status claim missing`);
if (!homeStatus) throw new Error(`[${scenario}] home.footer.status claim missing`);

const claim = scenario.startsWith("status") ? status : sidebar;
const input = scenario.startsWith("status")
  ? { sessionID: "s1", mode: "normal", showDetails: false }
  : { sessionID: "s1" };

// Defer the tree to mount time: the opentui runtime creates elements eagerly,
// and intrinsic elements need the renderer attached first.
const t = await testRender(
  () =>
    createComponent(PluginContextProvider, {
      value: context,
      get children() {
        return claim.render(input);
      },
    }),
  {
    width: scenario.startsWith("status") ? 80 : 44,
    height: scenario.startsWith("status") ? 3 : 12,
  },
);

await sleep(150);
await t.renderOnce();

const frame = () => t.captureCharFrame();
const expect = (text, label) => {
  const current = frame();
  if (!current.includes(text)) {
    throw new Error(`[${scenario}] missing ${label}: ${JSON.stringify(text)}\n${current}`);
  }
};
const reject = (text, label) => {
  if (frame().includes(text)) {
    throw new Error(`[${scenario}] unexpected ${label}: ${JSON.stringify(text)}\n${frame()}`);
  }
};

console.log(`[${scenario}] first paint:\n${frame()}`);
if (scenario.startsWith("status")) {
  if (scenario === "status-filtered") {
    expect("W:18% M:43%", "filtered status summary");
    reject("5H", "hidden rolling window");
  } else {
    expect("5H:2% W:18% M:43%", "status summary");
  }
  reject("stale", "stale marker");
} else {
  expect("OpenCode Go", "header");
  if (scenario === "ready") {
    expect("5h", "5h row");
    expect("2%", "rolling percent");
    expect("18%", "weekly percent");
    expect("43%", "monthly percent");
    expect("━", "filled bar");
    expect("─", "empty bar");
    reject("stale", "stale marker");
  } else if (scenario === "partial") {
    expect("5h", "5h row");
    reject("Weekly", "absent weekly window");
    reject("Monthly", "absent monthly window");
  } else if (scenario === "error") {
    expect("Go: Go API 500", "error line");
    reject("Weekly", "data without a successful load");
  } else if (scenario === "slow") {
    expect("loading…", "loading state");
    if (calls !== 1) throw new Error(`[${scenario}] expected 1 fetch at start, got ${calls}`);
    await sleep(10_400);
    if (calls !== 1) {
      throw new Error(`[${scenario}] interval tick during inflight was not skipped (calls=${calls})`);
    }
    await sleep(2_600);
    await t.renderOnce();
    console.log(`[${scenario}] after slow fetch resolves:\n${frame()}`);
    expect("Weekly", "data after slow fetch resolves");
    if (calls !== 1) throw new Error(`[${scenario}] unexpected extra fetch (calls=${calls})`);
  } else {
    expect("Weekly", "initial data");
    reject("stale", "stale marker before any failure");
    await sleep(10_700);
    await t.renderOnce();
    console.log(`[${scenario}] after failed refresh:\n${frame()}`);
    expect("⚠ stale", "stale marker");
    expect("18%", "data kept after failure");
    expect("43%", "monthly kept after failure");
  }
}

console.log(`[${scenario}] OK (fetch calls: ${calls})`);
process.exit(0);
