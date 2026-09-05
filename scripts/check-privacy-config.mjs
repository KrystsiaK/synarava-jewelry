const requiredPublicFields = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_LEGAL_NAME",
  "NEXT_PUBLIC_LEGAL_POSTAL_ADDRESS",
  "NEXT_PUBLIC_PRIVACY_EMAIL",
];

const missing = requiredPublicFields.filter((name) => !process.env[name]?.trim());
const invalid = [];

if (process.env.NEXT_PUBLIC_SITE_URL) {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SITE_URL);
    if (url.protocol !== "https:") invalid.push("NEXT_PUBLIC_SITE_URL must use https");
  } catch {
    invalid.push("NEXT_PUBLIC_SITE_URL must be a valid absolute URL");
  }
}

const email = process.env.NEXT_PUBLIC_PRIVACY_EMAIL;
if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  invalid.push("NEXT_PUBLIC_PRIVACY_EMAIL must be a valid email address");
}

const optionalIntegrations = [
  ["Google Tag Manager", "NEXT_PUBLIC_GTM_ID"],
  ["Meta Pixel", "NEXT_PUBLIC_META_PIXEL_ID"],
];

if (missing.length || invalid.length) {
  console.error("Privacy launch check failed.");
  if (missing.length) console.error(`Missing public configuration: ${missing.join(", ")}`);
  for (const message of invalid) console.error(message);
  process.exitCode = 1;
} else {
  console.log("Required public privacy configuration is present.");
}

for (const [label, variable] of optionalIntegrations) {
  console.log(`${label}: ${process.env[variable]?.trim() ? "configured (consent-gated)" : "not configured"}`);
}
