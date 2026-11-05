/**
 * Dry-import the collector module graph under bare Node + loader.mjs.
 * No network, no DB queries — resolve imports only, then exit.
 *
 * Used by vitest to catch Next-only packages (e.g. `server-only`) that
 * crash Railway cron: `ERR_MODULE_NOT_FOUND`.
 */
await import("@/lib/mission-control/collector/run-once");
console.log("mission-control-collector check-import: ok");
