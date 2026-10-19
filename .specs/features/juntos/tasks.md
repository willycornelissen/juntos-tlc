# Juntos Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/juntos/design.md`
**Status**: In Progress

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: none - strong defaults applied.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Domain (`src/domain/*`) | unit | All branches; 1:1 to spec ACs; all listed edge cases including real `Turma Pampulha QUA.xlsx` fixture | `src/domain/__tests__/*.test.ts` | `npm run test:run` |
| Services / Repository (`src/services/*`) | integration | Key query paths, atomic batch chunking, auth error mapping, and state transitions | `src/services/__tests__/*.test.ts` | `npm run test:run` |
| UI Components (`src/components/*`, `src/App.tsx`) | integration | All user stories: happy path + edge cases + validation/error states | `src/components/__tests__/*.test.tsx` | `npm run test:run` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `npm run test:run` |
| Full | After tasks with integration tests | `npm run test:run` |
| Build | After phase completion or full-app wiring tasks | `npm run build && npm run test:run` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Foundation & Pure Domain Engine

Core TypeScript setup, domain models, attendance percentage formula engine, and `.xlsx` `chamada` parser.

```
T1 → T2 → T3
```

### Phase 2: Synchronization, Auth & Repository Layer

Re-import diff/drop engine (`Inscrição Baixada`), Firebase Authentication service, and atomic Firestore/Local repository.

```
T4 → T5 → T6
```

### Phase 3: Editorial UI & Full Application Integration

Estante-inspired light/dark views for Login, Dashboard, New Class modal, Class Attendance Matrix, Re-import Diff modal, and Individual Student Record drawer.

```
T7 → T8 → T9 → T10
```

---

## Task Breakdown

### Phase 1: Foundation & Pure Domain Engine

### T1: Initialize Vite + React + TypeScript Scaffold and Domain Types

**What**: Initialize the Vite + React + TypeScript project configuration (`package.json`, `tsconfig.json`, `vite.config.ts` with `base: './'`) and define all canonical domain types and validation helpers in `src/domain/types.ts`.
**Where**: `src/domain/types.ts`
**Depends on**: None
**Reuses**: Reference layout from `.specs/features/juntos/design.md`
**Requirement**: TURMA-01, ALUNO-01

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Dependencies (`react`, `react-dom`, `xlsx`, `firebase`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `typescript`, `vite`, `@vitejs/plugin-react`) are installed and scripts (`dev`, `build`, `test:run`) are configured
- [ ] `src/domain/types.ts` exports `AttendanceCode`, `TurmaStatus`, `EnrollmentStatus`, `LessonColumn`, `CommentEntry`, `Turma`, `AlunoRecord`, `StudentMetrics`, `ParsedChamada`, and `ReimportPlan` plus comment/metadata validation helpers
- [ ] Unit tests in `src/domain/__tests__/types.test.ts` verify type guards and input validation bounds (non-empty comments 1-2000 chars, valid attendance codes)
- [ ] Gate check passes: `npm run build && npm run test:run`
- [ ] Test count: ≥ 4 tests pass

**Tests**: unit
**Gate**: build

**Commit**: `feat(domain): initialize project scaffold and core domain types`

---

### T2: Implement Attendance Percentage Calculation Engine

