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

The camera requests the environment-facing lens when available and allows the browser to choose a camera if that preference is unavailable. Camera access begins only after the user presses **Start kamera**. Stopping the camera stops all tracks and recognition.

## Recognition model

The app uses the quantized SSD-MobileNetV1 model from the [ONNX Model Zoo](https://github.com/onnx/models/tree/4c46cd00fbdb7cd30b6c1c17ab54f2e1f4f7b177/validated/vision/object_detection_segmentation/ssd-mobilenetv1), pinned to repository commit `4c46cd00fbdb7cd30b6c1c17ab54f2e1f4f7b177`. The model README declares the model MIT-licensed. Its SHA-256 is `2b79e6a7fb1ec6a33f332b9b10d82d9de4b7b49dcd26b5946921bb356895c954`.

The object detector supports all 80 categories in the COCO label map, including people, common objects, containers, and foods such as banana, apple, orange, broccoli, carrot, sandwich, pizza, and cake. The app maps these class IDs to Norwegian labels and displays the highest-confidence detection. This is generic object classification: it does not identify product brands or specific packaged-food types. Detections below the configurable confidence threshold are shown as **Ukjent matvare**. Two consecutive predictions are required to stabilize the text, and bounding-box coordinates are smoothed between frames. The displayed score is the model's detection score, not a calibrated probability or a guarantee of correctness.

The ONNX Model Zoo card documents a variable-size NHWC RGB `uint8` input and four outputs: boxes, class IDs, confidence scores, and detection count. The app scales each frame so its longest side is at most 320 pixels and preserves its aspect ratio. ONNX Runtime Web documents WASM support for iOS Safari; the app uses its single-threaded WASM backend and local model file at `public/models/ssd-mobilenet-v1-12-int8.onnx`.

When the detector reports anything other than an apple or banana, a separate Tesseract.js 7 OCR worker reads a camera frame (up to 960 pixels on its longest edge) every 3.5 seconds. It can display readable package text and recognizes the `Monster Energy` brand only when OCR reads the word `Monster` with at least 50% word confidence. OCR runs in the browser; frames are not uploaded. Tesseract.js and its English trained data are Apache-2.0 and MIT licensed, respectively. The worker, OCR core, and English trained data are loaded from jsDelivr on first use, so text recognition requires an internet connection. OCR confidence is a recognition score, not a calibrated probability. The English OCR model is intended for brand/package text, not reliable Norwegian transcription. This has not been validated against a physical Monster can or on iPhone Safari.

The camera overlay separates searching, analyzing, recognized, and unknown states. A subtle scan line marks searching or evaluation, and the animated frame, restrained particles, and glass-like `ARFoodLabel` follow available model or OCR coordinates. The label displays the relevant object-detection or OCR score. Coordinate mapping accounts for the preview's `object-fit: cover` crop and horizontally mirrored video; two consecutive missed detections clear a stale label. Before a detection is available, a centered viewfinder acts as a guide rather than claiming to track an object. These are HTML overlays; they are not spatially anchored AR and do not track depth or real-world pose.

Recognition results use canonical food labels and can provide a future nutrition lookup query in `src/types/recognition.ts`. Nutrition API integration is not implemented. When added, it should match the detected food against Matvaretabellen's actual food records and display verified nutrient values per 100 g; image recognition alone does not measure portion weight.

To change the object detector confidence threshold, edit `MIN_RECOGNITION_CONFIDENCE` in `src/workers/recognition.worker.ts`. Object detection runs about once per second after its model loads; OCR runs less often while the detected object is not an apple or banana.

## Test on iPhone

The production build can be validated with `npm run build`. To test actual predictions, deploy the app over HTTPS, open it in Safari on a physical iPhone, start the camera, and point it at one banana or apple at a time with the item centered and well lit. For OCR, show a Monster can close enough for the brand text to be sharp, well lit, and facing the camera; the first OCR use also needs an internet connection to load its engine and English data. Verify that it reads the visible package text and displays `Monster Energy` only when it reads `Monster`. Browser and desktop builds do not substitute for a physical iPhone Safari test.

## Deploy to Netlify

1. Push this repository to GitHub.
2. In Netlify, choose **Add new site → Import an existing project**, connect GitHub, and select this repository.
3. Use the build command `npm run build` and publish directory `dist`. These values are also specified in `netlify.toml`.
4. Deploy, then open the HTTPS URL from an iPhone in Safari.
5. Press **Start kamera** and allow camera access when Safari prompts. If permission was previously denied, enable camera access for the site in iOS Settings/Safari and reload.

Camera access on iPhone requires HTTPS (Netlify provides HTTPS). Test the deployed site on the physical iPhone; a desktop preview or simulator does not verify iPhone camera permissions, rear-camera selection, or model performance on that device.
