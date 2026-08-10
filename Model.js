.pragma library

var CONF_PATH = "/etc/openfortivpn/omarchy.conf"
var UNIT_NAME = "omarchy-fortivpn"

// Strips anything that could break out of a single "key = value" config
// line (or a stdin read) so a stray newline in a form field can never
// smuggle in a second directive.
function sanitizeField(value) {
  return String(value == null ? "" : value).replace(/[\r\n]/g, "").trim()
}

// Secrets may legitimately begin or end with whitespace. Newlines are still
// forbidden because config writes use one stdin line per value.
function sanitizeSecret(value) {
  return String(value == null ? "" : value).replace(/[\r\n]/g, "")
}

// Builds the root-side shell snippet that atomically rewrites just the
// given keys in the openfortivpn config, leaving every other key alone.
// Values arrive over stdin (one per key, in order) rather than argv, so
// nothing sensitive ever shows up in `ps`. An empty value clears the key.
function configWriteScript(keys) {
  var reads = []
  var prints = []
  for (var i = 0; i < keys.length; i++) {
    reads.push("IFS= read -r V" + i + " || V" + i + "=''")
    prints.push('  if [ -n "$V' + i + '" ]; then printf \'' + keys[i] + ' = %s\\n\' "$V' + i + '"; fi')
  }
  var pattern = keys.join("|").replace(/[.[\]*^$\\]/g, "\\$&")
  return [
    "set -e",
    "umask 177",
    'CONF="' + CONF_PATH + '"',
    'touch "$CONF"',
    'chmod 600 "$CONF"',
    reads.join("\n"),
    'TMP=$(mktemp "$CONF.XXXXXX")',
    'grep -vE "^(' + pattern + ')[[:space:]]*=" "$CONF" > "$TMP" || true',
    "{",
    prints.join("\n"),
    '} >> "$TMP"',
    'chmod 600 "$TMP"',
    'mv "$TMP" "$CONF"'
  ].join("\n")
}

// Command array for a Quickshell Process: pkexec running the snippet via
// bash -c. The Process must have stdinEnabled true and write one line per
// key (in the same order as `keys`) right after onStarted.
function configWriteCommand(keys) {
  return ["pkexec", "bash", "-c", configWriteScript(keys)]
}

function isActiveCommand() {
  return ["systemctl", "is-active", UNIT_NAME + ".service"]
}

function journalCommand(lines) {
  return ["journalctl", "-u", UNIT_NAME + ".service", "-n", String(lines || 40), "--no-pager", "--output=cat"]
}

function stopCommand() {
  return ["systemctl", "stop", UNIT_NAME + ".service"]
}

// A unit that exited non-zero (bad OTP, untrusted cert, ...) lingers in
// "failed" state and blocks reusing the same unit name, so this is run
// before every connect attempt. Harmless no-op when nothing is failed.
function resetFailedCommand() {
  return ["systemctl", "reset-failed", UNIT_NAME + ".service"]
}

// No --collect: a failed unit needs to stay observable as "failed" long
// enough for the next is-active poll to see it and pull the journal (that's
// how the untrusted-cert digest gets surfaced). resetFailedCommand() clears
// it explicitly before the next connect instead.
function startCommand(otp) {
  var args = ["systemd-run", "--system", "--unit=" + UNIT_NAME,
    "--property=Type=notify", "--description=Omarchy FortiVPN",
    "/usr/bin/openfortivpn", "-c", CONF_PATH]
  var code = sanitizeField(otp)
  if (code !== "") args.push("--otp=" + code)
  return args
}

// Normalizes `systemctl is-active` output into a small state enum the
// Service/Panel can switch on directly.
function normalizeActiveState(raw) {
  var text = sanitizeField(raw).toLowerCase()
  if (text === "active") return "connected"
  if (text === "activating" || text === "reloading") return "connecting"
  if (text === "deactivating") return "disconnecting"
  if (text === "failed") return "failed"
  return "disconnected"
}

// openfortivpn's own hint text for an unpinned gateway cert always includes
// the literal flag it wants you to rerun with, followed by the sha256
// digest — match on that shape rather than the surrounding wording, which
// has changed across versions.
function parseCertDigest(text) {
  var body = String(text || "")
  var m = body.match(/--trusted-cert[=\s]+([0-9a-fA-F]{40,64})/)
  if (m) return m[1].toLowerCase()
  m = body.match(/certificate[^\n]{0,40}sha256[^\n]{0,20}([0-9a-fA-F]{64})/i)
  if (m) return m[1].toLowerCase()
  return ""
}

// Best-effort one-line summary of the most recent journal entry for the
// unit, for surfacing under the status line when a connect attempt fails.
function parseFailureSummary(text) {
  var lines = String(text || "").split(/\r?\n/).map(function(l) { return l.trim() }).filter(function(l) { return l !== "" })
  if (lines.length === 0) return ""
  var errorLine = ""
  for (var i = lines.length - 1; i >= 0; i--) {
    if (/error|fail|denied|invalid|expired|refused/i.test(lines[i])) { errorLine = lines[i]; break }
  }
  var line = errorLine !== "" ? errorLine : lines[lines.length - 1]
  return line.length > 160 ? line.substring(0, 157) + "…" : line
}

if (typeof module !== "undefined") {
  module.exports = {
    CONF_PATH: CONF_PATH,
    UNIT_NAME: UNIT_NAME,
    sanitizeField: sanitizeField,
    sanitizeSecret: sanitizeSecret,
    configWriteScript: configWriteScript,
    configWriteCommand: configWriteCommand,
    isActiveCommand: isActiveCommand,
    journalCommand: journalCommand,
    stopCommand: stopCommand,
    resetFailedCommand: resetFailedCommand,
    startCommand: startCommand,
    normalizeActiveState: normalizeActiveState,
    parseCertDigest: parseCertDigest,
    parseFailureSummary: parseFailureSummary
  }
}
