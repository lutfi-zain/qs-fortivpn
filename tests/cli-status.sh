#!/usr/bin/env bash
set -euo pipefail

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

cat > "$tmp/sudo" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[[ $1 == -n && $3 == status ]] || exit 99
cat "$FORTIVPN_STATUS_FIXTURE"
EOF
chmod 700 "$tmp/sudo"

ready_status='interfaceVersion=1
controllerVersion=1.2.0
code=ready
message=FortiVPN is ready.
dependencyPath=/usr/bin/openfortivpn
configState=ready
trustedCertificate=false
unitState=inactive'
not_configured_status=${ready_status/code=ready/code=not_configured}
fixture="$tmp/status"

printf '%s\n' "$ready_status" > "$fixture"
PATH="$tmp:$PATH" FORTIVPN_STATUS_FIXTURE="$fixture" bash scripts/omarchy-fortivpn status > "$tmp/output"
[[ $(<"$tmp/output") == "$ready_status" ]]

printf '%s\n' "$not_configured_status" > "$fixture"
if PATH="$tmp:$PATH" FORTIVPN_STATUS_FIXTURE="$fixture" bash scripts/omarchy-fortivpn start --push > "$tmp/preflight-output" 2>&1; then
  printf '%s\n' "start must reject an unconfigured controller" >&2
  exit 1
fi
[[ $(<"$tmp/preflight-output") == *"code=not_configured"* ]]
