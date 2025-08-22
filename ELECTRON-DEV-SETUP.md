# 🚀 Electron Development Setup

## Quick Start (Windows)

1. **Build and Start Electron App:**
   ```bash
   # Run the automated script
   scripts\start-electron-dev.bat
   ```

## Quick Start (Mac/Linux)

1. **Build and Start Electron App:**
   ```bash
   # Run the automated script
   ./scripts/start-electron-dev.sh
   ```

## Manual Setup

### Option 1: Development Mode (Recommended for development)

1. **Start Frontend Dev Server:**
   ```bash
   cd frontend
   npm run dev
   ```
   This starts the Vite dev server on `http://localhost:5173`

2. **Start Electron App:**
   ```bash
   cd electron
   npm run dev
   ```
   Electron will automatically detect the dev server and load from it.

### Option 2: Production Mode

1. **Build Frontend:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Start Electron App:**
   ```bash
   cd electron
   npm start
   ```
   Electron will load the built files from `frontend/dist/`.

## 🔧 Troubleshooting

### White Screen Issues

- **Frontend not built:** Run `npm run build` in the frontend folder
- **Dev server not running:** Start with `npm run dev` in the frontend folder
- **Path issues:** Make sure you're running from the project root

### Common Errors

- **"Frontend Not Built":** Build the frontend first
- **"Dev server not available":** Start the dev server or build the frontend
- **File not found:** Check that all paths are correct

## 📁 File Structure

```
on-prem-ai-note-taker/
├── frontend/           # React app
│   ├── dist/          # Built files (after npm run build)
│   └── src/           # Source code
├── electron/           # Electron app
│   ├── main.js        # Main process
│   └── package.json   # Electron dependencies
└── scripts/            # Helper scripts
    ├── start-electron-dev.bat    # Windows
    └── start-electron-dev.sh     # Unix/Mac
```

## 🎯 Development Workflow

1. **Make changes** to frontend code
2. **Dev server** automatically reloads (if using `npm run dev`)
3. **Electron** automatically reloads from dev server
4. **For production:** Build frontend and restart Electron

## 🚨 Important Notes

- Always build the frontend before running Electron in production mode
- The dev server must be running for development mode to work
- Check the console for detailed error messages and loading paths
