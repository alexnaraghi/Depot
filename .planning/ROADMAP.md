# Roadmap: P4Now

## Overview

P4Now delivers a non-blocking Windows Perforce GUI in two phases. Phase 1 establishes the async-first architecture that prevents UI freezes and zombie processes, then Phase 2 implements core daily workflows (sync, submit, changelists, file operations) that prove the "never blocked" promise. Every requirement maps to executable work, no enterprise project management artifacts.

## Phases

**Phase Numbering:**
- Integer phases (1, 2): Planned milestone work
- Decimal phases (1.1, 1.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Non-Blocking Foundation** - Async architecture, process management, cancellation infrastructure
- [ ] **Phase 2: Core Workflows** - Sync, submit, changelists, file operations with non-blocking UI

## Phase Details

### Phase 1: Non-Blocking Foundation
**Goal**: Establish async-first architecture that prevents UI freezes, zombie processes, and enables operation cancellation

**Depends on**: Nothing (first phase)

**Requirements**: ARCH-01, ARCH-02, ARCH-03

**Success Criteria** (what must be TRUE):
  1. Developer can spawn p4 command (p4 info) and UI remains responsive during execution
  2. Developer can click Cancel button during long p4 operation and process terminates immediately
  3. Developer can close app during active p4 operation and no orphaned p4.exe processes remain in Task Manager
  4. DevTools performance monitor shows no main thread blocking >16ms during p4 operations

**Plans**: TBD

Plans:
- [ ] 01-01: TBD during planning

### Phase 2: Core Workflows
**Goal**: Implement daily Perforce operations (sync, submit, changelists, file operations) with non-blocking UI proven

**Depends on**: Phase 1

**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06

**Success Criteria** (what must be TRUE):
  1. User can sync workspace from depot and UI shows progress without freezing
  2. User can checkout file for editing and see optimistic status update immediately
  3. User can view pending changelist showing all modified and checked-out files with status indicators
  4. User can submit changelist with description and see non-blocking progress feedback
  5. User can revert checked-out file and file returns to depot state

**Plans**: TBD

Plans:
- [ ] 02-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Non-Blocking Foundation | 0/0 (TBD) | Not started | - |
| 2. Core Workflows | 0/0 (TBD) | Not started | - |
