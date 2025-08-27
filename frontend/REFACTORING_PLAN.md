# Frontend Refactoring Plan

## 📋 Files Requiring Refactoring (>350 lines)

### 🔥 **Critical Priority** (>1000 lines)
1. **src/components/recording/Recorder.tsx** - 1948 lines
   - Status: ❌ Needs complete refactoring
   - Action: Replace with RecorderRefactored and remove

2. **src/pages/MeetingView.tsx** - 1909 lines  
   - Status: ✅ Already refactored as MeetingViewRefactored
   - Action: Remove original, rename refactored version

3. **src/pages/Dashboard.tsx** - 1526 lines
   - Status: ❌ Needs refactoring
   - Action: Split into components and hooks

### 🟡 **High Priority** (700-1000 lines)
4. **src/services/api.ts** - 971 lines
   - Status: ❌ Needs refactoring
   - Action: Split by feature modules

5. **src/utils/audioDebug.ts** - 934 lines
   - Status: ❌ Needs refactoring  
   - Action: Split into focused modules

6. **src/pages/AdminDashboard.tsx** - 792 lines
   - Status: ❌ Needs refactoring
   - Action: Split into admin components

7. **src/pages/AskLlama.tsx** - 744 lines
   - Status: ❌ Needs refactoring
   - Action: Split into chat components

8. **src/App.tsx** - 730 lines
   - Status: ✅ Already refactored as AppRefactored
   - Action: Remove original, rename refactored version

### 🟠 **Medium Priority** (350-700 lines)
9. **src/components/queue/JobQueue.tsx** - 651 lines
   - Status: ❌ Needs refactoring
   - Action: Split into queue components

10. **src/stores/apiStateManager.ts** - 496 lines
    - Status: ❌ Needs refactoring
    - Action: Split into focused stores

11. **src/services/offline.ts** - 468 lines
    - Status: ❌ Needs refactoring
    - Action: Split by functionality

12. **src/components/recording/DeviceSelector.tsx** - 432 lines
    - Status: ❌ Needs refactoring
    - Action: Split into device components

13. **src/components/queue/QueueProcessor.tsx** - 410 lines
    - Status: ❌ Needs refactoring
    - Action: Split into processor components

14. **src/stores/globalRecordingManager.ts** - 372 lines
    - Status: ❌ Needs refactoring
    - Action: Split recording state logic

15. **src/components/recording/AudioRecordingTester.tsx** - 356 lines
    - Status: ❌ Needs refactoring
    - Action: Split into test components

## 🧹 **Cleanup Tasks**

### Remove Refactored Files
- [ ] Remove `src/App.tsx` (replace with AppRefactored)
- [ ] Remove `src/pages/MeetingView.tsx` (replace with MeetingViewRefactored)
- [ ] Remove `src/components/recording/Recorder.tsx` (replace with RecorderRefactored)

### Rename Refactored Files
- [ ] `AppRefactored.tsx` → `App.tsx`
- [ ] `MeetingViewRefactored.tsx` → `MeetingView.tsx`
- [ ] `RecorderRefactored.tsx` → `Recorder.tsx`

### Update Imports
- [ ] Update all imports to use new file names
- [ ] Update main.tsx entry point
- [ ] Update routing references

## 📊 **Progress Tracking**

### Refactoring Status
- **Total files >350 lines**: 15
- **Completed**: 3 (App, MeetingView, Recorder components)
- **Remaining**: 12
- **Target**: All files ≤350 lines

### Success Criteria
- [ ] All files ≤350 lines
- [ ] Build succeeds with `npm run build`
- [ ] All imports resolved correctly
- [ ] Feature functionality preserved
- [ ] Clean feature-based organization

## 🛠️ **Refactoring Strategy**

### 1. **Component Splitting**
- Extract reusable UI components
- Create focused feature components
- Implement container/presenter pattern

### 2. **Service Splitting**
- Group by feature domains
- Separate API concerns
- Extract utility functions

### 3. **Store Splitting**
- Single responsibility stores
- Domain-specific state management
- Clear state boundaries

### 4. **Utility Organization**
- Feature-specific utilities
- Shared common utilities
- Clear import paths

## 📝 **Implementation Order**

### Phase 1: Cleanup Existing Refactored Files
1. Replace old files with refactored versions
2. Update all import references
3. Test build success

### Phase 2: Critical Files (>1000 lines)
1. Dashboard.tsx → Split into dashboard components
2. Verify build after each refactoring

### Phase 3: High Priority Files (700-1000 lines)
1. api.ts → Split by feature modules
2. audioDebug.ts → Split into debug modules
3. AdminDashboard.tsx → Split into admin components
4. AskLlama.tsx → Split into chat components

### Phase 4: Medium Priority Files (350-700 lines)
1. JobQueue.tsx → Split into queue components
2. apiStateManager.ts → Split into focused stores
3. offline.ts → Split by functionality
4. DeviceSelector.tsx → Split into device components
5. QueueProcessor.tsx → Split into processor components
6. globalRecordingManager.ts → Split recording logic
7. AudioRecordingTester.tsx → Split into test components

### Phase 5: Final Verification
1. Run line count verification
2. Full build test
3. Import verification
4. Feature testing

## 🎯 **Target Structure**

```
frontend/src/
├── lib/                    # Shared utilities (<350 lines each)
├── features/              # Feature modules (<350 lines each)
│   ├── recording/
│   ├── meetings/
│   ├── admin/
│   ├── queue/
│   └── ui/
├── services/              # API services (<350 lines each)
├── stores/                # State management (<350 lines each)
├── hooks/                 # Custom hooks (<350 lines each)
├── components/            # Shared components (<350 lines each)
└── pages/                 # Page components (<350 lines each)
```

This plan ensures systematic refactoring while maintaining functionality and build stability.
