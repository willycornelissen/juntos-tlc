import React, { useEffect, useState, useCallback } from 'react';
import {
  type AuthUser,
  type ProfessorRecord,
  ADMIN_EMAIL,
  canAddTeachers,
  listProfessores,
  registerProfessor,
  removeProfessor,
} from '../services/authService';

export interface AddUserModalProps {
  adminUser: AuthUser | null;
  onClose: () => void;
  onUserAdded?: (user: AuthUser) => void;
}

export function AddUserModal({
  adminUser,
  onClose,
  onUserAdded,
}: AddUserModalProps): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [professores, setProfessores] = useState<ProfessorRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [confirmingUid, setConfirmingUid] = useState<string | null>(null);
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  const isAuthorized = canAddTeachers(adminUser);

  const loadProfessores = useCallback(async () => {
    if (!isAuthorized) {
      return;
    }
    setLoadingList(true);
    try {
      const list = await listProfessores(adminUser);
      setProfessores(list);
    } catch {
      // Ignora erro de listagem silencioso
    } finally {
      setLoadingList(false);
    }
  }, [adminUser, isAuthorized]);

  useEffect(() => {
    void loadProfessores();
  }, [loadProfessores]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Informe o e-mail ou usuário do novo professor.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const createdUser = await registerProfessor(
        adminUser,
        trimmedEmail,
        password
      );
      setSuccessMessage(
        `Professor "${createdUser.email}" cadastrado com sucesso!`
      );
      setEmail('');
      setPassword('');
      await loadProfessores();
      if (onUserAdded) {
        onUserAdded(createdUser);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível cadastrar o novo professor.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (prof: ProfessorRecord) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setRemovingUid(prof.uid);
    try {
      await removeProfessor(adminUser, prof.uid);
      setSuccessMessage(`Acesso do professor "${prof.email}" revogado com sucesso.`);
      setConfirmingUid(null);
      await loadProfessores();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível revogar o acesso do professor.'
      );
    } finally {
      setRemovingUid(null);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-users-modal-title"
    >
      <div className="modal-content" style={{ maxWidth: '680px' }}>
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
          <h2 id="manage-users-modal-title" className="card-title">
            Gerenciar Professores
          </h2>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            aria-label="Fechar diálogo"
          >
            Fechar
          </button>
        </div>

        <p className="card-meta" style={{ marginBottom: '1.25rem' }}>
          Cadastre novos professores ou revogue o acesso de professores previamente registrados.
        </p>

        {!isAuthorized ? (
          <div className="warning" role="alert">
            Apenas o usuário willy.cornelissen@gmail.com tem permissão para
            gerenciar professores.
          </div>
        ) : (
          <div>
            {errorMessage && (
              <div className="warning" role="alert">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                style={{
                  background: 'var(--success-bg)',
                  color: 'var(--success)',
                  border: '1px solid var(--success)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.9rem',
                  marginBottom: '1rem',
                  fontWeight: 500,
                }}
              >
                {successMessage}
              </div>
            )}

            {/* Formulário de Adicionar Novo Professor */}
            <form onSubmit={(e) => void handleSubmit(e)}>
              <div
                style={{
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1.15rem',
                  marginBottom: '1.5rem',
                }}
              >
                <h3
                  className="card-title"
                  style={{ fontSize: '1rem', marginBottom: '0.75rem' }}
                >
                  Novo Professor
                </h3>

                <div className="form-group">
                  <label htmlFor="new-user-email">
                    E-mail ou Usuário do Professor
                  </label>
                  <input
                    id="new-user-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="professor@escola.org"
                    disabled={loading}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="new-user-password">Senha Temporária</label>
                  <input
                    id="new-user-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    disabled={loading}
                    required
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: '0.75rem',
                  }}
                >
                  <button
                    type="submit"
                    className="btn"
                    disabled={loading}
                  >
                    {loading ? 'Adicionando...' : 'Adicionar Professor'}
                  </button>
                </div>
              </div>
            </form>

            {/* Listagem de Professores Cadastrados */}
            <div>
              <h3
                className="card-title"
                style={{
                  fontSize: '1.05rem',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Professores Cadastrados</span>
                <span className="card-meta" style={{ fontSize: '0.85rem' }}>
                  {loadingList
                    ? 'Carregando...'
                    : `${professores.length} cadastrado(s)`}
                </span>
              </h3>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                {professores.map((prof) => {
                  const isAdmin =
                    prof.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
                  const isInactive = prof.status === 'inativo';
                  const isConfirming = confirmingUid === prof.uid;
                  const isRemoving = removingUid === prof.uid;

                  return (
                    <div
                      key={prof.uid}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        background: isInactive
                          ? 'var(--surface-muted)'
                          : 'var(--surface)',
                        opacity: isInactive ? 0.8 : 1,
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontWeight: 600 }}>{prof.email}</span>
                        {isAdmin && (
                          <span className="tag" style={{ fontSize: '0.72rem' }}>
                            Administrador
                          </span>
                        )}
                        {!isAdmin && (
                          <span
                            className={`status-badge ${
                              isInactive ? 'encerrada' : 'ativo'
                            }`}
                          >
                            {isInactive ? 'Acesso Revogado' : 'Ativo'}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {!isAdmin && !isInactive && !isConfirming && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.82rem',
                              color: 'var(--danger)',
                              borderColor: 'var(--border)',
                            }}
                            onClick={() => setConfirmingUid(prof.uid)}
                            aria-label={`Remover professor ${prof.email}`}
                          >
                            Remover Acesso
                          </button>
                        )}

                        {isConfirming && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.8rem',
                                color: 'var(--danger)',
                                fontWeight: 600,
                              }}
                            >
                              Confirmar remoção?
                            </span>
                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{
                                padding: '0.3rem 0.6rem',
                                fontSize: '0.8rem',
                              }}
                              disabled={isRemoving}
                              onClick={() => void handleRemove(prof)}
                            >
                              {isRemoving ? 'Removendo...' : 'Sim, remover'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{
                                padding: '0.3rem 0.6rem',
                                fontSize: '0.8rem',
                              }}
                              disabled={isRemoving}
                              onClick={() => setConfirmingUid(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '1.5rem',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Concluir
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
