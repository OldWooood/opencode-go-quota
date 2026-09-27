# opencode-go-quota

An [OpenCode v2](https://opencode.ai) plugin that shows your
**OpenCode Go** quota (5h / Weekly / Monthly) in the TUI sidebar.

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

- Percentages are **used**, matching the OpenCode console
- Each window shows label, percent, and reset countdown, followed by a full-width bar
- Bar color follows the active theme: green <50% / yellow 50–80% / red ≥80% or rate-limited
- Styling matches the native Context block; refreshes every 30 seconds by default

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
      "options": { "refreshSec": 30, "mode": "used" }
    }
  ]
}
```

- `refreshSec`: polling interval in seconds, default `30`, clamped to 10–600.
- `mode`: `"used"` (default, same as the console) or `"left"` for remaining percent.
  In `left` mode the bar fills by remaining and the color bands are mirrored
  (green ≥50% left, yellow 20–50%, red ≤20% or rate-limited).

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
```
