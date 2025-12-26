const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const browsers = ['chrome', 'firefox'];
const successfulBuilds = [];

// Function to create a zip for a specific browser
function zipBrowser(browser) {
  return new Promise((resolve, reject) => {
    const distPath = path.resolve(__dirname, `../dist-${browser}`);
    const outputPath = path.resolve(__dirname, `../sus-o-meter-${browser}.zip`);

    // Check if dist folder exists
    if (!fs.existsSync(distPath)) {
      console.warn(`⚠️ Warning: dist-${browser} folder not found. Skipping ${browser}.`);
      resolve(false);
      return;
    }

    // Remove existing zip if it exists
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
      console.log(`Removed existing sus-o-meter-${browser}.zip`);
    }

    // Create output stream
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Listen for archive events
    output.on('close', () => {
      const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`✅ ${browser.toUpperCase()} extension packaged successfully!`);
      console.log(`📦 File: sus-o-meter-${browser}.zip`);
      console.log(`📊 Size: ${sizeInMB} MB (${archive.pointer()} bytes)`);
      console.log(`📍 Location: ${outputPath}`);
      console.log('');
      resolve(true);
    });

    archive.on('error', (err) => {
      console.error(`Error creating ${browser} zip:`, err);
      reject(err);
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Warning:', err);
      } else {
        reject(err);
      }
    });

    // Pipe archive to output file
    archive.pipe(output);

    // Add dist folder contents to archive
    console.log(`📦 Creating ${browser} extension package...`);
    archive.directory(distPath, false);

    // Finalize the archive
    archive.finalize();
  });
}

// Main execution
async function main() {
  console.log('📦 Packaging extension builds...\n');

  for (const browser of browsers) {
    try {
      const success = await zipBrowser(browser);
      if (success) {
        successfulBuilds.push(browser);
      }
    } catch (err) {
      console.error(`Failed to package ${browser}:`, err);
      process.exit(1);
    }
  }

  if (successfulBuilds.length === 0) {
    console.error('❌ Error: No dist folders found. Run build first.');
    process.exit(1);
  }

  console.log(`✨ Successfully packaged ${successfulBuilds.length} build(s): ${successfulBuilds.join(', ')}`);
}

main();
