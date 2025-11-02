/**
 * Create simple PNG placeholder icons
 * This creates data URI PNGs and writes them as actual PNG files
 */

const fs = require('fs');
const path = require('path');

// Simple function to create a colored PNG (1x1 pixel base64)
// We'll create larger canvases by repeating, but for now just create simple solid color PNGs

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Base64 encoded 1x1 purple PNG pixel
const purplePixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function createPlaceholderPNG(size, outputPath) {
  // For a quick placeholder, we'll create a simple colored square
  // This is a minimal PNG with a gradient color

  const canvas = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size / 8}" fill="url(#grad)"/>
  <text x="${size / 2}" y="${size / 2 + size / 8}"
        font-family="Arial, sans-serif"
        font-size="${size / 3}"
        font-weight="bold"
        fill="white"
        text-anchor="middle">SM</text>
</svg>`;

  // Write SVG file (Chrome will load these if PNG fails)
  fs.writeFileSync(outputPath.replace('.png', '.svg'), canvas);

  console.log(`Created ${path.basename(outputPath)} (SVG fallback)`);
}

async function main() {
  console.log('Creating placeholder icon files...');
  console.log('Note: SVG files will be created as Chrome may accept them in some contexts.\n');

  for (const size of sizes) {
    const filename = `icon${size}.png`;
    const filepath = path.join(iconsDir, filename);
    await createPlaceholderPNG(size, filepath);
  }

  console.log('\n⚠️  IMPORTANT: Chrome extensions require actual PNG files.');
  console.log('To convert SVG to PNG, use one of these methods:');
  console.log('1. Online: https://cloudconvert.com/svg-to-png');
  console.log('2. ImageMagick: convert icon.svg icon.png');
  console.log('3. Inkscape: inkscape icon.svg -o icon.png');
  console.log('\nFor now, you can also use a temporary workaround:');
  console.log('Remove the "icons" and "default_icon" fields from manifest.json');
}

main().catch(console.error);
