#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Electron to Tauri Migration...\n');

const checks = [
    {
        name: 'Tauri CLI installation',
        check: () => {
            try {
                execSync('npx tauri --version', { stdio: 'pipe' });
                return true;
            } catch {
                return false;
            }
        }
    },
    {
        name: 'Rust toolchain',
        check: () => {
            try {
                execSync('rustc --version', { stdio: 'pipe' });
                return true;
            } catch {
                return false;
            }
        }
    },
    {
        name: 'Tauri project structure',
        check: () => fs.existsSync('src-tauri')
    },
    {
        name: 'Audio module',
        check: () => fs.existsSync('src-tauri/src/audio.rs')
    },
    {
        name: 'Window management module',
        check: () => fs.existsSync('src-tauri/src/windows.rs')
    },
    {
        name: 'Tray module',
        check: () => fs.existsSync('src-tauri/src/tray.rs')
    },
    {
        name: 'IPC module',
        check: () => fs.existsSync('src-tauri/src/ipc.rs')
    },
    {
        name: 'Notification module',
        check: () => fs.existsSync('src-tauri/src/notifications.rs')
    },
    {
        name: 'File system module',
        check: () => fs.existsSync('src-tauri/src/fs.rs')
    },
    {
        name: 'Frontend Tauri integration',
        check: () => {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            return (packageJson.dependencies && packageJson.dependencies['@tauri-apps/api']) ||
                   (packageJson.devDependencies && packageJson.devDependencies['@tauri-apps/api']);
        }
    },
    {
        name: 'Build configuration',
        check: () => fs.existsSync('src-tauri/tauri.conf.json')
    },
    {
        name: 'Tauri main.rs',
        check: () => fs.existsSync('src-tauri/src/main.rs')
    },
    {
        name: 'Floating recorder HTML',
        check: () => fs.existsSync('frontend/dist/floating-recorder.html')
    },
    {
        name: 'Frontend Tauri services',
        check: () => fs.existsSync('frontend/src/services/tauriAudio.ts') && fs.existsSync('frontend/src/services/tauriIPC.ts')
    },
    {
        name: 'Tauri detection utility',
        check: () => fs.existsSync('frontend/src/lib/tauri.ts')
    }
];

let allPassed = true;

checks.forEach(({ name, check }) => {
    const passed = check();
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${name}`);
    if (!passed) allPassed = false;
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
    console.log('🎉 Migration verification PASSED!');
    console.log('🚀 You can now run: npm run tauri:dev');
    console.log('📦 To build: npm run tauri:build');
} else {
    console.log('❌ Migration verification FAILED!');
    console.log('🔧 Please complete the missing components from the migration guide');
    console.log('📖 Check ELECTRON_TO_TAURI_MIGRATION.md for detailed instructions');
}

process.exit(allPassed ? 0 : 1);