**What**: Implement `calculateAttendancePercentage`, `computeStudentMetrics`, and `computeLessonPresenceRate` matching the Excel formula `round(100 * (P+A+R) / (P+A+R+F+J))` for `% Trim` (9 most recent lessons by ISO date) and `% Ano` (all lessons).
**Where**: `src/domain/attendanceCalc.ts`
**Depends on**: T1
**Reuses**: `src/domain/types.ts`
**Requirement**: XLSX-01

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `calculateAttendancePercentage` counts `P`, `A`, `R` as present and `P`, `A`, `R`, `F`, `J` in the denominator, returning `null` when denominator is `0`
- [ ] `computeStudentMetrics` sorts lessons chronologically by `isoDate` descending, slices the 9 most recent lessons for `percentTrim`, computes `percentAno` across all lessons, and tallies each code (`P`, `A`, `R`, `F`, `J`)
- [ ] `computeLessonPresenceRate` computes the class-wide presence percentage for any `dateKey`
- [ ] Unit tests in `src/domain/__tests__/attendanceCalc.test.ts` verify exact percentages for all 3 students in `Turma Pampulha QUA.xlsx` (`14820`, `7728`, `14779`), empty lesson columns returning `null` (`-`), and unordered lesson arrays
- [ ] Gate check passes: `npm run test:run`
- [ ] Test count: ≥ 10 cumulative tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(domain): implement attendance calculation engine for trimestral and annual rates`

---

### T3: Implement Chamada Excel (`.xlsx`) Parser

**What**: Implement `parseChamadaBuffer`, `normalizeStudentKey`, and `parseLessonDateKey` using SheetJS (`xlsx`) to parse `chamada` spreadsheets (`A1` city, `A2` class name, row 2 course, row 3 theme, row 4 instructor, row 6 headers/dates, rows 7+ students and attendance marks).
**Where**: `src/domain/chamadaParser.ts`
**Depends on**: T2
**Reuses**: `src/domain/types.ts`, `Turma Pampulha QUA.xlsx`
**Requirement**: XLSX-01, XLSX-02

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Parses `Turma Pampulha QUA.xlsx` accurately: `cidadePlanilha = "Belo Horizonte"`, `nomeTurmaPlanilha = "Turma Pampulha (QUA)"`, 31 lessons (`28/01/26` to `14/10/26`) with themes and instructors, and 3 students (`14820`, `7728`, `14779`) with exact attendance marks
- [ ] Normalizes `DD/MM/YY` and `DD/MM/YYYY` dates into sortable `isoDate` (`YYYY-MM-DD`) and `dateKey` (`DD/MM/YY`)
- [ ] Rejects invalid workbooks, missing `Row 6` (`ID` / `Nome`) headers, or workbooks with 0 student rows below `Row 6` by throwing `ChamadaParseError`
- [ ] Unit tests in `src/domain/__tests__/chamadaParser.test.ts` test both the real `Turma Pampulha QUA.xlsx` file and malformed/empty `.xlsx` buffers
- [ ] Gate check passes: `npm run test:run`
- [ ] Test count: ≥ 18 cumulative tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(domain): implement xlsx chamada spreadsheet parser and validator`

---

### Phase 2: Synchronization, Auth & Repository Layer

### T4: Implement Re-import Diff and Enrollment Drop Engine

**What**: Implement `computeReimportPlan` to merge new/updated lesson dates, add new students, transition missing `Ativo` students to `Inscrição Baixada` with a single dated system comment, avoid duplicate drop comments on subsequent imports, and re-activate returning students.
**Where**: `src/domain/syncEngine.ts`
**Depends on**: T3
**Reuses**: `src/domain/types.ts`, `src/domain/chamadaParser.ts`
**Requirement**: XLSX-03, XLSX-04, SYNC-02

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Matches students by canonical `ID` (falling back to normalized `Nome` when `ID` is empty) and updates display name if changed (e.g., room suffix)
- [ ] Marks previously `Ativo` students absent from the new `.xlsx` as `Inscrição Baixada`, preserves all prior `presencas`, and appends `"Inscrição baixada: aluno não consta na planilha importada em DD/MM/AAAA."`
- [ ] Does NOT append a duplicate system comment when an already `Inscrição Baixada` student remains absent in later imports
- [ ] Restores a previously `Inscrição Baixada` student back to `Ativo` with a re-enrollment system comment if they reappear in a subsequent import
- [ ] Unit tests in `src/domain/__tests__/syncEngine.test.ts` cover initial import, student drop, idempotent repeat import, re-enrollment, and new lesson date merge
- [ ] Gate check passes: `npm run test:run`
- [ ] Test count: ≥ 25 cumulative tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(domain): implement re-import diff and enrollment drop sync engine`

---

### T5: Implement Firebase Configuration and Authentication Service

**What**: Implement Firebase initialization and `authService` supporting Email/Password sign-in, session state subscription, sign-out, localized Portuguese error messages, and automatic local demo session fallback when `VITE_FIREBASE_API_KEY` is not configured.
**Where**: `src/services/authService.ts`
**Depends on**: T4
**Reuses**: `src/domain/types.ts`
**Requirement**: AUTH-01, AUTH-02

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Exports `signInProfessor(email, password)`, `signOutProfessor()`, `subscribeAuthState(callback)`, and `mapAuthErrorToPtBr(errorCode)`
- [ ] Maps Firebase Auth errors (`auth/invalid-credential`, `auth/wrong-password`, `auth/user-not-found`, `auth/too-many-requests`, `auth/network-request-failed`) to clear Portuguese messages
- [ ] Integration tests in `src/services/__tests__/authService.test.ts` verify sign-in, sign-out, session persistence, and Portuguese error mapping
- [ ] Gate check passes: `npm run test:run`
- [ ] Test count: ≥ 31 cumulative tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(auth): implement firebase authentication service with localized errors`

