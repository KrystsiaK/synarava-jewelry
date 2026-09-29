import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import {
  ACCOUNT_ORDERS_SETTINGS_DEFAULTS,
  ACCOUNT_ORDERS_SETTINGS_KEY,
  type AccountOrdersSettings,
} from "@/lib/content/account-orders-settings-fields";

export {
  ACCOUNT_ORDERS_SETTINGS_DEFAULTS,
  ACCOUNT_ORDERS_SETTINGS_KEY,
  type AccountOrdersSettings,
};

const FIELD_KEYS = Object.keys(ACCOUNT_ORDERS_SETTINGS_DEFAULTS) as (keyof AccountOrdersSettings)[];

function parseStored(value: unknown): Partial<AccountOrdersSettings> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const next: Partial<AccountOrdersSettings> = {};
  for (const key of FIELD_KEYS) {
    if (typeof record[key] === "boolean") next[key] = record[key];
  }
  return next;
}

function mergeWithDefaults(overrides: Partial<AccountOrdersSettings>): AccountOrdersSettings {
  return {
    buyAgainOnOrdersEnabled:
      overrides.buyAgainOnOrdersEnabled ?? ACCOUNT_ORDERS_SETTINGS_DEFAULTS.buyAgainOnOrdersEnabled,
    headlessReturnEnabled:
      overrides.headlessReturnEnabled ?? ACCOUNT_ORDERS_SETTINGS_DEFAULTS.headlessReturnEnabled,
  };
}

export const getAccountOrdersSettings = cache(async (): Promise<AccountOrdersSettings> => {
  const setting = await db.siteSetting.findUnique({ where: { key: ACCOUNT_ORDERS_SETTINGS_KEY } });
  return mergeWithDefaults(parseStored(setting?.value));
});

export async function setAccountOrdersSettings(
  updates: Partial<AccountOrdersSettings>,
): Promise<AccountOrdersSettings> {
  const setting = await db.siteSetting.findUnique({ where: { key: ACCOUNT_ORDERS_SETTINGS_KEY } });
  const next: Partial<AccountOrdersSettings> = { ...parseStored(setting?.value) };

  for (const key of FIELD_KEYS) {
    if (key in updates && typeof updates[key] === "boolean") {
      next[key] = updates[key];
    }
  }

  await db.siteSetting.upsert({
    where: { key: ACCOUNT_ORDERS_SETTINGS_KEY },
    update: { value: next },
    create: { key: ACCOUNT_ORDERS_SETTINGS_KEY, value: next },
  });

  return mergeWithDefaults(next);
}
