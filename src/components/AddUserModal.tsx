import React, { useState } from 'react';
import {
  type AuthUser,
  canAddTeachers,
  registerProfessor,
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

  const isAuthorized = canAddTeachers(adminUser);

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

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-user-modal-title"
    >
      <div className="modal-content">
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
          <h2 id="add-user-modal-title" className="card-title">
            Adicionar Novo Professor
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
          Cadastre as credenciais de acesso (usuário e senha) para um novo
          professor no sistema.
        </p>

        {!isAuthorized ? (
          <div className="warning" role="alert">
            Apenas o usuário willy.cornelissen@gmail.com tem permissão para
            adicionar novos professores.
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)}>
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
                autoFocus
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-user-password">Senha</label>
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
                gap: '0.75rem',
                justifyContent: 'flex-end',
                marginTop: '1.25rem',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                {successMessage ? 'Concluir' : 'Cancelar'}
              </button>
              <button
                type="submit"
                className="btn"
                disabled={loading}
              >
                {loading ? 'Adicionando...' : 'Adicionar Professor'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
