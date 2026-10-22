# Feature Specification: Relatório de Encerramento da Turma

## Problem Statement
Quando uma turma conclui seu ciclo ou é marcada como "Encerrada", coordenadores e professores necessitam de uma visão analítica consolidada do desempenho da turma. Atualmente, a aplicação exibe apenas o status "Encerrada" e a matriz bruta de presenças, sem síntese estatística ou gráficos retrospectivos que evidenciem retenção, frequência por aula, distribuição de ocorrências e assiduidade dos alunos.

## Out of Scope
- Edição de chamadas diretamente a partir dos gráficos do relatório.
- Exportação em formato PDF ou XLSX específico do relatório (pode ser planejado para versão futura).
- Alteração no modelo do Firebase ou schema existente de dados.

## Assumptions & Open Questions
| Assumption | Chosen default | Rationale |
| --- | --- | --- |
| Biblioteca de gráficos | Componentes SVG nativos e responsivos com CSS do tema editorial | Evita conflitos de dependências com React 19 e garante renderização instantânea nos testes JSDOM |
| Disponibilidade do relatório | Acessível via alternador de abas ("Matriz de Chamada" / "Relatório de Encerramento") na tela de detalhes da turma | Permite consulta das métricas tanto para turmas encerradas quanto ativas em acompanhamento |
| Alunos considerados na curva por aula | Alunos ativos na turma no momento do cálculo | Mantém paridade com as métricas já calculadas em `attendanceCalc.ts` |

Open questions: none

## User Stories

### US-01: Consolidação Estatística de Encerramento
Como coordenador pedagógico, quero que o sistema calcule automaticamente os indicadores finais de retenção, frequência e ocorrências da turma para embasar a análise do encerramento.

**Acceptance Criteria**:
1. When a turma and its student records are provided, the calculation engine shall compute total students, active count, dropped count, retention rate percentage, and average global attendance percentage.
2. When lesson presence rates are requested, the calculation engine shall compute chronological attendance rate percentages for each lesson.
3. When attendance occurrences are aggregated, the calculation engine shall sum counts and percentage distribution for codes P, A, R, F, and J.
4. When student final attendance tiers are aggregated, the calculation engine shall group students into tiers: >=90%, 75-89%, 50-74%, and <50%.
5. When lessons have instructors specified, the calculation engine shall compute average attendance grouped by instructor.

### US-02: Visualização de Gráficos e KPIs no Relatório
Como professor ou coordenador, quero visualizar gráficos interativos e cards de KPIs para compreender visualmente o ciclo da turma.

**Acceptance Criteria**:
1. When the Relatório de Encerramento is displayed, the UI shall render KPI summary cards showing retention rate, global attendance average, total lessons, and count of replacements/justifications.
2. When the report is rendered, the UI shall display a Donut chart showing active students versus dropped enrollments.
3. When the report is rendered, the UI shall display an Attendance Curve line chart showing presence percentage across lessons with theme/date tooltips.
4. When the report is rendered, the UI shall display an Occurrences Distribution chart showing counts of P, A, R, F, and J.
5. When the report is rendered, the UI shall display a Attendance Tiers histogram chart grouping students by final attendance percentage.
6. When the report is rendered, the UI shall display an Instructor Performance bar chart showing average attendance rate per instructor.
7. Where a class has dropped students, the UI shall display a timeline showing cumulative drop progression across lesson dates.

### US-03: Navegação e Acesso na Tela da Turma
Como usuário visualizando a turma, quero alternar entre a matriz de chamadas e o relatório de encerramento facilmente.

**Acceptance Criteria**:
1. When viewing a turma detail page, the UI shall present tab buttons to switch between "Matriz de Chamada" and "Relatório de Encerramento".
2. While a class status is Encerrada, the UI shall highlight the availability of the Relatório de Encerramento.

## Requirement Traceability
| Requirement ID | User Story | Description | Status |
| --- | --- | --- | --- |
| ENCERR-01 | US-01 | Funções de cálculo estatístico e agregação de métricas para encerramento | verified |
| ENCERR-02 | US-02 | Componentes visuais dos gráficos e cards de KPIs do relatório | pending |
| ENCERR-03 | US-03 | Integração de navegação e alternância de abas em TurmaDetailView | pending |
