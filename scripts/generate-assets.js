/**
 * Generates app icon assets as SVG-based PNGs.
 * Run: node scripts/generate-assets.js
 *
 * For production, replace assets/ with properly sized PNGs:
 *   icon.png          1024x1024
 *   splash.png        1284x2778
 *   favicon.png       32x32
 *   adaptive-icon.png 1024x1024
 */
const fs   = require('fs');
const path = require('path');

// Minimal valid 1x1 navy-blue PNG (placeholder until real assets are added)
const NAVY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

const files = [
  'assets/icon.png',
  'assets/splash.png',
  'assets/favicon.png',
  'assets/adaptive-icon.png',
];

if (!fs.existsSync('assets')) fs.mkdirSync('assets');

files.forEach(f => {
  if (!fs.existsSync(f)) {
    fs.writeFileSync(f, NAVY_PNG);
    console.log('Created:', f);
  } else {
    console.log('Exists: ', f);
  }
});

console.log('\nDone. Replace with real 1024x1024 graduation-cap icon PNGs before publishing.');
console.log('Recommended tool: https://www.appicon.co or Figma export.');
