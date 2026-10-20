# Juntos Validation

**Result**: PASS
**Date**: 2026-10-20
**Spec**: `.specs/features/juntos/spec.md`
**Diff range**: `6dc1450..c7b261b`
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | ✅ Done | Commit `95dcba3` — Vite + React + TS scaffold and `src/domain/types.ts` |
| T2   | ✅ Done | Commit `6e987eb` — Attendance percentage calculation engine (`src/domain/attendanceCalc.ts`) |
| T3   | ✅ Done | Commit `394a168` — SheetJS `.xlsx` chamada parser (`src/domain/chamadaParser.ts`) |
| T4   | ✅ Done | Commit `a0dcee2` — Re-import diff and enrollment drop engine (`src/domain/syncEngine.ts`) |
| T5   | ✅ Done | Commit `a07d0fd` — Firebase Auth service with localized `pt-BR` errors (`src/services/authService.ts`) |
| T6   | ✅ Done | Commit `b17cca7` — Turma & Aluno repository with ≤450 batch chunking (`src/services/turmaRepo.ts`) |
| T7   | ✅ Done | Commit `3d4f769` — Editorial stylesheet, `LoginView`, and `TurmasDashboard` (`src/components/TurmasDashboard.tsx`) |
| T8   | ✅ Done | Commit `0bdf84c` — `TurmaDetailView` with Attendance Matrix, filters, metadata edit, and finish flow (`src/components/TurmaDetailView.tsx`) |
| T9   | ✅ Done | Commit `610bcd5` — `ReimportModal` with diff preview and enrollment drop confirmation (`src/components/ReimportModal.tsx`) |
| T10  | ✅ Done | Commit `c7b261b` — `AlunoFichaDrawer` and full application wiring (`src/components/AlunoFichaDrawer.tsx`, `src/App.tsx`) |

---

## Spec-Anchored Acceptance Criteria

### P1: Autenticação do Professor e Isolamento de Dados (`AUTH-01`, `AUTH-02`)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| 1. WHILE the user is not authenticated, the system SHALL display the email and password sign-in view and block access to class and student data (`AUTH-01`) | Unauthenticated state emits `null` user and renders `LoginView` email/password inputs | `src/services/__tests__/authService.test.ts:52` - `expect(observedStates).toEqual([null])`; `src/components/__tests__/AlunoFichaDrawer.test.tsx:155` - `fireEvent.change(screen.getByLabelText(/e-mail do professor/i), ...)` | ✅ PASS |
| 2. WHEN the user submits valid Firebase Authentication credentials THEN the system SHALL authenticate the session and load only the classes stored under that user's `uid` (`AUTH-01`) | Authenticated session returns user `uid` and isolates `listTurmas(uid)` per professor | `src/services/__tests__/authService.test.ts:55` - `expect(user).toEqual({ uid: 'demo-willy-filosofia-org-br', email: 'willy@filosofia.org.br', isDemo: true })`; `src/services/__tests__/turmaRepo.test.ts:129` - `expect(turmasA).toHaveLength(1)` & `src/services/__tests__/turmaRepo.test.ts:132` - `expect(turmasB[0].nome).toBe('Turma do Professor B')` | ✅ PASS |
| 3. IF Firebase Authentication returns an invalid-credential or network error THEN the system SHALL display a localized Portuguese error message in the sign-in form and re-enable the submit button (`AUTH-02`) | Error alert displays localized `pt-BR` message (`'E-mail ou senha inválidos.'`, `'Falha de conexão com a rede...'`) | `src/services/__tests__/authService.test.ts:19` - `expect(mapAuthErrorToPtBr('auth/invalid-credential')).toBe('E-mail ou senha inválidos.')`; `src/components/__tests__/TurmasDashboard.test.tsx:67` - `expect(screen.getByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')` | ✅ PASS |
| 4. WHEN the authenticated user clicks the sign-out button THEN the system SHALL terminate the Firebase session and return to the sign-in view (`AUTH-01`) | Session cleared (`getCurrentAuthUser() === null`) and UI returns to `LoginView` | `src/services/__tests__/authService.test.ts:103` - `expect(getCurrentAuthUser()).toBeNull()`; `src/components/__tests__/AlunoFichaDrawer.test.tsx:208` - `expect(screen.getByLabelText(/e-mail do professor/i)).toBeInTheDocument()` | ✅ PASS |

