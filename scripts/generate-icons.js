/**
 * Script to generate PNG icons from the original PNG icon
 * Uses sharp to resize the original icon to all required sizes
 * Run: npm run generate-icons
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Icon sizes needed for Chrome extension
const sizes = [16, 32, 48, 128];

// Paths
const inputFile = path.join(__dirname, '..', 'public', 'icons', 'og-icon.png');
const outputDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  console.log('🎨 Generating icon sizes from og-icon.png...');

  // Check if original icon exists
  if (!fs.existsSync(inputFile)) {
    console.error('❌ Original icon not found at:', inputFile);
    console.error('Please ensure og-icon.png exists in public/icons/');
    process.exit(1);
  }

  for (const size of sizes) {
    const outputFile = path.join(outputDir, `icon${size}.png`);

    try {
      await sharp(inputFile)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputFile);

      console.log(`✅ Generated icon${size}.png (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Failed to generate icon${size}.png:`, error.message);
      process.exit(1);
    }
  }

  console.log('✨ All icons generated successfully!');
  console.log('📁 Icons location: public/icons/');
  console.log('\n📋 Files created:');
  sizes.forEach(size => {
    console.log(`   - icon${size}.png (${size}x${size} pixels)`);
  });
}

// Run the script
generateIcons().catch(error => {
  console.error('Error generating icons:', error);
  process.exit(1);
});