import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional(),
);

const optionalShopDomain = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .transform((value) => value.replace(/^https?:\/\//, "").replace(/\/$/, ""))
    .pipe(z.string().regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i))
    .optional(),
);

const envSchema = z.object({
  DATABASE_URL: optionalString,
  AUTH_SESSION_SECRET: optionalString,
  ADMIN_USERNAME: optionalString,
  ADMIN_EMAIL: optionalString,
  ADMIN_PASSWORD: optionalString,
  ADMIN_PASSWORD_HASH: optionalString,
  ADMIN_SESSION_SECRET: optionalString,
  NEXTAUTH_SECRET: optionalString,
  NEXTAUTH_URL: optionalUrl,
  NEXT_PUBLIC_APP_URL: optionalUrl,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  COMMERCE_BACKEND: z.enum(["local", "shopify"]).optional(),
  SHOPIFY_STORE_DOMAIN: optionalShopDomain,
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: optionalString,
  SHOPIFY_STOREFRONT_API_VERSION: z
    .string()
    .regex(/^20\d{2}-(01|04|07|10)$/)
    .optional(),
  SHOPIFY_CLIENT_ID: optionalString,
  SHOPIFY_CLIENT_SECRET: optionalString,
  SHOPIFY_ADMIN_ACCESS_TOKEN: optionalString,
  SHOPIFY_ADMIN_API_VERSION: z
    .string()
    .regex(/^20\d{2}-(01|04|07|10)$/)
    .optional(),
  SHOPIFY_PUBLICATION_ID: optionalString,
  SHOPIFY_LOCATION_ID: optionalString,
  SHOPIFY_WEBHOOK_SECRET: optionalString,
  SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: optionalString,
  SHOPIFY_CUSTOMER_SESSION_SECRET: optionalString,
  S3_REGION: optionalString,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_ENDPOINT: optionalUrl,
  S3_PUBLIC_URL: optionalUrl,
  S3_FORCE_PATH_STYLE: optionalString,
  S3_USE_PROXY: optionalString,
  DEEPL_API_KEY: optionalString,
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  COMMERCE_BACKEND: process.env.COMMERCE_BACKEND,
  SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
  SHOPIFY_STOREFRONT_API_VERSION: process.env.SHOPIFY_STOREFRONT_API_VERSION,
  SHOPIFY_CLIENT_ID: process.env.SHOPIFY_CLIENT_ID,
  SHOPIFY_CLIENT_SECRET: process.env.SHOPIFY_CLIENT_SECRET,
  SHOPIFY_ADMIN_ACCESS_TOKEN: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
  SHOPIFY_ADMIN_API_VERSION: process.env.SHOPIFY_ADMIN_API_VERSION,
  SHOPIFY_PUBLICATION_ID: process.env.SHOPIFY_PUBLICATION_ID,
  SHOPIFY_LOCATION_ID: process.env.SHOPIFY_LOCATION_ID,
  SHOPIFY_WEBHOOK_SECRET: process.env.SHOPIFY_WEBHOOK_SECRET,
  SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID:
    process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID,
  SHOPIFY_CUSTOMER_SESSION_SECRET:
    process.env.SHOPIFY_CUSTOMER_SESSION_SECRET,
  S3_REGION: process.env.S3_REGION,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_PUBLIC_URL: process.env.S3_PUBLIC_URL,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
  S3_USE_PROXY: process.env.S3_USE_PROXY,
  DEEPL_API_KEY: process.env.DEEPL_API_KEY,
});
