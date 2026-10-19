# Juntos Specification

## Problem Statement

Professors teaching recurring philosophy and humanities classes export attendance spreadsheets (`chamada` `.xlsx` files) from their academic management system, but lack a dedicated tool to track student progression, attendance history, enrollment drops, and personal pedagogical notes over time. When a student drops out and disappears from subsequent spreadsheet exports, their historical context is easily lost. **Juntos** provides a static web application backed by Firebase where professors manage their classes, import and re-import `.xlsx` attendance sheets, automatically detect dropped enrollments (`inscrição baixada`), and maintain an individual longitudinal record (`ficha particular`) with comments for each student and class.

## Goals

- [ ] Enable authenticated professors to create and manage classes (`turmas`) with schedule (day/time), location, taught subjects (`cátedras`), and initial student/attendance import from the standard `chamada` `.xlsx` spreadsheet format.
- [ ] Provide an individual student record (`ficha particular`) per class displaying student ID, enrollment status (`Ativo` or `Inscrição Baixada`), trimestral and annual attendance percentages, per-date attendance codes (`P`, `A`, `R`, `F`, `J`) with lesson theme and instructor, and a chronological comment log.
- [ ] Support subsequent `.xlsx` re-imports on active classes that merge new lesson dates/attendance, add newly enrolled students, and automatically mark missing previously enrolled students as `Inscrição Baixada` with a timestamped system comment in their record.
- [ ] Allow professors to mark a class as finished (`turma encerrada`) and record closing or ongoing comments on the class.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Student or public portal | Juntos is strictly a private tool for the professor; students do not log in or view records. |
| Editing or exporting `.xlsx` spreadsheets back to the academic ERP | The external academic system is the source of truth for raw `.xlsx` exports; Juntos consumes `.xlsx` files one-way. |
| Automated email/WhatsApp notifications to absent or dropped students | Communication happens outside the platform in this MVP. |
| Multi-professor shared class editing / RBAC | Each professor account (`uid`) manages their own classes in isolation, matching the `estante.willy.dev.br` architecture. |
| Financial / tuition payment tracking | Enrollment status is derived strictly from presence in imported `.xlsx` files, not billing data. |

---

## Implicit-Requirement Dimensions Sweep

