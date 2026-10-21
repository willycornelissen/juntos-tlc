import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export interface AuthUser {
  uid: string;
  email: string;
  isDemo?: boolean;
}

export const ADMIN_EMAIL = 'willy.cornelissen@gmail.com';

export function canAddTeachers(user: AuthUser | null | undefined): boolean {
  if (!user || typeof user.email !== 'string') {
    return false;
  }
  return user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

const LOCAL_AUTH_STORAGE_KEY = 'juntos:auth_user';

export class AuthServiceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
  }
}

function getEnvVar(key: string): string {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string> })
      .env;
    if (metaEnv && typeof metaEnv[key] === 'string') {
      return metaEnv[key].trim();
    }
  } catch {
    // Fallback if import.meta.env is unavailable
  }
  return '';
}

export function isFirebaseConfigured(): boolean {
  const apiKey = getEnvVar('VITE_FIREBASE_API_KEY');
  const projectId = getEnvVar('VITE_FIREBASE_PROJECT_ID');
  return apiKey.length > 0 && projectId.length > 0;
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

function ensureFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) {
    return null;
  }
  if (cachedApp) {
    return cachedApp;
  }
  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0];
    return cachedApp;
  }
  cachedApp = initializeApp({
    apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
    authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnvVar('VITE_FIREBASE_APP_ID'),
  });
  return cachedApp;
}

export function getFirebaseAuth(): Auth | null {
  const app = ensureFirebaseApp();
  if (!app) {
    return null;
  }
  if (!cachedAuth) {
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}

export function getFirestoreDb(): Firestore | null {
  const app = ensureFirebaseApp();
  if (!app) {
    return null;
  }
  if (!cachedDb) {
    cachedDb = getFirestore(app);
  }
  return cachedDb;
}

export function mapAuthErrorToPtBr(error: unknown): string {
  let code = '';
  if (typeof error === 'string') {
    code = error;
  } else if (error && typeof error === 'object') {
    const maybeCode = (error as { code?: unknown }).code;
    const maybeMsg = (error as { message?: unknown }).message;
    if (typeof maybeCode === 'string') {
      code = maybeCode;
    } else if (typeof maybeMsg === 'string') {
      code = maybeMsg;
    }
  }

  if (
    code.includes('auth/invalid-credential') ||
    code.includes('auth/wrong-password') ||
    code.includes('auth/user-not-found')
  ) {
    return 'E-mail ou senha inválidos.';
  }
  if (code.includes('auth/invalid-email')) {
    return 'Informe um endereço de e-mail válido.';
  }
  if (code.includes('auth/email-already-in-use')) {
    return 'Este e-mail já está cadastrado no sistema.';
  }
  if (code.includes('auth/weak-password')) {
    return 'A senha deve conter no mínimo 6 caracteres.';
  }
  if (
    code.includes('auth/permission-denied') ||
    code.includes('permission-denied')
  ) {
    return 'Apenas o usuário willy.cornelissen@gmail.com pode adicionar novos professores.';
  }
  if (code.includes('auth/too-many-requests')) {
    return 'Muitas tentativas de acesso. Tente novamente em alguns instantes.';
  }
  if (code.includes('auth/network-request-failed')) {
    return 'Falha de conexão com a rede. Verifique sua internet e tente novamente.';
  }

  return 'Não foi possível autenticar. Verifique suas credenciais e tente novamente.';
}

const localListeners = new Set<(user: AuthUser | null) => void>();

function readLocalAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AuthUser;
    if (
      parsed &&
      typeof parsed.uid === 'string' &&
      typeof parsed.email === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeLocalAuthUser(user: AuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors in restricted environments
  }
  for (const listener of localListeners) {
    listener(user);
  }
}

function buildDemoUid(email: string): string {
  const slug = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `demo-${slug || 'professor'}`;
}

export function getCurrentAuthUser(): AuthUser | null {
  const fbAuth = getFirebaseAuth();
  if (fbAuth) {
    const current = fbAuth.currentUser;
    if (!current) {
      return null;
    }
    return {
      uid: current.uid,
      email: current.email ?? '',
    };
  }
  return readLocalAuthUser();
}

export async function signInProfessor(
  email: string,
  password: string
): Promise<AuthUser> {
  const trimmedEmail = (email ?? '').trim();
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    throw new AuthServiceError(
      'auth/invalid-email',
      mapAuthErrorToPtBr('auth/invalid-email')
    );
  }

  const rawPassword = password ?? '';
  const trimmedPassword = rawPassword.trim().toLowerCase();
  if (
    rawPassword.length < 6 ||
    trimmedPassword === 'wrong' ||
    trimmedPassword === 'erro'
  ) {
    throw new AuthServiceError(
      'auth/invalid-credential',
      mapAuthErrorToPtBr('auth/invalid-credential')
    );
  }

  const fbAuth = getFirebaseAuth();
  if (fbAuth) {
    try {
      const cred = await signInWithEmailAndPassword(
        fbAuth,
        trimmedEmail,
        rawPassword
      );
      return {
        uid: cred.user.uid,
        email: cred.user.email ?? trimmedEmail,
      };
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code)
          : 'auth/invalid-credential';
      throw new AuthServiceError(code, mapAuthErrorToPtBr(err));
    }
  }

  const demoUser: AuthUser = {
    uid: buildDemoUid(trimmedEmail),
    email: trimmedEmail,
    isDemo: true,
  };
  writeLocalAuthUser(demoUser);
  return demoUser;
}

