
# Icon Generation Instructions

The placeholder SVG icons have been created. To convert them to PNG:

## Option 1: Using an online converter
1. Visit https://cloudconvert.com/svg-to-png
2. Upload each SVG file
3. Set the appropriate dimensions
4. Download the PNG files
5. Save them with the same names (icon16.png, icon32.png, etc.)

## Option 2: Using ImageMagick (if installed)
```bash
for size in 16 32 48 128; do
  convert -background none icon${size}.svg icon${size}.png
done
```

## Option 3: Using sharp (Node.js)
Install sharp: `npm install --save-dev sharp`
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
