import React, { useCallback, useEffect, useState } from 'react';
import './index.css';
import type {
  AlunoRecord,
  CreateTurmaInput,
  ParsedChamada,
  ReimportPlan,
  Turma,
  TurmaStatus,
  UpdateTurmaMetadataInput,
} from './domain/types';
import {
  type AuthUser,
  canAddTeachers,
  signInProfessor,
  signOutProfessor,
  subscribeAuthState,
} from './services/authService';
import {
  addAlunoComment,
  addTurmaComment,
  applyReimportPlan,
  createTurmaFromImport,
  getTurmaWithAlunos,
  inactivateAluno,
  listTurmas,
  setTurmaStatus,
  updateTurmaMetadata,
} from './services/turmaRepo';
import { LoginView, TurmasDashboard } from './components/TurmasDashboard';
import { TurmaDetailView } from './components/TurmaDetailView';
import { ReimportModal } from './components/ReimportModal';
import { AlunoFichaDrawer } from './components/AlunoFichaDrawer';
import { AddUserModal } from './components/AddUserModal';

const SAMPLE_PAMPULHA_CHAMADA: ParsedChamada = {
  cidadePlanilha: 'Belo Horizonte',
  nomeTurmaPlanilha: 'Turma Pampulha (QUA)',
  lessons: [
    {
      dateKey: '14/10/26',
      isoDate: '2026-10-14',
      course: 'Filosofia para viver',
      theme: 'Transpasso Aula 10',
      instructor: 'Willy Garabini Cornelissen',
    },
    {
      dateKey: '07/10/26',
      isoDate: '2026-10-07',
      course: 'Filosofia para viver',
      theme: 'Transpasso Aula 9',
      instructor: 'Willy Garabini Cornelissen',
    },
    {
      dateKey: '28/01/26',
      isoDate: '2026-01-28',
      course: 'Filosofia para viver',
      theme: 'Aula de apresentação',
      instructor: 'Willy Garabini Cornelissen',
    },
  ],
  students: [
    {
      studentKey: '14820',
      externalId: '14820',
      sequencia: 1,
      nome: 'Claudia Marcia Marques (Sala Pampulha)',
      rawStatus: 'Ativo',
      presencas: { '14/10/26': 'P', '07/10/26': 'P', '28/01/26': 'P' },
    },
    {
      studentKey: '7728',
      externalId: '7728',
      sequencia: 2,
      nome: 'Lucas Selani de Melo (Sala Pampulha)',
      rawStatus: 'Ativo',
      presencas: { '14/10/26': 'P', '07/10/26': 'F', '28/01/26': 'P' },
    },
    {
      studentKey: '14779',
      externalId: '14779',
      sequencia: 3,
      nome: 'Maria Regina de Araujo Borges (Sala Pampulha)',
      rawStatus: 'Ativo',
      presencas: { '14/10/26': 'P', '07/10/26': 'P', '28/01/26': 'A' },
    },
  ],
};

