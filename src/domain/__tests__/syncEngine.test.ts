import { describe, it, expect } from 'vitest';
import { computeReimportPlan, formatDatePtBr } from '../syncEngine';
import type { AlunoRecord, ParsedChamada, Turma } from '../types';

function makeBaseTurma(): Turma {
  return {
    id: 'turma-pampulha-qua',
    nome: 'Turma Pampulha (QUA)',
    diaHorario: 'Quarta-feira, 19h30',
    local: 'Pampulha - Belo Horizonte',
    catedras: ['Filosofia para Viver', 'Transpasso'],
    cidadePlanilha: 'Belo Horizonte',
    status: 'Ativa',
    lessons: [
      {
        dateKey: '14/10/26',
        isoDate: '2026-10-14',
        course: 'Filosofia para viver',
        theme: 'Transpasso Aula 10',
        instructor: 'Willy Garabini Cornelissen',
      },
      {
        dateKey: '07/10/26',
        isoDate: '2026-10-07',
        course: 'Filosofia para viver',
        theme: 'Transpasso Aula 9',
        instructor: 'Willy Garabini Cornelissen',
      },
    ],
    comentarios: [],
    activeStudentsCount: 3,
    droppedStudentsCount: 0,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-14T22:00:00.000Z',
  };
}

function makeExistingStudents(): AlunoRecord[] {
  return [
    {
      studentKey: '14820',
      externalId: '14820',
      sequencia: 1,
      nome: 'Claudia Marcia Marques (Sala Pampulha)',
      status: 'Ativo',
      presencas: { '07/10/26': 'P', '14/10/26': 'F' },
      comentarios: [
        {
          id: 'c-prof-1',
          authorType: 'professor',
          text: 'Avisou que estava gripada.',
          createdAt: '2026-10-14T23:00:00.000Z',
        },
      ],
      enrolledAt: '2026-01-28T10:00:00.000Z',
      updatedAt: '2026-10-14T22:00:00.000Z',
    },
    {
      studentKey: '7728',
      externalId: '7728',
      sequencia: 2,
      nome: 'Lucas Selani de Melo (Sala Pampulha)',
      status: 'Ativo',
      presencas: { '07/10/26': 'P', '14/10/26': 'P' },
      comentarios: [],
      enrolledAt: '2026-01-28T10:00:00.000Z',
      updatedAt: '2026-10-14T22:00:00.000Z',
    },
    {
      studentKey: '14779',
      externalId: '14779',
      sequencia: 3,
      nome: 'Maria Regina de Araujo Borges (Sala Pampulha)',
      status: 'Ativo',
      presencas: { '07/10/26': 'F', '14/10/26': 'P' },
      comentarios: [],
      enrolledAt: '2026-01-28T10:00:00.000Z',
      updatedAt: '2026-10-14T22:00:00.000Z',
    },
  ];
}

