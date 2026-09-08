// Generates every raster image ChessLA needs for SEO/social/PWA purposes —
// favicons at each required size, the apple-touch-icon, and the Open Graph
// social preview image — from hand-authored SVG markup (no AI image
// generation, no external image files). Runs automatically after `npm run
// build` (see package.json "postbuild") and can also be run directly with
// `node scripts/generate-seo-assets.mjs`.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const BADGE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="3" y="3" width="94" height="94" rx="24" fill="#0E1414"/>
  <path d="M36 76 L36 40 L66 40" fill="none" stroke="#3DB09B" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="66" cy="40" r="7.5" fill="#D6AB52"/>
</svg>`;

function boardMotif(originX, originY, squares, size) {
  let rects = "";
  for (let row = 0; row < squares; row++) {
    for (let col = 0; col < squares; col++) {
      const isDark = (row + col) % 2 === 1;
      if (!isDark) continue; // only draw the dark squares over the page background
      rects += `<rect x="${originX + col * size}" y="${originY + row * size}" width="${size}" height="${size}" fill="#181F1E" />\n`;
    }
  }
  return rects;
}

function ogSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0E1414"/>
  <g opacity="0.65">${boardMotif(700, 0, 9, 70)}</g>

  <rect x="96" y="205" width="220" height="220" rx="52" fill="#161B1B"/>
  <path d="M180 373 L180 268 L266 268" fill="none" stroke="#3DB09B" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="266" cy="268" r="17" fill="#D6AB52"/>

  <text x="364" y="300" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="700" fill="#F4F4F2" letter-spacing="1">CHESSLA</text>
  <text x="366" y="360" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="400" fill="#A3A8A3">Think. Play. Conquer.</text>
  <text x="366" y="415" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="400" fill="#6B716C">Real-time multiplayer chess</text>
</svg>`;
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  const badgeBuffer = Buffer.from(BADGE_SVG);
  const favSizes = [16, 32, 192, 512];
  for (const size of favSizes) {
    await sharp(badgeBuffer).resize(size, size).png().toFile(path.join(publicDir, `favicon-${size}.png`));
  }
  await sharp(badgeBuffer).resize(180, 180).png().toFile(path.join(publicDir, "apple-touch-icon.png"));

  await sharp(Buffer.from(ogSvg())).png().toFile(path.join(publicDir, "social-preview.png"));

  console.log("Generated favicon-16.png, favicon-32.png, favicon-192.png, favicon-512.png, apple-touch-icon.png, social-preview.png in client/public/");
}

main().catch((err) => {
  console.error("Failed to generate SEO/social assets:", err);
  process.exit(1);
});
