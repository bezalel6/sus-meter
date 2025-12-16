const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const distPath = path.resolve(__dirname, '../dist');
const outputPath = path.resolve(__dirname, '../sus-meter.zip');

// Check if dist folder exists
if (!fs.existsSync(distPath)) {
  console.error('Error: dist folder not found. Run build first.');
  process.exit(1);
}

// Remove existing zip if it exists
if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath);
  console.log('Removed existing sus-meter.zip');
}

// Create output stream
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

// Listen for archive events
output.on('close', () => {
  const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`✅ Extension packaged successfully!`);
  console.log(`📦 File: sus-meter.zip`);
  console.log(`📊 Size: ${sizeInMB} MB (${archive.pointer()} bytes)`);
  console.log(`📍 Location: ${outputPath}`);
});

archive.on('error', (err) => {
  console.error('Error creating zip:', err);
  process.exit(1);
});

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn('Warning:', err);
  } else {
    throw err;
  }
});

// Pipe archive to output file
archive.pipe(output);

// Add dist folder contents to archive
console.log('📦 Creating extension package...');
archive.directory(distPath, false);

// Finalize the archive
archive.finalize();
