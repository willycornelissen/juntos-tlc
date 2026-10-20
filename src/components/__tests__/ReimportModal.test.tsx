import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import * as XLSX from 'xlsx';
import { ReimportModal } from '../ReimportModal';
import type { AlunoRecord, Turma } from '../../domain/types';

function buildXlsxFile(rows: unknown[][], fileName = 'chamada-atualizada.xlsx'): File {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'chamada');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buf], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const existingTurma: Turma = {
  id: 'turma-1',
  nome: 'Turma Pampulha (QUA)',
  diaHorario: 'Quarta-feira, 19h30',
  local: 'Belo Horizonte',
  catedras: ['Filosofia para Viver'],
  status: 'Ativa',
  lessons: [
    {
      dateKey: '14/10/26',
      isoDate: '2026-10-14',
      course: 'Filosofia para viver',
      theme: 'Transpasso Aula 10',
      instructor: 'Willy Garabini Cornelissen',
    },
  ],
  comentarios: [],
  activeStudentsCount: 2,
  droppedStudentsCount: 0,
  createdAt: '2026-01-28T10:00:00.000Z',
  updatedAt: '2026-10-14T10:00:00.000Z',
};

const existingAlunos: AlunoRecord[] = [
  {
    studentKey: '14820',
    externalId: '14820',
    sequencia: 1,
    nome: 'Claudia Marcia Marques (Sala Pampulha)',
    status: 'Ativo',
    presencas: { '14/10/26': 'P' },
    comentarios: [],
    enrolledAt: '2026-01-28T10:00:00.000Z',
    updatedAt: '2026-10-14T10:00:00.000Z',
  },
  {
    studentKey: '7728',
    externalId: '7728',
    sequencia: 2,
    nome: 'Lucas Selani de Melo (Sala Pampulha)',
    status: 'Ativo',
    presencas: { '14/10/26': 'P' },
    comentarios: [],
    enrolledAt: '2026-01-28T10:00:00.000Z',
    updatedAt: '2026-10-14T10:00:00.000Z',
  },
];

