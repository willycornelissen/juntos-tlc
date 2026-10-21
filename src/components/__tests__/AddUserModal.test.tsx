import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AddUserModal } from '../AddUserModal';
import { App } from '../../App';
import * as authService from '../../services/authService';

describe('components/AddUserModal', () => {
  const adminUser: authService.AuthUser = {
    uid: 'admin-willy',
    email: 'willy.cornelissen@gmail.com',
  };

  const otherUser: authService.AuthUser = {
    uid: 'other-prof',
    email: 'outro@professor.org',
  };

  it('renders form inputs for willy.cornelissen@gmail.com', () => {
    render(<AddUserModal adminUser={adminUser} onClose={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: /adicionar novo professor/i })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/e-mail ou usuário do professor/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /adicionar professor/i })
    ).toBeInTheDocument();
  });

  it('shows permission warning if logged user is not willy.cornelissen@gmail.com', () => {
    render(<AddUserModal adminUser={otherUser} onClose={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Apenas o usuário willy.cornelissen@gmail.com tem permissão para adicionar novos professores.'
    );
    expect(
      screen.queryByLabelText(/e-mail ou usuário do professor/i)
    ).not.toBeInTheDocument();
  });

  it('validates minimum password length and shows localized error message', async () => {
    render(<AddUserModal adminUser={adminUser} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/e-mail ou usuário do professor/i), {
      target: { value: 'novo@escola.org' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: '123' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /adicionar professor/i })
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A senha deve conter no mínimo 6 caracteres.'
      );
    });
  });

  it('submits valid credentials, registers the professor, and displays success status', async () => {
    const onUserAdded = vi.fn();
    const onClose = vi.fn();

    render(
      <AddUserModal
        adminUser={adminUser}
        onClose={onClose}
        onUserAdded={onUserAdded}
      />
    );

    fireEvent.change(screen.getByLabelText(/e-mail ou usuário do professor/i), {
      target: { value: 'maria.professora@escola.org' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'senhaForte123' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /adicionar professor/i })
    );

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Professor "maria.professora@escola.org" cadastrado com sucesso!'
      );
    });

    expect(onUserAdded).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'maria.professora@escola.org',
      })
    );

    // After success, clicking Concluir triggers onClose
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes dialog when clicking Fechar button in header', () => {
    const onClose = vi.fn();
    render(<AddUserModal adminUser={adminUser} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /fechar diálogo/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('App integration for user management button', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('displays "Adicionar Usuário" button beside "Sair" strictly when willy.cornelissen@gmail.com is logged in', async () => {
    vi.spyOn(authService, 'subscribeAuthState').mockImplementation((cb) => {
      cb({
        uid: 'willy-uid',
        email: 'willy.cornelissen@gmail.com',
      });
      return () => {};
    });

    render(<App />);

    const addUserBtn = screen.getByRole('button', {
      name: /adicionar usuário/i,
    });
    expect(addUserBtn).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();

    // Clicking the button opens the dialog
    fireEvent.click(addUserBtn);
    expect(
      screen.getByRole('heading', { name: /adicionar novo professor/i })
    ).toBeInTheDocument();

    // Closing the dialog removes it
    fireEvent.click(screen.getByRole('button', { name: /fechar diálogo/i }));
    expect(
      screen.queryByRole('heading', { name: /adicionar novo professor/i })
    ).not.toBeInTheDocument();
  });

  it('does NOT display "Adicionar Usuário" button when any other teacher is logged in', () => {
    vi.spyOn(authService, 'subscribeAuthState').mockImplementation((cb) => {
      cb({
        uid: 'other-uid',
        email: 'carlos.professor@filosofia.org',
      });
      return () => {};
    });

    render(<App />);

    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /adicionar usuário/i })
    ).not.toBeInTheDocument();
  });
});
