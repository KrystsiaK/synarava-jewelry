#!/usr/bin/env node

import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const version = packageJson.version;
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

if (typeof version !== "string" || !semverPattern.test(version)) {
  console.error(`package.json version must be a valid semver value. Received: ${String(version)}`);
  process.exit(1);
}

const gitRef = process.env.GITHUB_REF ?? "";
const tagMatch = gitRef.match(/^refs\/tags\/v(.+)$/);

if (tagMatch && tagMatch[1] !== version) {
  console.error(`Git tag ${gitRef} does not match package.json version ${version}. Expected refs/tags/v${version}.`);
  process.exit(1);
}

console.log(`Version ${version} is valid.`);
