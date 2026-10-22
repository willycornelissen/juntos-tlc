import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { RelatorioEncerramentoView } from '../RelatorioEncerramentoView';
import type { AlunoRecord, LessonColumn, Turma } from '../../domain/types';

describe('components/RelatorioEncerramentoView', () => {
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
      },
      comentarios: [],
      enrolledAt: '2026-02-15T00:00:00Z',
      updatedAt: '2026-03-08T00:00:00Z',
    },
    {
      studentKey: 'aluno-2',
      externalId: '102',
      nome: 'Bruno Souza',
      status: 'Inscrição Baixada',
      presencas: {
        '01/03/26': 'F',
      },
      comentarios: [],
      enrolledAt: '2026-02-15T00:00:00Z',
      droppedAt: '2026-03-05T00:00:00Z',
      updatedAt: '2026-03-05T00:00:00Z',
    },
  ];

  const sampleTurma: Turma = {
    id: 'turma-1',
    nome: 'Turma Filosofia 2026',
    diaHorario: 'Quarta 19:30',
    local: 'Sala 1',
    catedras: ['Filosofia para viver'],
    status: 'Encerrada',
    lessons: sampleLessons,
    comentarios: [],
    activeStudentsCount: 1,
    droppedStudentsCount: 1,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-03-08T00:00:00Z',
    closedAt: '2026-03-09T00:00:00Z',
  };

  it('renders executive KPI cards with correct metrics (ENCERR-02)', () => {
    render(
      <RelatorioEncerramentoView turma={sampleTurma} alunos={sampleAlunos} />
    );

    expect(screen.getByText('Relatório de Encerramento')).toBeInTheDocument();
    // Retention rate: 1 active out of 2 = 50%
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
    expect(screen.getByText(/Taxa de Retenção/i)).toBeInTheDocument();
    expect(screen.getByText(/Frequência Média Global/i)).toBeInTheDocument();
    expect(screen.getByText(/Total de Aulas/i)).toBeInTheDocument();
  });

  it('renders all 6 charts and visual sections (ENCERR-02)', () => {
    render(
      <RelatorioEncerramentoView turma={sampleTurma} alunos={sampleAlunos} />
    );

    // 1. Donut: Conclusão vs. Evasão
    expect(
      screen.getByRole('region', { name: /Conclusão vs. Evasão/i })
    ).toBeInTheDocument();

    // 2. Linha do Tempo de Evasão
    expect(
      screen.getByRole('region', { name: /Linha do Tempo de Evasão/i })
    ).toBeInTheDocument();

    // 3. Curva de Presença por Aula
    expect(
      screen.getByRole('region', { name: /Curva de Presença por Aula/i })
    ).toBeInTheDocument();

    // 4. Distribuição Geral de Ocorrências
    expect(
      screen.getByRole('region', { name: /Distribuição Geral de Ocorrências/i })
    ).toBeInTheDocument();

    // 5. Histograma de Faixas de Assiduidade
    expect(
      screen.getByRole('region', { name: /Faixas de Assiduidade Final/i })
    ).toBeInTheDocument();

    // 6. Frequência por Instrutor
    expect(
      screen.getByRole('region', { name: /Frequência Média por Instrutor/i })
    ).toBeInTheDocument();
  });

  it('handles empty turma with no lessons without errors', () => {
    const emptyTurma: Turma = {
      ...sampleTurma,
      lessons: [],
      activeStudentsCount: 0,
      droppedStudentsCount: 0,
    };

    render(<RelatorioEncerramentoView turma={emptyTurma} alunos={[]} />);
    expect(screen.getByText('Relatório de Encerramento')).toBeInTheDocument();
    expect(screen.getByText(/Sem aulas registradas/i)).toBeInTheDocument();
  });
});
