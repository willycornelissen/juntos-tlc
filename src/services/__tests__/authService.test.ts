import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCurrentAuthUser,
  isFirebaseConfigured,
  mapAuthErrorToPtBr,
  signInProfessor,
  signOutProfessor,
  subscribeAuthState,
  type AuthUser,
} from '../authService';

describe('services/authService', () => {
  beforeEach(async () => {
    localStorage.clear();
    await signOutProfessor();
  });

  it('maps Firebase Authentication error codes and objects to clear Portuguese messages (AUTH-02)', () => {
    expect(mapAuthErrorToPtBr('auth/invalid-credential')).toBe(
      'E-mail ou senha inválidos.'
    );
    expect(mapAuthErrorToPtBr({ code: 'auth/wrong-password' })).toBe(
      'E-mail ou senha inválidos.'
    );
    expect(mapAuthErrorToPtBr({ code: 'auth/user-not-found' })).toBe(
      'E-mail ou senha inválidos.'
    );
    expect(mapAuthErrorToPtBr('auth/invalid-email')).toBe(
      'Informe um endereço de e-mail válido.'
    );
    expect(mapAuthErrorToPtBr('auth/too-many-requests')).toBe(
      'Muitas tentativas de acesso. Tente novamente em alguns instantes.'
    );
    expect(mapAuthErrorToPtBr('auth/network-request-failed')).toBe(
      'Falha de conexão com a rede. Verifique sua internet e tente novamente.'
    );
    expect(mapAuthErrorToPtBr('auth/unknown-error')).toBe(
      'Não foi possível autenticar. Verifique suas credenciais e tente novamente.'
    );
  });

  it('signs in with valid credentials, persists session in localStorage, and notifies subscribers (AUTH-01 AC 1, 2)', async () => {
    expect(isFirebaseConfigured()).toBe(false);
    expect(getCurrentAuthUser()).toBeNull();

    const observedStates: Array<AuthUser | null> = [];
    const unsubscribe = subscribeAuthState((user) => {
      observedStates.push(user);
    });

    // Initial emission is null when unauthenticated
    expect(observedStates).toEqual([null]);

    const user = await signInProfessor('willy@filosofia.org.br', 'senhaSegura123');
    expect(user).toEqual({
      uid: 'demo-willy-filosofia-org-br',
      email: 'willy@filosofia.org.br',
      isDemo: true,
    });
    expect(getCurrentAuthUser()).toEqual(user);
    expect(observedStates[observedStates.length - 1]).toEqual(user);

    // Verify persistence in localStorage
    const rawStored = localStorage.getItem('juntos:auth_user');
    expect(rawStored).not.toBeNull();
    expect(JSON.parse(rawStored!)).toEqual(user);

    unsubscribe();
  });

  it('produces isolated deterministic uids for different professor emails (AUTH-01 AC 2)', async () => {
    const userA = await signInProfessor('prof.a@escola.br', '123456');
    await signOutProfessor();
    const userB = await signInProfessor('prof.b@escola.br', '123456');

    expect(userA.uid).not.toBe(userB.uid);
    expect(userA.uid).toBe('demo-prof-a-escola-br');
    expect(userB.uid).toBe('demo-prof-b-escola-br');
  });

  it('rejects invalid email or invalid password with localized Portuguese error (AUTH-02 AC 3)', async () => {
    await expect(signInProfessor('email-invalido', '123456')).rejects.toThrow(
      'Informe um endereço de e-mail válido.'
    );
    await expect(
      signInProfessor('willy@filosofia.org.br', '123')
    ).rejects.toThrow('E-mail ou senha inválidos.');
    await expect(
      signInProfessor('willy@filosofia.org.br', 'wrong')
    ).rejects.toThrow('E-mail ou senha inválidos.');
    expect(getCurrentAuthUser()).toBeNull();
  });

  it('signs out the authenticated professor and clears persisted session (AUTH-01 AC 4)', async () => {
    await signInProfessor('willy@filosofia.org.br', 'senhaSegura123');
    expect(getCurrentAuthUser()).not.toBeNull();

    const observed: Array<AuthUser | null> = [];
    const unsubscribe = subscribeAuthState((u) => observed.push(u));
    expect(observed[0]?.email).toBe('willy@filosofia.org.br');

    await signOutProfessor();
    expect(getCurrentAuthUser()).toBeNull();
    expect(localStorage.getItem('juntos:auth_user')).toBeNull();
    expect(observed[observed.length - 1]).toBeNull();

    unsubscribe();
  });
});