### P1: Criação de Turma com Importação Inicial da Planilha Excel (`XLSX-01`, `XLSX-02`, `TURMA-01`)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| 1. WHEN the professor selects a valid `.xlsx` file in the class creation form THEN the system SHALL parse `A1`, `A2`, rows `2..4` (`G+`), row `6` (`ID`, `Nome`, `Status`, `G6+` dates), and rows `7+` (`P`, `A`, `R`, `F`, `J`) (`XLSX-01`) | Parses `Belo Horizonte`, `Turma Pampulha (QUA)`, 31 lessons (`14/10/26`..`28/01/26`), and 3 students (`14820`, `7728`, `14779`), pre-filling form inputs | `src/domain/__tests__/chamadaParser.test.ts:60` - `expect(parsed.cidadePlanilha).toBe('Belo Horizonte')`, `src/domain/__tests__/chamadaParser.test.ts:62` - `expect(parsed.lessons).toHaveLength(31)`, `src/domain/__tests__/chamadaParser.test.ts:81` - `expect(parsed.students.map((s) => s.externalId)).toEqual(['14820', '7728', '14779'])`; `src/components/__tests__/TurmasDashboard.test.tsx:118` - `expect(screen.getByLabelText(/nome da turma/i)).toHaveValue('Turma Pampulha (QUA)')` | ✅ PASS |
| 2. WHEN the professor submits the new class form with class name, day/time, location, at least one `cátedra`, and a parsed `.xlsx` file THEN the system SHALL persist the class, its lesson dates, and each student's individual record to Firestore with status `Ativo` (`TURMA-01`) | Turma persisted with `status: 'Ativa'`, lessons sorted, and all students persisted with `status: 'Ativo'` | `src/services/__tests__/turmaRepo.test.ts:88` - `expect(turma.status).toBe('Ativa')` & `src/services/__tests__/turmaRepo.test.ts:96` - `expect(alunos.every((a) => a.status === 'Ativo')).toBe(true)`; `src/components/__tests__/TurmasDashboard.test.tsx:141` - `expect(createdInput).toEqual({ nome: 'Turma Pampulha (QUA)', diaHorario: 'Quarta-feira, 19h30', ... })` | ✅ PASS |
| 3. IF the uploaded file is not a valid `.xlsx` workbook or lacks the required student header row (`ID` and `Nome`) THEN the system SHALL reject the import before saving and display a validation message specifying the missing structure (`XLSX-02`) | Throws `ChamadaParseError` with specific structure message and renders alert without calling `onCreateTurma` | `src/domain/__tests__/chamadaParser.test.ts:133` - `expect(() => parseChamadaBuffer(buf)).toThrow(/cabeçalho obrigatório ausente na linha 6/i)`; `src/components/__tests__/TurmasDashboard.test.tsx:172` - `expect(screen.getByRole('alert')).toHaveTextContent(/planilha excel \(\.xlsx\) válida/i)` | ✅ PASS |
| 4. The system SHALL calculate each student's `% Trim` (up to 9 most recent lessons) and `% Ano` (all lessons) using `round(100 * count(P, A, R) / count(P, A, R, F, J))` or display `-` when no attendance codes exist (`XLSX-01`) | Exact percentages (`14820`: `78%`/`80%`, `7728`: `89%`/`81%`, `14779`: `89%`/`87%`) and `null` (`-`) when uncounted | `src/domain/__tests__/attendanceCalc.test.ts:86` - `expect(metrics).toEqual({ percentTrim: 78, percentAno: 80, ... })`, `src/domain/__tests__/attendanceCalc.test.ts:105` - `expect(metrics).toEqual({ percentTrim: 89, percentAno: 81, ... })`, `src/domain/__tests__/attendanceCalc.test.ts:124` - `expect(metrics).toEqual({ percentTrim: 89, percentAno: 87, ... })`; `src/components/__tests__/TurmaDetailView.test.tsx:347` - `expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(3)` | ✅ PASS |

