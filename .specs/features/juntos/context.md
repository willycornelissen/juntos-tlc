# Juntos Context

**Gathered:** 2026-10-19
**Spec:** `.specs/features/juntos/spec.md`
**Status:** Ready for design

---

## Feature Boundary

A static web application (`Vite + React`) hosted on GitHub Pages and backed by Firebase (`Authentication` + `Cloud Firestore`) for professors to manage classes (`turmas`), import and re-import standard `chamada` `.xlsx` attendance spreadsheets, track individual student records (`fichas particulares`) with automatic enrollment-drop detection (`inscrição baixada`), and record pedagogical comments at both the student and class levels.

---

## Implementation Decisions

### Hosting, Stack & Reference Architecture
- **Static SPA for GitHub Pages:** Built with React + Vite + TypeScript, compiling to static assets deployable to GitHub Pages, following the exact model of `https://estante.willy.dev.br/`.
- **Firebase Backend-as-a-Service:** Uses Firebase Authentication (Email/Password) and Cloud Firestore, isolating each professor's data under their authenticated `uid`.
- **Client-Side Excel Parsing:** Uses SheetJS (`xlsx`) in the browser to read `.xlsx` workbooks directly without any server-side backend.

### Visual Identity & Interactive UI
- **Editorial Academic Aesthetic (Estante-inspired):**
  - Automatic light/dark theme (`prefers-color-scheme: dark`) with warm background tones (`#f6f5f1` in light mode, `#1b1b1b` in dark mode), primary forest green (`#2c5f4a`), and amber highlights (`#f59e0b`).
  - Serif hero banner (`Georgia`), clean pill tags for `cátedras` and student statuses, and tab-based navigation (`Turmas Ativas`, `Turmas Encerradas`, `+ Nova Turma`).
- **Class View & Attendance Matrix:**
  - Displays class metadata (Name, Location, Day/Time, `Cátedras` tags, Status badge, and class-level comments).
  - Interactive attendance table showing each student (`ID`, `Nome`, `Status` badge, `% Trim`, `% Ano`) and scrollable lesson date columns (`DD/MM/YY`) with color-coded badges for `P` (Presente), `A` (Atraso/Assistida), `R` (Reposição), `F` (Falta), and `J` (Falta Justificada), plus hover/popover details showing the lesson's **Tema** and **Instrutor**.
  - Import dropzone with **Diff Preview Modal** before confirming a re-import (highlighting new lesson dates, newly enrolled students, and students who will be marked `Inscrição Baixada`).
- **Individual Student Record (`Ficha Particular`):**
  - Slide-over drawer / modal opened by clicking any student row.
  - Shows student header (`ID`, `Nome`, `Ativo` vs. `Inscrição Baixada` badge), attendance summary cards (`% Trim`, `% Ano`, counts of `P`/`A`/`R`/`F`/`J`), detailed per-lesson log (with theme and instructor), and a chronological **Comment Timeline** combining automatic system events (e.g., enrollment drop/re-enrollment notices) and custom professor notes.

### Excel Spreadsheet Format (`Turma Pampulha QUA.xlsx`)
- **Exact Layout Supported:**
  - **Row 1 (`A1`):** City / Branch (e.g., `Belo Horizonte`) — used as a pre-fill hint for Location.
  - **Row 2 (`A2` & `G2+`):** `A2` = Class Name (e.g., `Turma Pampulha (QUA)`); `G2+` = Course name per lesson column (e.g., `Filosofia para viver`).
  - **Row 3 (`A3 = 'Tema'`, `G3+`):** Lesson theme per date column (e.g., `Transpasso Aula 10`, `Tema 9 - Aristóteles`).
  - **Row 4 (`A4 = 'Instrutores'`, `G4+`):** Instructor name per date column (e.g., `Willy Garabini Cornelissen`).
  - **Row 5 (`C5 = '% Presença'`, `G5+`):** Class attendance percentage per lesson date (computed dynamically in the app).
  - **Row 6 (Table Header):** `A6 = 'ID'`, `B6 = count`, `C6 = 'Nome'`, `D6 = 'Status'`, `E6 = '% Trim'`, `F6 = '% Ano'`, `G6+ = Lesson Dates` (`DD/MM/YY`).
  - **Rows 7+ (Student Rows):** Student `ID` in Col `A`, sequential number in Col `B`, `Nome` in Col `C`, initial `Status` in Col `D`, and attendance codes (`P`, `A`, `R`, `F`, `J`) in Cols `G+`.
- **Attendance Formula Parity:**
  - Present codes: `P`, `A`, `R`.
  - Total counted codes: `P`, `A`, `R`, `F`, `J`.
  - `% Trim`: Computed over the 9 most recent lesson columns (`G` through `O`).
  - `% Ano`: Computed over all lesson columns (`G+`).

### Agent's Discretion
- Exact Firestore document/subcollection layout and local state caching strategy (to be detailed in `design.md`).
- Visual layout details of the diff preview modal and student drawer.

### Declined / Undiscussed Gray Areas → Assumptions
- All defaults (re-enrollment behavior if a dropped student reappears in a later `.xlsx`, matching by `ID` from Col `A` first, and pre-filling class name/location from `A2`/`A1`) are logged in `spec.md` under **Assumptions & Open Questions**.

---

## Specific References

- **Reference Web App:** `https://estante.willy.dev.br/` (Vite + React + Firebase Auth/Firestore + GitHub Pages + editorial light/dark CSS).
- **Reference Spreadsheet:** `Turma Pampulha QUA.xlsx` in the repository root.

---

## Deferred Ideas

- None — discussion stayed within feature scope.