export function App(): React.ReactElement {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string | null>(null);
  const [activeTurma, setActiveTurma] = useState<Turma | null>(null);
  const [activeAlunos, setActiveAlunos] = useState<AlunoRecord[]>([]);
  const [selectedStudentKey, setSelectedStudentKey] = useState<string | null>(
    null
  );
  const [isReimportOpen, setIsReimportOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  const refreshTurmas = useCallback(async (uid: string) => {
    const loaded = await listTurmas(uid);
    setTurmas(loaded);
  }, []);

  const refreshActiveTurma = useCallback(
    async (uid: string, turmaId: string) => {
      const { turma, alunos } = await getTurmaWithAlunos(uid, turmaId);
      setActiveTurma(turma);
      setActiveAlunos(alunos);
    },
    []
  );

  useEffect(() => {
    const unsubscribe = subscribeAuthState((authUser) => {
      setUser(authUser);
      if (!authUser) {
        setTurmas([]);
        setSelectedTurmaId(null);
        setActiveTurma(null);
        setActiveAlunos([]);
        setSelectedStudentKey(null);
        setIsAddUserOpen(false);
      } else {
        void refreshTurmas(authUser.uid);
      }
    });
    return unsubscribe;
  }, [refreshTurmas]);

  const handleSignIn = async (email: string, password: string) => {
    const signedIn = await signInProfessor(email, password);
    setUser(signedIn);
    await refreshTurmas(signedIn.uid);
  };

  const handleSignOut = async () => {
    await signOutProfessor();
    setUser(null);
  };

  const handleSelectTurma = async (turmaId: string) => {
    if (!user) {
      return;
    }
    setSelectedTurmaId(turmaId);
    await refreshActiveTurma(user.uid, turmaId);
  };

  const handleCreateTurma = async (
    input: CreateTurmaInput,
    parsed: ParsedChamada
  ) => {
    if (!user) {
      return;
    }
    const { turma, alunos } = await createTurmaFromImport(
      user.uid,
      input,
      parsed
    );
    await refreshTurmas(user.uid);
    setSelectedTurmaId(turma.id);
    setActiveTurma(turma);
    setActiveAlunos(alunos);
  };

  const handleLoadSampleTurma = async () => {
    if (!user) {
      return;
    }
    await handleCreateTurma(
      {
        nome: 'Turma Pampulha (QUA)',
        diaHorario: 'Quarta-feira, 19h30',
        local: 'Belo Horizonte',
        catedras: ['Filosofia para Viver', 'Transpasso'],
        cidadePlanilha: 'Belo Horizonte',
      },
      SAMPLE_PAMPULHA_CHAMADA
    );
  };

  const handleUpdateMetadata = async (patch: UpdateTurmaMetadataInput) => {
    if (!user || !selectedTurmaId) {
      return;
    }
    await updateTurmaMetadata(user.uid, selectedTurmaId, patch);
    await refreshActiveTurma(user.uid, selectedTurmaId);
    await refreshTurmas(user.uid);
  };

  const handleChangeStatus = async (
    status: TurmaStatus,
    closingComment?: string
  ) => {
    if (!user || !selectedTurmaId) {
      return;
    }
    await setTurmaStatus(user.uid, selectedTurmaId, status, closingComment);
    await refreshActiveTurma(user.uid, selectedTurmaId);
    await refreshTurmas(user.uid);
  };

  const handleAddTurmaComment = async (text: string) => {
    if (!user || !selectedTurmaId) {
      return;
    }
    await addTurmaComment(user.uid, selectedTurmaId, text);
    await refreshActiveTurma(user.uid, selectedTurmaId);
    await refreshTurmas(user.uid);
  };

  const handleConfirmReimport = async (plan: ReimportPlan) => {
    if (!user || !selectedTurmaId) {
      return;
    }
    await applyReimportPlan(user.uid, selectedTurmaId, plan);
    await refreshActiveTurma(user.uid, selectedTurmaId);
    await refreshTurmas(user.uid);
  };

  const handleAddAlunoComment = async (studentKey: string, text: string) => {
    if (!user || !selectedTurmaId) {
      return;
    }
    await addAlunoComment(user.uid, selectedTurmaId, studentKey, text);
    await refreshActiveTurma(user.uid, selectedTurmaId);
  };

  const handleInactivateAluno = async (studentKey: string) => {
    if (!user || !selectedTurmaId) {
      return;
    }
    await inactivateAluno(user.uid, selectedTurmaId, studentKey);
    await refreshActiveTurma(user.uid, selectedTurmaId);
    await refreshTurmas(user.uid);
  };

  if (!user) {
    return <LoginView onSignIn={handleSignIn} />;
  }

  const selectedAluno =
    selectedStudentKey !== null
      ? activeAlunos.find((a) => a.studentKey === selectedStudentKey) ?? null
      : null;

  return (
    <div>
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-brand">
            <h1>Juntos.</h1>
            <p>Gestão de turmas, chamadas e acompanhamento de alunos</p>
          </div>
          <div className="hero-user">
            <span>{user.email}</span>
            {canAddTeachers(user) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAddUserOpen(true)}
              >
                Adicionar Usuário
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void handleSignOut()}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        {selectedTurmaId && activeTurma ? (
          <TurmaDetailView
            turma={activeTurma}
            alunos={activeAlunos}
            onBack={() => {
              setSelectedTurmaId(null);
              setActiveTurma(null);
              setActiveAlunos([]);
              setSelectedStudentKey(null);
            }}
            onSelectStudent={(aluno) => setSelectedStudentKey(aluno.studentKey)}
            onOpenReimportModal={() => setIsReimportOpen(true)}
            onUpdateMetadata={handleUpdateMetadata}
            onChangeStatus={handleChangeStatus}
            onAddTurmaComment={handleAddTurmaComment}
          />
        ) : (
          <TurmasDashboard
            turmas={turmas}
            onSelectTurma={(id) => void handleSelectTurma(id)}
            onCreateTurma={handleCreateTurma}
            onLoadSampleTurma={handleLoadSampleTurma}
          />
        )}

        {isReimportOpen && activeTurma && (
          <ReimportModal
            turma={activeTurma}
            alunos={activeAlunos}
            onClose={() => setIsReimportOpen(false)}
            onConfirmReimport={handleConfirmReimport}
          />
        )}

        {selectedAluno && activeTurma && (
          <AlunoFichaDrawer
            aluno={selectedAluno}
            lessons={activeTurma.lessons}
            onClose={() => setSelectedStudentKey(null)}
            onAddComment={handleAddAlunoComment}
            onInactivate={handleInactivateAluno}
          />
        )}

        {isAddUserOpen && (
          <AddUserModal
            adminUser={user}
            onClose={() => setIsAddUserOpen(false)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
