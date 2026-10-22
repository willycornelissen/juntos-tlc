import { describe, expect, it } from 'vitest';
import type { AlunoRecord, LessonColumn, Turma } from '../types';
import {
  computeRelatorioEncerramento,
  type RelatorioEncerramentoData,
} from '../relatorioEncerramento';

describe('domain/relatorioEncerramento', () => {
  const sampleLessons: LessonColumn[] = [
    {
      dateKey: '01/03/26',
      isoDate: '2026-03-01',
      course: 'Filosofia',
      theme: 'Ética e Moral',
      instructor: 'Prof. João',
    },
    {
      dateKey: '08/03/26',
      isoDate: '2026-03-08',
      course: 'Filosofia',
      theme: 'O Mito da Caverna',
      instructor: 'Profa. Maria',
    },
    {
      dateKey: '15/03/26',
      isoDate: '2026-03-15',
      course: 'Filosofia',
      theme: 'Sêneca e Estoicismo',
      instructor: 'Prof. João',
    },
    {
      dateKey: '22/03/26',
      isoDate: '2026-03-22',
      course: 'Filosofia',
      theme: 'Encerramento do Ciclo',
      instructor: 'Profa. Maria',
    },
  ];

  const sampleAlunos: AlunoRecord[] = [
    {
      studentKey: 'aluno-1',
      externalId: '101',
      nome: 'Ana Silva',
      status: 'Ativo',
      presencas: {
        '01/03/26': 'P',
        '08/03/26': 'P',
        '15/03/26': 'R',
        '22/03/26': 'P',
      },
      comentarios: [],
      enrolledAt: '2026-02-15T00:00:00Z',
      updatedAt: '2026-03-22T00:00:00Z',
    },
    {
      studentKey: 'aluno-2',
      externalId: '102',
      nome: 'Bruno Souza',
      status: 'Ativo',
      presencas: {
        '01/03/26': 'P',
        '08/03/26': 'F',
        '15/03/26': 'J',
        '22/03/26': 'A',
      },
      comentarios: [],
      enrolledAt: '2026-02-15T00:00:00Z',
      updatedAt: '2026-03-22T00:00:00Z',
    },
    {
      studentKey: 'aluno-3',
      externalId: '103',
      nome: 'Carla Dias',
      status: 'Inscrição Baixada',
      presencas: {
        '01/03/26': 'P',
        '08/03/26': 'F',
      },
      comentarios: [],
      enrolledAt: '2026-02-15T00:00:00Z',
      droppedAt: '2026-03-10T00:00:00Z',
      updatedAt: '2026-03-10T00:00:00Z',
    },
    {
      studentKey: 'aluno-4',
      externalId: '104',
      nome: 'Diego Lima',
      status: 'Inscrição Baixada',
      presencas: {
        '01/03/26': 'F',
      },
      comentarios: [],
      enrolledAt: '2026-02-15T00:00:00Z',
      droppedAt: '2026-03-02T00:00:00Z',
      updatedAt: '2026-03-02T00:00:00Z',
    },
  ];

  const sampleTurma: Turma = {
    id: 'turma-teste-1',
    nome: 'Turma Filosofia 2026',
    diaHorario: 'Quarta 19:30',
    local: 'Sala 1',
    catedras: ['Filosofia para viver'],
    status: 'Encerrada',
    lessons: sampleLessons,
    comentarios: [],
    activeStudentsCount: 2,
    droppedStudentsCount: 2,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-03-22T00:00:00Z',
    closedAt: '2026-03-23T00:00:00Z',
  };

  it('computes executive KPIs correctly (total, retention, global attendance, occurrences)', () => {
    const report: RelatorioEncerramentoData = computeRelatorioEncerramento(
      sampleTurma,
      sampleAlunos
    );

    expect(report.kpis.totalAlunos).toBe(4);
    expect(report.kpis.activeStudentsCount).toBe(2);
    expect(report.kpis.droppedStudentsCount).toBe(2);
    expect(report.kpis.retentionRate).toBe(50); // 2 / 4 = 50%
    expect(report.kpis.totalLessons).toBe(4);
    expect(report.kpis.totalPresents).toBe(5); // Ana: 3, Bruno: 1, Carla: 1
    expect(report.kpis.totalLates).toBe(1); // Bruno: 1
    expect(report.kpis.totalReplacements).toBe(1); // Ana: 1
    expect(report.kpis.totalAbsences).toBe(3); // Bruno: 1, Carla: 1, Diego: 1
    expect(report.kpis.totalJustified).toBe(1); // Bruno: 1
    expect(report.kpis.averageAttendanceRate).toBeGreaterThan(0);
  });

  it('computes lesson presence curve in chronological order', () => {
    const report = computeRelatorioEncerramento(sampleTurma, sampleAlunos);

    expect(report.curvaAulas).toHaveLength(4);
    expect(report.curvaAulas[0].isoDate).toBe('2026-03-01');
    expect(report.curvaAulas[0].instructor).toBe('Prof. João');
    expect(report.curvaAulas[0].theme).toBe('Ética e Moral');
    // Aula 1: Ana=P, Bruno=P (ativos) -> 2/2 = 100%
    expect(report.curvaAulas[0].presenceRate).toBe(100);

    // Aula 2: Ana=P, Bruno=F -> 1/2 = 50%
    expect(report.curvaAulas[1].isoDate).toBe('2026-03-08');
    expect(report.curvaAulas[1].presenceRate).toBe(50);

    // Aula 3: Ana=R, Bruno=J -> 1/2 = 50%
    expect(report.curvaAulas[2].isoDate).toBe('2026-03-15');
    expect(report.curvaAulas[2].presenceRate).toBe(50);

    // Aula 4: Ana=P, Bruno=A -> 2/2 = 100%
    expect(report.curvaAulas[3].isoDate).toBe('2026-03-22');
    expect(report.curvaAulas[3].presenceRate).toBe(100);
  });

  it('aggregates occurrence distribution across all codes (P, A, R, F, J)', () => {
    const report = computeRelatorioEncerramento(sampleTurma, sampleAlunos);

    const codes = report.ocorrencias.map((o) => o.code);
    expect(codes).toEqual(['P', 'A', 'R', 'F', 'J']);

    const totalCount = report.ocorrencias.reduce((acc, o) => acc + o.count, 0);
    expect(totalCount).toBe(11); // 5 + 1 + 1 + 3 + 1

    const sumPercentages = report.ocorrencias.reduce(
      (acc, o) => acc + o.percentage,
      0
    );
    expect(Math.round(sumPercentages)).toBe(100);
  });

  it('groups students into attendance tiers (histogram)', () => {
    const report = computeRelatorioEncerramento(sampleTurma, sampleAlunos);

    expect(report.faixasAssiduidade).toHaveLength(4);
    const tierLabels = report.faixasAssiduidade.map((f) => f.label);
    expect(tierLabels).toEqual([
      '≥ 90% (Excelente)',
      '75% – 89% (Adequado)',
      '50% – 74% (Atenção)',
      '< 50% (Crítico)',
    ]);

    // Active students: Ana = 100% (≥90%), Bruno = 50% (50-74%)
    const tier90 = report.faixasAssiduidade.find((f) => f.min === 90);
    const tier50 = report.faixasAssiduidade.find((f) => f.min === 50);
    expect(tier90?.count).toBe(1);
    expect(tier50?.count).toBe(1);
  });

  it('computes average presence by instructor', () => {
    const report = computeRelatorioEncerramento(sampleTurma, sampleAlunos);

    expect(report.mediaInstrutores.length).toBeGreaterThanOrEqual(2);
    const joao = report.mediaInstrutores.find((i) => i.instructor === 'Prof. João');
    const maria = report.mediaInstrutores.find((i) => i.instructor === 'Profa. Maria');

    expect(joao).toBeDefined();
    expect(maria).toBeDefined();
    expect(joao?.lessonCount).toBe(2);
    expect(maria?.lessonCount).toBe(2);
    // João: aula 1 (100%), aula 3 (50%) -> avg = 75%
    expect(joao?.averageRate).toBe(75);
    // Maria: aula 2 (50%), aula 4 (100%) -> avg = 75%
    expect(maria?.averageRate).toBe(75);
  });

  it('computes cumulative drop evolution across dates', () => {
    const report = computeRelatorioEncerramento(sampleTurma, sampleAlunos);

    expect(report.evolucaoEvasao.length).toBeGreaterThan(0);
    const lastDropEntry = report.evolucaoEvasao[report.evolucaoEvasao.length - 1];
    expect(lastDropEntry.droppedCountCumulative).toBe(2);
    expect(lastDropEntry.activeCountRemaining).toBe(2);
  });

  it('handles empty turma with no lessons gracefully', () => {
    const emptyTurma: Turma = {
      ...sampleTurma,
      lessons: [],
      activeStudentsCount: 0,
      droppedStudentsCount: 0,
    };
    const report = computeRelatorioEncerramento(emptyTurma, []);

    expect(report.kpis.totalAlunos).toBe(0);
    expect(report.kpis.retentionRate).toBeNull();
    expect(report.kpis.averageAttendanceRate).toBeNull();
    expect(report.curvaAulas).toEqual([]);
    expect(report.mediaInstrutores).toEqual([]);
    expect(report.evolucaoEvasao).toEqual([]);
  });
});
