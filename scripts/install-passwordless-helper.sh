#!/usr/bin/env bash
# Installs the root-owned helper and a sudo rule limited to that helper.
set -euo pipefail

HELPER=/usr/local/libexec/omarchy-fortivpn-helper
CLI=/usr/local/bin/omarchy-fortivpn
SUDOERS=/etc/sudoers.d/omarchy-fortivpn

if [[ ${1:-} == --install-root ]]; then
  [[ $# == 2 && $2 =~ ^[a-z_][a-z0-9_-]*\$?$ ]] || { printf '%s\n' "Invalid user name." >&2; exit 1; }
  script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
  sudoers_tmp=$(mktemp "$SUDOERS.tmp.XXXXXX")
  trap 'rm -f "$sudoers_tmp"' EXIT
  printf '%s ALL=(root) NOPASSWD: %s reset, %s stop, %s start, %s start *\n' \
    "$2" "$HELPER" "$HELPER" "$HELPER" "$HELPER" > "$sudoers_tmp"
  chown root:root "$sudoers_tmp"
  chmod 440 "$sudoers_tmp"
  visudo -cf "$sudoers_tmp"
  mv "$sudoers_tmp" "$SUDOERS"
  install -D -o root -g root -m 755 "$script_dir/omarchy-fortivpn-helper" "$HELPER"
  install -D -o root -g root -m 755 "$script_dir/omarchy-fortivpn" "$CLI"
  printf '%s\n' "Installed passwordless FortiVPN helper for $2."
  exit 0
fi

[[ $EUID != 0 ]] || { printf '%s\n' "Run this installer as your normal desktop user." >&2; exit 1; }
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
exec pkexec /usr/bin/bash "$script_dir/install-passwordless-helper.sh" --install-root "$(id -un)"
