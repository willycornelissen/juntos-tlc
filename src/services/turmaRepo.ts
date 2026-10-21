import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { normalizeStudentKey } from '../domain/chamadaParser';
import { formatDatePtBr } from '../domain/syncEngine';
import {
  type AlunoRecord,
  type CommentEntry,
  type CreateTurmaInput,
  type ParsedChamada,
  type ReimportPlan,
  type Turma,
  type TurmaStatus,
  type UpdateTurmaMetadataInput,
  validateCommentText,
  validateTurmaMetadata,
} from '../domain/types';
import { getFirestoreDb } from './authService';

const DEFAULT_BATCH_CHUNK_SIZE = 450;
const LOCAL_REPO_PREFIX = 'juntos:repo:';

interface StoredTurmaBundle {
  turma: Turma;
  alunos: Record<string, AlunoRecord>;
}

interface UserStore {
  turmas: Record<string, StoredTurmaBundle>;
}

const memoryStore = new Map<string, UserStore>();
let idCounter = 0;

function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export function chunkArray<T>(
  items: T[],
  maxChunkSize = DEFAULT_BATCH_CHUNK_SIZE
): T[][] {
  const size = Math.max(1, Math.floor(maxChunkSize));
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function readUserStore(uid: string): UserStore {
  const storageKey = `${LOCAL_REPO_PREFIX}${uid}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as UserStore;
      if (parsed && typeof parsed === 'object' && parsed.turmas) {
        memoryStore.set(uid, parsed);
        return parsed;
      }
    }
  } catch {
    // Fallback to memoryStore
  }
  const existing = memoryStore.get(uid);
  if (existing) {
    return existing;
  }
  const empty: UserStore = { turmas: {} };
  memoryStore.set(uid, empty);
  return empty;
}

function writeUserStore(uid: string, store: UserStore): void {
  memoryStore.set(uid, store);
  const storageKey = `${LOCAL_REPO_PREFIX}${uid}`;
  try {
    localStorage.setItem(storageKey, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors in restricted environments
  }
}

export function resetLocalStoreForTests(): void {
  memoryStore.clear();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LOCAL_REPO_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    // Ignore
  }
}

function sortAlunos(alunos: AlunoRecord[]): AlunoRecord[] {
  return [...alunos].sort((a, b) => {
    if (a.sequencia !== undefined && b.sequencia !== undefined) {
      if (a.sequencia !== b.sequencia) {
        return a.sequencia - b.sequencia;
      }
    } else if (a.sequencia !== undefined) {
      return -1;
    } else if (b.sequencia !== undefined) {
      return 1;
    }
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

async function commitChunkedOperations(
  db: Firestore,
  operations: Array<(batch: ReturnType<typeof writeBatch>) => void>
): Promise<void> {
  const chunks = chunkArray(operations, DEFAULT_BATCH_CHUNK_SIZE);
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const op of chunk) {
      op(batch);
    }
    await batch.commit();
  }
}

export async function listTurmas(uid: string): Promise<Turma[]> {
  const db = getFirestoreDb();
  if (db) {
    const turmasRef = collection(db, 'users', uid, 'turmas');
    const snap = await getDocs(turmasRef);
    const items = snap.docs.map((d) => d.data() as Turma);
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const store = readUserStore(uid);
  return Object.values(store.turmas)
    .map((b) => ({
      ...b.turma,
      lessons: [...b.turma.lessons],
      comentarios: [...b.turma.comentarios],
      catedras: [...b.turma.catedras],
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getTurmaWithAlunos(
  uid: string,
  turmaId: string
): Promise<{ turma: Turma; alunos: AlunoRecord[] }> {
  const db = getFirestoreDb();
  if (db) {
    const turmaRef = doc(db, 'users', uid, 'turmas', turmaId);
    const alunosRef = collection(db, 'users', uid, 'turmas', turmaId, 'alunos');
    const [turmaSnap, alunosSnap] = await Promise.all([
      getDoc(turmaRef),
      getDocs(alunosRef),
    ]);
    if (!turmaSnap.exists()) {
      throw new Error('Turma não encontrada.');
    }
    const turma = turmaSnap.data() as Turma;
    const alunos = sortAlunos(
      alunosSnap.docs.map((d) => d.data() as AlunoRecord)
    );
    return { turma, alunos };
  }

  const store = readUserStore(uid);
  const bundle = store.turmas[turmaId];
  if (!bundle) {
    throw new Error('Turma não encontrada.');
  }
  const turma: Turma = {
    ...bundle.turma,
    catedras: [...bundle.turma.catedras],
    lessons: bundle.turma.lessons.map((l) => ({ ...l })),
    comentarios: bundle.turma.comentarios.map((c) => ({ ...c })),
  };
  const alunos = sortAlunos(
    Object.values(bundle.alunos).map((a) => ({
      ...a,
      presencas: { ...a.presencas },
      comentarios: a.comentarios.map((c) => ({ ...c })),
    }))
  );
  return { turma, alunos };
}

export async function createTurmaFromImport(
  uid: string,
  input: CreateTurmaInput,
  parsed: ParsedChamada,
  nowIso = new Date().toISOString()
): Promise<{ turma: Turma; alunos: AlunoRecord[] }> {
  const validation = validateTurmaMetadata(input);
  if (!validation.valid || !validation.normalized) {
    throw new Error(validation.error ?? 'Dados da turma inválidos.');
  }

  const sortedLessons = [...parsed.lessons].sort((a, b) =>
    b.isoDate.localeCompare(a.isoDate)
  );

  const alunosMap: Record<string, AlunoRecord> = {};
  for (const row of parsed.students) {
    const key =
      row.studentKey || normalizeStudentKey(row.externalId, row.nome);
    alunosMap[key] = {
      studentKey: key,
      externalId: row.externalId.trim(),
      sequencia: row.sequencia,
      nome: row.nome.trim(),
      status: 'Ativo',
      presencas: { ...row.presencas },
      comentarios: [],
      enrolledAt: nowIso,
      updatedAt: nowIso,
    };
  }

  const alunos = sortAlunos(Object.values(alunosMap));
  const turmaId = generateId('turma');
  const cidadePlanilha =
    (input.cidadePlanilha ?? parsed.cidadePlanilha ?? '').trim() || undefined;

  const turma: Turma = {
    id: turmaId,
    nome: validation.normalized.nome,
    diaHorario: validation.normalized.diaHorario,
    local: validation.normalized.local,
    catedras: validation.normalized.catedras,
    ...(cidadePlanilha ? { cidadePlanilha } : {}),
    status: 'Ativa',
    lessons: sortedLessons,
    comentarios: [],
    activeStudentsCount: alunos.length,
    droppedStudentsCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const db = getFirestoreDb();
  if (db) {
    const turmaRef = doc(db, 'users', uid, 'turmas', turmaId);
    const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [
      (batch) => batch.set(turmaRef, turma),
      ...alunos.map(
        (aluno) => (batch: ReturnType<typeof writeBatch>) =>
          batch.set(
            doc(
              db,
              'users',
              uid,
              'turmas',
              turmaId,
              'alunos',
              aluno.studentKey
            ),
            aluno
          )
      ),
    ];
    await commitChunkedOperations(db, ops);
    return { turma, alunos };
  }

  const store = readUserStore(uid);
  store.turmas[turmaId] = {
    turma,
    alunos: alunosMap,
  };
  writeUserStore(uid, store);
  return { turma, alunos };
}

export async function applyReimportPlan(
  uid: string,
  turmaId: string,
  plan: ReimportPlan,
  nowIso = new Date().toISOString()
): Promise<{ turma: Turma; alunos: AlunoRecord[] }> {
  const { turma: existingTurma } = await getTurmaWithAlunos(uid, turmaId);
  if (existingTurma.status === 'Encerrada') {
    throw new Error(
      'Não é permitido importar planilha em uma turma encerrada. Reabra a turma primeiro.'
    );
  }

  const updatedTurma: Turma = {
    ...existingTurma,
    lessons: plan.updatedLessons,
    activeStudentsCount: plan.activeStudentsCount,
    droppedStudentsCount: plan.droppedStudentsCount,
    updatedAt: nowIso,
  };

  const sortedStudents = sortAlunos(plan.updatedStudents);

  const db = getFirestoreDb();
  if (db) {
    const turmaRef = doc(db, 'users', uid, 'turmas', turmaId);
    const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [
      (batch) => batch.set(turmaRef, updatedTurma),
      ...sortedStudents.map(
        (aluno) => (batch: ReturnType<typeof writeBatch>) =>
          batch.set(
            doc(
              db,
              'users',
              uid,
              'turmas',
              turmaId,
              'alunos',
              aluno.studentKey
            ),
            aluno
          )
      ),
    ];
    await commitChunkedOperations(db, ops);
    return { turma: updatedTurma, alunos: sortedStudents };
  }

  const store = readUserStore(uid);
  const alunosMap: Record<string, AlunoRecord> = {};
  for (const aluno of sortedStudents) {
    alunosMap[aluno.studentKey] = aluno;
  }
  store.turmas[turmaId] = {
    turma: updatedTurma,
    alunos: alunosMap,
  };
  writeUserStore(uid, store);
  return { turma: updatedTurma, alunos: sortedStudents };
}

export async function updateTurmaMetadata(
  uid: string,
  turmaId: string,
  patch: UpdateTurmaMetadataInput,
  nowIso = new Date().toISOString()
): Promise<Turma> {
  const validation = validateTurmaMetadata(patch);
  if (!validation.valid || !validation.normalized) {
    throw new Error(validation.error ?? 'Dados da turma inválidos.');
  }

  const { turma: existingTurma } = await getTurmaWithAlunos(uid, turmaId);
  const updatedTurma: Turma = {
    ...existingTurma,
    nome: validation.normalized.nome,
    diaHorario: validation.normalized.diaHorario,
    local: validation.normalized.local,
    catedras: validation.normalized.catedras,
    updatedAt: nowIso,
  };

  const db = getFirestoreDb();
  if (db) {
    await setDoc(doc(db, 'users', uid, 'turmas', turmaId), updatedTurma);
    return updatedTurma;
  }

  const store = readUserStore(uid);
  store.turmas[turmaId].turma = updatedTurma;
  writeUserStore(uid, store);
  return updatedTurma;
}

export async function setTurmaStatus(
  uid: string,
  turmaId: string,
  status: TurmaStatus,
  closingComment?: string,
  nowIso = new Date().toISOString()
): Promise<Turma> {
  const { turma: existingTurma } = await getTurmaWithAlunos(uid, turmaId);
  const updatedComments = [...existingTurma.comentarios];

  if (closingComment !== undefined && closingComment.trim().length > 0) {
    const commentCheck = validateCommentText(closingComment);
    if (!commentCheck.valid || !commentCheck.trimmed) {
      throw new Error(commentCheck.error ?? 'Comentário inválido.');
    }
    updatedComments.push({
      id: generateId('turma-comment'),
      authorType: 'professor',
      text: commentCheck.trimmed,
      createdAt: nowIso,
    });
  }

  const updatedTurma: Turma = {
    ...existingTurma,
    status,
    comentarios: updatedComments,
    updatedAt: nowIso,
  };

  if (status === 'Encerrada') {
    updatedTurma.closedAt = nowIso;
  } else {
    delete updatedTurma.closedAt;
  }

  const db = getFirestoreDb();
  if (db) {
    await setDoc(doc(db, 'users', uid, 'turmas', turmaId), updatedTurma);
    return updatedTurma;
  }

  const store = readUserStore(uid);
  store.turmas[turmaId].turma = updatedTurma;
  writeUserStore(uid, store);
  return updatedTurma;
}

export async function addTurmaComment(
  uid: string,
  turmaId: string,
  text: string,
  nowIso = new Date().toISOString()
): Promise<CommentEntry> {
  const validation = validateCommentText(text);
  if (!validation.valid || !validation.trimmed) {
    throw new Error(validation.error ?? 'Comentário inválido.');
  }

  const { turma: existingTurma } = await getTurmaWithAlunos(uid, turmaId);
  const entry: CommentEntry = {
    id: generateId('turma-comment'),
    authorType: 'professor',
    text: validation.trimmed,
    createdAt: nowIso,
  };

  const updatedTurma: Turma = {
    ...existingTurma,
    comentarios: [...existingTurma.comentarios, entry],
    updatedAt: nowIso,
  };

  const db = getFirestoreDb();
  if (db) {
    await setDoc(doc(db, 'users', uid, 'turmas', turmaId), updatedTurma);
    return entry;
  }

  const store = readUserStore(uid);
  store.turmas[turmaId].turma = updatedTurma;
  writeUserStore(uid, store);
  return entry;
}

export async function addAlunoComment(
  uid: string,
  turmaId: string,
  studentKey: string,
  text: string,
  nowIso = new Date().toISOString()
): Promise<CommentEntry> {
  const validation = validateCommentText(text);
  if (!validation.valid || !validation.trimmed) {
    throw new Error(validation.error ?? 'Comentário inválido.');
  }

  const { alunos } = await getTurmaWithAlunos(uid, turmaId);
  const existingAluno = alunos.find((a) => a.studentKey === studentKey);
  if (!existingAluno) {
    throw new Error('Aluno não encontrado na turma.');
  }

  const entry: CommentEntry = {
    id: generateId('aluno-comment'),
    authorType: 'professor',
    text: validation.trimmed,
    createdAt: nowIso,
  };

  const updatedAluno: AlunoRecord = {
    ...existingAluno,
    comentarios: [...existingAluno.comentarios, entry],
    updatedAt: nowIso,
  };

  const db = getFirestoreDb();
  if (db) {
    await setDoc(
      doc(db, 'users', uid, 'turmas', turmaId, 'alunos', studentKey),
      updatedAluno
    );
    return entry;
  }

  const store = readUserStore(uid);
  store.turmas[turmaId].alunos[studentKey] = updatedAluno;
  writeUserStore(uid, store);
  return entry;
}

export async function inactivateAluno(
  uid: string,
  turmaId: string,
  studentKey: string,
  nowIso = new Date().toISOString()
): Promise<{ turma: Turma; aluno: AlunoRecord }> {
  const { turma: existingTurma, alunos: existingAlunos } =
    await getTurmaWithAlunos(uid, turmaId);

  const existingAluno = existingAlunos.find((a) => a.studentKey === studentKey);
  if (!existingAluno) {
    throw new Error('Aluno não encontrado na turma.');
  }

  if (existingAluno.status === 'Inscrição Baixada') {
    return { turma: existingTurma, aluno: existingAluno };
  }

  const dropComment: CommentEntry = {
    id: generateId('aluno-drop'),
    authorType: 'sistema',
    text: `Inscrição baixada manualmente em ${formatDatePtBr(nowIso)}.`,
    createdAt: nowIso,
  };

  const updatedAluno: AlunoRecord = {
    ...existingAluno,
    status: 'Inscrição Baixada',
    droppedAt: nowIso,
    comentarios: [...existingAluno.comentarios, dropComment],
    updatedAt: nowIso,
  };

  const updatedAlunos = existingAlunos.map((a) =>
    a.studentKey === studentKey ? updatedAluno : a
  );

  const activeStudentsCount = updatedAlunos.filter(
    (a) => a.status === 'Ativo'
  ).length;
  const droppedStudentsCount = updatedAlunos.filter(
    (a) => a.status === 'Inscrição Baixada'
  ).length;

  const updatedTurma: Turma = {
    ...existingTurma,
    activeStudentsCount,
    droppedStudentsCount,
    updatedAt: nowIso,
  };

  const db = getFirestoreDb();
  if (db) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid, 'turmas', turmaId), updatedTurma);
    batch.set(
      doc(db, 'users', uid, 'turmas', turmaId, 'alunos', studentKey),
      updatedAluno
    );
    await batch.commit();
    return { turma: updatedTurma, aluno: updatedAluno };
  }

  const store = readUserStore(uid);
  if (store.turmas[turmaId]) {
    store.turmas[turmaId].turma = updatedTurma;
    store.turmas[turmaId].alunos[studentKey] = updatedAluno;
    writeUserStore(uid, store);
  }

  return { turma: updatedTurma, aluno: updatedAluno };
}

