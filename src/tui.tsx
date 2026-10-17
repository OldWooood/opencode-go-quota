/** @jsxImportSource @opentui/solid */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Plugin, usePlugin } from "@opencode/plugin/tui";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { formatCountdown } from "./format";

const GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
const DEFAULT_REFRESH_MS = 30_000;
const MIN_REFRESH_MS = 10_000;
const MAX_REFRESH_MS = 600_000;
/** Countdowns advance at least once a minute even between refreshes. */
const COUNTDOWN_TICK_MS = 60_000;

type GoWindowState = {
  label: string;
  /** 已用百分比，和官网 console 口径一致 */
  used: number;
  resetIso: string;
  limited: boolean;
};

type PanelState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  /** Last successful data; `stale` carries the most recent refresh error, "" when fresh. */
  | { kind: "ready"; windows: GoWindowState[]; stale: string };

const WINDOW_LABELS = [
  { key: "rolling", label: "5h" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
] as const;

function loadApiKey(): string {
  if (process.env.OPENCODE_API_KEY) return process.env.OPENCODE_API_KEY;
  try {
    const raw = readFileSync(join(homedir(), ".local", "share", "opencode", "auth.json"), "utf8");
    const auth = JSON.parse(raw) as Record<string, { key?: string }>;
    return auth["opencode-go"]?.key ?? auth["opencode"]?.key ?? "";
  } catch {
    return "";
  }
}

async function fetchWindows(signal: AbortSignal): Promise<GoWindowState[]> {
  const key = loadApiKey();
  if (!key) throw new Error("no opencode-go key (auth.json / OPENCODE_API_KEY)");
  const res = await fetch(GO_USAGE_URL, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  });
  if (!res.ok) throw new Error(`Go API ${res.status}`);
  const payload = (await res.json()) as {
    usage?: Record<string, { status?: string; percent?: number; resetsAt?: string }>;
  };
  const windows = WINDOW_LABELS.flatMap(({ key, label }): GoWindowState[] => {
    const w = payload.usage?.[key];
    if (!w) return [];
    const limited = w.status === "rate-limited";
    const percent = typeof w.percent === "number" ? w.percent : 0;
    return [
      {
        label,
        used: limited ? 100 : Math.max(0, Math.min(100, percent)),
        resetIso: typeof w.resetsAt === "string" ? w.resetsAt : "",
        limited,
      },
    ];
  });
  if (windows.length === 0) throw new Error("no usage windows in response");
  return windows;
}

function GoPanel(props: { refreshMs?: number; mode?: "used" | "left" }) {
  const ctx = usePlugin();
  const refreshMs = props.refreshMs ?? DEFAULT_REFRESH_MS;
  const mode = props.mode ?? "used";
  const [state, setState] = createSignal<PanelState>({ kind: "loading" });
  let disposed = false;
  let inflight = false;
  const controller = new AbortController();

  const refresh = async () => {
    if (disposed || inflight) return;
    inflight = true;
    try {
      const windows = await fetchWindows(controller.signal);
      if (!disposed) setState({ kind: "ready", windows, stale: "" });
    } catch (error) {
      if (!disposed) {
        const message = error instanceof Error ? error.message.slice(0, 80) : "unknown";
        // Keep the last successful data visible; only a failure before any
        // data has ever loaded takes over the panel.
        setState((prev) =>
          prev.kind === "ready" ? { ...prev, stale: message } : { kind: "error", message },
        );
      }
    } finally {
      inflight = false;
    }
  };

  void refresh();
  const timer = setInterval(() => void refresh(), refreshMs);
  const [now, setNow] = createSignal(Date.now());
  const clock = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
  onCleanup(() => {
    disposed = true;
    clearInterval(timer);
    clearInterval(clock);
    controller.abort();
  });

  const BAR_WIDTH = 28;
  const trackColor = ctx.theme.border.base;
  /** Display value by mode: used% or left%. Limited windows read 100% used / 0% left. */
  const displayPct = (w: GoWindowState) => (mode === "left" ? 100 - w.used : w.used);
  const barFill = (w: GoWindowState) => {
    const v = displayPct(w);
    if (w.limited) return ctx.theme.text.feedback.error.muted;
    if (mode === "left") {
      if (v <= 20) return ctx.theme.text.feedback.error.muted;
      if (v < 50) return ctx.theme.text.feedback.warning.muted;
      return ctx.theme.text.feedback.success.muted;
    }
    if (v >= 80) return ctx.theme.text.feedback.error.muted;
    if (v >= 50) return ctx.theme.text.feedback.warning.muted;
    return ctx.theme.text.feedback.success.muted;
  };

  const errMsg = () => {
    const s = state();
    return s.kind === "error" ? s.message : undefined;
  };
  const readyWindows = () => {
    const s = state();
    return s.kind === "ready" ? s.windows : undefined;
  };
  /** Marker shown when the visible data comes from a failed refresh. */
  const staleMark = () => {
    const s = state();
    return s.kind === "ready" && s.stale ? " ⚠ stale" : "";
  };

  return (
    <box flexDirection="column">
      <box flexDirection="row">
        <text fg={ctx.theme.text.base}>
          <strong>OpenCode Go</strong>
        </text>
        <Show when={staleMark()}>
          {(mark: () => string) => (
            <text fg={ctx.theme.text.feedback.warning.muted}>{mark()}</text>
          )}
        </Show>
      </box>
      <Show
        when={errMsg()}
        fallback={
          <Show when={readyWindows()} fallback={<text fg={ctx.theme.text.muted}>loading…</text>}>
            {(wins: () => GoWindowState[]) => (
              <For each={wins()}>
                {(w: GoWindowState) => {
                  const pct = displayPct(w);
                  const filled = Math.round((pct / 100) * BAR_WIDTH);
                  const reset = () =>
                    w.resetIso ? ` · ${formatCountdown(w.resetIso, now())}` : "";
                  return (
                    <box flexDirection="column">
                      <box flexDirection="row">
                        <text fg={ctx.theme.text.muted}>{`${w.label.padEnd(7)} `}</text>
                        <text fg={ctx.theme.text.muted}>{`${pct}%`}</text>
                        <text
                          fg={ctx.theme.text.muted}
                        >{`${w.limited ? " (limited)" : ""}${reset()}`}</text>
                      </box>
                      <box flexDirection="row">
                        <Show when={filled > 0}>
                          <text fg={barFill(w)}>{"━".repeat(filled)}</text>
                        </Show>
                        <Show when={filled < BAR_WIDTH}>
                          <text fg={w.limited ? barFill(w) : trackColor}>
                            {"─".repeat(BAR_WIDTH - filled)}
                          </text>
                        </Show>
                      </box>
                    </box>
                  );
                }}
              </For>
            )}
          </Show>
        }
      >
        {(msg: () => string) => <text fg={ctx.theme.text.feedback.error.base}>Go: {msg()}</text>}
      </Show>
    </box>
  );
}

export default Plugin.define({
  id: "opencode-go-sidebar",
  setup(context) {
    const opts = (context.options as { refreshSec?: unknown; mode?: unknown } | undefined) ?? {};
    const sec = typeof opts.refreshSec === "number" && Number.isFinite(opts.refreshSec) ? opts.refreshSec : 30;
    const refreshMs = Math.min(MAX_REFRESH_MS, Math.max(MIN_REFRESH_MS, sec * 1000));
    const mode = opts.mode === "left" ? "left" : ("used" as const);
    return context.ui.slot({
      append: "sidebar.content",
      render: () => <GoPanel refreshMs={refreshMs} mode={mode} />,
    });
  },
});
