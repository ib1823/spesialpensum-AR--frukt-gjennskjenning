# MatHjelp WebAR

MatHjelp WebAR is a mobile-first React, TypeScript, and Vite application. It provides a live camera preview with local, on-device food detection while the camera is running.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Develop

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Browser camera access requires a secure context: `localhost` is permitted during development, while phones need HTTPS.

## Build

```sh
npm run build
npm run preview
```

The production site is generated in `dist/`.

## Camera architecture

`useCamera` owns the MediaDevices stream lifecycle and returns a `videoRef` pointing to the same `<video>` element used for the preview. `useFoodRecognition` consumes that video element without opening another camera stream. It preprocesses one frame at a time and transfers only the downsized pixels to a dedicated Vite-built Web Worker, where ONNX Runtime Web runs on WASM. The worker releases the inference session when the camera stops. AI errors are displayed separately and do not stop the camera.

The camera requests the environment-facing lens when available and allows the browser to choose a camera if that preference is unavailable. Camera access begins only after the user presses **Start kamera**; while running, the preview expands to a full-viewport camera screen with controls inset for mobile safe areas. Stopping the camera stops all tracks and recognition and returns to the normal page layout.

## Recognition model

The app uses the quantized SSD-MobileNetV1 model from the [ONNX Model Zoo](https://github.com/onnx/models/tree/4c46cd00fbdb7cd30b6c1c17ab54f2e1f4f7b177/validated/vision/object_detection_segmentation/ssd-mobilenetv1), pinned to repository commit `4c46cd00fbdb7cd30b6c1c17ab54f2e1f4f7b177`. The model README declares the model MIT-licensed. Its SHA-256 is `2b79e6a7fb1ec6a33f332b9b10d82d9de4b7b49dcd26b5946921bb356895c954`.

The object detector supports all 80 categories in the COCO label map, including people, common objects, containers, and foods such as banana, apple, orange, broccoli, carrot, sandwich, pizza, and cake. It returns the current qualifying detections in confidence order. The user selects a visible detection by tapping its box; only that selected item drives the AR label and, for food categories with a database mapping, the nutrition lookup until the user chooses another item. Selection follows the closest matching detection by class and box overlap/position, and does not switch to unrelated classes. This is generic object classification: it does not identify product brands or specific packaged-food types. Detections below the configurable confidence threshold are not selectable. Two consecutive predictions are required to stabilize the text; the bounding box is then smoothed for display between detector results. The displayed score is the model's detection score, not a calibrated probability or a guarantee of correctness.

The ONNX Model Zoo card documents a variable-size NHWC RGB `uint8` input and four outputs: boxes, class IDs, confidence scores, and detection count. The app scales each frame so its longest side is at most 320 pixels and preserves its aspect ratio. ONNX Runtime Web documents WASM support for iOS Safari; the app uses its single-threaded WASM backend and local model file at `public/models/ssd-mobilenet-v1-12-int8.onnx`.

When the detector reports anything other than an apple or banana, a separate Tesseract.js 7 OCR worker reads a camera frame (up to 960 pixels on its longest edge) every 3.5 seconds. It can display readable package text and recognizes the `Monster Energy` brand only when OCR reads the word `Monster` with at least 50% word confidence. OCR runs in the browser; frames are not uploaded. Tesseract.js and its English trained data are Apache-2.0 and MIT licensed, respectively. The worker, OCR core, and English trained data are loaded from jsDelivr on first use, so text recognition requires an internet connection. OCR confidence is a recognition score, not a calibrated probability. The English OCR model is intended for brand/package text, not reliable Norwegian transcription. This has not been validated against a physical Monster can or on iPhone Safari.

The camera overlay first marks selectable object detections and asks the user to tap the item to scan. After selection, a subtle scan line, animated frame, restrained particles, and glass-like `ARFoodLabel` follow that target's model bounding box; **Velg en annen vare** unlocks it. Apple and banana labels show sample nutrition values per 100 g, explicitly marked as estimates rather than values measured for the detected item; the Matvaretabellen panel remains the source for selectable database records. For detected food categories with database mappings, that panel is anchored beside the selected object instead of staying fixed on the screen. Other COCO objects, such as a TV, can be selected to display their detected name but have no nutrition lookup. Position updates are interpolated with animation frames, and placement switches around the object to keep the overlay inside the preview. Coordinate mapping accounts for the preview's `object-fit: cover` crop and horizontally mirrored video. When the selected item is no longer detected, its overlay fades and it is not replaced by another item automatically. These are HTML overlays with 2D camera-image tracking; they are not spatially anchored AR and do not track depth or real-world pose. Pinning an item to its real location while moving the camera is not possible with bounding boxes alone and is not implemented.

When the detector identifies a COCO food category or OCR reads the Monster brand, the app fetches the official Norwegian `foods.json` and `nutrients.json` datasets from Matvaretabellen. It shows the selected food record's actual energy, protein, carbohydrates, fat, and fiber values per 100 g, together with the record ID and source link. Banana, apple, and orange use a general raw-food record when the exact generic record is available. Other categories show matching records in a selector; the user must select the actual variant before values are displayed. This is important for foods such as pizza and energy drinks, whose nutrients vary substantially. A Monster text match is not itself a Matvaretabellen product match; for that label the user must choose the matching regular or sugar-free energy-drink record. The database is fetched lazily from Matvaretabellen and cached by the browser where supported. Recognition does not determine portion size, brand formulation, or whether a food is raw/cooked, and the displayed values must not be interpreted as the specific item's exact nutrition unless its record is selected.

To change the object detector confidence threshold, edit `MIN_RECOGNITION_CONFIDENCE` in `src/workers/recognition.worker.ts`. The detector processes one frame at a time, waiting 400 ms between completed inferences; OCR runs less often while the detected object is not an apple or banana.

## Spatial AR on iPhone

The current web build cannot provide the requested world tracking in iPhone Safari. Safari on iOS does not support the WebXR Device API, the browser API for immersive AR sessions, hit testing, and WebXR anchors ([Can I use: WebXR](https://caniuse.com/webxr), [WebKit implementation issue](https://bugs.webkit.org/show_bug.cgi?id=208988)). `getUserMedia` provides camera video, not camera pose, depth, world tracking, or spatial anchors. The existing React labels therefore remain 2D overlays that follow image-space detections; storing a detection box would not make one spatial.

The smallest practical change is an iOS app shell (for example, Capacitor) around this React app plus a custom Swift ARKit integration. Keep the existing web scanner available, and add a native AR experience in which:

1. ARKit owns the camera session and renders the live camera view. The existing `getUserMedia` stream cannot be treated as an ARKit session or source of world coordinates.
2. The existing apple/banana model receives frames from that AR session through a native-to-web bridge (or a separately validated native inference adapter). It returns the recognized class and image-space box only; that box is not saved as placement.
3. After the user selects a detection, the native side maps a point beside its box into the AR view, performs an ARKit raycast, and creates a named `ARAnchor` at the resulting world transform. A RealityKit entity attached to that anchor displays the tappable hologram. The JS bridge sends recognition and nutrition data to the native view and reports anchor/tap events back to React.
4. The nutrition panel can be shown or hidden independently of the anchor. Surface `ARSession` tracking state in the UI, retain the anchor through temporary interruptions, and let ARKit relocalize when possible. If anchors must survive ending/restarting the AR session, save and restore an `ARWorldMap` and handle relocalization explicitly; retaining an anchor object in memory alone does not provide this.

ARKit's `ARWorldTrackingConfiguration` provides six-degree-of-freedom tracking and ray casting, and `ARAnchor` stores a transform in the AR session's world coordinate space ([world tracking](https://developer.apple.com/documentation/arkit/arworldtrackingconfiguration), [anchors](https://developer.apple.com/documentation/arkit/aranchor)). This requires a native iOS target and on-device testing; it cannot be enabled by a Vercel deployment or by adding a CSS/Three.js overlay to the current Safari camera preview. No native AR implementation is included in this repository.

## Test on iPhone

The production build can be validated with `npm run build`. To test actual predictions, deploy the app over HTTPS, open it in Safari on a physical iPhone, start the camera, and point it at one banana or apple at a time with the item centered and well lit. For OCR, show a Monster can close enough for the brand text to be sharp, well lit, and facing the camera; the first OCR use also needs an internet connection to load its engine and English data. Verify that it reads the visible package text and displays `Monster Energy` only when it reads `Monster`. Browser and desktop builds do not substitute for a physical iPhone Safari test.

## Deploy to Netlify

1. Push this repository to GitHub.
2. In Netlify, choose **Add new site → Import an existing project**, connect GitHub, and select this repository.
3. Use the build command `npm run build` and publish directory `dist`. These values are also specified in `netlify.toml`.
4. Deploy, then open the HTTPS URL from an iPhone in Safari.
5. Press **Start kamera** and allow camera access when Safari prompts. If permission was previously denied, enable camera access for the site in iOS Settings/Safari and reload.

Camera access on iPhone requires HTTPS (Netlify provides HTTPS). Test the deployed site on the physical iPhone; a desktop preview or simulator does not verify iPhone camera permissions, rear-camera selection, or model performance on that device.
