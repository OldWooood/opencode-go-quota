// Server entrypoint for local-directory installs: opencode resolves
// "<dir>/server", falling back to "<dir>/index". Keep this shim — the
// package.json "exports" map only covers package installs.
export { default } from "./src/index";
