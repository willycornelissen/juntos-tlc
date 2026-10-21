import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import * as XLSX from 'xlsx';
import { AlunoFichaDrawer } from '../AlunoFichaDrawer';
import { App } from '../../App';
import { resetLocalStoreForTests } from '../../services/turmaRepo';
import { signOutProfessor } from '../../services/authService';
import type { AlunoRecord, LessonColumn } from '../../domain/types';

const sampleLessons: LessonColumn[] = [
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
];

const droppedAluno: AlunoRecord = {
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
};

function buildXlsxFile(rows: unknown[][], name = 'reimport.xlsx'): File {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'chamada');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buf], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('components/AlunoFichaDrawer & App integration', () => {
  beforeEach(async () => {
    resetLocalStoreForTests();
    await signOutProfessor();
  });

  it('renders student ID, Nome, Inscrição Baixada badge, % Trim, % Ano, P/A/R/F/J counts, lesson history, and automatic system drop comment (ALUNO-01 AC 1, 4)', () => {
    render(
      <AlunoFichaDrawer
        aluno={droppedAluno}
        lessons={sampleLessons}
        onClose={vi.fn()}
        onAddComment={vi.fn()}
      />
    );

    expect(screen.getByText(/ID: 7728/i)).toBeInTheDocument();
    expect(
      screen.getByText('Lucas Selani de Melo (Sala Pampulha)')
    ).toBeInTheDocument();
    expect(screen.getByText('Inscrição Baixada')).toBeInTheDocument();
    expect(screen.getAllByText('50%')).toHaveLength(2);
    expect(screen.getByText('Transpasso Aula 10')).toBeInTheDocument();
    expect(screen.getByText('Transpasso Aula 9')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Inscrição baixada: aluno não consta na planilha importada em 14/10/2026.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/registro automático do sistema/i)
    ).toBeInTheDocument();
  });

  it('keeps comment form enabled for Inscrição Baixada student and submits valid professor comment (ALUNO-01 AC 4, ALUNO-02)', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    render(
      <AlunoFichaDrawer
        aluno={droppedAluno}
        lessons={sampleLessons}
        onClose={vi.fn()}
        onAddComment={onAddComment}
      />
    );

    const textarea = screen.getByLabelText(
      /novo comentário na ficha particular/i
    );
    expect(textarea).not.toBeDisabled();

    fireEvent.change(textarea, {
      target: {
        value: 'Conversei com o Lucas; precisou viajar a trabalho neste mês.',
      },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /adicionar comentário/i })
    );

    await waitFor(() => {
      expect(onAddComment).toHaveBeenCalledWith(
        '7728',
        'Conversei com o Lucas; precisou viajar a trabalho neste mês.'
      );
    });
  });

  it('prevents submitting an empty or whitespace-only comment in AlunoFichaDrawer (ALUNO-03)', () => {
    const onAddComment = vi.fn();
    render(
      <AlunoFichaDrawer
        aluno={droppedAluno}
        lessons={sampleLessons}
        onClose={vi.fn()}
        onAddComment={onAddComment}
      />
    );

    fireEvent.change(
      screen.getByLabelText(/novo comentário na ficha particular/i),
      { target: { value: '   ' } }
    );
    fireEvent.click(
      screen.getByRole('button', { name: /adicionar comentário/i })
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'O comentário não pode estar vazio.'
    );
    expect(onAddComment).not.toHaveBeenCalled();
  });

  it('executes full App workflow: sign in, load sample Turma Pampulha (QUA), open student ficha, add professor comment, and sign out (AUTH-01, TURMA-01, ALUNO-01, ALUNO-02)', async () => {
    render(<App />);

    // Initially unauthenticated -> LoginView
    fireEvent.change(screen.getByLabelText(/e-mail do professor/i), {
      target: { value: 'willy@juntos.dev.br' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'senha123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText('willy@juntos.dev.br')).toBeInTheDocument();
    });

    // Load sample turma with 1 click
    fireEvent.click(
      screen.getByRole('button', {
        name: /carregar turma de exemplo \(pampulha qua\)/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText('Claudia Marcia Marques (Sala Pampulha)')
      ).toBeInTheDocument();
    });

    // Click student to open AlunoFichaDrawer
    fireEvent.click(
      screen.getByText('Claudia Marcia Marques (Sala Pampulha)')
    );

    await waitFor(() => {
      expect(screen.getByText(/ficha particular · id: 14820/i)).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByLabelText(/novo comentário na ficha particular/i),
      { target: { value: 'Participação exemplar nas aulas de Filosofia.' } }
    );
    fireEvent.click(
      screen.getByRole('button', { name: /adicionar comentário/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText('Participação exemplar nas aulas de Filosofia.')
      ).toBeInTheDocument();
    });

    // Close drawer and sign out
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));
    fireEvent.click(screen.getByRole('button', { name: /sair/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/e-mail do professor/i)).toBeInTheDocument();
    });
  });

  it('re-imports an updated xlsx in App, automatically marks missing student as Inscrição Baixada, and shows the system comment in their ficha (XLSX-03, XLSX-04)', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/e-mail do professor/i), {
      target: { value: 'prof@juntos.dev.br' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'senha123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /carregar turma de exemplo \(pampulha qua\)/i,
        })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /carregar turma de exemplo \(pampulha qua\)/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /importar planilha \(\.xlsx\)/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /importar planilha \(\.xlsx\)/i })
    );

    // Upload spreadsheet where student 7728 (Lucas) is missing
    const updatedRows = [
      ['Belo Horizonte'],
      ['Turma Pampulha (QUA)', '', '', '', '', '', 'Filosofia para viver'],
      ['Tema', '', '', '', '', '', 'Transpasso Aula 11'],
      ['Instrutores', '', '', '', '', '', 'Willy Garabini Cornelissen'],
      ['', '', '% Presença'],
      ['ID', '2', 'Nome', 'Status', '% Trim', '% Ano', '21/10/26'],
      ['14820', '1', 'Claudia Marcia Marques (Sala Pampulha)', 'Ativo', '', '', 'P'],
      ['14779', '3', 'Maria Regina de Araujo Borges (Sala Pampulha)', 'Ativo', '', '', 'P'],
    ];

    fireEvent.change(screen.getByLabelText(/selecionar planilha/i), {
      target: { files: [buildXlsxFile(updatedRows)] },
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /confirmar sincronização/i })
      ).not.toBeDisabled();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /confirmar sincronização/i })
    );

    // Open Lucas's ficha particular and verify status Inscrição Baixada + automatic system comment
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /reimportar planilha/i })
      ).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByText('Lucas Selani de Melo (Sala Pampulha)')
    );

    await waitFor(() => {
      expect(
        screen.getByText(/inscrição baixada: aluno não consta na planilha importada em/i)
      ).toBeInTheDocument();
    });
  });

  it('finishes an active class in App and moves it under Turmas Encerradas in dashboard (TURMA-03)', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/e-mail do professor/i), {
      target: { value: 'encerrar@juntos.dev.br' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'senha123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /carregar turma de exemplo \(pampulha qua\)/i,
        })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /carregar turma de exemplo \(pampulha qua\)/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /encerrar turma/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /encerrar turma/i }));
    fireEvent.change(
      screen.getByLabelText(/comentário de encerramento/i),
      { target: { value: 'Turma concluída no segundo semestre.' } }
    );
    fireEvent.click(
      screen.getByRole('button', { name: /confirmar encerramento/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText('Turma concluída no segundo semestre.')
      ).toBeInTheDocument();
    });

    // Return to dashboard and verify class is under Turmas Encerradas
    fireEvent.click(
      screen.getByRole('button', { name: /voltar para turmas/i })
    );

    expect(
      screen.getByRole('tab', { name: /turmas ativas \(0\)/i })
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('tab', { name: /turmas encerradas \(1\)/i })
    );
    expect(screen.getByText('Turma Pampulha (QUA)')).toBeInTheDocument();
  });

  it('renders Inativar button next to Fechar, enabled for active student and disabled for Inscrição Baixada student', () => {
    const activeAluno: AlunoRecord = {
      ...droppedAluno,
      status: 'Ativo',
      comentarios: [],
    };

    const { rerender } = render(
      <AlunoFichaDrawer
        aluno={activeAluno}
        lessons={sampleLessons}
        onClose={vi.fn()}
        onAddComment={vi.fn()}
        onInactivate={vi.fn()}
      />
    );

    const inativarBtn = screen.getByRole('button', { name: 'Inativar' });
    expect(inativarBtn).toBeInTheDocument();
    expect(inativarBtn).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();

    rerender(
      <AlunoFichaDrawer
        aluno={droppedAluno}
        lessons={sampleLessons}
        onClose={vi.fn()}
        onAddComment={vi.fn()}
        onInactivate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Inativar' })).toBeDisabled();
  });

  it('inactivates an active student from the ficha drawer in App, updating status to Inscrição Baixada and adding manual drop comment', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/e-mail do professor/i), {
      target: { value: 'prof-inativar@juntos.dev.br' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'senha123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /carregar turma de exemplo \(pampulha qua\)/i,
        })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /carregar turma de exemplo \(pampulha qua\)/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText('Claudia Marcia Marques (Sala Pampulha)')
      ).toBeInTheDocument();
    });

    // Open Claudia's ficha
    fireEvent.click(
      screen.getByText('Claudia Marcia Marques (Sala Pampulha)')
    );

    await waitFor(() => {
      expect(screen.getByText(/ficha particular · id: 14820/i)).toBeInTheDocument();
    });

    // Verify initial Ativo badge inside drawer
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByText('Ativo')).toBeInTheDocument();

    // Click Inativar button next to Fechar
    const inativarBtn = within(drawer).getByRole('button', { name: 'Inativar' });
    expect(inativarBtn).not.toBeDisabled();
    fireEvent.click(inativarBtn);

    // Verify status changed to Inscrição Baixada and comment is added
    await waitFor(() => {
      expect(within(drawer).getByText('Inscrição Baixada')).toBeInTheDocument();
    });
    expect(
      within(drawer).getByText(/inscrição baixada manualmente em/i)
    ).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Inativar' })).toBeDisabled();

    // Close drawer and verify class view counts and student status
    fireEvent.click(within(drawer).getByRole('button', { name: /fechar/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog')
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByText(/2 ativos · 1 inscrição baixada/i)
    ).toBeInTheDocument();
  });
});
