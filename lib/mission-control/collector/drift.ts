import type { WiringConfig } from "@synarava/wiring-engine";

/**
 * Collect unique widget keys referenced by WiringConfig bindings.
 */
export function wiringConfigNodeKeys(config: WiringConfig): string[] {
  const keys = new Set<string>();
  for (const binding of config.systemBindings ?? []) {
    if (binding.source) keys.add(binding.source.widgetKey);
    for (const sink of binding.sinks ?? []) {
      keys.add(sink.widgetKey);
    }
  }
  for (const connection of config.userConnections ?? []) {
    keys.add(connection.source.widgetKey);
    keys.add(connection.target.widgetKey);
  }
  return [...keys].toSorted();
}

/**
 * Drift = declared in WiringConfig, no live provider, not an intentional placeholder.
 * Log-only (no Telegram).
 */
export function findDriftNodeKeys(input: {
  wiringNodeKeys: readonly string[];
  providerKeys: ReadonlySet<string>;
  placeholderKeys: ReadonlySet<string>;
}): string[] {
  return input.wiringNodeKeys.filter(
    (key) =>
      !input.providerKeys.has(key) && !input.placeholderKeys.has(key),
  );
}