describe('components/ReimportModal', () => {
  it('previews diff summary showing added lesson dates, newly enrolled students, and students dropping to Inscrição Baixada (XLSX-03, XLSX-04, SYNC-02)', async () => {
    const onConfirmReimport = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ReimportModal
        turma={existingTurma}
        alunos={existingAlunos}
        onClose={onClose}
        onConfirmReimport={onConfirmReimport}
        nowIso="2026-10-21T12:00:00.000Z"
      />
    );

    // Build updated spreadsheet where 7728 (Lucas) is missing, 15001 (Ana) is new, and 21/10/26 is added
    const updatedRows = [
      ['Belo Horizonte'],
      ['Turma Pampulha (QUA)', '', '', '', '', '', 'Filosofia para viver', 'Filosofia para viver'],
      ['Tema', '', '', '', '', '', 'Transpasso Aula 11', 'Transpasso Aula 10'],
      ['Instrutores', '', '', '', '', '', 'Willy Garabini Cornelissen', 'Willy Garabini Cornelissen'],
      ['', '', '% Presença'],
      ['ID', '2', 'Nome', 'Status', '% Trim', '% Ano', '21/10/26', '14/10/26'],
      ['14820', '1', 'Claudia Marcia Marques (Sala Pampulha)', 'Ativo', '', '', 'P', 'P'],
      ['15001', '2', 'Ana Carolina Souza', 'Ativo', '', '', 'P', ''],
    ];

    const file = buildXlsxFile(updatedRows);
    fireEvent.change(screen.getByLabelText(/selecionar planilha/i), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(
        screen.getByText(/resumo da sincronização/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/21\/10\/26/)).toBeInTheDocument();
    expect(screen.getByText(/\[15001\] Ana Carolina Souza/)).toBeInTheDocument();
    expect(
      screen.getByText(/\[7728\] Lucas Selani de Melo \(Sala Pampulha\)/)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /confirmar sincronização/i })
    );

    await waitFor(() => {
      expect(onConfirmReimport).toHaveBeenCalledTimes(1);
    });

    const submittedPlan = onConfirmReimport.mock.calls[0][0];
    expect(submittedPlan.diffSummary.addedLessonDates).toEqual(['21/10/26']);
    expect(submittedPlan.diffSummary.droppedStudents).toEqual([
      {
        studentKey: '7728',
        externalId: '7728',
        nome: 'Lucas Selani de Melo (Sala Pampulha)',
      },
    ]);
    const droppedLucas = submittedPlan.updatedStudents.find(
      (s: AlunoRecord) => s.studentKey === '7728'
    );
    expect(droppedLucas?.status).toBe('Inscrição Baixada');
    expect(droppedLucas?.comentarios[0].text).toBe(
      'Inscrição baixada: aluno não consta na planilha importada em 21/10/2026.'
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('previews re-enrolled students when a previously Inscrição Baixada student reappears in the spreadsheet (XLSX-03 AC 5)', async () => {
    const alunosWithDropped: AlunoRecord[] = [
      existingAlunos[0],
      {
        ...existingAlunos[1],
        status: 'Inscrição Baixada',
        droppedAt: '2026-10-14T10:00:00.000Z',
      },
    ];

    render(
      <ReimportModal
        turma={existingTurma}
        alunos={alunosWithDropped}
        onClose={vi.fn()}
        onConfirmReimport={vi.fn()}
        nowIso="2026-10-21T12:00:00.000Z"
      />
    );

    const rows = [
      ['Belo Horizonte'],
      ['Turma Pampulha (QUA)', '', '', '', '', '', 'Filosofia para viver'],
      ['Tema', '', '', '', '', '', 'Transpasso Aula 10'],
      ['Instrutores', '', '', '', '', '', 'Willy Garabini Cornelissen'],
      ['', '', '% Presença'],
      ['ID', '2', 'Nome', 'Status', '% Trim', '% Ano', '14/10/26'],
      ['14820', '1', 'Claudia Marcia Marques (Sala Pampulha)', 'Ativo', '', '', 'P'],
      ['7728', '2', 'Lucas Selani de Melo (Sala Pampulha)', 'Ativo', '', '', 'P'],
    ];

    fireEvent.change(screen.getByLabelText(/selecionar planilha/i), {
      target: { files: [buildXlsxFile(rows)] },
    });

    await waitFor(() => {
      expect(
        screen.getByText(/inscrição reativada \(1\)/i)
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/\[7728\] Lucas Selani de Melo \(Sala Pampulha\)/)
    ).toBeInTheDocument();
  });

  it('displays warning alert and keeps confirmation button disabled when an invalid xlsx file is uploaded (XLSX-02)', async () => {
    const onConfirmReimport = vi.fn();
    render(
      <ReimportModal
        turma={existingTurma}
        alunos={existingAlunos}
        onClose={vi.fn()}
        onConfirmReimport={onConfirmReimport}
      />
    );

    const invalidFile = new File([new Uint8Array([0, 1, 2, 3])], 'corrompido.xlsx');
    fireEvent.change(screen.getByLabelText(/selecionar planilha/i), {
      target: { files: [invalidFile] },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /planilha excel \(\.xlsx\) válida/i
      );
    });

    expect(
      screen.getByRole('button', { name: /confirmar sincronização/i })
    ).toBeDisabled();
    expect(onConfirmReimport).not.toHaveBeenCalled();
  });

  it('surfaces error message if onConfirmReimport rejects on save (SYNC-01)', async () => {
    const onConfirmReimport = vi
      .fn()
      .mockRejectedValue(new Error('Falha ao gravar no Firestore.'));

    render(
      <ReimportModal
        turma={existingTurma}
        alunos={existingAlunos}
        onClose={vi.fn()}
        onConfirmReimport={onConfirmReimport}
      />
    );

    const rows = [
      ['Belo Horizonte'],
      ['Turma Pampulha (QUA)', '', '', '', '', '', 'Filosofia para viver'],
      ['Tema', '', '', '', '', '', 'Transpasso Aula 10'],
      ['Instrutores', '', '', '', '', '', 'Willy Garabini Cornelissen'],
      ['', '', '% Presença'],
      ['ID', '1', 'Nome', 'Status', '% Trim', '% Ano', '14/10/26'],
      ['14820', '1', 'Claudia Marcia Marques (Sala Pampulha)', 'Ativo', '', '', 'P'],
    ];

    fireEvent.change(screen.getByLabelText(/selecionar planilha/i), {
      target: { files: [buildXlsxFile(rows)] },
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /confirmar sincronização/i })
      ).not.toBeDisabled();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /confirmar sincronização/i })
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Falha ao gravar no Firestore.'
      );
    });
  });
});
