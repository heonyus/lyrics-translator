# workflow_state.md

_Last updated: 2025-01-28_

## Phase

SCAFFOLD

## Status

RUNNING

## CurrentItem

**1. Project Setup and Structure**

## SCAFFOLD Phase Progress:
- ✅ Copied .cursor/rules folder from realtime-translator
- ✅ Copied task template and report guidelines
- ✅ Created workflow_state.md for progress tracking
- ✅ Created lyrics-translator specific PRD
- ✅ Initialized Next.js 15 project with TypeScript
- ✅ Installed core dependencies (React 19, Framer Motion, Radix UI, etc.)
- ✅ Created project structure with domains
- ✅ Setup Tailwind CSS with karaoke-specific configurations
- ✅ Created basic pages (home, layout)
- ✅ Added utility functions and UI components
- 🔄 Creating task files for each domain

## Plan

### Execution Strategy

Building a karaoke-style lyrics translator for singing broadcasts. This system will display lyrics word-by-word with highlighting synchronized to singing, show real-time translations as subtitles, and provide an OBS-compatible overlay interface.

#### Item 1: Project Setup and Structure

- **Construct**:
  - Initialize Next.js 15 project with TypeScript, Tailwind, and App Router
  - Install core dependencies (Framer Motion, Radix UI, React Hook Form, Zod)
  - Create domain-based folder structure
  - Setup environment variables for API keys
  - Create base configuration files
- **Validate**: Project builds and runs with basic setup

#### Item 2: Lyrics Domain Implementation

- **Construct**:
  - Create LRC parser with word-level timing support
  - Implement lyrics data structures and schemas
  - Add support for multiple lyric formats
  - Create lyrics loading and management system
- **Validate**: Can parse and manage LRC files with word timings

#### Item 3: Karaoke Domain Implementation

- **Construct**:
  - Build word-by-word highlighting engine
  - Create smooth transition animations
  - Implement timing synchronization logic
  - Add progress tracking and display
- **Validate**: Karaoke display works with proper highlighting

#### Item 4: Translation Domain Implementation

- **Construct**:
  - Integrate Google Translate API
  - Implement translation caching system
  - Add multi-language support
  - Create translation management UI
- **Validate**: Real-time translation works accurately

#### Item 5: Sync Domain Implementation

- **Construct**:
  - Build audio playback synchronization
  - Add manual timing adjustment controls
  - Implement offset calibration system
  - Create sync state management
- **Validate**: Timing stays synchronized with audio

#### Item 6: UI/Overlay Domain Implementation

- **Construct**:
  - Create karaoke display component
  - Build translation subtitle component
  - Implement OBS-friendly transparent overlay
  - Add broadcaster control panel
- **Validate**: UI works in OBS with transparency

#### Item 7: Integration and Testing

- **Construct**:
  - Connect all domains together
  - Add real-time preview functionality
  - Implement settings persistence
  - Create comprehensive tests
- **Validate**: Complete system works end-to-end

#### Item 8: Deployment and Documentation

- **Construct**:
  - Deploy to Vercel
  - Configure environment variables
  - Create user documentation
  - Add setup instructions for OBS
- **Validate**: Live deployment works correctly

## Items

- [ ] **1. Project Setup and Structure**
- [ ] **2. Lyrics Domain Implementation**
- [ ] **3. Karaoke Domain Implementation**
- [ ] **4. Translation Domain Implementation**
- [ ] **5. Sync Domain Implementation**
- [ ] **6. UI/Overlay Domain Implementation**
- [ ] **7. Integration and Testing**
- [ ] **8. Deployment and Documentation**

## Log

### 2025-01-28 - Project Initialization
- **Started**: Setting up karaoke lyrics translator project
- **Status**: 🔄 In Progress
- **Actions**: 
  - Created .cursor directory structure
  - Copied rules, tasks, and reports from realtime-translator
  - Initialized workflow_state.md for progress tracking

## ArchiveLog

## Rules

> **Keep every major section under an explicit H2 (`##`) heading so the agent can locate them unambiguously.**

### [PHASE: ANALYZE]

1.  Read **template.prd.mdc**, relevant code & docs.
2.  Summarize requirements. _No code or planning._

### [PHASE: BLUEPRINT]

1.  Decompose task into ordered steps and write task sub items under **## Items**.
2.  Write pseudocode or file-level diff outline under **## Plan**.
3.  Set `Status = RUNNING` and begin implementation.

### [PHASE: CONSTRUCT]

1.  Follow the approved **## Plan** exactly.
2.  After each atomic change:
    - run test / linter commands
    - capture tool output in **## Log**
3.  On success of all steps, set `Phase = VALIDATE`.
4.  Check git status and commit with compact message.

### [PHASE: VALIDATE]

1.  Rerun full test suite & any E2E checks.
2.  If clean, set `Status = COMPLETED`.
3.  Check git status and commit with compact message.