# STATE

## Decisions

### AD-001
- **Decision**: Build Juntos as a static React + Vite + TypeScript SPA hosted on GitHub Pages with Firebase Authentication and Cloud Firestore, parsing `.xlsx` spreadsheets entirely in the browser via SheetJS (`xlsx`).
- **Reason**: Matches the user's proven deployment and operational workflow (`estante.willy.dev.br`), requires zero server maintenance, and keeps infrastructure costs at zero under Firebase Spark limits.
- **Trade-off**: All spreadsheet parsing, synchronization diffing, and batch persistence must run in the client browser and be protected via Firestore Security Rules (`request.auth.uid == userId`).
- **Scope**: Entire application architecture, authentication, storage, and build pipeline.
- **Date**: 2026-10-19
- **Status**: active

### AD-002
- **Decision**: Model Firestore data hierarchically per professor (`users/{uid}/turmas/{turmaId}`) with embedded `lessons[]` and `comentarios[]` on the class document and a dedicated `alunos/{studentKey}` subcollection per class containing each student's attendance map (`presencas`) and student-level `comentarios[]`.
- **Reason**: Keeps dashboard queries (`turmas`) lightweight without downloading all student histories, isolates individual student comment writes to a single student document, and enables atomic class+student spreadsheet imports via Firestore `writeBatch`.
- **Trade-off**: Opening a specific class requires two queries (`turmas/{turmaId}` and `turmas/{turmaId}/alunos`), which are fetched in parallel.
- **Scope**: Firestore schema, repository layer (`src/services/firestore.ts`), and sync engine (`src/domain/syncEngine.ts`).
- **Date**: 2026-10-19
- **Status**: active

### AD-003
- **Decision**: Implement the Closing Report (Relatório de Encerramento) with native responsive SVG charts and pure domain statistics calculations without external charting libraries.
- **Reason**: Guarantees zero peer-dependency conflicts with React 19, ultra-fast rendering, zero impact on bundle size, and seamless execution in JSDOM unit tests.
- **Trade-off**: Chart geometry (curves, donuts, bars) is maintained in-code rather than abstracted by a third-party library.
- **Scope**: Domain calculations (`src/domain/relatorioEncerramento.ts`) and UI presentation (`src/components/RelatorioEncerramentoView.tsx`).
- **Date**: 2026-10-22
- **Status**: active

## Handoff

- **Feature**: relatorio-encerramento (`.specs/features/relatorio-encerramento`)
- **Phase / Task**: Execute — Verified (`validation.md` PASS, all 3 tasks T1-T3 complete)
- **Completed**: Specify (`spec.md`), Tasks (`tasks.md`), Execute (`T1`..`T3`), Verifier report (`validation.md`)
- **In-progress** (file:line): none
- **Next step**: User acceptance testing
- **Blockers**: none
- **Uncommitted files**: none
- **Branch**: main
