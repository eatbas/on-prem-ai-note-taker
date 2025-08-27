# Frontend Architecture Guide

## 🏗️ Overview

The frontend has been refactored from a messy, unorganized structure into a clean, modular, feature-based architecture following modern React best practices.

## 📁 New Directory Structure

```
frontend/src/
├── lib/                          # 🔧 Shared utilities, types, constants
│   ├── constants.ts              # App-wide constants
│   ├── types.ts                  # Centralized type definitions
│   ├── utils.ts                  # Shared utility functions
│   └── index.ts                  # Barrel exports
│
├── features/                     # 🎯 Feature-based organization
│   ├── recording/               # Recording functionality
│   ├── meetings/                # Meeting management
│   ├── admin/                   # Admin features
│   ├── queue/                   # Job queue processing
│   ├── ui/                      # Shared UI components
│   └── index.ts                 # Feature exports
│
├── components/                   # 🧩 Legacy component structure (to be migrated)
│   ├── recording/               # Recording components
│   ├── queue/                   # Queue components
│   ├── common/                  # Shared components
│   └── index.ts                 # Component exports
│
├── hooks/                        # 🪝 Custom React hooks
│   ├── useAudioRecorder.ts      # Audio recording logic
│   ├── useDebounce.ts           # Debouncing utilities
│   ├── usePageVisibility.ts     # Page visibility detection
│   └── index.ts                 # Hook exports
│
├── services/                     # 📡 API and data services
│   ├── api.ts                   # External API calls
│   ├── db.ts                    # Database schema
│   ├── offline.ts               # Local storage operations
│   └── index.ts                 # Service exports
│
├── stores/                       # 🗃️ State management
│   ├── globalRecordingManager.ts
│   ├── jobQueueManager.ts
│   ├── apiStateManager.ts
│   ├── electronApiOptimizer.ts
│   └── index.ts                 # Store exports
│
├── pages/                        # 📄 Top-level page components
│   ├── Dashboard.tsx
│   ├── MeetingView.tsx
│   ├── AdminDashboard.tsx
│   ├── AskLlama.tsx
│   └── index.ts                 # Page exports
│
├── utils/                        # 🛠️ Legacy utilities (to be moved to lib/)
│   ├── utils.ts
│   ├── audioDebug.ts
│   ├── envLoader.ts
│   └── index.ts
│
├── types/                        # 📝 Legacy types (moved to lib/types.ts)
├── assets/                       # 🖼️ Static assets
├── App.tsx                       # 🏠 Main app component
├── main.tsx                      # 🚀 App entry point
└── index.ts                      # 📦 Main exports
```

## 🎯 Feature-Based Organization

### Benefits of Feature Structure

1. **Scalability**: Easy to add new features without breaking existing code
2. **Maintainability**: Related code is grouped together
3. **Reusability**: Clear boundaries between features
4. **Team Collaboration**: Different teams can work on different features

### Feature Modules

#### 🎙️ Recording Feature (`features/recording/`)
- **Components**: Recorder, DeviceSelector, AudioLevelMonitor, etc.
- **Hooks**: useAudioRecorder
- **Types**: RecordingConfig, AudioDevice, AudioRecorderState

#### 📅 Meetings Feature (`features/meetings/`)
- **Components**: Dashboard, MeetingView
- **Types**: Meeting, MeetingMetadata, TranscriptionResult

#### ⚙️ Admin Feature (`features/admin/`)
- **Components**: AdminDashboard, AskLlama
- **Types**: Job, JobStatus, JobProgress

#### 📊 Queue Feature (`features/queue/`)
- **Components**: JobQueue, ProgressDashboard, ProgressTracker
- **Types**: Job, JobProgress

#### 🎨 UI Feature (`features/ui/`)
- **Components**: TagsManager, Toast
- **Types**: ToastMessage, ModalProps

## 📚 Import Patterns

### Recommended Import Patterns

```typescript
// ✅ Feature-based imports (preferred)
import { Recording } from '@/features'
import { useAudioRecorder } from '@/features/recording'

// ✅ Direct feature imports
import { Recorder, DeviceSelector } from '@/features/recording'

// ✅ Lib imports for shared utilities
import { formatDuration, generateId } from '@/lib'
import type { Meeting, AudioDevice } from '@/lib/types'

// ✅ Service imports
import { createMeeting, addChunk } from '@/services'

// ✅ Hook imports
import { useDebounce, usePageVisibility } from '@/hooks'
```