---

### T6: Implement Turma and Aluno Repository Service

**What**: Implement `turmaRepo` (`Firestore` repository scoped to `users/{uid}/turmas/{turmaId}/alunos/{studentKey}` with ≤ 450-op batch chunking + `LocalStorage` adapter) covering class creation, `.xlsx` re-import application, metadata editing, class finish/reopen (`Encerrada`/`Ativa`), and professor comments on classes and students.
**Where**: `src/services/turmaRepo.ts`
**Depends on**: T5
**Reuses**: `src/domain/types.ts`, `src/domain/syncEngine.ts`
**Requirement**: TURMA-01, TURMA-02, TURMA-03, ALUNO-02, ALUNO-03, SYNC-01

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Implements `listTurmas`, `getTurmaWithAlunos`, `createTurmaFromImport`, `applyReimportPlan`, `updateTurmaMetadata`, `setTurmaStatus`, `addTurmaComment`, and `addAlunoComment`
- [ ] Enforces guard against re-importing `.xlsx` into an `Encerrada` class (`TURMA-03` AC 2) and rejects empty/whitespace comments (`ALUNO-03`)
- [ ] Chunks batch operations into slices of ≤ 450 writes (`chunkArray`) to satisfy Firestore batch limits (`SYNC-01`)
- [ ] Integration tests in `src/services/__tests__/turmaRepo.test.ts` verify full CRUD lifecycle, user `uid` isolation, batch chunking, class closing/reopening, and comment persistence
- [ ] Gate check passes: `npm run test:run`
- [ ] Test count: ≥ 40 cumulative tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(repo): implement turma and aluno repository with batch chunking`

---

### Phase 3: Editorial UI & Full Application Integration

### T7: Create Editorial Styles, LoginView, and TurmasDashboard with NewTurmaModal

**What**: Create the Estante-inspired editorial stylesheet (`src/index.css`), authentication view, and `TurmasDashboard` featuring `Turmas Ativas` / `Turmas Encerradas` tabs and the `+ Nova Turma` modal with `.xlsx` drag-and-drop parsing and metadata pre-filling (`A1` location, `A2` class name).
**Where**: `src/components/TurmasDashboard.tsx`
**Depends on**: T6
**Reuses**: `src/domain/chamadaParser.ts`, `src/services/turmaRepo.ts`
**Requirement**: AUTH-01, AUTH-02, TURMA-01, TURMA-03

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Renders `Turmas Ativas` and `Turmas Encerradas` filter tabs with class cards showing `nome`, `diaHorario`, `local`, `cátedras` badges, and active/dropped student counts
- [ ] `+ Nova Turma` form parses an uploaded `.xlsx` file, pre-fills class name from `A2` and location from `A1`, validates required fields (name, day/time, location, ≥1 `cátedra`), and creates the class
- [ ] Component tests in `src/components/__tests__/TurmasDashboard.test.tsx` verify tab switching, `.xlsx` upload pre-fill, validation error display, and class creation
- [ ] Gate check passes: `npm run test:run`
- [ ] Test count: ≥ 46 cumulative tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): create editorial styles and turmas dashboard with xlsx import`

---

### T8: Create TurmaDetailView with Attendance Matrix, Filters, and Finish Class Flow

