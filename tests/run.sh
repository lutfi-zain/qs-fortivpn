#!/usr/bin/env bash
set -euo pipefail

bash -n scripts/omarchy-fortivpn-helper scripts/omarchy-fortivpn scripts/install-passwordless-helper.sh tests/controller-status.sh tests/cli-status.sh
node tests/model-status.test.js
bash tests/controller-status.sh
bash tests/cli-status.sh
