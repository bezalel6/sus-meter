# Icon Generation Guide

The extension currently loads **without icons** to allow immediate development and testing.

## Quick Solution: Add PNG Icons

### Option 1: Use an Online Converter (Easiest)
1. Go to https://cloudconvert.com/svg-to-png
2. Upload each SVG file from this directory
3. Convert to PNG at the correct size:
   - icon16.svg → 16x16 PNG
   - icon32.svg → 32x32 PNG
   - icon48.svg → 48x48 PNG
   - icon128.svg → 128x128 PNG
4. Save them in this directory with the names: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`

### Option 2: Use ImageMagick (Command Line)
If you have ImageMagick installed:
```bash
cd public/icons
convert -background none icon16.svg -resize 16x16 icon16.png
convert -background none icon32.svg -resize 32x32 icon32.png
convert -background none icon48.svg -resize 48x48 icon48.png
convert -background none icon128.svg -resize 128x128 icon128.png
```

### Option 3: Design Custom Icons
Create your own 16x16, 32x32, 48x48, and 128x128 PNG icons using:
- Figma (https://figma.com)
- Canva (https://canva.com)
- GIMP (https://gimp.org)
- Photoshop
- Any image editor

## After Creating PNG Icons

Update `public/manifest.json` to include the icons:

```json
{
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

Then rebuild: `npm run build`

## Icon Size Requirements

- **16x16**: Toolbar icon
- **32x32**: Windows taskbar
- **48x48**: Extension management page
- **128x128**: Chrome Web Store and installation

## Design Guidelines

- Use simple, recognizable shapes
- Ensure visibility at 16x16 size
- Maintain consistent branding
- Test in both light and dark themes
- Avoid fine details that won't be visible when small
