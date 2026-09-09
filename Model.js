.pragma library

var UNIT_NAME = "omarchy-fortivpn"
var HELPER_PATH = "/usr/local/libexec/omarchy-fortivpn-helper"

// Strips anything that could break out of a single "key = value" config
// line (or a stdin read) so a stray newline in a form field can never
// smuggle in a second directive.
function sanitizeField(value) {
  return String(value == null ? "" : value).replace(/[\r\n]/g, "").trim()
}

// Normalizes one or more gateway hosts (comma/space/semicolon-delimited),
// stripping protocol prefixes and extracting optional inline port/realm.
function parseGateways(rawHost, defaultPort) {
  var raw = sanitizeField(rawHost)
  var items = raw.split(/[,;\s]+/)
  var cleaned = []
  var detectedPort = defaultPort || "443"
  var detectedRealm = ""

  for (var i = 0; i < items.length; i++) {
    var item = items[i].trim()
    if (!item) continue
    if (item.startsWith("https://")) item = item.substring(8)
    if (item.startsWith("http://")) item = item.substring(7)
    if (item.indexOf("/") !== -1) {
      var slashParts = item.split("/")
      item = slashParts[0]
      if (!detectedRealm && slashParts[1]) detectedRealm = slashParts[1]
    }
    if (item.indexOf(":") !== -1) {
      var colParts = item.split(":")
      item = colParts[0]
      if (colParts[1]) detectedPort = colParts[1]
    }
    if (item && cleaned.indexOf(item) === -1) {
      cleaned.push(item)
    }
  }
  return {
    hosts: cleaned.join(", "),
    port: detectedPort,
    realm: detectedRealm
  }
}

// Secrets may legitimately begin or end with whitespace. Newlines are still
// forbidden because config writes use one stdin line per value.
function sanitizeSecret(value) {
  return String(value == null ? "" : value).replace(/[\r\n]/g, "")
}

// Configuration changes require polkit authentication. Values still travel
// over stdin so passwords never appear in the process list.
function configWriteCommand(keys) {
  return ["pkexec", HELPER_PATH, "write"].concat(keys)
}

function isActiveCommand() {
  return ["systemctl", "is-active", UNIT_NAME + ".service"]
}

function journalCommand(lines, sinceEpochMs) {
  var args = ["journalctl", "-u", UNIT_NAME + ".service", "-n", String(lines || 40), "--no-pager", "--output=cat"]
  if (sinceEpochMs > 0) args.push("--since=@" + (sinceEpochMs / 1000).toFixed(3))
  return args
}

function stopCommand() {
  return ["sudo", "-n", HELPER_PATH, "stop"]
}

// A unit that exited non-zero (bad OTP, untrusted cert, ...) lingers in
// "failed" state and blocks reusing the same unit name, so this is run
// before every connect attempt. Harmless no-op when nothing is failed.
function resetFailedCommand() {
  return ["sudo", "-n", HELPER_PATH, "reset"]
}

// No --collect: a failed unit needs to stay observable as "failed" long
// enough for the next is-active poll to see it and pull the journal (that's
// how the untrusted-cert digest gets surfaced). resetFailedCommand() clears
// it explicitly before the next connect instead.
function startCommand(otp) {
  var args = ["sudo", "-n", HELPER_PATH, "start"]
  var code = sanitizeField(otp)
  if (code !== "") args.push(code)
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
  var m = body.match(/--trusted-cert[=\s]+([0-9a-fA-F]{64})(?:[^0-9a-fA-F]|$)/)
  if (m) return m[1].toLowerCase()
  m = body.match(/certificate[^\n]{0,40}sha256[^\n]{0,20}([0-9a-fA-F]{64})(?:[^0-9a-fA-F]|$)/i)
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
    UNIT_NAME: UNIT_NAME,
    sanitizeField: sanitizeField,
    sanitizeSecret: sanitizeSecret,
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
