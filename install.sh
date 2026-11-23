#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1 || ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 19) ? 0 : 1)'; then
  echo "Install Node.js 22.19 or newer with npm." >&2
  exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "Install Git before continuing." >&2
  exit 1
fi

if [[ -n ${BASH_SOURCE[0]:-} ]]; then
  entry_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
  if [[ -f "$entry_dir/install.mjs" ]]; then
    exec node "$entry_dir/install.mjs" "$@"
  fi
fi

base=${BB_SHARE_BASE_URL:-https://github.com/smart-lty/bb-custom/releases/latest/download}
case "$base" in
  https://*) ;;
  *) echo "BB_SHARE_BASE_URL must be an HTTPS URL." >&2; exit 1 ;;
esac
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
curl --proto '=https' --proto-redir '=https' -fsSL "${base%/}/install.mjs" -o "$stage/install.mjs"
if [[ -t 1 ]] && ( : </dev/tty ) 2>/dev/null; then
  node "$stage/install.mjs" --source "$base" "$@" </dev/tty
else
  node "$stage/install.mjs" --source "$base" "$@"
fi
