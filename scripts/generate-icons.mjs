// One-time PWA icon generation. Run from the repo root:
//   npm install --no-save sharp && node scripts/generate-icons.mjs
// The generated PNGs in client/public/icons are committed, so this only needs
// to run again if the icon design changes.
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'client', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// Graduation cap drawn from plain shapes - no fonts, no emoji, renders anywhere.
const cap = `
  <rect x="186" y="252" width="140" height="70" rx="16" fill="#ffffff"/>
  <polygon points="256,145 446,225 256,305 66,225" fill="#ffffff"/>
  <line x1="446" y1="228" x2="446" y2="316" stroke="#fbbf24" stroke-width="14" stroke-linecap="round"/>
  <circle cx="446" cy="332" r="17" fill="#fbbf24"/>
`;

const svg = (content, radius) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#667eea"/>
      <stop offset="1" stop-color="#764ba2"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  ${content}
</svg>`;

// Maskable icons keep the art inside the 80% safe zone on a full-bleed ground.
const maskableSvg = svg(
  `<g transform="translate(256 256) scale(0.72) translate(-256 -256)">${cap}</g>`,
  0
);
const standardSvg = svg(cap, 96);

const render = (source, size, file) =>
  sharp(Buffer.from(source)).resize(size, size).png().toFile(path.join(outDir, file));

await Promise.all([
  render(standardSvg, 192, 'icon-192.png'),
  render(standardSvg, 512, 'icon-512.png'),
  render(maskableSvg, 512, 'maskable-512.png'),
  render(standardSvg, 180, 'apple-touch-icon.png'),
]);

console.log('Icons written to client/public/icons');