**What**: Implement `TurmaDetailView` displaying class metadata (with inline edit mode), student search and status filter (`Todos`, `Ativos`, `Inscrição Baixada`), interactive Attendance Matrix (`% Trim`, `% Ano`, `P`/`A`/`R`/`F`/`J` cells, lesson `Tema` & `Instrutor` headers), class comments section, and `Encerrar Turma` / `Reabrir Turma` actions.
**Where**: `src/components/TurmaDetailView.tsx`
**Depends on**: T7
**Reuses**: `src/domain/attendanceCalc.ts`, `src/services/turmaRepo.ts`
**Requirement**: TURMA-02, TURMA-03, ALUNO-01

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Displays all students with their `ID`, `Nome`, `Status` badge (`Ativo` vs `Inscrição Baixada`), `% Trim`, `% Ano`, and per-date attendance marks alongside lesson `Tema`, `Instrutor`, and class `% Presença`
- [ ] Supports real-time filtering by status (`Todos`, `Ativos`, `Inscrição Baixada`) and case-insensitive search by `Nome` or `ID`
- [ ] Allows editing class metadata (`nome`, `diaHorario`, `local`, `cátedras`), adding class comments, and finishing/reopening a class (`Encerrar turma` with closing comment disables `.xlsx` re-import button while `Encerrada`)
- [ ] Component tests in `src/components/__tests__/TurmaDetailView.test.tsx` verify attendance matrix rendering, student filtering/search, metadata editing, and finishing a class
- [ ] Gate check passes: `npm run test:run`
- [ ] Test count: ≥ 52 cumulative tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): implement turma detail view with attendance matrix and finish flow`

---

### T9: Create ReimportModal with Diff Preview and Enrollment Drop Confirmation

**What**: Implement `ReimportModal` allowing the professor to upload a new `.xlsx` spreadsheet into an active class, inspect the synchronization diff preview (new/updated dates, new students, and students transitioning to `Inscrição Baixada`), and confirm the update.
**Where**: `src/components/ReimportModal.tsx`
**Depends on**: T8
**Reuses**: `src/domain/chamadaParser.ts`, `src/domain/syncEngine.ts`, `src/services/turmaRepo.ts`
**Requirement**: XLSX-03, XLSX-04, SYNC-02

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Parses the uploaded `.xlsx` file and renders a clear diff summary before applying changes (count and names of students dropping to `Inscrição Baixada`, newly enrolled students, and lesson dates)
- [ ] Applies the re-import plan on confirmation and surfaces actionable `.warning` messages if the file is invalid
- [ ] Component tests in `src/components/__tests__/ReimportModal.test.tsx` verify diff preview rendering, enrollment drop detection, and confirmation callback
- [ ] Gate check passes: `npm run test:run`
- [ ] Test count: ≥ 56 cumulative tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(ui): implement xlsx re-import modal with diff preview`

---

### T10: Create AlunoFichaDrawer and Wire Complete Application in App.tsx

**What**: Implement `AlunoFichaDrawer` (individual student record showing `ID`, `Nome`, `Status` badge, `% Trim`, `% Ano`, `P`/`A`/`R`/`F`/`J` breakdown, chronological lesson history with theme/instructor, and comment timeline with professor comment form) and connect Auth, Dashboard, TurmaDetailView, ReimportModal, and AlunoFichaDrawer in `src/App.tsx`.
**Where**: `src/components/AlunoFichaDrawer.tsx`
**Depends on**: T9
**Reuses**: `src/domain/attendanceCalc.ts`, `src/services/turmaRepo.ts`, `src/components/*`
**Requirement**: ALUNO-01, ALUNO-02, ALUNO-03

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `AlunoFichaDrawer` renders full student metrics, per-lesson table (date, course, theme, instructor, attendance code), chronological comments (distinguishing `sistema` drop/re-enrollment comments from `professor` notes), and validates non-empty professor comment submission
- [ ] `src/App.tsx` integrates authentication gate (`LoginView`), `HeroHeader`, `TurmasDashboard`, `TurmaDetailView`, `ReimportModal`, and `AlunoFichaDrawer` (plus sample `Turma Pampulha (QUA)` quick-load button in demo mode)
- [ ] End-to-end component integration tests in `src/components/__tests__/AlunoFichaDrawer.test.tsx` verify viewing a dropped student's automatic comment, adding a professor comment, rejecting blank comments, and full app navigation
- [ ] Gate check passes: `npm run build && npm run test:run`
- [ ] Test count: ≥ 62 cumulative tests pass

