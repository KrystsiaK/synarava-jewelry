/**
 * HTTP runtime lands in Этап 2. Этап 1 ships domain + registry only.
 * This entrypoint keeps Railway startCommand valid as a placeholder process.
 */
console.info(
  JSON.stringify({
    service: "@synarava/sku-api",
    stage: "domain-poc",
    message:
      "HTTP /v1 endpoints arrive in Этап 2; registry domain layer is loaded via package imports.",
  }),
);

// Keep process alive only when explicitly requested (e.g. local smoke).
if (process.env.SKU_API_KEEPALIVE === "1") {
  setInterval(() => undefined, 60_000);
}