describe('domain/syncEngine', () => {
  it('formats ISO and DD/MM/YY strings into DD/MM/AAAA', () => {
    expect(formatDatePtBr('2026-10-21T19:30:00.000Z')).toBe('21/10/2026');
    expect(formatDatePtBr('2026-01-05')).toBe('05/01/2026');
    expect(formatDatePtBr('14/10/26')).toBe('14/10/2026');
  });

  it('merges new lesson dates, updates student display name by ID, adds new students, and transitions missing active student to Inscrição Baixada with dated comment (XLSX-03, XLSX-04, SYNC-02)', () => {
    const turma = makeBaseTurma();
    const existingStudents = makeExistingStudents();

    // Lucas (7728) is removed; Claudia (14820) has updated room suffix; Ana (15900) is newly enrolled; new lesson 21/10/26 added
    const parsed: ParsedChamada = {
      cidadePlanilha: 'Belo Horizonte',
      nomeTurmaPlanilha: 'Turma Pampulha (QUA)',
      lessons: [
        {
          dateKey: '21/10/26',
          isoDate: '2026-10-21',
          course: 'Filosofia para viver',
          theme: 'Transpasso Aula 11',
          instructor: 'Willy Garabini Cornelissen',
        },
        {
          dateKey: '14/10/26',
          isoDate: '2026-10-14',
          course: 'Filosofia para viver',
          theme: 'Transpasso Aula 10',
          instructor: 'Willy Garabini Cornelissen',
        },
        {
          dateKey: '07/10/26',
          isoDate: '2026-10-07',
          course: 'Filosofia para viver',
          theme: 'Transpasso Aula 9',
          instructor: 'Willy Garabini Cornelissen',
        },
      ],
      students: [
        {
          studentKey: '14820',
          externalId: '14820',
          sequencia: 1,
          nome: 'Claudia Marcia Marques (Auditório)',
          rawStatus: 'Ativo',
          presencas: { '07/10/26': 'P', '14/10/26': 'J', '21/10/26': 'P' },
        },
        {
          studentKey: '14779',
          externalId: '14779',
          sequencia: 2,
          nome: 'Maria Regina de Araujo Borges (Sala Pampulha)',
          rawStatus: 'Ativo',
          presencas: { '07/10/26': 'F', '14/10/26': 'P', '21/10/26': 'P' },
        },
        {
          studentKey: '15900',
          externalId: '15900',
          sequencia: 3,
          nome: 'Ana Carolina Souza',
          rawStatus: 'Ativo',
          presencas: { '21/10/26': 'P' },
        },
      ],
    };

    const plan = computeReimportPlan(
      turma,
      existingStudents,
      parsed,
      '2026-10-21T22:30:00.000Z'
    );

    // Verify diff summary
    expect(plan.diffSummary.addedLessonDates).toEqual(['21/10/26']);
    expect(plan.diffSummary.updatedLessonDates).toEqual(['14/10/26']);
    expect(plan.diffSummary.newStudents).toEqual([
      {
        studentKey: '15900',
        externalId: '15900',
        nome: 'Ana Carolina Souza',
      },
    ]);
    expect(plan.diffSummary.droppedStudents).toEqual([
      {
        studentKey: '7728',
        externalId: '7728',
        nome: 'Lucas Selani de Melo (Sala Pampulha)',
      },
    ]);
    expect(plan.diffSummary.reenrolledStudents).toEqual([]);
    expect(plan.diffSummary.unchangedActiveCount).toBe(2);
    expect(plan.diffSummary.alreadyDroppedCount).toBe(0);

    expect(plan.activeStudentsCount).toBe(3);
    expect(plan.droppedStudentsCount).toBe(1);

    // Lessons sorted newest first
    expect(plan.updatedLessons.map((l) => l.dateKey)).toEqual([
      '21/10/26',
      '14/10/26',
      '07/10/26',
    ]);

    // Check Claudia (14820): name updated, attendance updated, professor comment preserved
    const claudia = plan.updatedStudents.find((s) => s.studentKey === '14820')!;
    expect(claudia.nome).toBe('Claudia Marcia Marques (Auditório)');
    expect(claudia.status).toBe('Ativo');
    expect(claudia.presencas).toEqual({
      '07/10/26': 'P',
      '14/10/26': 'J',
      '21/10/26': 'P',
    });
    expect(claudia.comentarios).toHaveLength(1);
    expect(claudia.comentarios[0].text).toBe('Avisou que estava gripada.');

    // Check Lucas (7728): marked as Inscrição Baixada, prior attendance preserved, system comment added
    const lucas = plan.updatedStudents.find((s) => s.studentKey === '7728')!;
    expect(lucas.status).toBe('Inscrição Baixada');
    expect(lucas.droppedAt).toBe('2026-10-21T22:30:00.000Z');
    expect(lucas.presencas).toEqual({
      '07/10/26': 'P',
      '14/10/26': 'P',
    });
    expect(lucas.comentarios).toHaveLength(1);
    expect(lucas.comentarios[0]).toMatchObject({
      authorType: 'sistema',
      text: 'Inscrição baixada: aluno não consta na planilha importada em 21/10/2026.',
      createdAt: '2026-10-21T22:30:00.000Z',
    });

    // Check Ana (15900): newly added
    const ana = plan.updatedStudents.find((s) => s.studentKey === '15900')!;
    expect(ana.status).toBe('Ativo');
    expect(ana.presencas).toEqual({ '21/10/26': 'P' });
    expect(ana.enrolledAt).toBe('2026-10-21T22:30:00.000Z');
  });

  it('does NOT duplicate automatic drop comment when an already Inscrição Baixada student remains absent in later imports (XLSX-03 AC 4)', () => {
    const turma = makeBaseTurma();
    const existingStudents = makeExistingStudents();

    const parsedWithoutLucas: ParsedChamada = {
      cidadePlanilha: 'Belo Horizonte',
      nomeTurmaPlanilha: 'Turma Pampulha (QUA)',
      lessons: turma.lessons,
      students: [
        {
          studentKey: '14820',
          externalId: '14820',
          sequencia: 1,
          nome: 'Claudia Marcia Marques (Sala Pampulha)',
          rawStatus: 'Ativo',
          presencas: { '07/10/26': 'P', '14/10/26': 'F' },
        },
        {
          studentKey: '14779',
          externalId: '14779',
          sequencia: 2,
          nome: 'Maria Regina de Araujo Borges (Sala Pampulha)',
          rawStatus: 'Ativo',
          presencas: { '07/10/26': 'F', '14/10/26': 'P' },
        },
      ],
    };

    const firstPlan = computeReimportPlan(
      turma,
      existingStudents,
      parsedWithoutLucas,
      '2026-10-21T10:00:00.000Z'
    );

    const secondPlan = computeReimportPlan(
      { ...turma, lessons: firstPlan.updatedLessons },
      firstPlan.updatedStudents,
      parsedWithoutLucas,
      '2026-10-28T10:00:00.000Z'
    );

    expect(secondPlan.diffSummary.droppedStudents).toEqual([]);
    expect(secondPlan.diffSummary.alreadyDroppedCount).toBe(1);

    const lucasAfterSecond = secondPlan.updatedStudents.find(
      (s) => s.studentKey === '7728'
    )!;
    expect(lucasAfterSecond.status).toBe('Inscrição Baixada');
    expect(lucasAfterSecond.droppedAt).toBe('2026-10-21T10:00:00.000Z');
    expect(lucasAfterSecond.comentarios).toHaveLength(1);
    expect(lucasAfterSecond.comentarios[0].text).toBe(
      'Inscrição baixada: aluno não consta na planilha importada em 21/10/2026.'
    );
  });

  it('restores a previously Inscrição Baixada student back to Ativo with a re-enrollment system comment when they reappear (XLSX-03 AC 5)', () => {
    const turma = makeBaseTurma();
    const existingWithDroppedLucas: AlunoRecord[] = makeExistingStudents().map(
      (s) =>
        s.studentKey === '7728'
          ? {
              ...s,
              status: 'Inscrição Baixada',
              droppedAt: '2026-10-21T10:00:00.000Z',
              comentarios: [
                {
                  id: 'sys-drop-7728',
                  authorType: 'sistema',
                  text: 'Inscrição baixada: aluno não consta na planilha importada em 21/10/2026.',
                  createdAt: '2026-10-21T10:00:00.000Z',
                },
              ],
            }
          : s
    );

    const parsedLucasReturns: ParsedChamada = {
      cidadePlanilha: 'Belo Horizonte',
      nomeTurmaPlanilha: 'Turma Pampulha (QUA)',
      lessons: [
        {
          dateKey: '28/10/26',
          isoDate: '2026-10-28',
          course: 'Filosofia para viver',
          theme: 'Transpasso Aula 12',
          instructor: 'Willy Garabini Cornelissen',
        },
        ...turma.lessons,
      ],
      students: [
        {
          studentKey: '14820',
          externalId: '14820',
          sequencia: 1,
          nome: 'Claudia Marcia Marques (Sala Pampulha)',
          rawStatus: 'Ativo',
          presencas: { '07/10/26': 'P', '14/10/26': 'F', '28/10/26': 'P' },
        },
        {
          studentKey: '7728',
          externalId: '7728',
          sequencia: 2,
          nome: 'Lucas Selani de Melo (Sala Pampulha)',
          rawStatus: 'Ativo',
          presencas: { '07/10/26': 'P', '14/10/26': 'P', '28/10/26': 'R' },
        },
        {
          studentKey: '14779',
          externalId: '14779',
          sequencia: 3,
          nome: 'Maria Regina de Araujo Borges (Sala Pampulha)',
          rawStatus: 'Ativo',
          presencas: { '07/10/26': 'F', '14/10/26': 'P', '28/10/26': 'P' },
        },
      ],
    };

    const plan = computeReimportPlan(
      turma,
      existingWithDroppedLucas,
      parsedLucasReturns,
      '2026-10-28T22:00:00.000Z'
    );

    expect(plan.diffSummary.reenrolledStudents).toEqual([
      {
        studentKey: '7728',
        externalId: '7728',
        nome: 'Lucas Selani de Melo (Sala Pampulha)',
      },
    ]);
    expect(plan.activeStudentsCount).toBe(3);
    expect(plan.droppedStudentsCount).toBe(0);

    const lucas = plan.updatedStudents.find((s) => s.studentKey === '7728')!;
    expect(lucas.status).toBe('Ativo');
    expect(lucas.droppedAt).toBeUndefined();
    expect(lucas.presencas['28/10/26']).toBe('R');
    expect(lucas.comentarios).toHaveLength(2);
    expect(lucas.comentarios[1]).toMatchObject({
      authorType: 'sistema',
      text: 'Inscrição reativada: aluno voltou a constar na planilha importada em 28/10/2026.',
      createdAt: '2026-10-28T22:00:00.000Z',
    });
  });

  it('matches students without external ID by normalized name slug without creating duplicates (XLSX-03 AC 2)', () => {
    const turma = makeBaseTurma();
    const existingNoId: AlunoRecord[] = [
      {
        studentKey: 'nome:joao-da-silva',
        externalId: '',
        sequencia: 1,
        nome: 'João da Silva',
        status: 'Ativo',
        presencas: { '07/10/26': 'P', '14/10/26': 'P' },
        comentarios: [],
        enrolledAt: '2026-01-28T10:00:00.000Z',
        updatedAt: '2026-10-14T22:00:00.000Z',
      },
    ];

    const parsed: ParsedChamada = {
      cidadePlanilha: 'Belo Horizonte',
      nomeTurmaPlanilha: 'Turma Pampulha (QUA)',
      lessons: turma.lessons,
      students: [
        {
          studentKey: '',
          externalId: '',
          sequencia: 1,
          nome: '  Joao da Silva  ',
          rawStatus: 'Ativo',
          presencas: { '07/10/26': 'P', '14/10/26': 'A' },
        },
      ],
    };

    const plan = computeReimportPlan(
      turma,
      existingNoId,
      parsed,
      '2026-10-15T10:00:00.000Z'
    );

    expect(plan.diffSummary.newStudents).toEqual([]);
    expect(plan.diffSummary.droppedStudents).toEqual([]);
    expect(plan.updatedStudents).toHaveLength(1);
    expect(plan.updatedStudents[0].presencas['14/10/26']).toBe('A');
  });
});
