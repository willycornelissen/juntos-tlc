# Tasks: Relatório de Encerramento da Turma

## Test Coverage Matrix
| Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domain (`src/domain/*`) | unit | Todas as funções de cálculo de estatísticas e agregações | `src/domain/__tests__/*.test.ts` | `npm run test:run` |
| UI Components (`src/components/*`) | component | Renderização de cards, gráficos SVG e comportamento de abas | `src/components/__tests__/*.test.tsx` | `npm run test:run` |

## Gate Check Commands
| Gate Level | When to Use | Command |
| --- | --- | --- |
| Unit | Após tarefas de domínio | `npm run test:run` |
| Full | Após tarefas de componentes e integração | `npm run test:run` |

## Execution Plan
### Phase 1: Implementation Pipeline
```
T1 -> T2 -> T3
```

## Task Breakdown

### T1: Implementar motor de cálculo de estatísticas de encerramento
**What**: Desenvolver funções puras em `src/domain/relatorioEncerramento.ts` para calcular:
- KPIs: total de alunos, concluintes ativos, baixados, taxa de retenção, taxa média de presença, total de aulas, total de reposições (R), total de faltas justificadas (J) e total de faltas (F).
- Curva de presença por aula (cronológica com taxa de presença, tema e instrutor).
- Distribuição de ocorrências de chamada (P, A, R, F, J) com contagens e percentuais.
- Histograma de faixas de assiduidade final (>=90%, 75-89%, 50-74%, <50%).
- Média de presença por instrutor.
- Evolução de evasão/baixas ao longo das aulas.
**Where**: `src/domain/relatorioEncerramento.ts`
**Depends on**: None
**Tests**: `src/domain/__tests__/relatorioEncerramento.test.ts`
**Gate**: `npm run test:run`

### T2: Implementar componente visual do Relatório de Encerramento com gráficos
**What**: Criar `src/components/RelatorioEncerramentoView.tsx` renderizando:
- Grade de cards com os principais KPIs executivos.
- Gráfico Donut de Conclusão vs. Evasão.
- Gráfico de Linha da Curva de Presença por Aula com média de referência e tooltip informativo.
- Gráfico de Barras da Distribuição Geral de Ocorrências (P, A, R, F, J).
- Gráfico Histograma de Faixas de Assiduidade dos Alunos.
- Gráfico de Barras de Frequência por Instrutor.
- Gráfico de Linha da Progressão de Evasão por data de aula (quando houver alunos baixados).
- Estilo alinhado com o design editorial existente.
**Where**: `src/components/RelatorioEncerramentoView.tsx`
**Depends on**: T1
**Tests**: `src/components/__tests__/RelatorioEncerramentoView.test.tsx`
**Gate**: `npm run test:run`

### T3: Integrar abas de navegação e visualização em TurmaDetailView
**What**: Atualizar `src/components/TurmaDetailView.tsx` para:
- Adicionar controle de abas: "Matriz de Chamada" e "Relatório de Encerramento".
- Exibir badge ou destaque visual no botão de relatório quando a turma estiver com status "Encerrada".
- Renderizar `RelatorioEncerramentoView` quando a aba correspondente estiver ativa.
- Manter suporte a todos os fluxos existentes (filtros, busca, reabertura, encerramento).
**Where**: `src/components/TurmaDetailView.tsx`
**Depends on**: T2
**Tests**: `src/components/__tests__/TurmaDetailView.test.tsx`
**Gate**: `npm run test:run`
