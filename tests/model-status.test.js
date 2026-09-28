const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "..", "Model.js"), "utf8")
  .replace(/^\.pragma library\n/, "");
const moduleForTest = { exports: {} };
new Function("module", source)(moduleForTest);
const model = moduleForTest.exports;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ready = [
  "interfaceVersion=1",
  "controllerVersion=1.2.0",
  "code=ready",
  "message=FortiVPN is ready.",
  "dependencyPath=/usr/bin/openfortivpn",
  "configState=ready",
  "trustedCertificate=false",
  "unitState=active"
].join("\n");

assert(model.statusCommand().join(" ") === "sudo -n /usr/local/libexec/omarchy-fortivpn-helper status", "status must use the privileged controller");
assert(model.parseStatus(ready).code === "ready", "valid controller status must parse");
assert(model.parseStatus(ready.replace("interfaceVersion=1", "interfaceVersion=2")) === null, "incompatible interface must be rejected");
assert(model.parseStatus(ready.replace("configState=ready", "configState=unknown")) === null, "unknown config state must be rejected");