Required for Large/Complex scope. Every dimension resolves to traced requirements or an explicit `N/A because...`.

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Covered by `XLSX-01`, `XLSX-02`, `TURMA-02`, `ALUNO-03`: validate `.xlsx` layout (`Row 6` headers `ID`, `Nome`, `Status`, date columns `G+`), file size ≤ 5 MB, required class metadata fields, and non-empty comment text (1–2000 chars). |
| Failure / partial-failure states | Covered by `XLSX-04`, `SYNC-01`: Firestore writes during class creation and spreadsheet re-import execute via atomic `writeBatch` commits so partial student or attendance updates never persist on network failure. |
| Idempotency / retry / duplicate handling | Covered by `XLSX-03`: re-importing the exact same `.xlsx` file updates existing date columns by date key (`DD/MM/YY`) and matches students by their canonical `ID` (Col A, falling back to normalized `Nome` if `ID` is absent) without duplicating students, dates, or system drop comments. |
| Auth boundaries & rate limits | Covered by `AUTH-01`, `AUTH-02`: Firebase Authentication (email/password) gates all views; Firestore data is scoped under the authenticated professor's `uid` (`users/{uid}/...`). Client-side throttling disables submit/import buttons while an operation is in flight. |
| Concurrency / ordering | Covered by `ALUNO-02`, `XLSX-01`: lesson dates from columns `G+` are parsed (`DD/MM/YY`) and sorted chronologically; student comments and class comments are ordered by ISO/server timestamp. |
| Data lifecycle / expiry | Covered by `TURMA-03`, `ALUNO-01`: finished classes (`Encerrada`) and dropped students (`Inscrição Baixada`) are retained indefinitely for historical consultation and never hard-deleted by re-imports. |
| Observability | Covered by `SYNC-02`: UI displays explicit import diff summaries (students added, attendance dates updated, students marked `Inscrição Baixada`) and actionable error banners (`warning` class) when parsing or Firestore operations fail. |
| External-dependency failure | Covered by `AUTH-02`, `SYNC-01`: if Firebase Auth or Firestore is unreachable or rejects a write, the UI retains unsaved form/import state in memory and surfaces a clear error message in Portuguese. |
| State-transition integrity | Covered by `TURMA-03`, `ALUNO-01`: a class transitions from `Ativa` to `Encerrada` (and while `Encerrada`, blocks accidental `.xlsx` re-imports unless reopened); a student transitions from `Ativo` to `Inscrição Baixada` when absent from a newer `.xlsx` import (and if they reappear in a subsequent import, transitions back to `Ativo` with an automatic re-enrollment comment). |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Hosting and backend architecture | Static Vite + React SPA hosted on GitHub Pages backed by Firebase Auth (email/password) and Cloud Firestore | Matches the user's explicit request and existing `estante.willy.dev.br` reference architecture | y |
| Visual identity and language | Portuguese (`pt-BR`) UI with the warm academic/editorial palette (`#f6f5f1` light / `#1b1b1b` dark, `#2c5f4a` primary green, `#f59e0b` amber accent, Georgia serif hero) | Directly inspired by `estante.willy.dev.br` while adapting components for class matrices and student drawers | y |
| Spreadsheet layout (`Turma Pampulha QUA.xlsx`) | Sheet `chamada` (or first sheet): `A1` = branch/city, `A2` = spreadsheet class name, `G2+` = course name, `G3+` = lesson theme (`Tema`), `G4+` = lesson instructor (`Instrutores`), `Row 6` = headers (`A6=ID`, `B6=seq`, `C6=Nome`, `D6=Status`, `E6=% Trim`, `F6=% Ano`, `G6+=DD/MM/YY` dates), `Row 7+` = student rows with codes `P`, `A`, `R`, `F`, `J` | Verified directly from the provided `Turma Pampulha QUA.xlsx` reference file | y |
| Attendance percentage calculation | Present count = `P + A + R`; Total count = `P + A + R + F + J`; `% Trim` uses the 9 most recent lesson dates; `% Ano` uses all recorded lesson dates for that student | Matches the exact Excel formulas embedded in `E7:F9` and `G5:AK5` of `Turma Pampulha QUA.xlsx` | y |
| Student unique identification within a class | Match students across imports primarily by column `A` (`ID`, e.g., `14820`), falling back to normalized student name (`C`) only if `ID` is blank | `Turma Pampulha QUA.xlsx` provides a unique numeric `ID` per student in column `A`, preventing false drops if a name suffix changes slightly | y |
| Pre-filling class metadata from spreadsheet | When uploading `.xlsx` during class creation, pre-fill class name from `A2` and location/city from `A1` so the professor can confirm or edit them alongside day/time and `cátedras` | Reduces manual typing while keeping all metadata editable by the professor | y |
| Re-enrollment behavior if a dropped student reappears | If a student previously marked `Inscrição Baixada` reappears in a newer `.xlsx` import, restore status to `Ativo` and append an automatic system comment recording the re-enrollment | Preserves state-transition integrity when an enrollment is reinstated in the academic system | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Autenticação do Professor e Isolamento de Dados ⭐ MVP

**User Story**: As a professor, I want to sign in with my email and password so that my classes, student records, and private pedagogical comments are securely stored in Firebase and accessible from anywhere.

**Why P1**: Required foundation for hosting on GitHub Pages with Firebase Firestore security.

**Acceptance Criteria**:
1. WHILE the user is not authenticated, the system SHALL display the email and password sign-in view and block access to class and student data.
2. WHEN the user submits valid Firebase Authentication credentials THEN the system SHALL authenticate the session and load only the classes stored under that user's `uid`.
3. IF Firebase Authentication returns an invalid-credential or network error THEN the system SHALL display a localized Portuguese error message in the sign-in form and re-enable the submit button.
4. WHEN the authenticated user clicks the sign-out button THEN the system SHALL terminate the Firebase session and return to the sign-in view.

**Independent Test**: Sign in with a test professor account, verify empty/isolated dashboard, refresh page to confirm session persistence, and sign out.

