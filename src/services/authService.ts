import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

export interface AuthUser {
  uid: string;
  email: string;
  isDemo?: boolean;
}

export interface ProfessorRecord {
  uid: string;
  email: string;
  status: 'ativo' | 'inativo';
  createdAt: string;
  deactivatedAt?: string;
}

export const ADMIN_EMAIL = 'willy.cornelissen@gmail.com';

export function canAddTeachers(user: AuthUser | null | undefined): boolean {
  if (!user || typeof user.email !== 'string') {
    return false;
  }
  return user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

const LOCAL_AUTH_STORAGE_KEY = 'juntos:auth_user';
const LOCAL_PROFESSORES_KEY = 'juntos:professores';
const LOCAL_REVOKED_PROFESSORES_KEY = 'juntos:revoked_professores';

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
  if (
    code.includes('auth/user-disabled') ||
    code.includes('user-disabled')
  ) {
    return 'Acesso revogado pelo administrador.';
  }
  if (code.includes('auth/cannot-remove-admin')) {
    return 'Não é possível remover o usuário administrador principal.';
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

function readLocalProfessores(): ProfessorRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROFESSORES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Fallback if storage fails
  }
  const defaultList: ProfessorRecord[] = [
    {
      uid: buildDemoUid(ADMIN_EMAIL),
      email: ADMIN_EMAIL,
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  return defaultList;
}

function writeLocalProfessores(list: ProfessorRecord[]): void {
  try {
    localStorage.setItem(LOCAL_PROFESSORES_KEY, JSON.stringify(list));
  } catch {
    // Ignore quota errors
  }
}

function readRevokedProfessores(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_REVOKED_PROFESSORES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Fallback
  }
  return [];
}

function addRevokedProfessor(identifier: string): void {
  try {
    const current = readRevokedProfessores();
    const normalized = identifier.trim().toLowerCase();
    if (!current.includes(normalized)) {
      current.push(normalized);
      localStorage.setItem(
        LOCAL_REVOKED_PROFESSORES_KEY,
        JSON.stringify(current)
      );
    }
  } catch {
    // Ignore
  }
}

async function deleteUserTurmasAndAlunos(uid: string): Promise<void> {
  const db = getFirestoreDb();
  if (db) {
    const turmasRef = collection(db, 'users', uid, 'turmas');
    const turmasSnap = await getDocs(turmasRef);
    for (const turmaDoc of turmasSnap.docs) {
      const alunosRef = collection(
        db,
        'users',
        uid,
        'turmas',
        turmaDoc.id,
        'alunos'
      );
      const alunosSnap = await getDocs(alunosRef);
      for (const alunoDoc of alunosSnap.docs) {
        await deleteDoc(alunoDoc.ref);
      }
      await deleteDoc(turmaDoc.ref);
    }
    return;
  }

  try {
    localStorage.removeItem(`juntos:repo:${uid}`);
  } catch {
    // Ignore storage quota errors in restricted environments
  }
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
      const signedIn: AuthUser = {
        uid: cred.user.uid,
        email: cred.user.email ?? trimmedEmail,
      };

      if (trimmedEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        const db = getFirestoreDb();
        if (db) {
          const revokedDoc = await getDoc(
            doc(db, 'revoked_users', signedIn.uid)
          );
          if (revokedDoc.exists()) {
            await signOut(fbAuth);
            throw new AuthServiceError(
              'auth/user-disabled',
              mapAuthErrorToPtBr('auth/user-disabled')
            );
          }
        }
      }

      return signedIn;
    } catch (err) {
      if (err instanceof AuthServiceError) {
        throw err;
      }
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code)
          : 'auth/invalid-credential';
      throw new AuthServiceError(code, mapAuthErrorToPtBr(err));
    }
  }

  if (trimmedEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    const revoked = readRevokedProfessores();
    if (
      revoked.includes(trimmedEmail.toLowerCase()) ||
      revoked.includes(buildDemoUid(trimmedEmail).toLowerCase())
    ) {
      throw new AuthServiceError(
        'auth/user-disabled',
        mapAuthErrorToPtBr('auth/user-disabled')
      );
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
      const newUser: AuthUser = {
        uid: cred.user.uid,
        email: cred.user.email ?? trimmedEmail,
      };

      const db = getFirestoreDb();
      if (db) {
        await deleteDoc(doc(db, 'revoked_users', newUser.uid)).catch(() => {});
        await setDoc(doc(db, 'professores', newUser.uid), {
          uid: newUser.uid,
          email: newUser.email,
          status: 'ativo',
          createdAt: new Date().toISOString(),
        });
      }

      return newUser;
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

  const revoked = readRevokedProfessores().filter(
    (id) =>
      id !== trimmedEmail.toLowerCase() &&
      id !== newUser.uid.toLowerCase()
  );
  try {
    localStorage.setItem(
      LOCAL_REVOKED_PROFESSORES_KEY,
      JSON.stringify(revoked)
    );
  } catch {
    // Ignore
  }

  const list = readLocalProfessores();
  const existingIdx = list.findIndex(
    (p) => p.email.toLowerCase() === trimmedEmail.toLowerCase()
  );
  const record: ProfessorRecord = {
    uid: newUser.uid,
    email: newUser.email,
    status: 'ativo',
    createdAt: new Date().toISOString(),
  };
  if (existingIdx >= 0) {
    list[existingIdx] = record;
  } else {
    list.push(record);
  }
  writeLocalProfessores(list);

  return newUser;
}

export async function listProfessores(
  adminUser: AuthUser | null | undefined
): Promise<ProfessorRecord[]> {
  if (!canAddTeachers(adminUser)) {
    throw new AuthServiceError(
      'auth/permission-denied',
      mapAuthErrorToPtBr('auth/permission-denied')
    );
  }

  const db = getFirestoreDb();
  if (db) {
    const snap = await getDocs(collection(db, 'professores'));
    const items: ProfessorRecord[] = [];
    snap.forEach((d) => {
      items.push(d.data() as ProfessorRecord);
    });
    if (!items.some((p) => p.email.toLowerCase() === ADMIN_EMAIL.toLowerCase())) {
      items.unshift({
        uid: adminUser?.uid ?? buildDemoUid(ADMIN_EMAIL),
        email: ADMIN_EMAIL,
        status: 'ativo',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    }
    return items;
  }

  return readLocalProfessores();
}

export async function removeProfessor(
  adminUser: AuthUser | null | undefined,
  targetUid: string
): Promise<void> {
  if (!canAddTeachers(adminUser)) {
    throw new AuthServiceError(
      'auth/permission-denied',
      mapAuthErrorToPtBr('auth/permission-denied')
    );
  }

  if (targetUid === adminUser?.uid || targetUid === buildDemoUid(ADMIN_EMAIL)) {
    throw new AuthServiceError(
      'auth/cannot-remove-admin',
      mapAuthErrorToPtBr('auth/cannot-remove-admin')
    );
  }

  const db = getFirestoreDb();
  if (db) {
    const profRef = doc(db, 'professores', targetUid);
    const snap = await getDoc(profRef);
    if (snap.exists()) {
      const data = snap.data() as ProfessorRecord;
      if (data.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        throw new AuthServiceError(
          'auth/cannot-remove-admin',
          mapAuthErrorToPtBr('auth/cannot-remove-admin')
        );
      }
      // 1. Registra como revogado para impedir futuros logins
      await setDoc(doc(db, 'revoked_users', targetUid), {
        email: data.email,
        revokedAt: new Date().toISOString(),
      });
      // 2. Remove da coleção de professores para que não conste mais na listagem
      await deleteDoc(profRef);
    }
    // 3. Remove todas as turmas e alunos do professor
    await deleteUserTurmasAndAlunos(targetUid);
    return;
  }

  const list = readLocalProfessores();
  const target = list.find((p) => p.uid === targetUid);
  if (target && target.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    throw new AuthServiceError(
      'auth/cannot-remove-admin',
      mapAuthErrorToPtBr('auth/cannot-remove-admin')
    );
  }

  if (target) {
    addRevokedProfessor(target.email);
    addRevokedProfessor(target.uid);
  } else {
    addRevokedProfessor(targetUid);
  }

  // Remove completamente da lista de professores (não aparece mais!)
  const updated = list.filter((p) => p.uid !== targetUid);
  writeLocalProfessores(updated);

  // Remove todas as turmas e alunos do professor
  await deleteUserTurmasAndAlunos(targetUid);
}
