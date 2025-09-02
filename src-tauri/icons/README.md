# Application Icons

This directory contains the application icons for the Tauri build.

## Required Icon Files

- `32x32.png` - 32x32 pixel PNG icon
- `128x128.png` - 128x128 pixel PNG icon
- `128x128@2x.png` - 256x256 pixel PNG icon (high DPI)
- `icon.icns` - macOS icon bundle
- `icon.ico` - Windows icon file

## Generating Icons

You can use tools like:
- **ImageMagick**: `convert input.png -resize 32x32 32x32.png`
- **Icon Generator websites**
- **Figma/Photoshop** for custom designs

## Current Status

⚠️ **PLACEHOLDER**: These are placeholder files. Replace with actual icon files before building for production.

The application will still build and run without these icons, but the generated installers will use default icons.
