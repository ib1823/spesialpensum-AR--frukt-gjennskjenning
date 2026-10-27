# MatHjelp

MatHjelp is a mobile-responsive React, TypeScript, and Vite website.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Develop

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

The production site is generated in `dist/`.

## Hosting

The project is a standard Vite site and can be deployed to Vercel using the
`npm run build` build command and `dist` output directory. Vercel's framework
detection can configure these defaults automatically. There is no Vercel
configuration file in this repository. `netlify.toml` is retained for existing
Netlify deployments.

## Project status

The previous camera-based recognition prototype has been removed. This site
does not currently request camera access or provide AI food recognition,
nutrition overlays, or augmented reality. Future spatial AR work will require a
separate implementation; it is not simulated in this web app.
