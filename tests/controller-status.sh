#!/usr/bin/env bash
set -euo pipefail

output=$("$(dirname -- "$0")/../scripts/omarchy-fortivpn-helper" status)

field() {
  local wanted=$1 key value
  while IFS='=' read -r key value; do
    [[ $key == "$wanted" ]] && { printf '%s' "$value"; return; }
  done <<< "$output"
  return 1
}

[[ $(field interfaceVersion) == 1 ]]
[[ $(field controllerVersion) == 1.2.0 ]]
[[ $(field code) =~ ^(ready|not_configured|dependency_missing|config_invalid)$ ]]
[[ $(field configState) =~ ^(missing|incomplete|ready|invalid)$ ]]
[[ $(field trustedCertificate) =~ ^(true|false)$ ]]
[[ $(field unitState) =~ ^(active|activating|deactivating|failed|inactive)$ ]]
[[ -n $(field message) ]]