**Tests**: integration
**Gate**: build

**Commit**: `feat(ui): implement aluno ficha drawer and wire full application`

---

## Phase Execution Map

Visual representation of task ordering. Phases run in sequence, and tasks within a phase run in order:

```
Phase 1 → Phase 2 → Phase 3

Phase 1:  T1 ------→ T2 ------→ T3
Phase 2:  T4 ------→ T5 ------→ T6
Phase 3:  T7 ------→ T8 ------→ T9 ------→ T10
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Initialize Vite + React + TS scaffold and domain types | 1 domain module (`src/domain/types.ts`) + config | ✅ Granular |
| T2: Implement attendance percentage calculation engine | 1 domain module (`src/domain/attendanceCalc.ts`) | ✅ Granular |
| T3: Implement Chamada Excel (`.xlsx`) parser | 1 domain module (`src/domain/chamadaParser.ts`) | ✅ Granular |
| T4: Implement re-import diff and enrollment drop engine | 1 domain module (`src/domain/syncEngine.ts`) | ✅ Granular |
| T5: Implement Firebase configuration and auth service | 1 service module (`src/services/authService.ts`) | ✅ Granular |
| T6: Implement Turma and Aluno repository service | 1 service module (`src/services/turmaRepo.ts`) | ✅ Granular |
| T7: Create editorial styles and TurmasDashboard with NewTurmaModal | 1 UI view (`src/components/TurmasDashboard.tsx`) | ✅ Granular |
| T8: Create TurmaDetailView with attendance matrix and finish flow | 1 UI view (`src/components/TurmaDetailView.tsx`) | ✅ Granular |
| T9: Create ReimportModal with diff preview | 1 UI component (`src/components/ReimportModal.tsx`) | ✅ Granular |
| T10: Create AlunoFichaDrawer and wire App.tsx | 1 UI component (`src/components/AlunoFichaDrawer.tsx`) + `App.tsx` | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows (intra-phase) | Status |
| ---- | ---------------------- | --------------------------- | ------ |
| T1 | None | Start of Phase 1 (`T1 → T2`) | ✅ Match |
| T2 | T1 | `T1 → T2` | ✅ Match |
| T3 | T2 | `T2 → T3` | ✅ Match |
| T4 | T3 (Phase 1) | Start of Phase 2 (`T4 → T5`) | ✅ Match |
| T5 | T4 | `T4 → T5` | ✅ Match |
| T6 | T5 | `T5 → T6` | ✅ Match |
| T7 | T6 (Phase 2) | Start of Phase 3 (`T7 → T8`) | ✅ Match |
| T8 | T7 | `T7 → T8` | ✅ Match |
| T9 | T8 | `T8 → T9` | ✅ Match |
| T10 | T9 | `T9 → T10` | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1: Initialize scaffold & domain types | Domain (`src/domain/*`) | unit | unit | ✅ OK |
| T2: Attendance calculation engine | Domain (`src/domain/*`) | unit | unit | ✅ OK |
| T3: Chamada `.xlsx` parser | Domain (`src/domain/*`) | unit | unit | ✅ OK |
| T4: Re-import diff & drop engine | Domain (`src/domain/*`) | unit | unit | ✅ OK |
| T5: Firebase Auth service | Services (`src/services/*`) | integration | integration | ✅ OK |
| T6: Turma & Aluno repository | Services (`src/services/*`) | integration | integration | ✅ OK |
| T7: TurmasDashboard & NewTurmaModal | UI Components (`src/components/*`) | integration | integration | ✅ OK |
| T8: TurmaDetailView & Attendance Matrix | UI Components (`src/components/*`) | integration | integration | ✅ OK |
| T9: ReimportModal | UI Components (`src/components/*`) | integration | integration | ✅ OK |
| T10: AlunoFichaDrawer & App wiring | UI Components (`src/components/*`, `src/App.tsx`) | integration | integration | ✅ OK |
