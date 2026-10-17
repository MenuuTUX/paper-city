import { copyFile, mkdir, readdir } from 'node:fs/promises';

// Serve the module worker from the app's origin. Bundler-generated worker URLs
// differ between development and production and can otherwise fail at runtime.
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await copyFile(
  new URL('../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url),
  new URL('../public/maplibre-worker.mjs', import.meta.url),
);

// OCR runs entirely in the browser. Serve its worker and WASM engine locally;
// only English traineddata is a tracked public asset, downloaded once at setup.
await mkdir(new URL('../public/ocr/', import.meta.url), { recursive: true });
await copyFile(new URL('../node_modules/tesseract.js/dist/worker.min.js', import.meta.url), new URL('../public/ocr/worker.min.js', import.meta.url));
for (const file of await readdir(new URL('../node_modules/tesseract.js-core/', import.meta.url))) {
  if (file.includes('lstm') && (file.endsWith('.wasm') || file.endsWith('.wasm.js'))) {
    await copyFile(new URL(`../node_modules/tesseract.js-core/${file}`, import.meta.url), new URL(`../public/ocr/${file}`, import.meta.url));
  }
}