### P1: Reimportação de Planilha e Baixa Automática de Inscrição (`XLSX-03`, `XLSX-04`, `SYNC-02`)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| 1. WHILE a class has status `Ativa`, WHEN the professor uploads a new `.xlsx` spreadsheet for that class THEN the system SHALL compute and preview the synchronization summary before applying changes (`XLSX-03`, `SYNC-02`) | Diff summary computed and rendered in `ReimportModal` before confirmation | `src/domain/__tests__/syncEngine.test.ts:157` - `expect(plan.diffSummary.addedLessonDates).toEqual(['21/10/26'])` & `src/domain/__tests__/syncEngine.test.ts:166` - `expect(plan.diffSummary.droppedStudents).toEqual([{ studentKey: '7728', ... }])`; `src/components/__tests__/ReimportModal.test.tsx:100` - `expect(screen.getByText(/resumo da sincronização/i)).toBeInTheDocument()` | ✅ PASS |
| 2. WHEN the professor confirms the `.xlsx` re-import THEN the system SHALL upsert lesson dates and update attendance codes for all students present matched by `ID` (or normalized `Nome` if `ID` is empty) (`XLSX-03`) | Upserts lessons, updates attendance marks by `ID` or normalized name slug | `src/domain/__tests__/syncEngine.test.ts:191` - `expect(claudia.presencas).toEqual({ '07/10/26': 'P', '14/10/26': 'J', '21/10/26': 'P' })`; `src/domain/__tests__/syncEngine.test.ts:410` - `expect(plan.updatedStudents[0].presencas['14/10/26']).toBe('A')` | ✅ PASS |
| 3. WHEN the professor confirms a `.xlsx` re-import in which a previously `Ativo` student is no longer present THEN the system SHALL update status to `Inscrição Baixada`, preserve prior attendance, and append `"Inscrição baixada: aluno não consta na planilha importada em DD/MM/AAAA."` (`XLSX-04`) | Status becomes `'Inscrição Baixada'`, prior `presencas` preserved, and exact dated system comment appended | `src/domain/__tests__/syncEngine.test.ts:201` - `expect(lucas.status).toBe('Inscrição Baixada')`, `src/domain/__tests__/syncEngine.test.ts:203` - `expect(lucas.presencas).toEqual({ '07/10/26': 'P', '14/10/26': 'P' })`, `src/domain/__tests__/syncEngine.test.ts:208` - `expect(lucas.comentarios[0]).toMatchObject({ authorType: 'sistema', text: 'Inscrição baixada: aluno não consta na planilha importada em 21/10/2026.' })`; `src/services/__tests__/turmaRepo.test.ts:243` - `expect(lucas.status).toBe('Inscrição Baixada')` | ✅ PASS |
| 4. IF an already `Inscrição Baixada` student remains absent in subsequent `.xlsx` imports THEN the system SHALL NOT duplicate the automatic drop comment (`XLSX-03`) | `droppedStudents` is `[]`, `alreadyDroppedCount` is `1`, and `comentarios` length remains `1` | `src/domain/__tests__/syncEngine.test.ts:263` - `expect(secondPlan.diffSummary.droppedStudents).toEqual([])` & `src/domain/__tests__/syncEngine.test.ts:271` - `expect(lucasAfterSecond.comentarios).toHaveLength(1)` | ✅ PASS |
| 5. WHEN a previously `Inscrição Baixada` student reappears in a subsequent `.xlsx` import THEN the system SHALL update status back to `Ativo` and append an automatic re-enrollment comment (`XLSX-03`) | Status restored to `'Ativo'`, `droppedAt` cleared, and re-enrollment system comment appended | `src/domain/__tests__/syncEngine.test.ts:357` - `expect(lucas.status).toBe('Ativo')` & `src/domain/__tests__/syncEngine.test.ts:361` - `expect(lucas.comentarios[1]).toMatchObject({ authorType: 'sistema', text: 'Inscrição reativada: aluno voltou a constar na planilha importada em 28/10/2026.' })`; `src/components/__tests__/ReimportModal.test.tsx:175` - `expect(screen.getByText(/inscrição reativada \(1\)/i)).toBeInTheDocument()` | ✅ PASS |