### Legacy Import Patterns (to be migrated)

```typescript
// ❌ Avoid these patterns
import { Recorder } from '@/components/recording'
import { formatDuration } from '@/utils'
```

## 🔧 Shared Library (`lib/`)

### Constants (`lib/constants.ts`)
Centralized configuration values:
- Recording settings
- Audio monitoring config
- UI configuration
- API settings
- Error/success messages

### Types (`lib/types.ts`)
Comprehensive type definitions:
- Base types (ID, Timestamp, Language)
- Audio types (AudioDevice, RecordingConfig)
- Meeting types (Meeting, TranscriptionResult)
- Job types (Job, JobStatus)
- UI types (ToastMessage, ModalProps)

### Utils (`lib/utils.ts`)
Shared utility functions:
- Time formatting
- File size formatting
- Audio calculations
- Device utilities
- Storage utilities
- Async utilities
- Validation utilities

## 🪝 Custom Hooks

### Audio Hooks
- `useAudioRecorder`: Dual-channel recording management

### Utility Hooks
- `useDebounce`: Value and callback debouncing
- `usePageVisibility`: Page visibility and user activity detection

## 📡 Services

### API Services (`services/api.ts`)
- External API communication
- Authentication
- Transcription and summarization

### Database Services (`services/db.ts`)
- IndexedDB schema
- Local data storage

### Offline Services (`services/offline.ts`)
- Local meeting management
- Audio chunk assembly
- Sync operations

## 🗃️ State Management

### Global Recording Manager
- Recording state coordination
- Cross-component recording management

### Job Queue Manager
- Background job processing
- Progress tracking

### API State Manager
- API call coordination
- Error handling

## 🔄 Migration Guide

### From Old Structure to New Structure

```typescript
// OLD: Direct component imports
import { Recorder } from './components/recording/Recorder'
import { formatDuration } from './utils/utils'

// NEW: Feature-based imports
import { Recorder } from '@/features/recording'
import { formatDuration } from '@/lib'
```

### Updating Existing Code

1. **Replace utility imports**:
   ```typescript
   // OLD
   import { formatDuration } from '@/utils'
   
   // NEW
   import { formatDuration } from '@/lib'
   ```

2. **Use feature exports**:
   ```typescript
   // OLD
   import { Recorder } from '@/components/recording'
   
   // NEW
   import { Recorder } from '@/features/recording'
   ```

3. **Use centralized types**:
   ```typescript
   // OLD
   import { Meeting } from '@/services/db'
   
   // NEW
   import type { Meeting } from '@/lib/types'
   ```

## 🚀 Benefits Achieved

### 1. **Better Organization**
- Clear feature boundaries
- Logical grouping of related code
- Easier navigation

### 2. **Improved Maintainability**
- Single source of truth for types
- Centralized constants
- Consistent patterns

### 3. **Enhanced Developer Experience**
- Better IDE support
- Clearer import paths
- Reduced cognitive load

### 4. **Scalability**
- Easy to add new features
- Minimal impact when changing existing code
- Clear ownership boundaries

### 5. **Performance**
- Better tree shaking
- Lazy loading potential
- Reduced bundle size

## 📋 Next Steps

### Immediate (High Priority)
1. **Update App.tsx** to use new import patterns
2. **Migrate existing imports** throughout the codebase
3. **Test all functionality** after migration

### Short Term
1. **Move legacy utils** to `lib/utils.ts`
2. **Consolidate types** from services to `lib/types.ts`
3. **Remove empty legacy folders**

### Long Term
1. **Add unit tests** for each feature
2. **Implement Storybook** for component documentation
3. **Add ESLint rules** to enforce import patterns

## 🎯 Code Standards

### File Naming
- **Components**: PascalCase (e.g., `RecordingModal.tsx`)
- **Hooks**: camelCase with "use" prefix (e.g., `useAudioRecorder.ts`)
- **Utilities**: camelCase (e.g., `formatDuration`)
- **Types**: PascalCase (e.g., `Meeting`, `AudioDevice`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `RECORDING_CONFIG`)

### Export Patterns
- **Default exports** for components and pages
- **Named exports** for utilities, hooks, and types
- **Barrel exports** in index.ts files
- **Feature namespaces** for related exports

### Import Order
1. React and external libraries
2. Internal feature imports
3. Shared lib imports
4. Service imports
5. Type imports (with `type` keyword)

The new architecture provides a solid foundation for scaling the application while maintaining code quality and developer productivity.
