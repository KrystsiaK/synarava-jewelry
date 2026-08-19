#!/bin/sh

set -eu

github_registry_key='//npm.pkg.github.com/:_authToken'

cleanup_auth() {
  pnpm config delete --global "$github_registry_key" >/dev/null 2>&1 || true
}

trap cleanup_auth EXIT HUP INT TERM

if [ -z "${NPM_TOKEN:-}" ]; then
  echo "Railway install error: NPM_TOKEN is unavailable in the install step." >&2
  echo "Add a Railway service variable named NPM_TOKEN with GitHub Packages read access." >&2
  exit 64
fi

pnpm config set --global "$github_registry_key" "$NPM_TOKEN"
echo "GitHub Packages authentication configured for this install step."

pnpm install --frozen-lockfile --prefer-offline