### P1: Ficha Particular do Aluno e Comentários do Professor (`ALUNO-01`, `ALUNO-02`, `ALUNO-03`)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| 1. WHEN the professor clicks on a student in the class view THEN the system SHALL display that student's `ficha particular` (`ID`, `Nome`, status, `% Trim`, `% Ano`, chronological lesson attendances, and comment history) (`ALUNO-01`) | Drawer opens and displays student `ID`, `Nome`, status badge, `% Trim`, `% Ano`, lesson rows, and comments | `src/components/__tests__/AlunoFichaDrawer.test.tsx:75` - `expect(screen.getByText(/ID: 7728/i)).toBeInTheDocument()`, `src/components/__tests__/AlunoFichaDrawer.test.tsx:79` - `expect(screen.getByText('Inscrição Baixada')).toBeInTheDocument()`, `src/components/__tests__/AlunoFichaDrawer.test.tsx:80` - `expect(screen.getAllByText('50%')).toHaveLength(2)` | ✅ PASS |
| 2. WHEN the professor submits a non-empty comment in a student's individual record THEN the system SHALL persist the comment with author type `professor` and creation timestamp and immediately render it (`ALUNO-02`) | Persists `authorType: 'professor'` comment with `createdAt` and renders it in drawer | `src/services/__tests__/turmaRepo.test.ts:373` - `expect(profNoteOnDropped).toMatchObject({ authorType: 'professor', text: 'Conversamos por telefone; mudou de horário no trabalho.', createdAt: '2026-10-22T14:00:00.000Z' })`; `src/components/__tests__/AlunoFichaDrawer.test.tsx:198` - `expect(screen.getByText('Participação exemplar nas aulas de Filosofia.')).toBeInTheDocument()` | ✅ PASS |
| 3. IF the professor attempts to submit an empty or whitespace-only comment THEN the system SHALL prevent submission and keep the comment form unchanged (`ALUNO-03`) | Rejects blank comment with `'O comentário não pode estar vazio.'` and does not invoke save | `src/domain/__tests__/types.test.ts:35` - `expect(whitespaceResult.valid).toBe(false)`; `src/services/__tests__/turmaRepo.test.ts:361` - `await expect(addAlunoComment('uid-prof-1', turma.id, '7728', '  \n ')).rejects.toThrow('O comentário não pode estar vazio.')`; `src/components/__tests__/AlunoFichaDrawer.test.tsx:145` - `expect(screen.getByRole('alert')).toHaveTextContent('O comentário não pode estar vazio.')` | ✅ PASS |
| 4. WHILE a student has status `Inscrição Baixada`, the system SHALL visually distinguish the student with a dedicated status badge and keep the professor comment input enabled (`ALUNO-01`) | Renders `'Inscrição Baixada'` badge and keeps comment textarea enabled | `src/components/__tests__/AlunoFichaDrawer.test.tsx:79` - `expect(screen.getByText('Inscrição Baixada')).toBeInTheDocument()` & `src/components/__tests__/AlunoFichaDrawer.test.tsx:107` - `expect(textarea).not.toBeDisabled()` | ✅ PASS |

### P1: Encerramento de Turma e Comentários da Turma (`TURMA-03`)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| 1. WHILE a class has status `Ativa`, WHEN the professor triggers `Encerrar turma` and optionally provides a closing comment THEN the system SHALL update status to `Encerrada`, record closing timestamp and comment, and move the class under finished classes (`TURMA-03`) | Status updated to `'Encerrada'`, `closedAt` and closing comment persisted, and class appears under `Turmas Encerradas` tab | `src/services/__tests__/turmaRepo.test.ts:271` - `expect(closed.status).toBe('Encerrada')` & `src/services/__tests__/turmaRepo.test.ts:272` - `expect(closed.closedAt).toBe('2026-12-10T22:00:00.000Z')`; `src/components/__tests__/AlunoFichaDrawer.test.tsx:346` - `fireEvent.click(screen.getByRole('tab', { name: /turmas encerradas \(1\)/i }))` & `src/components/__tests__/AlunoFichaDrawer.test.tsx:348` - `expect(screen.getByText('Turma Pampulha (QUA)')).toBeInTheDocument()` | ✅ PASS |
| 2. WHILE a class has status `Encerrada`, the system SHALL disable `.xlsx` attendance re-imports unless the professor explicitly reopens the class (`Reabrir turma`) (`TURMA-03`) | Repository rejects `applyReimportPlan` on `Encerrada` class and UI disables import button until reopened | `src/services/__tests__/turmaRepo.test.ts:289` - `await expect(applyReimportPlan(...)).rejects.toThrow('Não é permitido importar planilha em uma turma encerrada. Reabra a turma primeiro.')`; `src/components/__tests__/TurmaDetailView.test.tsx:300` - `expect(importBtn).toBeDisabled()` & `src/components/__tests__/TurmaDetailView.test.tsx:307` - `expect(onChangeStatus).toHaveBeenCalledWith('Ativa')` | ✅ PASS |
| 3. WHEN the professor submits a general comment on a class THEN the system SHALL persist the timestamped class comment and display it in the class details view (`TURMA-03`) | Persists timestamped `professor` comment on turma and renders it in `TurmaDetailView` | `src/services/__tests__/turmaRepo.test.ts:328` - `expect(entry).toMatchObject({ authorType: 'professor', text: 'Turma participativa na aula sobre estoicismo.', createdAt: '2026-10-15T21:00:00.000Z' })`; `src/components/__tests__/TurmaDetailView.test.tsx:244` - `expect(onAddTurmaComment).toHaveBeenCalledWith('Excelente debate sobre a Aula 10.')` | ✅ PASS |
| 4. WHEN the professor toggles between `Turmas Ativas` and `Turmas Encerradas` in the dashboard THEN the system SHALL filter the displayed classes according to their current status (`TURMA-03`) | Active classes shown only in `Turmas Ativas` and finished classes shown only in `Turmas Encerradas` | `src/components/__tests__/TurmasDashboard.test.tsx:85` - `expect(screen.getByText('Turma Pampulha (QUA)')).toBeInTheDocument()` & `src/components/__tests__/TurmasDashboard.test.tsx:94` - `expect(screen.getByText('Turma Savassi (TER)')).toBeInTheDocument()` | ✅ PASS |

