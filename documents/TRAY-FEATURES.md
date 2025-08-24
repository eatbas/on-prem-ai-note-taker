# System Tray Features

## Overview
The On-Prem AI Note Taker now includes system tray functionality that allows the application to run in the background and provides quick access to recording controls.

## Features

### 🎯 **Minimize to Tray**
- Clicking the red X button now minimizes the application to the system tray instead of closing it
- The application continues running in the background
- To completely quit the app, use the tray context menu

### 🎤 **System Tray Icon**
- A tray icon appears in the system tray (bottom-right on Windows, top-right on macOS/Linux)
- The icon shows the current application status
- Click the tray icon to restore the main window

### 📋 **Tray Context Menu**
Right-click the tray icon to access:
- **🎤 Start Recording** / **🔴 Recording...** - Quick access to start recording or shows current status
- **📝 Open App** - Restore and focus the main application window
- **❌ Quit** - Completely close the application

### 🎬 **Recording Indicator**
When recording is active, a compact recording interface appears in the top-right corner of the screen:
- **Stop Button** - Red circular button to stop recording
- **Timer** - Shows current recording duration (MM:SS format)
- **Audio Level Bars** - Visual representation of audio input levels
- **Microphone Icon** - Indicates microphone is active

## Usage

### Starting Recording from Tray
1. Right-click the tray icon
2. Select "🎤 Start Recording"
3. The main window will open and recording will begin
4. A recording indicator will appear on screen

### Minimizing to Tray
1. Click the red X button on the main window
2. The application minimizes to the system tray
3. The app continues running and recording (if active)

### Restoring from Tray
1. Click the tray icon, or
2. Right-click and select "📝 Open App"

### Quitting the Application
1. Right-click the tray icon
2. Select "❌ Quit"
3. The application will completely close

## Technical Details

### IPC Communication
- The main process communicates with the renderer process using IPC
- Recording state updates are sent to update the tray menu
- Tray actions are sent to the frontend to trigger recording

### Window Management
- Window close events are intercepted to prevent actual closing
- The `app.isQuiting` flag controls when the app should actually quit
- Tray creation happens after the main window is ready

### Cross-Platform Support
- Windows: 16x16 icon size, bottom-right tray location
- macOS: Standard icon size, top-right menu bar location  
- Linux: Standard icon size, top-right panel location

## Troubleshooting

### Tray Icon Not Visible
- Check if your OS supports system tray icons
- Ensure the application has proper permissions
- Try restarting the application

### Recording Indicator Not Showing
- Verify that recording has actually started
- Check if the window is minimized or hidden
- Ensure the frontend is properly loaded

### Cannot Quit Application
- Use the tray context menu "❌ Quit" option
- Check if any recording is in progress
- Force quit from Task Manager if necessary
