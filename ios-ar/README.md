# MatHjelp AR for iOS

This is a native iOS app, separate from the React/TypeScript website in the
repository root. Open `MatHjelpAR.xcodeproj` on a Mac with Xcode to build it.
The web app's Vite build does not include this directory.

## What is implemented

- An ARKit `ARWorldTrackingConfiguration` session with horizontal and vertical
  plane detection, live tracking status, and camera-error reporting.
- A placement flow that raycasts against detected plane geometry first and
  uses a provisional estimated horizontal plane only as a user-confirmed
  fallback.
- Explicit named `ARAnchor` instances. RealityKit hologram entities are attached
  to those anchors and are not positioned using screen-space boxes.
- A tappable RealityKit label, an independent nutrition card, and controls to
  remove the current anchor or start a clean scan.
- Microsoft ONNX Runtime for iOS loads the original ONNX model directly.
- The model input is resized camera imagery as RGB `uint8` in dynamic NHWC
  shape `[1, height, width, 3]`, with the longest side limited to 320 pixels.
  The runtime validates `detection_boxes`, `detection_classes`,
  `detection_scores`, and `num_detections`; COCO class 52 is banana and 53 is
  apple. Results below 0.45 confidence, malformed boxes, and duplicate
  overlapping boxes are rejected.
- A SwiftUI label follows each current model bounding box in the 2D camera
  view. It is explicitly marked **2D-SPORING** and is not a world anchor.
- To create real spatial AR for a selected detection, use **Forankre** and
  manually tap a nearby raycastable surface. The box alone has no depth and is
  never used as a 3D position.

## Recognition model and Core ML conversion

The model is the quantized SSD-MobileNetV1 model from ONNX Model Zoo, pinned to
commit `4c46cd00fbdb7cd30b6c1c17ab54f2e1f4f7b177`. It is stored as an app-only
resource in `Resources/ssd-mobilenet-v1-12-int8.onnx`; the original MIT license
is included alongside it. Its SHA-256 is
`2b79e6a7fb1ec6a33f332b9b10d82d9de4b7b49dcd26b5946921bb356895c954`.

ONNX checker validation confirmed its single dynamic NHWC RGB `uint8` input,
named `inputs`, and four float outputs: `detection_boxes` (normalized
`[yMin, xMin, yMax, xMax]`), `detection_classes`, `detection_scores`, and
`num_detections`. The graph contains quantized `QLinearConv` nodes and `Loop`
based post-processing/NMS. Therefore it is not a Core ML model that Vision can
load as `VNRecognizedObjectObservation`. No ONNX-to-Core-ML conversion has been
produced or validated. This app instead uses ONNX Runtime's native iOS package
to preserve the existing graph and its output format.

The **Testanker** control remains an explicitly labelled AR placement test,
not AI recognition. The separate screen-space detection label can track an
image box but has no depth. A real AR anchor is only created after a user tap
produces an ARKit raycast hit. One anchor per recognized food category is
allowed in this initial version.

Nutrition figures are approximate example values. Replace the catalog with a
trusted nutrition source before using the values as authoritative data.

## Requirements and testing

- A Mac running a supported version of Xcode is required to open, build, sign,
  and install the native iOS app.
- An ARKit-capable physical iPhone and camera permission are required to test
  world tracking and spatial anchors. The iOS Simulator is not a substitute for
  this device test.
- On Windows, the Swift source and Xcode project can be edited, but this
  repository environment cannot build or run Xcode/iOS targets. Xcode must
  resolve the ONNX Runtime Swift package on the first build.

On a Mac, open `MatHjelpAR.xcodeproj`, select an iPhone destination, set a
development team if signing is required, and run the app. Start AR, move the
phone to establish tracking, select **Plasser testanker**, then tap a detected
surface. Tap the world-anchored label to open its test card. Close the card and
verify that the label remains anchored; use **Fjern anker** to remove it.

## Structure

- `App/` — SwiftUI app entry and main screen.
- `AR/` — ARKit session, raycast placement, RealityKit anchors and labels.
- `Recognition/` — ONNX Runtime session, camera preprocessing, and validated
  model outputs.
- `Nutrition/` — food and nutrition data model/catalog.
- `UI/` — tracking and nutrition panels.
- `Resources/` — the original quantized ONNX detector and its license.
- `Tests/` — reserved for native tests when an Xcode test target is added.
