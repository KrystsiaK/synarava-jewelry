export function readEnvValue(key: string): string {
  return process.env[key] ?? "";
}

export type AdminCredentials = { username: string; password: string };

export function adminCredentials(): AdminCredentials | null {
  const username = readEnvValue("ADMIN_USERNAME") || readEnvValue("ADMIN_EMAIL");
  const password = readEnvValue("ADMIN_PASSWORD");
  if (!username || !password) return null;
  return { username, password };
}

export function hasShopifySandbox(): boolean {
  const hasClientCredentials = Boolean(
    readEnvValue("SHOPIFY_CLIENT_ID") && readEnvValue("SHOPIFY_CLIENT_SECRET"),
  );
  return Boolean(
    readEnvValue("SHOPIFY_STORE_DOMAIN") &&
      (readEnvValue("SHOPIFY_ADMIN_ACCESS_TOKEN") || hasClientCredentials),
  );
}
