/**
 * Script to generate PNG icons from SVG
 * You'll need to install sharp: npm install --save-dev sharp
 * Run: node scripts/generate-icons.js
 */

const fs = require('fs').promises;
const path = require('path');

// Placeholder icon generation (creates simple colored squares)
// In production, you should use proper icon generation tools or design actual icons

async function generatePlaceholderIcons() {
  const sizes = [16, 32, 48, 128];
  const iconDir = path.join(__dirname, '..', 'public', 'icons');

  // Ensure icons directory exists
  await fs.mkdir(iconDir, { recursive: true });

  // Create a simple SVG template function
  const createSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size / 8}" fill="url(#grad${size})"/>
  <text x="${size / 2}" y="${size / 2 + size / 8}"
        font-family="Arial, sans-serif"
        font-size="${size / 3}"
        font-weight="bold"
        fill="white"
        text-anchor="middle">SM</text>
</svg>
  `;

  console.log('Generating placeholder icons...');

  for (const size of sizes) {
    const svgContent = createSvg(size);
    const fileName = `icon${size}.svg`;
    const filePath = path.join(iconDir, fileName);

    await fs.writeFile(filePath, svgContent);
    console.log(`Created ${fileName}`);
  }

  // Create instructions file
  const instructions = `
# Icon Generation Instructions

The placeholder SVG icons have been created. To convert them to PNG:

## Option 1: Using an online converter
1. Visit https://cloudconvert.com/svg-to-png
2. Upload each SVG file
3. Set the appropriate dimensions
4. Download the PNG files
5. Save them with the same names (icon16.png, icon32.png, etc.)

## Option 2: Using ImageMagick (if installed)
\`\`\`bash
for size in 16 32 48 128; do
  convert -background none icon\${size}.svg icon\${size}.png
done
\`\`\`

## Option 3: Using sharp (Node.js)
Install sharp: \`npm install --save-dev sharp\`
Then update this script to use sharp for conversion.

## Icon Requirements:
- icon16.png: 16x16 pixels (browser toolbar)
- icon32.png: 32x32 pixels (Windows)
- icon48.png: 48x48 pixels (extension management page)
- icon128.png: 128x128 pixels (Chrome Web Store)

## Design Tips:
- Use simple, recognizable shapes
- Ensure visibility at small sizes
- Maintain consistent branding
- Consider dark/light mode compatibility
`;

  await fs.writeFile(path.join(iconDir, 'README.md'), instructions);
  console.log('Created icon generation instructions in public/icons/README.md');
}

generatePlaceholderIcons().catch(console.error);