### P2: Edição de Metadados da Turma e Filtros de Alunos (`TURMA-02`)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| 1. WHEN the professor edits and saves a class's name, day/time, location, or `cátedras` THEN the system SHALL update those fields in Firestore without altering student records or attendance history (`TURMA-02`) | Updates metadata fields while `afterEdit.alunos` remains identical to `alunos` | `src/services/__tests__/turmaRepo.test.ts:177` - `expect(updated.nome).toBe('Turma Pampulha Noite')` & `src/services/__tests__/turmaRepo.test.ts:183` - `expect(afterEdit.alunos).toEqual(alunos)`; `src/components/__tests__/TurmaDetailView.test.tsx:197` - `expect(onUpdateMetadata).toHaveBeenCalledWith({ nome: 'Turma Pampulha Noite', ... })` | ✅ PASS |
| 2. WHEN the professor selects a status filter (`Todos`, `Ativos`, `Inscrição Baixada`) or types a search query in the class view THEN the system SHALL filter the displayed student rows in real time by status and case-insensitive match on `Nome` or `ID` (`TURMA-02`) | Filters student rows immediately by status button and search query | `src/components/__tests__/TurmaDetailView.test.tsx:135` - `expect(screen.getByText('Lucas Selani de Melo (Sala Pampulha)')).toBeInTheDocument()`, `src/components/__tests__/TurmaDetailView.test.tsx:138` - `expect(screen.queryByText('Claudia Marcia Marques (Sala Pampulha)')).not.toBeInTheDocument()`, `src/components/__tests__/TurmaDetailView.test.tsx:155` - `expect(screen.getByText('Lucas Selani de Melo (Sala Pampulha)')).toBeInTheDocument()` | ✅ PASS |

**Status**: ✅ All 23/23 ACs covered and matched spec-defined outcomes (0 gaps, 0 spec-precision gaps)

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| 1 | `src/domain/attendanceCalc.ts:41` | Changed trimestral slice bound `sortedLessons.slice(0, 9)` → `sortedLessons.slice(0, 5)` | ✅ Killed (`src/domain/__tests__/attendanceCalc.test.ts:86,105,124,144` failed — 4 tests failed) |
| 2 | `src/domain/syncEngine.ts:191` | Replaced `if (existing.status === 'Ativo')` with `if (true)` so already-dropped students receive duplicate drop comments | ✅ Killed (`src/domain/__tests__/syncEngine.test.ts:263` failed) |
| 3 | `src/services/turmaRepo.ts:294` | Replaced `if (existingTurma.status === 'Encerrada')` with `if (false)` to bypass the finished-class re-import guard | ✅ Killed (`src/services/__tests__/turmaRepo.test.ts:289` failed) |

