// TUI entrypoint for local-directory installs: opencode resolves "<dir>/tui".
// Keep this shim — the package.json "exports" map only covers package installs.
export { default } from "./src/tui";
