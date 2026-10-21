import React, { useMemo, useState } from 'react';
import { computeStudentMetrics } from '../domain/attendanceCalc';
import { formatDatePtBr } from '../domain/syncEngine';
import {
  ATTENDANCE_CODES,
  type AlunoRecord,
  type LessonColumn,
  validateCommentText,
} from '../domain/types';

export interface AlunoFichaDrawerProps {
  aluno: AlunoRecord;
  lessons: LessonColumn[];
  onClose: () => void;
  onAddComment: (studentKey: string, text: string) => Promise<void>;
  onInactivate?: (studentKey: string) => Promise<void>;
}

export function AlunoFichaDrawer({
  aluno,
  lessons,
  onClose,
  onAddComment,
  onInactivate,
}: AlunoFichaDrawerProps): React.ReactElement {
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inactivating, setInactivating] = useState(false);
  const [inactivateError, setInactivateError] = useState<string | null>(null);

  const metrics = useMemo(
    () => computeStudentMetrics(lessons, aluno.presencas),
    [lessons, aluno.presencas]
  );

  // Chronological lesson history (oldest to newest or newest to oldest — sorted by isoDate ascending for chronological progression)
  const chronologicalLessons = useMemo(() => {
    return [...lessons].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  }, [lessons]);

  const chronologicalComments = useMemo(() => {
    return [...aluno.comentarios].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
  }, [aluno.comentarios]);

  const isDropped = aluno.status === 'Inscrição Baixada';

  const handleInactivate = async () => {
    if (isDropped || inactivating || !onInactivate) {
      return;
    }
    setInactivating(true);
    setInactivateError(null);
    try {
      await onInactivate(aluno.studentKey);
    } catch (err) {
      setInactivateError(
        err instanceof Error ? err.message : 'Erro ao inativar aluno.'
      );
    } finally {
      setInactivating(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError(null);

    const validation = validateCommentText(commentText);
    if (!validation.valid || !validation.trimmed) {
      setCommentError(
        validation.error ?? 'O comentário não pode estar vazio.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await onAddComment(aluno.studentKey, validation.trimmed);
      setCommentText('');
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : 'Erro ao salvar comentário.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ficha-aluno-title"
    >
      <aside className="drawer-panel">
        <div
          className="card-header"
          style={{
            borderBottom: '1px solid var(--border)',
            paddingBottom: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <span className="card-meta">
              Ficha Particular · ID: {aluno.externalId || '-'}
            </span>
            <h2
              id="ficha-aluno-title"
              className="card-title"
              style={{ fontSize: '1.4rem', marginTop: '0.2rem' }}
            >
              {aluno.nome}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span
              className={`status-badge ${isDropped ? 'baixada' : 'ativo'}`}
            >
              {aluno.status}
            </span>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void handleInactivate()}
              disabled={isDropped || inactivating}
              title={isDropped ? 'Aluno já está inativo' : undefined}
            >
              {inactivating ? 'Inativando...' : 'Inativar'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        </div>

        {inactivateError && (
          <div className="warning" role="alert" style={{ marginBottom: '1rem' }}>
            {inactivateError}
          </div>
        )}

        {/* Attendance Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.25rem',
          }}
        >
          <div
            style={{
              background: 'var(--surface-muted)',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
            }}
          >
            <div className="card-meta">% Trimestre (9 últimas)</div>
            <strong style={{ fontSize: '1.35rem', color: 'var(--primary)' }}>
              {metrics.percentTrim !== null ? `${metrics.percentTrim}%` : '-'}
            </strong>
          </div>

          <div
            style={{
              background: 'var(--surface-muted)',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
            }}
          >
            <div className="card-meta">% Ano (Total)</div>
            <strong style={{ fontSize: '1.35rem', color: 'var(--primary)' }}>
              {metrics.percentAno !== null ? `${metrics.percentAno}%` : '-'}
            </strong>
          </div>
        </div>

        {/* Counts of P, A, R, F, J */}
        <div
          style={{
            display: 'flex',
            gap: '0.6rem',
            flexWrap: 'wrap',
            marginBottom: '1.5rem',
          }}
          aria-label="Contagem de presenças e faltas"
        >
          {ATTENDANCE_CODES.map((code) => (
            <div
              key={code}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'var(--surface-muted)',
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
              }}
            >
              <span className={`att-badge att-${code}`}>{code}</span>
              <strong>{metrics.counts[code]}</strong>
            </div>
          ))}
        </div>

        {/* Comments Timeline & Form */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>
            Acompanhamento e Comentários ({chronologicalComments.length})
          </h3>

          {chronologicalComments.length === 0 ? (
            <p className="card-meta">
              Nenhum comentário registrado na ficha deste aluno.
            </p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              {chronologicalComments.map((entry) => {
                const isSystem = entry.authorType === 'sistema';
                return (
                  <li
                    key={entry.id}
                    style={{
                      background: isSystem
                        ? 'var(--danger-bg)'
                        : 'var(--surface-muted)',
                      borderLeft: `3px solid ${
                        isSystem ? 'var(--danger)' : 'var(--primary)'
                      }`,
                      padding: '0.7rem 0.95rem',
                      borderRadius: '6px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        color: isSystem ? 'var(--danger)' : 'var(--muted)',
                        marginBottom: '0.2rem',
                      }}
                    >
                      {isSystem ? 'Registro automático do sistema' : 'Professor'}{' '}
                      · {formatDatePtBr(entry.createdAt)}
                    </div>
                    <div>{entry.text}</div>
                  </li>
                );
              })}
            </ul>
          )}

          {commentError && (
            <div className="warning" role="alert">
              {commentError}
            </div>
          )}

          <form onSubmit={handleSubmitComment} noValidate>
            <div className="form-group">
              <label htmlFor="ficha-novo-comentario">
                Novo comentário na ficha particular
              </label>
              <textarea
                id="ficha-novo-comentario"
                rows={3}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Adicione observações pedagógicas, motivos de falta ou contato realizado..."
              />
            </div>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Adicionar comentário'}
            </button>
          </form>
        </div>

        {/* Chronological Lesson Attendance Table */}
        <div>
          <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>
            Histórico de Aulas ({chronologicalLessons.length})
          </h3>
          <div className="matrix-wrapper">
            <table
              className="matrix-table"
              aria-label="Histórico de presença do aluno"
            >
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Presença</th>
                  <th>Curso</th>
                  <th>Tema</th>
                  <th>Instrutor</th>
                </tr>
              </thead>
              <tbody>
                {chronologicalLessons.map((lesson) => {
                  const code = aluno.presencas[lesson.dateKey];
                  return (
                    <tr key={lesson.dateKey}>
                      <td>{lesson.dateKey}</td>
                      <td style={{ textAlign: 'center' }}>
                        {code ? (
                          <span className={`att-badge att-${code}`}>{code}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{lesson.course || '-'}</td>
                      <td>{lesson.theme || '-'}</td>
                      <td>{lesson.instructor || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </aside>
    </div>
  );
}