**Sensor depth**: lightweight (3 targeted high-risk behavior mutations in isolated scratch with full restoration; post-sensor `git status --porcelain` and `git diff` verified clean)
**Result**: 3/3 killed - PASS ✅

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ |
| Matches patterns | ✅ |
| Spec-anchored outcome check (asserted values match spec) | ✅ |
| Per-layer Coverage Expectation met (domain 1:1 ACs; services & UI cover happy+edge+error) | ✅ |
| Every test maps to a spec requirement - no unclaimed tests | ✅ |
| Documented guidelines followed: none - strong defaults applied | ✅ |

---

## Edge Cases

- [x] Edge case 1 (Formula cells in `% Trim`, `% Ano`, `% Presença` without cached values computed directly from raw `P`, `A`, `R`, `F`, `J` marks): Handled and verified in `src/domain/__tests__/chamadaParser.test.ts:92-111` and `src/domain/__tests__/attendanceCalc.test.ts:75-130`
- [x] Edge case 2 (Lesson date column in `Row 6` with no attendance marks imported with metadata and `-` displayed for class attendance percentage): Handled and verified in `src/domain/__tests__/attendanceCalc.test.ts:194` and `src/components/__tests__/TurmaDetailView.test.tsx:345-347`
- [x] Edge case 3 (Student name in column `C` with room suffix in parentheses matched by `ID` across imports and display name updated): Handled and verified in `src/domain/__tests__/syncEngine.test.ts:188-189`
- [x] Edge case 4 (`.xlsx` file uploaded with zero student rows below `Row 6` rejected with error instead of marking all existing students as `Inscrição Baixada`): Handled and verified in `src/domain/__tests__/chamadaParser.test.ts:154-167`
- [x] Edge case 5 (Firestore batch operations exceeding 450 operations chunked into sequential batches of ≤ 450 operations): Handled and verified in `src/services/__tests__/turmaRepo.test.ts:63-71` (`SYNC-01`)

---

## Gate Check

- **Gate command**: `npm run build && npm run test:run`
- **Result**: 62 passed, 0 failed, 0 skipped (10 test files)
- **Test count before feature**: 0
- **Test count after feature**: 62
- **Delta**: +62 new tests
- **Skipped tests**: none
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status  |
| ----------- | --------------- | ----------- |
| AUTH-01     | Implementing    | ✅ Verified |
| AUTH-02     | Implementing    | ✅ Verified |
| XLSX-01     | Implementing    | ✅ Verified |
| XLSX-02     | Implementing    | ✅ Verified |
| XLSX-03     | Implementing    | ✅ Verified |
| XLSX-04     | Implementing    | ✅ Verified |
| TURMA-01    | Implementing    | ✅ Verified |
| TURMA-02    | Implementing    | ✅ Verified |
| TURMA-03    | Implementing    | ✅ Verified |
| ALUNO-01    | Implementing    | ✅ Verified |
| ALUNO-02    | Implementing    | ✅ Verified |
| ALUNO-03    | Implementing    | ✅ Verified |
| SYNC-01     | Implementing    | ✅ Verified |
| SYNC-02     | Implementing    | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 23/23 ACs matched spec outcome (0 spec-precision gaps)
**Sensor**: 3/3 mutations killed
**Gate**: 62 passed, 0 failed

**What works**:
- Full `chamada` `.xlsx` parsing with 100% fidelity on `Turma Pampulha QUA.xlsx` (`Belo Horizonte`, `Turma Pampulha (QUA)`, 31 lessons with themes and instructors, 3 students with exact `% Trim` and `% Ano`).
- Re-import synchronization engine (`computeReimportPlan`) that detects missing active students, transitions them to `Inscrição Baixada`, preserves prior attendance history, appends a single dated system comment without duplicating on subsequent imports, and supports re-enrollment.
- Firebase Authentication and Firestore/LocalStorage repository with professor `uid` isolation, ≤450 batch chunking, class metadata editing, class closing/reopening (`Encerrada`/`Ativa`), and timestamped comments on both classes and individual student records (`ficha particular`).
- Complete editorial UI (`LoginView`, `TurmasDashboard`, `TurmaDetailView`, `ReimportModal`, `AlunoFichaDrawer`) verified by 62 unit and integration tests and a clean production `vite build`.

**Issues found**: None

**Next steps**: Feature is verified and ready for use or deployment.
