#!/usr/bin/env bash
# graphify setup for this clone. Idempotent, costs no LLM tokens.
#   scripts/setup-graphify.sh              full: CLI (+Leiden) + graph.json merge driver
#   scripts/setup-graphify.sh --cli-only   CLI only (cloud agents: no merge-driver / no hooks)
#   scripts/setup-graphify.sh --check      read-only: silent + exit 0 when ready, else prints what is missing + exit 1
# Flags combine: "--check --cli-only" checks only the CLI. Needs uv, pipx or python3+pip.
#
# Differs from synarava/wordpress-starter: does NOT install git hooks, does NOT add
# pre-commit, and does NOT build the graph. Full mode installs the pinned CLI
# and registers the local merge.graphify.* driver from the graphify shebang.
# --check is offline: no PyPI / network; verifies CLI + pinned version (+ merge driver).
set -euo pipefail
cd "$(dirname "$0")/.."

# Pinned CLI — keep in sync with scripts/__tests__/setup-graphify-pin.guard.test.ts
GRAPHIFYY_VERSION="0.9.112"
GRAPHIFYY_SPEC="graphifyy[leiden]==${GRAPHIFYY_VERSION}"

check=0 cli_only=0
for a in "$@"; do
  case "$a" in
    --check) check=1 ;;
    --cli-only) cli_only=1 ;;
    *) echo "usage: $0 [--cli-only] [--check]" >&2; exit 2 ;;
  esac
done
# uv / pipx / pip --user install into ~/.local/bin, which a non-login shell may not have on PATH.
export PATH="$HOME/.local/bin:$PATH"

version() { graphify --version 2>/dev/null | awk '/^graphify [0-9]/{print $2; exit}'; }

register_merge_driver() {
  local graphify_bin py
  graphify_bin="$(command -v graphify)"
  py="$(sed -n '1s/^#!//p' "$graphify_bin")"
  case "$py" in
    *[!a-zA-Z0-9/_.-]*)
      echo "graphify shebang is not a safe Python path: $py" >&2
      return 1
      ;;
  esac
  [ -n "$py" ] || { echo "could not read Python path from graphify shebang" >&2; return 1; }
  git config merge.graphify.name "graphify graph.json union merge"
  git config merge.graphify.driver "\"$py\" -m graphify merge-driver %O %A %B"
}

if [ "$check" = 1 ]; then
  missing=()
  if ! command -v graphify >/dev/null 2>&1; then
    missing+=("graphify CLI is not installed")
  else
    cur=$(version)
    if [ -z "$cur" ]; then
      missing+=("graphify CLI version could not be parsed")
    elif [ "$cur" != "$GRAPHIFYY_VERSION" ]; then
      missing+=("graphify $cur does not match pinned ${GRAPHIFYY_VERSION}")
    fi
  fi
  if [ "$cli_only" = 0 ]; then
    git config --get merge.graphify.driver >/dev/null 2>&1 || missing+=("graph.json merge driver is not registered")
  fi
  [ ${#missing[@]} -eq 0 ] && exit 0
  fix="scripts/setup-graphify.sh"; [ "$cli_only" = 1 ] && fix="$fix --cli-only"
  echo "graphify setup incomplete:"
  printf ' - %s\n' "${missing[@]}"
  echo "Fix: $fix (idempotent, no LLM tokens). If it fails or needs something you cannot do, tell the user what failed and the exact command to run, then continue without graphify."
  exit 1
fi

# Install pinned CLI; [leiden] = Leiden clustering (otherwise a silent Louvain fallback).
if command -v uv >/dev/null 2>&1; then
  uv tool install --force "$GRAPHIFYY_SPEC" >/dev/null
elif command -v pipx >/dev/null 2>&1; then
  pipx install --force "$GRAPHIFYY_SPEC" >/dev/null
elif command -v python3 >/dev/null 2>&1; then
  python3 -m pip install --user -q "$GRAPHIFYY_SPEC"
else
  echo "need uv (https://docs.astral.sh/uv/), pipx or python3+pip to install graphify" >&2; exit 1
fi
command -v graphify >/dev/null 2>&1 || { echo "graphify installed but not on PATH: add ~/.local/bin to PATH" >&2; exit 1; }
echo "graphify $(version)"
[ "$cli_only" = 1 ] && exit 0

# Register the union merge driver for graph.json (local git config only).
# See https://docs.graphify.com/cookbooks/shared-team-graph
register_merge_driver
echo "merge.graphify.driver registered"

echo "graphify ready (CLI + merge driver). Hooks/pre-commit/graph build are intentionally not installed by this script."