---

### P1: Criação de Turma com Importação Inicial da Planilha Excel ⭐ MVP

**User Story**: As a professor, I want to create a class by importing the initial `chamada` `.xlsx` spreadsheet and providing the class name, day and time of lessons, location, and taught subject(s) (`cátedras`) so that all enrolled students and existing lesson attendances are registered.

**Why P1**: Core entry point of the Juntos workflow described by the user.

**Acceptance Criteria**:
1. WHEN the professor selects a valid `.xlsx` file in the class creation form THEN the system SHALL parse cell `A1` (location hint), cell `A2` (class name hint), row `2` (`G2+` course), row `3` (`G3+` lesson themes), row `4` (`G4+` instructors), row `6` (`A6=ID`, `C6=Nome`, `D6=Status`, `G6+` lesson dates), and rows `7+` (enrolled students and their `P`, `A`, `R`, `F`, `J` attendance codes).
2. WHEN the professor submits the new class form with class name, day/time, location, at least one `cátedra`, and a parsed `.xlsx` file THEN the system SHALL persist the class, its lesson dates, and each student's individual record (`ficha particular`) to Firestore with status `Ativo`.
3. IF the uploaded file is not a valid `.xlsx` workbook or lacks the required student header row (`ID` and `Nome`) THEN the system SHALL reject the import before saving and display a validation message specifying the missing structure.
4. The system SHALL calculate each student's `% Trim` (up to the 9 most recent lessons) and `% Ano` (all lessons) using the formula `round(100 * count(P, A, R) / count(P, A, R, F, J))` whenever `count(P, A, R, F, J) > 0`, or display `-` when no attendance codes exist.

**Independent Test**: Upload `Turma Pampulha QUA.xlsx`, fill in day/time (`Quarta-feira, 19h30`), location (`Pampulha - Belo Horizonte`), and cátedras (`Filosofia para Viver`, `Transpasso`), save, and verify all 3 students (`14820`, `7728`, `14779`) and 31 lesson dates (`28/01/26` to `14/10/26`) appear with exact attendance percentages.

---

### P1: Reimportação de Planilha e Baixa Automática de Inscrição ⭐ MVP

**User Story**: As a professor, I want to import updated `.xlsx` attendance spreadsheets into an existing active class so that new lesson dates and attendances are updated and any previously active student missing from the new spreadsheet is automatically marked as having their enrollment dropped (`inscrição baixada`) with a comment in their record.

**Why P1**: Core requirement for longitudinal tracking of attendance updates and student dropouts.

**Acceptance Criteria**:
1. WHILE a class has status `Ativa`, WHEN the professor uploads a new `.xlsx` spreadsheet for that class THEN the system SHALL compute and preview the synchronization summary (new/updated lesson dates, newly enrolled students, and students missing from the new spreadsheet) before applying changes.
2. WHEN the professor confirms the `.xlsx` re-import THEN the system SHALL upsert lesson dates (`G6+` with theme and instructor) and update attendance codes (`P`, `A`, `R`, `F`, `J`) for all students present in the spreadsheet matched by student `ID` (or normalized `Nome` if `ID` is empty).
3. WHEN the professor confirms a `.xlsx` re-import in which a previously `Ativo` student of that class is no longer present THEN the system SHALL update that student's status to `Inscrição Baixada`, preserve all of their prior attendance history, and append an automatic system comment (`"Inscrição baixada: aluno não consta na planilha importada em DD/MM/AAAA."`) to their individual record.
4. IF an already `Inscrição Baixada` student remains absent in subsequent `.xlsx` imports THEN the system SHALL NOT duplicate the automatic drop comment in their individual record.
5. WHEN a previously `Inscrição Baixada` student reappears in a subsequent `.xlsx` import THEN the system SHALL update their status back to `Ativo` and append an automatic system comment recording the re-enrollment.

**Independent Test**: Re-import a modified spreadsheet for `Turma Pampulha (QUA)` where student `7728` (`Lucas Selani de Melo`) is removed and a new lesson date `21/10/26` is added; verify `7728` stays in the class with status `Inscrição Baixada`, retains all prior attendance, and receives the automatic drop comment.

