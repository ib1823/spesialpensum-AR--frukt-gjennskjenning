# MatHjelp WebAR

MatHjelp WebAR is a mobile-first React, TypeScript, and Vite application. Phase 1 provides a live camera preview; it does not run AI recognition or process frames continuously.

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

`useCamera` owns the MediaDevices stream lifecycle and returns a `videoRef` pointing to the same `<video>` element used for the preview. Future frame capture and inference code should consume that element rather than opening another camera stream. Frame capture, preprocessing, model inference, detection results, and AR overlays are intentionally not implemented yet.

The camera requests the environment-facing lens when available and allows the browser to choose a camera if that preference is unavailable. Camera access begins only after the user presses **Start kamera**. Stopping the camera stops all tracks, and the hook also cleans up on unmount.

## Deploy to Netlify

1. Push this repository to GitHub.
2. In Netlify, choose **Add new site → Import an existing project**, connect GitHub, and select this repository.
3. Use the build command `npm run build` and publish directory `dist`. These values are also specified in `netlify.toml`.
4. Deploy, then open the HTTPS URL from an iPhone in Safari.
5. Press **Start kamera** and allow camera access when Safari prompts. If permission was previously denied, enable camera access for the site in iOS Settings/Safari and reload.

Camera access on iPhone requires HTTPS (Netlify provides HTTPS). Test the deployed site on the physical iPhone; a desktop preview or simulator does not verify iPhone camera permissions or rear-camera selection.
