import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LoginView, TurmasDashboard } from '../TurmasDashboard';
import type { Turma } from '../../domain/types';

function loadRealXlsxFile(): File {
  const filePath = path.resolve(process.cwd(), 'Turma Pampulha QUA.xlsx');
  const buf = fs.readFileSync(filePath);
  return new File([buf], 'Turma Pampulha QUA.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const sampleActiveTurma: Turma = {
  id: 'turma-1',
  nome: 'Turma Pampulha (QUA)',
  diaHorario: 'Quarta-feira, 19h30',
  local: 'Belo Horizonte',
  catedras: ['Filosofia para Viver', 'Transpasso'],
  status: 'Ativa',
  lessons: [],
  comentarios: [],
  activeStudentsCount: 3,
  droppedStudentsCount: 1,
  createdAt: '2026-01-28T10:00:00.000Z',
  updatedAt: '2026-10-14T10:00:00.000Z',
};

const sampleClosedTurma: Turma = {
  id: 'turma-2',
  nome: 'Turma Savassi (TER)',
  diaHorario: 'Terça-feira, 20h00',
  local: 'Savassi',
  catedras: ['Psicologia Prática'],
  status: 'Encerrada',
  lessons: [],
  comentarios: [],
  activeStudentsCount: 2,
  droppedStudentsCount: 0,
  createdAt: '2025-02-01T10:00:00.000Z',
  updatedAt: '2025-12-10T10:00:00.000Z',
  closedAt: '2025-12-10T10:00:00.000Z',
};

describe('components/LoginView & TurmasDashboard', () => {
  it('submits professor credentials in LoginView and renders localized Portuguese error on failure (AUTH-01, AUTH-02)', async () => {
    const onSignIn = vi
      .fn()
      .mockRejectedValueOnce({ code: 'auth/invalid-credential' })
      .mockResolvedValueOnce(undefined);

    render(<LoginView onSignIn={onSignIn} />);

    expect(
      screen.getByRole('img', { name: /logotipo juntos/i })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/e-mail do professor/i), {
      target: { value: 'willy@exemplo.com' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'E-mail ou senha inválidos.'
      );
    });

    expect(onSignIn).toHaveBeenCalledWith('willy@exemplo.com', 'wrongpass');
  });

  it('filters between Turmas Ativas and Turmas Encerradas tabs and opens a selected class (TURMA-03 AC 4)', () => {
    const onSelectTurma = vi.fn();
    render(
      <TurmasDashboard
        turmas={[sampleActiveTurma, sampleClosedTurma]}
        onSelectTurma={onSelectTurma}
        onCreateTurma={vi.fn()}
      />
    );

    expect(screen.getByText('Turma Pampulha (QUA)')).toBeInTheDocument();
    expect(screen.queryByText('Turma Savassi (TER)')).not.toBeInTheDocument();
    expect(screen.getByText('Filosofia para Viver')).toBeInTheDocument();
    expect(screen.getByText('Transpasso')).toBeInTheDocument();
    expect(
      screen.getByText(/3 ativos · 1 inscrição baixada/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /turmas encerradas/i }));
    expect(screen.getByText('Turma Savassi (TER)')).toBeInTheDocument();
    expect(screen.queryByText('Turma Pampulha (QUA)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /abrir turma/i }));
    expect(onSelectTurma).toHaveBeenCalledWith('turma-2');
  });

  it('parses uploaded Turma Pampulha QUA.xlsx in + Nova Turma, pre-fills A2 name and A1 location, and creates the class (TURMA-01, XLSX-01)', async () => {
    const onCreateTurma = vi.fn().mockResolvedValue(undefined);
    render(
      <TurmasDashboard
        turmas={[]}
        onSelectTurma={vi.fn()}
        onCreateTurma={onCreateTurma}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /\+ nova turma/i }));

    const fileInput = screen.getByLabelText(/planilha de chamada/i);
    const xlsxFile = loadRealXlsxFile();
    fireEvent.change(fileInput, { target: { files: [xlsxFile] } });

    await waitFor(() => {
      expect(screen.getByLabelText(/nome da turma/i)).toHaveValue(
        'Turma Pampulha (QUA)'
      );
    });
    expect(screen.getByLabelText(/local/i)).toHaveValue('Belo Horizonte');
    expect(
      screen.getByText(/3 alunos e 31 aulas identificadas/i)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/dia e horário das aulas/i), {
      target: { value: 'Quarta-feira, 19h30' },
    });
    fireEvent.change(screen.getByLabelText(/cátedras/i), {
      target: { value: 'Filosofia para Viver, Transpasso' },
    });

    fireEvent.click(screen.getByRole('button', { name: /criar turma/i }));

    await waitFor(() => {
      expect(onCreateTurma).toHaveBeenCalledTimes(1);
    });

    const [createdInput, createdParsed] = onCreateTurma.mock.calls[0];
    expect(createdInput).toEqual({
      nome: 'Turma Pampulha (QUA)',
      diaHorario: 'Quarta-feira, 19h30',
      local: 'Belo Horizonte',
      catedras: ['Filosofia para Viver', 'Transpasso'],
      cidadePlanilha: 'Belo Horizonte',
    });
    expect(createdParsed.students).toHaveLength(3);
    expect(createdParsed.lessons).toHaveLength(31);
  });

  it('displays validation warning on invalid xlsx file or missing required metadata fields (XLSX-02, TURMA-01)', async () => {
    const onCreateTurma = vi.fn();
    render(
      <TurmasDashboard
        turmas={[]}
        onSelectTurma={vi.fn()}
        onCreateTurma={onCreateTurma}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /\+ nova turma/i }));

    const badFile = new File([new Uint8Array([1, 2, 3])], 'invalido.xlsx', {
      type: 'application/octet-stream',
    });
    fireEvent.change(screen.getByLabelText(/planilha de chamada/i), {
      target: { files: [badFile] },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /planilha excel \(\.xlsx\) válida/i
      );
    });
    expect(onCreateTurma).not.toHaveBeenCalled();
  });

  it('rejects form submission when required metadata fields such as cátedras are missing (TURMA-01)', async () => {
    const onCreateTurma = vi.fn();
    render(
      <TurmasDashboard
        turmas={[]}
        onSelectTurma={vi.fn()}
        onCreateTurma={onCreateTurma}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /\+ nova turma/i }));

    const xlsxFile = loadRealXlsxFile();
    fireEvent.change(screen.getByLabelText(/planilha de chamada/i), {
      target: { files: [xlsxFile] },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/nome da turma/i)).toHaveValue(
        'Turma Pampulha (QUA)'
      );
    });

    // Leave diaHorario and catedras blank and submit
    fireEvent.click(screen.getByRole('button', { name: /criar turma/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Informe o dia e horário das aulas.'
      );
    });
    expect(onCreateTurma).not.toHaveBeenCalled();
  });

  it('rejects form submission when no xlsx spreadsheet has been uploaded (XLSX-02)', async () => {
    const onCreateTurma = vi.fn();
    render(
      <TurmasDashboard
        turmas={[]}
        onSelectTurma={vi.fn()}
        onCreateTurma={onCreateTurma}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /\+ nova turma/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar turma/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Selecione uma planilha de chamada (.xlsx) válida.'
    );
    expect(onCreateTurma).not.toHaveBeenCalled();
  });
});