---

### P1: Ficha Particular do Aluno e Comentários do Professor ⭐ MVP

**User Story**: As a professor, I want to open an individual record (`ficha particular`) for any active or dropped student in a class and add my own dated comments so that I can follow up on each student's attendance, context, and reasons for absence or withdrawal.

**Why P1**: Essential for student accompaniment and adding context alongside automatic enrollment-drop comments.

**Acceptance Criteria**:
1. WHEN the professor clicks on a student in the class view THEN the system SHALL display that student's individual record (`ficha particular`) containing their `ID`, `Nome`, current status (`Ativo` or `Inscrição Baixada`), `% Trim`, `% Ano`, full chronological history of lesson attendances (date, course, theme, instructor, and code `P`/`A`/`R`/`F`/`J`), and chronological comment history.
2. WHEN the professor submits a non-empty comment in a student's individual record THEN the system SHALL persist the comment with author type `professor` and creation timestamp to Firestore and immediately render it in the student's comment list.
3. IF the professor attempts to submit an empty or whitespace-only comment THEN the system SHALL prevent submission and keep the comment form unchanged.
4. WHILE a student has status `Inscrição Baixada`, the system SHALL visually distinguish the student in both the class list and the individual record with a dedicated status badge and keep the professor comment input enabled.

**Independent Test**: Open the individual record of a student (both `Ativo` and `Inscrição Baixada`), inspect their attendance breakdown and system comments, add a professor comment, reload the page, and verify the comment persists.

---

### P1: Encerramento de Turma e Comentários da Turma ⭐ MVP

**User Story**: As a professor, I want to mark a class as finished (`terminada` / `encerrada`) and add comments to the class so that completed courses are organized separately from active classes while preserving their full history and observations.

**Why P1**: Explicitly requested by the user to close out completed classes with professor commentary.

**Acceptance Criteria**:
1. WHILE a class has status `Ativa`, WHEN the professor triggers the finish-class action (`Encerrar turma`) and optionally provides a closing comment THEN the system SHALL update the class status to `Encerrada`, record the closing timestamp and comment in Firestore, and move the class under the finished classes filter/tab.
2. WHILE a class has status `Encerrada`, the system SHALL disable `.xlsx` attendance re-imports for that class unless the professor explicitly reopens the class (`Reabrir turma`).
3. WHEN the professor submits a general comment on a class (active or finished) THEN the system SHALL persist the timestamped class comment to Firestore and display it in the class details view.
4. WHEN the professor toggles between `Turmas Ativas` and `Turmas Encerradas` in the dashboard THEN the system SHALL filter the displayed classes according to their current status.

**Independent Test**: Add a comment to an active class, mark the class as finished with a closing note, verify it moves to `Turmas Encerradas` and blocks new `.xlsx` imports while keeping all student records and comments accessible.

---

### P2: Edição de Metadados da Turma e Filtros de Alunos

**User Story**: As a professor, I want to edit a class's metadata (name, day/time, location, `cátedras`) and filter students within a class by status (`Todos`, `Ativos`, `Inscrição Baixada`) or search by name/ID so that I can quickly locate students and keep schedule details accurate.

**Why P2**: Improves usability as class sizes and semester schedules evolve.

**Acceptance Criteria**:
1. WHEN the professor edits and saves a class's name, day/time, location, or `cátedras` THEN the system SHALL update those fields in Firestore without altering student records or attendance history.
2. WHEN the professor selects a status filter (`Todos`, `Ativos`, `Inscrição Baixada`) or types a search query in the class view THEN the system SHALL filter the displayed student rows in real time by status and case-insensitive match on `Nome` or `ID`.

**Independent Test**: Edit the `cátedras` and schedule of an existing class, then filter students by `Inscrição Baixada` and search by ID `14820`.

---

## Edge Cases

