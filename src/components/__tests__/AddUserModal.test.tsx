import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AddUserModal } from '../AddUserModal';
import { App } from '../../App';
import * as authService from '../../services/authService';

describe('components/AddUserModal', () => {
  const adminUser: authService.AuthUser = {
    uid: 'demo-willy-cornelissen-gmail-com',
    email: 'willy.cornelissen@gmail.com',
  };

  const otherUser: authService.AuthUser = {
    uid: 'other-prof',
    email: 'outro@professor.org',
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders form inputs and teachers list for willy.cornelissen@gmail.com', async () => {
    render(<AddUserModal adminUser={adminUser} onClose={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: /gerenciar professores/i })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/e-mail ou usuário do professor/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/senha temporária/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /adicionar professor/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('willy.cornelissen@gmail.com')).toBeInTheDocument();
      expect(screen.getByText('Administrador')).toBeInTheDocument();
    });
  });

  it('shows permission warning if logged user is not willy.cornelissen@gmail.com', () => {
    render(<AddUserModal adminUser={otherUser} onClose={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Apenas o usuário willy.cornelissen@gmail.com tem permissão para gerenciar professores.'
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
    fireEvent.change(screen.getByLabelText(/senha temporária/i), {
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

  it('submits valid credentials, registers the professor, and shows in list', async () => {
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
    fireEvent.change(screen.getByLabelText(/senha temporária/i), {
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

    // Shows in the list
    expect(screen.getByText('maria.professora@escola.org')).toBeInTheDocument();
  });

  it('allows removing a professor and their turmas with inline confirmation and removes them from the list', async () => {
    // Pre-populate with another teacher
    await authService.registerProfessor(
      adminUser,
      'pedro.prof@escola.org',
      'senha123456'
    );

    render(<AddUserModal adminUser={adminUser} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('pedro.prof@escola.org')).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole('button', {
      name: /remover professor pedro\.prof@escola\.org/i,
    });
    fireEvent.click(removeBtn);

    expect(
      screen.getByText('Excluir professor e turmas?')
    ).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /sim, excluir/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Professor "pedro.prof@escola.org" e todas as suas turmas foram removidos com sucesso.'
      );
    });

    // The teacher must not appear in the list anymore
    expect(screen.queryByText('pedro.prof@escola.org')).not.toBeInTheDocument();
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

  it('displays "Gerenciar Professores" button beside "Sair" strictly when willy.cornelissen@gmail.com is logged in', async () => {
    vi.spyOn(authService, 'subscribeAuthState').mockImplementation((cb) => {
      cb({
        uid: 'demo-willy-cornelissen-gmail-com',
        email: 'willy.cornelissen@gmail.com',
      });
      return () => {};
    });

    render(<App />);

    const manageBtn = screen.getByRole('button', {
      name: /gerenciar professores/i,
    });
    expect(manageBtn).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();

    // Clicking the button opens the dialog
    fireEvent.click(manageBtn);
    expect(
      screen.getByRole('heading', { name: /gerenciar professores/i })
    ).toBeInTheDocument();

    // Closing the dialog removes it
    fireEvent.click(screen.getByRole('button', { name: /fechar diálogo/i }));
    expect(
      screen.queryByRole('heading', { name: /gerenciar professores/i })
    ).not.toBeInTheDocument();
  });

  it('does NOT display "Gerenciar Professores" button when any other teacher is logged in', () => {
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
      screen.queryByRole('button', { name: /gerenciar professores/i })
    ).not.toBeInTheDocument();
  });
});