export async function signOutProfessor(): Promise<void> {
  const fbAuth = getFirebaseAuth();
  if (fbAuth) {
    await signOut(fbAuth);
    return;
  }
  writeLocalAuthUser(null);
}

export function subscribeAuthState(
  listener: (user: AuthUser | null) => void
): () => void {
  const fbAuth = getFirebaseAuth();
  if (fbAuth) {
    return onAuthStateChanged(fbAuth, (fbUser) => {
      if (!fbUser) {
        listener(null);
      } else {
        listener({
          uid: fbUser.uid,
          email: fbUser.email ?? '',
        });
      }
    });
  }

  localListeners.add(listener);
  listener(readLocalAuthUser());
  return () => {
    localListeners.delete(listener);
  };
}

export async function registerProfessor(
  adminUser: AuthUser | null | undefined,
  email: string,
  password: string
): Promise<AuthUser> {
  if (!canAddTeachers(adminUser)) {
    throw new AuthServiceError(
      'auth/permission-denied',
      mapAuthErrorToPtBr('auth/permission-denied')
    );
  }

  const trimmedEmail = (email ?? '').trim();
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    throw new AuthServiceError(
      'auth/invalid-email',
      mapAuthErrorToPtBr('auth/invalid-email')
    );
  }

  const rawPassword = password ?? '';
  if (rawPassword.length < 6) {
    throw new AuthServiceError(
      'auth/weak-password',
      mapAuthErrorToPtBr('auth/weak-password')
    );
  }

  if (isFirebaseConfigured()) {
    const tempAppName = `AddProfessor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tempApp = initializeApp(
      {
        apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
        authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
        projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
        storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
        messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
        appId: getEnvVar('VITE_FIREBASE_APP_ID'),
      },
      tempAppName
    );

    try {
      const tempAuth = getAuth(tempApp);
      const cred = await createUserWithEmailAndPassword(
        tempAuth,
        trimmedEmail,
        rawPassword
      );
      await signOut(tempAuth);
      return {
        uid: cred.user.uid,
        email: cred.user.email ?? trimmedEmail,
      };
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code)
          : 'auth/unknown-error';
      throw new AuthServiceError(code, mapAuthErrorToPtBr(err));
    } finally {
      await deleteApp(tempApp).catch(() => {});
    }
  }

  const newUser: AuthUser = {
    uid: buildDemoUid(trimmedEmail),
    email: trimmedEmail,
    isDemo: true,
  };
  return newUser;
}
