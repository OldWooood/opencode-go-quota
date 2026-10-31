# opencode-go-quota

An [OpenCode v2](https://opencode.ai) plugin that shows your
**OpenCode Go** quota (5h / Weekly / Monthly) in the TUI sidebar, plus a
compact one-line summary in the bottom status bar.

## Preview

```
OpenCode Go
5h      0% · 4h 59m
────────────────────────────
Weekly  53% · 17h 7m
━━━━━━━━━━━━━━━─────────────
Monthly 26% · 23d 18h 33m
━━━━━━━─────────────────────
```

Bottom status bar (session and home screens):

```
[Go] 5H:6% W:11% M:5%
```

- Percentages are **used**, matching the OpenCode console
- Each window shows label, percent, and reset countdown, followed by a full-width bar
- Sidebar bar color follows the active theme: green <50% / yellow 50–80% / red ≥80% or rate-limited
- The status bar summary stays monochrome and compact (`label:percent`), and
  abbreviates Weekly/Monthly as `W`/`M` to blend with the rest of the status line
- `statusWindows` picks which windows the status bar shows; `status: false`
  hides the summary entirely while keeping the sidebar
- Styling matches the native Context block; refreshes every 30 seconds by default
- A failed refresh keeps the last known values visible and marks them `⚠ stale`
  instead of blanking the panel; the status bar appends `⚠`

## Install

Add the local path to `~/.config/opencode/cli.json`:

```json
{
  "plugins": ["/path/to/opencode-go-quota"]
}
```

Use the absolute path of your clone. Restart the TUI to take effect.

With options:

```json
{
  "plugins": [
    {
      "package": "/path/to/opencode-go-quota",
      "options": { "refreshSec": 30, "mode": "used", "statusWindows": ["weekly", "monthly"] }
    }
  ]
}
```

- `refreshSec`: polling interval in seconds, default `30`, clamped to 10–600.
- `mode`: `"used"` (default, same as the console) or `"left"` for remaining percent.
  In `left` mode the bar fills by remaining, the color bands are mirrored
  (green ≥50% left, yellow 20–50%, red ≤20% or rate-limited), and the status
  bar shows remaining percentages too.
- `statusWindows`: which quotas the status bar shows, e.g.
  `["weekly", "monthly"]`. Accepts `rolling` / `weekly` / `monthly` (aliases
  `5h` / `w` / `m`); default is all three. The sidebar still shows every window
  the API returns.
- `status`: set to `false` to hide the status bar summary entirely; default
  `true`.

> `opencode plugin add` is not supported. It registers a server plugin in
> `opencode.json`, whose TUI loads from an isolated cache copy with its own
> `solid-js` runtime — the panel renders once and never refreshes. Do not
> register both; duplicate plugin ids leave only one instance active.

## Auth

The API key is resolved in order, first match wins:

1. `OPENCODE_API_KEY` environment variable
2. `opencode-go` entry in `~/.local/share/opencode/auth.json` (written by `opencode auth login`)
3. `opencode` entry in the same file

It queries `https://opencode.ai/zen/go/v1/usage` (read-only usage endpoint,
no model calls).

## Update / Uninstall

```bash
git -C /path/to/opencode-go-quota pull
```

Restart the TUI after updating. No build step needed.
To uninstall, remove the entry from `cli.json` and restart the TUI.

## Develop

```bash
pnpm install
pnpm typecheck
pnpm test          # unit tests (node --test)
pnpm test:render   # headless TUI smoke test; requires bun on PATH
```

`pnpm test:render` mounts the panel in the real @opentui test renderer and
checks the ready / partial / stale / error / slow-refresh / status-bar scenarios.
