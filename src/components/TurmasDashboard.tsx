import React, { useState } from 'react';
import {
  ChamadaParseError,
  parseChamadaBuffer,
} from '../domain/chamadaParser';
import {
  type CreateTurmaInput,
  type ParsedChamada,
  type Turma,
  validateTurmaMetadata,
} from '../domain/types';
import { mapAuthErrorToPtBr } from '../services/authService';

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao ler arquivo.'));
      }
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}

export interface LoginViewProps {
  onSignIn: (email: string, password: string) => Promise<void>;
}

export function LoginView({ onSignIn }: LoginViewProps): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await onSignIn(email, password);
    } catch (err) {
      if (err instanceof Error && err.message && !err.message.startsWith('Firebase:')) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(mapAuthErrorToPtBr(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-logo-wrapper">
          <img
            src={`${import.meta.env.BASE_URL}juntos.png`}
            alt="Logotipo Juntos"
            className="login-logo"
          />
        </div>
        <p className="subtitle">
          Acompanhamento de turmas, chamadas e fichas particulares de alunos.
        </p>

        {errorMessage && (
          <div className="warning" role="alert">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login-email">E-mail do professor</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="professor@exemplo.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
            />
          </div>

          <button
            type="submit"
            className="btn"
            disabled={submitting}
            style={{ width: '100%' }}
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export type DashboardTab = 'ativas' | 'encerradas' | 'nova';

export interface TurmasDashboardProps {
  turmas: Turma[];
  onSelectTurma: (turmaId: string) => void;
  onCreateTurma: (
    input: CreateTurmaInput,
    parsed: ParsedChamada
  ) => Promise<void>;
  onLoadSampleTurma?: () => Promise<void>;
}

export function TurmasDashboard({
  turmas,
  onSelectTurma,
  onCreateTurma,
  onLoadSampleTurma,
}: TurmasDashboardProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<DashboardTab>('ativas');

  // + Nova Turma form state
  const [nome, setNome] = useState('');
  const [diaHorario, setDiaHorario] = useState('');
  const [local, setLocal] = useState('');
  const [catedrasText, setCatedrasText] = useState('');
  const [parsedChamada, setParsedChamada] = useState<ParsedChamada | null>(
    null
  );
  const [fileName, setFileName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const turmasAtivas = turmas.filter((t) => t.status === 'Ativa');
  const turmasEncerradas = turmas.filter((t) => t.status === 'Encerrada');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setFormError(null);
    setFileName(file.name);

    try {
      const buffer = await readFileAsArrayBuffer(file);
      const parsed = parseChamadaBuffer(buffer);
      setParsedChamada(parsed);
      if (parsed.nomeTurmaPlanilha) {
        setNome(parsed.nomeTurmaPlanilha);
      }
      if (parsed.cidadePlanilha) {
        setLocal(parsed.cidadePlanilha);
      }
    } catch (err) {
      setParsedChamada(null);
      if (err instanceof ChamadaParseError || err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('Não foi possível ler a planilha Excel (.xlsx).');
      }
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!parsedChamada) {
      setFormError('Selecione uma planilha de chamada (.xlsx) válida.');
      return;
    }

    const catedras = catedrasText
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    const validation = validateTurmaMetadata({
      nome,
      diaHorario,
      local,
      catedras,
    });

    if (!validation.valid || !validation.normalized) {
      setFormError(validation.error ?? 'Preencha todos os campos obrigatórios.');
      return;
    }

    setCreating(true);
    try {
      await onCreateTurma(
        {
          ...validation.normalized,
          cidadePlanilha: parsedChamada.cidadePlanilha,
        },
        parsedChamada
      );
      setNome('');
      setDiaHorario('');
      setLocal('');
      setCatedrasText('');
      setParsedChamada(null);
      setFileName('');
      setActiveTab('ativas');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Erro ao criar a turma.'
      );
    } finally {
      setCreating(false);
    }
  };

  const displayedTurmas =
    activeTab === 'ativas' ? turmasAtivas : turmasEncerradas;

  return (
    <section>
      <div className="tabs" role="tablist" aria-label="Navegação de turmas">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ativas'}
          className={`tab ${activeTab === 'ativas' ? 'active' : ''}`}
          onClick={() => setActiveTab('ativas')}
        >
          Turmas Ativas ({turmasAtivas.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'encerradas'}
          className={`tab ${activeTab === 'encerradas' ? 'active' : ''}`}
          onClick={() => setActiveTab('encerradas')}
        >
          Turmas Encerradas ({turmasEncerradas.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'nova'}
          className={`tab ${activeTab === 'nova' ? 'active' : ''}`}
          onClick={() => {
            setFormError(null);
            setActiveTab('nova');
          }}
        >
          + Nova Turma
        </button>
      </div>

      {activeTab === 'nova' ? (
        <div className="card" style={{ maxWidth: '680px' }}>
          <h2 className="card-title">Criar Nova Turma</h2>
          <p className="card-meta">
            Envie a planilha de chamada (.xlsx) para preencher os dados iniciais
            e cadastrar os alunos automaticamente.
          </p>

          {formError && (
            <div className="warning" role="alert">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="nova-turma-xlsx">
                Planilha de chamada (.xlsx)
              </label>
              <input
                id="nova-turma-xlsx"
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
              />
            </div>

            {parsedChamada && (
              <div
                className="card-meta"
                style={{
                  background: 'var(--surface-muted)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                }}
              >
                <strong>Planilha carregada ({fileName}):</strong>{' '}
                {parsedChamada.students.length} alunos e{' '}
                {parsedChamada.lessons.length} aulas identificadas.
              </div>
            )}

            <div className="form-group">
              <label htmlFor="nova-turma-nome">Nome da turma</label>
              <input
                id="nova-turma-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Turma Pampulha (QUA)"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="nova-turma-dia-horario">
                Dia e horário das aulas
              </label>
              <input
                id="nova-turma-dia-horario"
                type="text"
                value={diaHorario}
                onChange={(e) => setDiaHorario(e.target.value)}
                placeholder="Ex: Quarta-feira, 19h30"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="nova-turma-local">Local</label>
              <input
                id="nova-turma-local"
                type="text"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Ex: Pampulha - Belo Horizonte"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="nova-turma-catedras">
                Cátedras (separadas por vírgula)
              </label>
              <input
                id="nova-turma-catedras"
                type="text"
                value={catedrasText}
                onChange={(e) => setCatedrasText(e.target.value)}
                placeholder="Ex: Filosofia para Viver, Transpasso"
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn" disabled={creating}>
                {creating ? 'Criando turma...' : 'Criar Turma'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveTab('ativas')}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : displayedTurmas.length === 0 ? (
        <div className="card">
          <p className="card-meta">
            {activeTab === 'ativas'
              ? 'Nenhuma turma ativa cadastrada no momento.'
              : 'Nenhuma turma encerrada encontrada.'}
          </p>
          {activeTab === 'ativas' && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setActiveTab('nova')}
              >
                + Nova Turma
              </button>
              {onLoadSampleTurma && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void onLoadSampleTurma()}
                >
                  Carregar turma de exemplo (Pampulha QUA)
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="turmas-grid">
          {displayedTurmas.map((turma) => (
            <article key={turma.id} className="card">
              <div className="card-header">
                <h2 className="card-title">{turma.nome}</h2>
                <span
                  className={`status-badge ${
                    turma.status === 'Ativa' ? 'ativa' : 'encerrada'
                  }`}
                >
                  {turma.status}
                </span>
              </div>

              <div className="card-meta">
                <span>
                  <strong>Horário:</strong> {turma.diaHorario}
                </span>
                <span>
                  <strong>Local:</strong> {turma.local}
                </span>
                <span>
                  <strong>Alunos:</strong> {turma.activeStudentsCount} ativos
                  {turma.droppedStudentsCount > 0
                    ? ` · ${turma.droppedStudentsCount} inscrição baixada`
                    : ''}
                </span>
              </div>

              <div className="tags" aria-label="Cátedras da turma">
                {turma.catedras.map((cat) => (
                  <span key={cat} className="tag">
                    {cat}
                  </span>
                ))}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => onSelectTurma(turma.id)}
                >
                  Abrir turma
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
