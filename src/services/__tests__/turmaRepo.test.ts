import { describe, it, expect, beforeEach } from 'vitest';
import {
  addAlunoComment,
  addTurmaComment,
  applyReimportPlan,
  chunkArray,
  createTurmaFromImport,
  getTurmaWithAlunos,
  listTurmas,
  resetLocalStoreForTests,
  setTurmaStatus,
  updateTurmaMetadata,
} from '../turmaRepo';
import { computeReimportPlan } from '../../domain/syncEngine';
import type { ParsedChamada } from '../../domain/types';

function makeSampleParsedChamada(): ParsedChamada {
  return {
    cidadePlanilha: 'Belo Horizonte',
    nomeTurmaPlanilha: 'Turma Pampulha (QUA)',
    lessons: [
      {
        dateKey: '07/10/26',
        isoDate: '2026-10-07',
        course: 'Filosofia para viver',
        theme: 'Transpasso Aula 9',
        instructor: 'Willy Garabini Cornelissen',
      },
      {
        dateKey: '14/10/26',
        isoDate: '2026-10-14',
        course: 'Filosofia para viver',
        theme: 'Transpasso Aula 10',
        instructor: 'Willy Garabini Cornelissen',
      },
    ],
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
        studentKey: '7728',
        externalId: '7728',
        sequencia: 2,
        nome: 'Lucas Selani de Melo (Sala Pampulha)',
        rawStatus: 'Ativo',
        presencas: { '07/10/26': 'P', '14/10/26': 'P' },
      },
    ],
  };
}

