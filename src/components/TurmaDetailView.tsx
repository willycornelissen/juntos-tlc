import React, { useMemo, useState } from 'react';
import { RelatorioEncerramentoView } from './RelatorioEncerramentoView';
import {
  computeLessonPresenceRate,
  computeStudentMetrics,
} from '../domain/attendanceCalc';
import { formatDatePtBr } from '../domain/syncEngine';
import {
  type AlunoRecord,
  type Turma,
  type TurmaStatus,
  type UpdateTurmaMetadataInput,
  validateCommentText,
  validateTurmaMetadata,
} from '../domain/types';

export type StudentStatusFilter = 'Todos' | 'Ativos' | 'Inscrição Baixada';

export type TurmaDetailTab = 'matriz' | 'relatorio';

export interface TurmaDetailViewProps {
  turma: Turma;
  alunos: AlunoRecord[];
  onBack: () => void;
  onSelectStudent: (aluno: AlunoRecord) => void;
  onOpenReimportModal: () => void;
  onUpdateMetadata: (patch: UpdateTurmaMetadataInput) => Promise<void>;
  onChangeStatus: (
    status: TurmaStatus,
    closingComment?: string
  ) => Promise<void>;
  onAddTurmaComment: (text: string) => Promise<void>;
}

export function TurmaDetailView({
  turma,
  alunos,
  onBack,
  onSelectStudent,
  onOpenReimportModal,
  onUpdateMetadata,
  onChangeStatus,
  onAddTurmaComment,
}: TurmaDetailViewProps): React.ReactElement {
  // Inline metadata edit state
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editNome, setEditNome] = useState(turma.nome);
  const [editDiaHorario, setEditDiaHorario] = useState(turma.diaHorario);
  const [editLocal, setEditLocal] = useState(turma.local);
  const [editCatedras, setEditCatedras] = useState(turma.catedras.join(', '));
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);

  // Encerrar turma form state
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closingComment, setClosingComment] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);

  // View tab state (Matriz vs Relatório)
  const [activeTab, setActiveTab] = useState<TurmaDetailTab>('matriz');

  // Student filter & search state
  const [statusFilter, setStatusFilter] =
    useState<StudentStatusFilter>('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Class comment form state
  const [newCommentText, setNewCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  const startEditMetadata = () => {
    setEditNome(turma.nome);
    setEditDiaHorario(turma.diaHorario);
    setEditLocal(turma.local);
    setEditCatedras(turma.catedras.join(', '));
    setMetadataError(null);
    setIsEditingMetadata(true);
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    setMetadataError(null);

    const catedrasList = editCatedras
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    const validation = validateTurmaMetadata({
      nome: editNome,
      diaHorario: editDiaHorario,
      local: editLocal,
      catedras: catedrasList,
    });

    if (!validation.valid || !validation.normalized) {
      setMetadataError(validation.error ?? 'Dados inválidos.');
      return;
    }

    setSavingMetadata(true);
    try {
      await onUpdateMetadata(validation.normalized);
      setIsEditingMetadata(false);
    } catch (err) {
      setMetadataError(
        err instanceof Error ? err.message : 'Erro ao atualizar turma.'
      );
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleConfirmEncerrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingStatus(true);
    try {
      const trimmedClosing = closingComment.trim();
      await onChangeStatus(
        'Encerrada',
        trimmedClosing.length > 0 ? trimmedClosing : undefined
      );
      setShowCloseForm(false);
      setClosingComment('');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleReopenTurma = async () => {
    setChangingStatus(true);
    try {
      await onChangeStatus('Ativa');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleSubmitTurmaComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError(null);

    const validation = validateCommentText(newCommentText);
    if (!validation.valid || !validation.trimmed) {
      setCommentError(
        validation.error ?? 'O comentário não pode estar vazio.'
      );
      return;
    }

    setSubmittingComment(true);
    try {
      await onAddTurmaComment(validation.trimmed);
      setNewCommentText('');
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : 'Erro ao salvar comentário.'
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  const filteredAlunos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return alunos.filter((aluno) => {
      if (statusFilter === 'Ativos' && aluno.status !== 'Ativo') {
        return false;
      }
      if (
        statusFilter === 'Inscrição Baixada' &&
        aluno.status !== 'Inscrição Baixada'
      ) {
        return false;
      }
      if (query.length > 0) {
        const matchesName = aluno.nome.toLowerCase().includes(query);
        const matchesId = aluno.externalId.toLowerCase().includes(query);
        return matchesName || matchesId;
      }
      return true;
    });
  }, [alunos, statusFilter, searchQuery]);

  const sortedComments = useMemo(() => {
    return [...turma.comentarios].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
  }, [turma.comentarios]);

  return (
    <section>
      <div
        style={{
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          ← Voltar para turmas
        </button>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {turma.status === 'Ativa' ? (
            <>
              <button
                type="button"
                className="btn"
                onClick={onOpenReimportModal}
              >
                Importar planilha (.xlsx)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCloseForm((prev) => !prev)}
                disabled={changingStatus}
              >
                Encerrar turma
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                disabled
                title="Turma encerrada: reabra a turma para importar novas planilhas."
              >
                Importar planilha (.xlsx)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void handleReopenTurma()}
                disabled={changingStatus}
              >
                Reabrir turma
              </button>
            </>
          )}
        </div>
      </div>

      {turma.status === 'Encerrada' && (
        <div
          className="card"
          style={{
            marginBottom: '1rem',
            background: 'var(--surface-muted)',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <span>
            Esta turma está <strong>Encerrada</strong>. A reimportação de
            planilhas (.xlsx) está bloqueada até que a turma seja reaberta.
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setActiveTab('relatorio')}
          >
            Ver Relatório de Encerramento →
          </button>
        </div>
      )}

      {showCloseForm && turma.status === 'Ativa' && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 className="card-title">Encerrar Turma</h3>
          <p className="card-meta">
            Ao encerrar a turma, ela será movida para a aba de Turmas Encerradas
            e novas importações de planilha ficarão bloqueadas.
          </p>
          <form onSubmit={handleConfirmEncerrar}>
            <div className="form-group">
              <label htmlFor="closing-comment-input">
                Comentário de encerramento (opcional)
              </label>
              <textarea
                id="closing-comment-input"
                rows={3}
                value={closingComment}
                onChange={(e) => setClosingComment(e.target.value)}
                placeholder="Observações finais sobre o ciclo desta turma..."
              />
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={changingStatus}
              >
                Confirmar encerramento
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCloseForm(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Class Metadata Header / Inline Editor */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        {!isEditingMetadata ? (
          <>
            <div className="card-header">
              <div>
                <h2 className="card-title" style={{ fontSize: '1.5rem' }}>
                  {turma.nome}
                </h2>
                <div
                  className="card-meta"
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    marginTop: '0.35rem',
                  }}
                >
                  <span>
                    <strong>Dia/Horário:</strong> {turma.diaHorario}
                  </span>
                  <span>
                    <strong>Local:</strong> {turma.local}
                  </span>
                  <span>
                    <strong>Alunos:</strong> {turma.activeStudentsCount} ativos
                    {' · '}
                    {turma.droppedStudentsCount} inscrição baixada
                  </span>
                </div>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
              >
                <span
                  className={`status-badge ${
                    turma.status === 'Ativa' ? 'ativa' : 'encerrada'
                  }`}
                >
                  {turma.status}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={startEditMetadata}
                >
                  Editar dados
                </button>
              </div>
            </div>

            <div className="tags" aria-label="Cátedras">
              {turma.catedras.map((c) => (
                <span key={c} className="tag">
                  {c}
                </span>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={handleSaveMetadata} noValidate>
            <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>
              Editar dados da turma
            </h3>

            {metadataError && (
              <div className="warning" role="alert">
                {metadataError}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="edit-turma-nome">Nome da turma</label>
              <input
                id="edit-turma-nome"
                type="text"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-turma-horario">Dia e horário</label>
              <input
                id="edit-turma-horario"
                type="text"
                value={editDiaHorario}
                onChange={(e) => setEditDiaHorario(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-turma-local">Local</label>
              <input
                id="edit-turma-local"
                type="text"
                value={editLocal}
                onChange={(e) => setEditLocal(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-turma-catedras">
                Cátedras (separadas por vírgula)
              </label>
              <input
                id="edit-turma-catedras"
                type="text"
                value={editCatedras}
                onChange={(e) => setEditCatedras(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                type="submit"
                className="btn"
                disabled={savingMetadata}
              >
                Salvar alterações
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditingMetadata(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* View Switcher Tabs */}
      <div
        role="tablist"
        aria-label="Visualizações da turma"
        style={{
          display: 'flex',
          gap: '0.6rem',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '0.75rem',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'matriz'}
          className={`btn ${activeTab === 'matriz' ? '' : 'btn-secondary'}`}
          onClick={() => setActiveTab('matriz')}
        >
          📋 Matriz de Chamada
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'relatorio'}
          className={`btn ${activeTab === 'relatorio' ? '' : 'btn-secondary'}`}
          style={
            turma.status === 'Encerrada' && activeTab !== 'relatorio'
              ? { borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 600 }
              : {}
          }
          onClick={() => setActiveTab('relatorio')}
        >
          📊 Relatório de Encerramento
          {turma.status === 'Encerrada' && (
            <span
              style={{
                marginLeft: '0.5rem',
                fontSize: '0.75rem',
                background: 'var(--primary)',
                color: '#ffffff',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                verticalAlign: 'middle',
              }}
            >
              Disponível
            </span>
          )}
        </button>
      </div>

      {activeTab === 'relatorio' ? (
        <div style={{ marginBottom: '2rem' }}>
          <RelatorioEncerramentoView turma={turma} alunos={alunos} />
        </div>
      ) : (
        <>
          {/* Filter Bar */}
      <div
        className="card"
        style={{
          marginBottom: '1rem',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div
          role="group"
          aria-label="Filtrar alunos por status"
          style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}
        >
          {(
            ['Todos', 'Ativos', 'Inscrição Baixada'] as StudentStatusFilter[]
          ).map((filterOption) => (
            <button
              key={filterOption}
              type="button"
              className={`btn ${
                statusFilter === filterOption ? '' : 'btn-secondary'
              }`}
              onClick={() => setStatusFilter(filterOption)}
            >
              {filterOption}
            </button>
          ))}
        </div>

        <div style={{ flex: '1 1 260px', maxWidth: '380px' }}>
          <input
            type="search"
            aria-label="Buscar aluno por nome ou ID"
            placeholder="Buscar aluno por nome ou ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Attendance Matrix Table */}
      <div className="matrix-wrapper" style={{ marginBottom: '2rem' }}>
        <table className="matrix-table" aria-label="Matriz de chamada da turma">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Status</th>
              <th>% Trim</th>
              <th>% Ano</th>
              {turma.lessons.map((lesson) => {
                const lessonRate = computeLessonPresenceRate(
                  lesson.dateKey,
                  alunos
                );
                return (
                  <th
                    key={lesson.dateKey}
                    title={`${lesson.course} — ${lesson.theme} (${lesson.instructor})`}
                  >
                    <div>{lesson.dateKey}</div>
                    <div
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 400,
                        color: 'var(--muted)',
                      }}
                    >
                      {lesson.theme}
                    </div>
                    <div
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 400,
                        color: 'var(--muted)',
                      }}
                    >
                      {lesson.instructor}
                    </div>
                    <div
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        color: 'var(--primary)',
                      }}
                    >
                      {lessonRate !== null ? `${lessonRate}%` : '-'}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredAlunos.length === 0 ? (
              <tr>
                <td
                  colSpan={5 + turma.lessons.length}
                  style={{ textAlign: 'center', padding: '1.25rem' }}
                >
                  Nenhum aluno encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              filteredAlunos.map((aluno) => {
                const metrics = computeStudentMetrics(
                  turma.lessons,
                  aluno.presencas
                );
                const isDropped = aluno.status === 'Inscrição Baixada';
                return (
                  <tr
                    key={aluno.studentKey}
                    className={`matrix-row-clickable ${
                      isDropped ? 'matrix-row-dropped' : ''
                    }`}
                    onClick={() => onSelectStudent(aluno)}
                  >
                    <td>{aluno.externalId || '-'}</td>
                    <td>
                      <strong>{aluno.nome}</strong>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          isDropped ? 'baixada' : 'ativo'
                        }`}
                      >
                        {aluno.status}
                      </span>
                    </td>
                    <td>
                      {metrics.percentTrim !== null
                        ? `${metrics.percentTrim}%`
                        : '-'}
                    </td>
                    <td>
                      {metrics.percentAno !== null
                        ? `${metrics.percentAno}%`
                        : '-'}
                    </td>
                    {turma.lessons.map((lesson) => {
                      const code = aluno.presencas[lesson.dateKey];
                      return (
                        <td
                          key={lesson.dateKey}
                          style={{ textAlign: 'center' }}
                        >
                          {code ? (
                            <span className={`att-badge att-${code}`}>
                              {code}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </>
      )}

      {/* Class Comments Section */}
      <div className="card">
        <h3 className="card-title">Comentários da Turma</h3>

        {sortedComments.length === 0 ? (
          <p className="card-meta">
            Nenhum comentário registrado para esta turma ainda.
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
            {sortedComments.map((comment) => (
              <li
                key={comment.id}
                style={{
                  background: 'var(--surface-muted)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--muted)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {comment.authorType === 'sistema' ? 'Sistema' : 'Professor'}{' '}
                  · {formatDatePtBr(comment.createdAt)}
                </div>
                <div>{comment.text}</div>
              </li>
            ))}
          </ul>
        )}

        {commentError && (
          <div className="warning" role="alert">
            {commentError}
          </div>
        )}

        <form onSubmit={handleSubmitTurmaComment} noValidate>
          <div className="form-group">
            <label htmlFor="novo-comentario-turma">
              Adicionar comentário da turma
            </label>
            <textarea
              id="novo-comentario-turma"
              rows={2}
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Registre observações gerais sobre o andamento da turma..."
            />
          </div>
          <button
            type="submit"
            className="btn"
            disabled={submittingComment}
          >
            Salvar comentário
          </button>
        </form>
      </div>
    </section>
  );
}
