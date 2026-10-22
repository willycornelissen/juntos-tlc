import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TurmaDetailView } from '../TurmaDetailView';
import type { AlunoRecord, Turma } from '../../domain/types';

const sampleTurma: Turma = {
  id: 'turma-pampulha',
  nome: 'Turma Pampulha (QUA)',
  diaHorario: 'Quarta-feira, 19h30',
  local: 'Belo Horizonte',
  catedras: ['Filosofia para Viver', 'Transpasso'],
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
  comentarios: [
    {
      id: 'c-1',
      authorType: 'professor',
      text: 'Turma bastante participativa neste trimestre.',
      createdAt: '2026-10-01T12:00:00.000Z',
    },
  ],
  activeStudentsCount: 2,
  droppedStudentsCount: 1,
  createdAt: '2026-01-28T10:00:00.000Z',
  updatedAt: '2026-10-14T10:00:00.000Z',
};

const sampleAlunos: AlunoRecord[] = [
  {
    studentKey: '14820',
    externalId: '14820',
    sequencia: 1,
    nome: 'Claudia Marcia Marques (Sala Pampulha)',
    status: 'Ativo',
    presencas: { '14/10/26': 'P', '07/10/26': 'P' },
    comentarios: [],
    enrolledAt: '2026-01-28T10:00:00.000Z',
    updatedAt: '2026-10-14T10:00:00.000Z',
  },
  {
    studentKey: '7728',
    externalId: '7728',
    sequencia: 2,
    nome: 'Lucas Selani de Melo (Sala Pampulha)',
    status: 'Inscrição Baixada',
    presencas: { '14/10/26': 'F', '07/10/26': 'P' },
    comentarios: [
      {
        id: 'sys-drop-7728',
        authorType: 'sistema',
        text: 'Inscrição baixada: aluno não consta na planilha importada em 14/10/2026.',
        createdAt: '2026-10-14T10:00:00.000Z',
      },
    ],
    enrolledAt: '2026-01-28T10:00:00.000Z',
    droppedAt: '2026-10-14T10:00:00.000Z',
    updatedAt: '2026-10-14T10:00:00.000Z',
  },
];