describe('services/turmaRepo', () => {
  beforeEach(() => {
    resetLocalStoreForTests();
  });

  it('chunks large operation arrays into batches of at most 450 items (SYNC-01, Edge Case 5)', () => {
    const items = Array.from({ length: 1000 }, (_, i) => i + 1);
    const chunks = chunkArray(items);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(450);
    expect(chunks[1]).toHaveLength(450);
    expect(chunks[2]).toHaveLength(100);
    expect(chunks.flat()).toEqual(items);
  });

  it('creates a turma with initial spreadsheet import and persists students with status Ativo (TURMA-01 AC 2)', async () => {
    const parsed = makeSampleParsedChamada();
    const { turma, alunos } = await createTurmaFromImport(
      'uid-prof-1',
      {
        nome: 'Turma Pampulha (QUA)',
        diaHorario: 'Quarta-feira, 19h30',
        local: 'Pampulha - Belo Horizonte',
        catedras: ['Filosofia para Viver', 'Transpasso'],
      },
      parsed,
      '2026-10-14T22:00:00.000Z'
    );

    expect(turma.nome).toBe('Turma Pampulha (QUA)');
    expect(turma.status).toBe('Ativa');
    expect(turma.activeStudentsCount).toBe(2);
    expect(turma.droppedStudentsCount).toBe(0);
    expect(turma.lessons.map((l) => l.dateKey)).toEqual([
      '14/10/26',
      '07/10/26',
    ]);
    expect(alunos).toHaveLength(2);
    expect(alunos.every((a) => a.status === 'Ativo')).toBe(true);

    const fetched = await getTurmaWithAlunos('uid-prof-1', turma.id);
    expect(fetched.turma).toEqual(turma);
    expect(fetched.alunos).toEqual(alunos);
  });

  it('isolates turmas by professor uid so one professor cannot see another professor classes (AUTH-01 AC 2)', async () => {
    const parsed = makeSampleParsedChamada();
    await createTurmaFromImport(
      'uid-prof-a',
      {
        nome: 'Turma do Professor A',
        diaHorario: 'Segunda, 19h',
        local: 'Savassi',
        catedras: ['Ética'],
      },
      parsed
    );
    await createTurmaFromImport(
      'uid-prof-b',
      {
        nome: 'Turma do Professor B',
        diaHorario: 'Terça, 20h',
        local: 'Pampulha',
        catedras: ['História da Filosofia'],
      },
      parsed
    );

    const turmasA = await listTurmas('uid-prof-a');
    const turmasB = await listTurmas('uid-prof-b');

    expect(turmasA).toHaveLength(1);
    expect(turmasA[0].nome).toBe('Turma do Professor A');
    expect(turmasB).toHaveLength(1);
    expect(turmasB[0].nome).toBe('Turma do Professor B');
  });

  it('rejects turma creation or metadata update when required fields are blank (TURMA-01, TURMA-02)', async () => {
    const parsed = makeSampleParsedChamada();
    await expect(
      createTurmaFromImport(
        'uid-prof-1',
        {
          nome: '   ',
          diaHorario: 'Quarta, 19h30',
          local: 'Pampulha',
          catedras: ['Filosofia'],
        },
        parsed
      )
    ).rejects.toThrow('Informe o nome da turma.');
  });

  it('updates turma metadata without altering student records or attendance history (TURMA-02 AC 1)', async () => {
    const parsed = makeSampleParsedChamada();
    const { turma, alunos } = await createTurmaFromImport(
      'uid-prof-1',
      {
        nome: 'Turma Pampulha (QUA)',
        diaHorario: 'Quarta-feira, 19h30',
        local: 'Pampulha',
        catedras: ['Filosofia para Viver'],
      },
      parsed,
      '2026-10-14T22:00:00.000Z'
    );

    const updated = await updateTurmaMetadata(
      'uid-prof-1',
      turma.id,
      {
        nome: 'Turma Pampulha Noite',
        diaHorario: 'Quarta-feira, 20h00',
        local: 'Pampulha - Sala 2',
        catedras: ['Filosofia para Viver', 'Psicologia'],
      },
      '2026-10-15T10:00:00.000Z'
    );

    expect(updated.nome).toBe('Turma Pampulha Noite');
    expect(updated.diaHorario).toBe('Quarta-feira, 20h00');
    expect(updated.local).toBe('Pampulha - Sala 2');
    expect(updated.catedras).toEqual(['Filosofia para Viver', 'Psicologia']);

    const afterEdit = await getTurmaWithAlunos('uid-prof-1', turma.id);
    expect(afterEdit.alunos).toEqual(alunos);
  });

  it('applies a re-import plan on an active turma and persists dropped student status and system comment (XLSX-03, XLSX-04)', async () => {
    const parsed = makeSampleParsedChamada();
    const { turma, alunos } = await createTurmaFromImport(
      'uid-prof-1',
      {
        nome: 'Turma Pampulha (QUA)',
        diaHorario: 'Quarta-feira, 19h30',
        local: 'Pampulha',
        catedras: ['Filosofia para Viver'],
      },
      parsed,
      '2026-10-14T22:00:00.000Z'
    );

    const nextParsed: ParsedChamada = {
      ...parsed,
      lessons: [
        {
          dateKey: '21/10/26',
          isoDate: '2026-10-21',
          course: 'Filosofia para viver',
          theme: 'Transpasso Aula 11',
          instructor: 'Willy Garabini Cornelissen',
        },
        ...parsed.lessons,
      ],
      students: [
        {
          studentKey: '14820',
          externalId: '14820',
          sequencia: 1,
          nome: 'Claudia Marcia Marques (Sala Pampulha)',
          rawStatus: 'Ativo',
          presencas: { '07/10/26': 'P', '14/10/26': 'F', '21/10/26': 'P' },
        },
      ],
    };

    const plan = computeReimportPlan(
      turma,
      alunos,
      nextParsed,
      '2026-10-21T22:00:00.000Z'
    );

    const applied = await applyReimportPlan(
      'uid-prof-1',
      turma.id,
      plan,
      '2026-10-21T22:00:00.000Z'
    );

    expect(applied.turma.activeStudentsCount).toBe(1);
    expect(applied.turma.droppedStudentsCount).toBe(1);
    expect(applied.turma.lessons).toHaveLength(3);

    const lucas = applied.alunos.find((a) => a.studentKey === '7728')!;
    expect(lucas.status).toBe('Inscrição Baixada');
    expect(lucas.comentarios[0].text).toBe(
      'Inscrição baixada: aluno não consta na planilha importada em 21/10/2026.'
    );
  });

  it('closes a turma with a closing comment, blocks re-imports while Encerrada, and allows reopening (TURMA-03 AC 1, 2)', async () => {
    const parsed = makeSampleParsedChamada();
    const { turma, alunos } = await createTurmaFromImport(
      'uid-prof-1',
      {
        nome: 'Turma Pampulha (QUA)',
        diaHorario: 'Quarta-feira, 19h30',
        local: 'Pampulha',
        catedras: ['Filosofia para Viver'],
      },
      parsed,
      '2026-10-14T22:00:00.000Z'
    );

    const closed = await setTurmaStatus(
      'uid-prof-1',
      turma.id,
      'Encerrada',
      'Ciclo de aulas concluído com excelente participação.',
      '2026-12-10T22:00:00.000Z'
    );

    expect(closed.status).toBe('Encerrada');
    expect(closed.closedAt).toBe('2026-12-10T22:00:00.000Z');
    expect(closed.comentarios).toHaveLength(1);
    expect(closed.comentarios[0]).toMatchObject({
      authorType: 'professor',
      text: 'Ciclo de aulas concluído com excelente participação.',
      createdAt: '2026-12-10T22:00:00.000Z',
    });

    const plan = computeReimportPlan(
      closed,
      alunos,
      parsed,
      '2026-12-11T10:00:00.000Z'
    );

    await expect(
      applyReimportPlan('uid-prof-1', turma.id, plan, '2026-12-11T10:00:00.000Z')
    ).rejects.toThrow(
      'Não é permitido importar planilha em uma turma encerrada. Reabra a turma primeiro.'
    );

    const reopened = await setTurmaStatus(
      'uid-prof-1',
      turma.id,
      'Ativa',
      undefined,
      '2026-12-12T10:00:00.000Z'
    );
    expect(reopened.status).toBe('Ativa');
    expect(reopened.closedAt).toBeUndefined();
  });

  it('adds timestamped comments to a turma and rejects blank comments (TURMA-03 AC 3)', async () => {
    const parsed = makeSampleParsedChamada();
    const { turma } = await createTurmaFromImport(
      'uid-prof-1',
      {
        nome: 'Turma Pampulha (QUA)',
        diaHorario: 'Quarta-feira, 19h30',
        local: 'Pampulha',
        catedras: ['Filosofia para Viver'],
      },
      parsed
    );

    await expect(
      addTurmaComment('uid-prof-1', turma.id, '   ')
    ).rejects.toThrow('O comentário não pode estar vazio.');

    const entry = await addTurmaComment(
      'uid-prof-1',
      turma.id,
      '  Turma participativa na aula sobre estoicismo.  ',
      '2026-10-15T21:00:00.000Z'
    );

    expect(entry).toMatchObject({
      authorType: 'professor',
      text: 'Turma participativa na aula sobre estoicismo.',
      createdAt: '2026-10-15T21:00:00.000Z',
    });

    const fetched = await getTurmaWithAlunos('uid-prof-1', turma.id);
    expect(fetched.turma.comentarios).toEqual([entry]);
  });

  it('adds professor comments to both Ativo and Inscrição Baixada students and rejects blank comments (ALUNO-02, ALUNO-03, ALUNO-01 AC 4)', async () => {
    const parsed = makeSampleParsedChamada();
    const { turma, alunos } = await createTurmaFromImport(
      'uid-prof-1',
      {
        nome: 'Turma Pampulha (QUA)',
        diaHorario: 'Quarta-feira, 19h30',
        local: 'Pampulha',
        catedras: ['Filosofia para Viver'],
      },
      parsed,
      '2026-10-14T22:00:00.000Z'
    );

    // Drop student 7728
    const plan = computeReimportPlan(
      turma,
      alunos,
      { ...parsed, students: [parsed.students[0]] },
      '2026-10-21T22:00:00.000Z'
    );
    await applyReimportPlan('uid-prof-1', turma.id, plan);

    await expect(
      addAlunoComment('uid-prof-1', turma.id, '7728', '  \n ')
    ).rejects.toThrow('O comentário não pode estar vazio.');

    const profNoteOnDropped = await addAlunoComment(
      'uid-prof-1',
      turma.id,
      '7728',
      'Conversamos por telefone; mudou de horário no trabalho.',
      '2026-10-22T14:00:00.000Z'
    );

    expect(profNoteOnDropped).toMatchObject({
      authorType: 'professor',
      text: 'Conversamos por telefone; mudou de horário no trabalho.',
      createdAt: '2026-10-22T14:00:00.000Z',
    });

    const fetched = await getTurmaWithAlunos('uid-prof-1', turma.id);
    const lucas = fetched.alunos.find((a) => a.studentKey === '7728')!;
    expect(lucas.status).toBe('Inscrição Baixada');
    expect(lucas.comentarios).toHaveLength(2);
    expect(lucas.comentarios[0].authorType).toBe('sistema');
    expect(lucas.comentarios[1]).toEqual(profNoteOnDropped);
  });
});
