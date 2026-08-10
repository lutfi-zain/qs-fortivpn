import QtQuick
import qs.Commons
import qs.Ui

// Simple glyph-based icon rather than a custom-drawn mark (Fortinet's logo
// has no simple silhouette worth reproducing at bar size, unlike Tailscale's
// dot grid) — reuses the same VPN glyph already used for Mullvad exit nodes
// elsewhere in the shell, so it's a known-good glyph in this font stack.
Item {
  id: root

  property real iconSize: Style.font.icon
  property color color: Color.foreground
  property color badgeColor: Color.urgent
  property bool connected: false
  property bool connecting: false
  property bool warning: false

  width: iconSize
  height: iconSize
  implicitWidth: iconSize
  implicitHeight: iconSize

  Text {
    anchors.centerIn: parent
    text: root.connected ? "󰌾" : "󰌿"
    color: root.color
    font.family: Style.font.family
    font.pixelSize: root.iconSize

    RotationAnimation on rotation {
      running: root.connecting
      from: 0
      to: 360
      duration: 1400
      loops: Animation.Infinite
    }
  }

  BorderSurface {
    visible: root.warning
    width: Math.max(7, parent.width * 0.42)
    height: width
    radius: width / 2
    color: root.badgeColor
    anchors.right: parent.right
    anchors.bottom: parent.bottom
    borderSpec: Border.flat(Color.popups.background, 1)

    Text {
      anchors.centerIn: parent
      text: "!"
      color: Color.background
      font.family: Style.font.family
      font.pixelSize: Math.max(6, parent.height * 0.72)
      font.bold: true
    }
  }
}