describe('components/TurmaDetailView', () => {
  it('renders attendance matrix with student IDs, status badges, % Trim, % Ano, lesson themes/instructors, and opens student ficha on click (ALUNO-01, XLSX-01)', () => {
    const onSelectStudent = vi.fn();
    render(
      <TurmaDetailView
        turma={sampleTurma}
        alunos={sampleAlunos}
        onBack={vi.fn()}
        onSelectStudent={onSelectStudent}
        onOpenReimportModal={vi.fn()}
        onUpdateMetadata={vi.fn()}
        onChangeStatus={vi.fn()}
        onAddTurmaComment={vi.fn()}
      />
    );

    expect(screen.getByText('14820')).toBeInTheDocument();
    expect(
      screen.getByText('Claudia Marcia Marques (Sala Pampulha)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Lucas Selani de Melo (Sala Pampulha)')
    ).toBeInTheDocument();

    expect(screen.getByText('Transpasso Aula 10')).toBeInTheDocument();
    expect(screen.getByText('Transpasso Aula 9')).toBeInTheDocument();
    expect(
      screen.getAllByText('Willy Garabini Cornelissen').length
    ).toBeGreaterThanOrEqual(2);

    // Lucas has 1 P and 1 F => 50% Trim and 50% Ano
    expect(screen.getAllByText('50%').length).toBeGreaterThanOrEqual(2);

    fireEvent.click(
      screen.getByText('Lucas Selani de Melo (Sala Pampulha)')
    );
    expect(onSelectStudent).toHaveBeenCalledWith(sampleAlunos[1]);
  });

  it('filters students in real time by status (Todos, Ativos, Inscrição Baixada) and case-insensitive search by Nome or ID (TURMA-02 AC 2)', () => {
    render(
      <TurmaDetailView
        turma={sampleTurma}
        alunos={sampleAlunos}
        onBack={vi.fn()}
        onSelectStudent={vi.fn()}
        onOpenReimportModal={vi.fn()}
        onUpdateMetadata={vi.fn()}
        onChangeStatus={vi.fn()}
        onAddTurmaComment={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Inscrição Baixada' })
    );
    expect(
      screen.getByText('Lucas Selani de Melo (Sala Pampulha)')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Claudia Marcia Marques (Sala Pampulha)')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ativos' }));
    expect(
      screen.getByText('Claudia Marcia Marques (Sala Pampulha)')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Lucas Selani de Melo (Sala Pampulha)')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    fireEvent.change(
      screen.getByRole('searchbox', { name: /buscar aluno por nome ou id/i }),
      { target: { value: '7728' } }
    );
    expect(
      screen.getByText('Lucas Selani de Melo (Sala Pampulha)')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Claudia Marcia Marques (Sala Pampulha)')
    ).not.toBeInTheDocument();
  });

  it('allows editing class metadata (nome, diaHorario, local, cátedras) inline (TURMA-02 AC 1)', async () => {
    const onUpdateMetadata = vi.fn().mockResolvedValue(undefined);
    render(
      <TurmaDetailView
        turma={sampleTurma}
        alunos={sampleAlunos}
        onBack={vi.fn()}
        onSelectStudent={vi.fn()}
        onOpenReimportModal={vi.fn()}
        onUpdateMetadata={onUpdateMetadata}
        onChangeStatus={vi.fn()}
        onAddTurmaComment={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /editar dados/i }));

    fireEvent.change(screen.getByLabelText(/nome da turma/i), {
      target: { value: 'Turma Pampulha Noite' },
    });
    fireEvent.change(screen.getByLabelText(/dia e horário/i), {
      target: { value: 'Quarta-feira, 20h00' },
    });
    fireEvent.change(screen.getByLabelText(/local/i), {
      target: { value: 'Sede Pampulha' },
    });
    fireEvent.change(screen.getByLabelText(/cátedras/i), {
      target: { value: 'Filosofia para Viver, Ética' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /salvar alterações/i })
    );

    await waitFor(() => {
      expect(onUpdateMetadata).toHaveBeenCalledWith({
        nome: 'Turma Pampulha Noite',
        diaHorario: 'Quarta-feira, 20h00',
        local: 'Sede Pampulha',
        catedras: ['Filosofia para Viver', 'Ética'],
      });
    });
  });

  it('adds a class comment and blocks empty comment submissions (TURMA-03 AC 3)', async () => {
    const onAddTurmaComment = vi.fn().mockResolvedValue(undefined);
    render(
      <TurmaDetailView
        turma={sampleTurma}
        alunos={sampleAlunos}
        onBack={vi.fn()}
        onSelectStudent={vi.fn()}
        onOpenReimportModal={vi.fn()}
        onUpdateMetadata={vi.fn()}
        onChangeStatus={vi.fn()}
        onAddTurmaComment={onAddTurmaComment}
      />
    );

    expect(
      screen.getByText('Turma bastante participativa neste trimestre.')
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /salvar comentário/i })
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'O comentário não pode estar vazio.'
    );
    expect(onAddTurmaComment).not.toHaveBeenCalled();

    fireEvent.change(
      screen.getByLabelText(/adicionar comentário da turma/i),
      {
        target: { value: 'Excelente debate sobre a Aula 10.' },
      }
    );
    fireEvent.click(
      screen.getByRole('button', { name: /salvar comentário/i })
    );

    await waitFor(() => {
      expect(onAddTurmaComment).toHaveBeenCalledWith(
        'Excelente debate sobre a Aula 10.'
      );
    });
  });

  it('supports finishing an active class with a closing comment and disables xlsx re-import when Encerrada (TURMA-03 AC 1, 2)', async () => {
    const onChangeStatus = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <TurmaDetailView
        turma={sampleTurma}
        alunos={sampleAlunos}
        onBack={vi.fn()}
        onSelectStudent={vi.fn()}
        onOpenReimportModal={vi.fn()}
        onUpdateMetadata={vi.fn()}
        onChangeStatus={onChangeStatus}
        onAddTurmaComment={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /encerrar turma/i }));
    fireEvent.change(
      screen.getByLabelText(/comentário de encerramento/i),
      {
        target: { value: 'Ciclo concluído com sucesso em outubro.' },
      }
    );
    fireEvent.click(
      screen.getByRole('button', { name: /confirmar encerramento/i })
    );

    await waitFor(() => {
      expect(onChangeStatus).toHaveBeenCalledWith(
        'Encerrada',
        'Ciclo concluído com sucesso em outubro.'
      );
    });

    // Re-render with status === 'Encerrada' and verify re-import button is disabled and Reabrir turma is shown
    rerender(
      <TurmaDetailView
        turma={{ ...sampleTurma, status: 'Encerrada' }}
        alunos={sampleAlunos}
        onBack={vi.fn()}
        onSelectStudent={vi.fn()}
        onOpenReimportModal={vi.fn()}
        onUpdateMetadata={vi.fn()}
        onChangeStatus={onChangeStatus}
        onAddTurmaComment={vi.fn()}
      />
    );

    const importBtn = screen.getByRole('button', {
      name: /importar planilha \(\.xlsx\)/i,
    });
    expect(importBtn).toBeDisabled();
    expect(
      screen.getByText(/reimportação de planilhas \(\.xlsx\) está bloqueada/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reabrir turma/i }));
    await waitFor(() => {
      expect(onChangeStatus).toHaveBeenCalledWith('Ativa');
    });
  });

  it('displays "-" for lesson presence rate and student cells when a lesson column has no attendance marks, and validates required metadata on edit (Edge Case 2, TURMA-02)', async () => {
    const onUpdateMetadata = vi.fn();
    const turmaWithEmptyLesson: Turma = {
      ...sampleTurma,
      lessons: [
        {
          dateKey: '21/10/26',
          isoDate: '2026-10-21',
          course: 'Filosofia para viver',
          theme: 'Transpasso Aula 11',
          instructor: 'Willy Garabini Cornelissen',
        },
      ],
    };
    const alunosWithoutMarks: AlunoRecord[] = [
      {
        ...sampleAlunos[0],
        presencas: {},
      },
    ];

    render(
      <TurmaDetailView
        turma={turmaWithEmptyLesson}
        alunos={alunosWithoutMarks}
        onBack={vi.fn()}
        onSelectStudent={vi.fn()}
        onOpenReimportModal={vi.fn()}
        onUpdateMetadata={onUpdateMetadata}
        onChangeStatus={vi.fn()}
        onAddTurmaComment={vi.fn()}
      />
    );

    expect(screen.getByText('21/10/26')).toBeInTheDocument();
    expect(screen.getByText('Transpasso Aula 11')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(3);

    fireEvent.click(screen.getByRole('button', { name: /editar dados/i }));
    fireEvent.change(screen.getByLabelText(/nome da turma/i), {
      target: { value: '   ' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /salvar alterações/i })
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Informe o nome da turma.'
    );
    expect(onUpdateMetadata).not.toHaveBeenCalled();
  });

  it('allows switching between Matriz and Relatório de Encerramento tabs (ENCERR-03)', () => {
    render(
      <TurmaDetailView
        turma={sampleTurma}
        alunos={sampleAlunos}
        onBack={vi.fn()}
        onSelectStudent={vi.fn()}
        onOpenReimportModal={vi.fn()}
        onUpdateMetadata={vi.fn()}
        onChangeStatus={vi.fn()}
        onAddTurmaComment={vi.fn()}
      />
    );

    const matrizTab = screen.getByRole('tab', { name: /Matriz de Chamada/i });
    const relatorioTab = screen.getByRole('tab', { name: /Relatório de Encerramento/i });

    expect(matrizTab).toBeInTheDocument();
    expect(relatorioTab).toBeInTheDocument();
    expect(matrizTab).toHaveAttribute('aria-selected', 'true');

    // Switch to report
    fireEvent.click(relatorioTab);
    expect(relatorioTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Relatório de Encerramento')).toBeInTheDocument();
    expect(screen.getByText(/Taxa de Retenção/i)).toBeInTheDocument();

    // Switch back to matrix
    fireEvent.click(matrizTab);
    expect(matrizTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Matriz de chamada da turma')).toBeInTheDocument();
  });

  it('highlights report button and supports quick navigation from Encerrada banner (ENCERR-03)', () => {
    const closedTurma: Turma = {
      ...sampleTurma,
      status: 'Encerrada',
    };

    render(
      <TurmaDetailView
        turma={closedTurma}
        alunos={sampleAlunos}
        onBack={vi.fn()}
        onSelectStudent={vi.fn()}
        onOpenReimportModal={vi.fn()}
        onUpdateMetadata={vi.fn()}
        onChangeStatus={vi.fn()}
        onAddTurmaComment={vi.fn()}
      />
    );

    expect(screen.getByText(/Disponível/i)).toBeInTheDocument();
    const verRelatorioBtn = screen.getByRole('button', {
      name: /Ver Relatório de Encerramento →/i,
    });
    expect(verRelatorioBtn).toBeInTheDocument();

    fireEvent.click(verRelatorioBtn);
    expect(screen.getByText('Relatório de Encerramento')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /Conclusão vs. Evasão/i })
    ).toBeInTheDocument();
  });
});