- IF a `.xlsx` file contains formula cells in `% Trim` (`E`), `% Ano` (`F`), or `% Presença` (`Row 5`) without cached values THEN the system SHALL compute all attendance percentages directly from the raw `P`, `A`, `R`, `F`, `J` cells rather than relying on cached Excel formula strings.
- IF a lesson date column in `Row 6` has no attendance marks (`P`, `A`, `R`, `F`, `J`) for any student THEN the system SHALL still import the lesson column metadata (date, course, theme, instructor) and display `-` for its class attendance percentage.
- IF a student's name in column `C` contains a room suffix in parentheses (e.g., `Claudia Marcia Marques (Sala Pampulha)`) and their `ID` (`14820`) remains the same across imports THEN the system SHALL match the student by `ID` (`14820`) and update the display name if changed.
- IF a `.xlsx` file is uploaded with zero student rows below `Row 6` THEN the system SHALL reject the import with an error message instead of marking all existing students in the class as `Inscrição Baixada`.
- WHEN Firestore batch operations exceed 450 operations (large classes) THEN the system SHALL chunk writes into sequential batches of ≤ 450 operations to respect Firestore's 500-operation batch limit.

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| AUTH-01 | P1: Autenticação do Professor e Isolamento de Dados (AC 1, 2, 4) — T5, T7 | Tasks | In Tasks |
| AUTH-02 | P1: Autenticação do Professor e Isolamento de Dados (AC 3) — T5, T7 | Tasks | In Tasks |
| XLSX-01 | P1: Criação de Turma com Importação Inicial da Planilha Excel (AC 1, 4) — T2, T3 | Execute | Implementing |
| XLSX-02 | P1: Criação de Turma com Importação Inicial da Planilha Excel (AC 3) — T3 | Tasks | In Tasks |
| XLSX-03 | P1: Reimportação de Planilha e Baixa Automática de Inscrição (AC 1, 2, 4, 5) — T4, T9 | Tasks | In Tasks |
| XLSX-04 | P1: Reimportação de Planilha e Baixa Automática de Inscrição (AC 3) — T4, T9 | Tasks | In Tasks |
| TURMA-01 | P1: Criação de Turma com Importação Inicial da Planilha Excel (AC 2) — T1, T6, T7 | Execute | Implementing |
| TURMA-02 | P2: Edição de Metadados da Turma e Filtros de Alunos (AC 1, 2) — T6, T8 | Tasks | In Tasks |
| TURMA-03 | P1: Encerramento de Turma e Comentários da Turma (AC 1, 2, 3, 4) — T6, T7, T8 | Tasks | In Tasks |
| ALUNO-01 | P1: Ficha Particular do Aluno e Comentários do Professor (AC 1, 4) — T1, T8, T10 | Execute | Implementing |
| ALUNO-02 | P1: Ficha Particular do Aluno e Comentários do Professor (AC 2) — T6, T10 | Tasks | In Tasks |
| ALUNO-03 | P1: Ficha Particular do Aluno e Comentários do Professor (AC 3) — T6, T10 | Tasks | In Tasks |
| SYNC-01 | Edge Cases & Implicit Dimensions: Atomic batch persistence and error recovery — T6 | Tasks | In Tasks |
| SYNC-02 | Edge Cases & Implicit Dimensions: Import diff preview and observability feedback — T4, T9 | Tasks | In Tasks |

**ID format:** `[CATEGORY]-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 14 total, 14 mapped to tasks, 0 unmapped ✅

---

## Success Criteria

How we know the feature is successful:

- [ ] Importing `Turma Pampulha QUA.xlsx` parses 100% of its structure (`Belo Horizonte`, `Turma Pampulha (QUA)`, 31 lessons from `28/01/26` to `14/10/26` with themes and instructors, and 3 students `14820`, `7728`, `14779` with matching `% Trim` and `% Ano`).
- [ ] Re-importing an updated `.xlsx` where a student is removed automatically transitions that student to `Inscrição Baixada`, keeps their prior attendance intact, and records a single dated system comment in their `ficha particular`.
- [ ] Professor can add comments to both individual students (active or dropped) and classes, and can mark a class as finished (`Encerrada`) with a closing comment.
- [ ] Static build (`vite build`) succeeds cleanly for GitHub Pages deployment with automated unit/integration tests verifying parser, diff engine, attendance calculations, and UI workflows.
