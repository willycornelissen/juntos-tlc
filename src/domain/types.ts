export type AttendanceCode = 'P' | 'A' | 'R' | 'F' | 'J';

export const ATTENDANCE_CODES: readonly AttendanceCode[] = ['P', 'A', 'R', 'F', 'J'] as const;

export type TurmaStatus = 'Ativa' | 'Encerrada';

export type EnrollmentStatus = 'Ativo' | 'Inscrição Baixada';

export interface LessonColumn {
  dateKey: string;       // Original DD/MM/YY from Row 6 (e.g. "14/10/26")
  isoDate: string;       // Normalized YYYY-MM-DD (e.g. "2026-10-14")
  course: string;        // From Row 2 (e.g. "Filosofia para viver")
  theme: string;         // From Row 3 (e.g. "Transpasso Aula 10")
  instructor: string;    // From Row 4 (e.g. "Willy Garabini Cornelissen")
}

export interface CommentEntry {
  id: string;
  authorType: 'professor' | 'sistema';
  text: string;
  createdAt: string;     // ISO-8601 timestamp
}

export interface Turma {
  id: string;
  nome: string;
  diaHorario: string;
  local: string;
  catedras: string[];
  cidadePlanilha?: string;
  status: TurmaStatus;
  lessons: LessonColumn[];
  comentarios: CommentEntry[];
  activeStudentsCount: number;
  droppedStudentsCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface AlunoRecord {
  studentKey: string;    // Canonical key (ID from Col A, or slugified Nome)
  externalId: string;    // Col A value (e.g. "14820")
  sequencia?: number;    // Col B value
  nome: string;          // Col C value
  status: EnrollmentStatus;
  presencas: Record<string, AttendanceCode>; // Keyed by LessonColumn.dateKey
  comentarios: CommentEntry[];
  enrolledAt: string;
  droppedAt?: string;
  updatedAt: string;
}

export interface StudentMetrics {
  percentTrim: number | null; // 0-100 across up to 9 most recent lessons, or null ("-")
  percentAno: number | null;  // 0-100 across all lessons, or null ("-")
  counts: Record<AttendanceCode, number>;
  totalCounted: number;
}

export interface ParsedStudentRow {
  studentKey: string;
  externalId: string;
  sequencia?: number;
  nome: string;
  rawStatus: string;
  presencas: Record<string, AttendanceCode>;
}

export interface ParsedChamada {
  cidadePlanilha: string;
  nomeTurmaPlanilha: string;
  lessons: LessonColumn[];
  students: ParsedStudentRow[];
}

export interface ReimportDiffSummary {
  addedLessonDates: string[];
  updatedLessonDates: string[];
  newStudents: Array<{ studentKey: string; externalId: string; nome: string }>;
  droppedStudents: Array<{ studentKey: string; externalId: string; nome: string }>;
  reenrolledStudents: Array<{ studentKey: string; externalId: string; nome: string }>;
  unchangedActiveCount: number;
  alreadyDroppedCount: number;
}

export interface ReimportPlan {
  diffSummary: ReimportDiffSummary;
  updatedLessons: LessonColumn[];
  updatedStudents: AlunoRecord[];
  activeStudentsCount: number;
  droppedStudentsCount: number;
}

export interface CreateTurmaInput {
  nome: string;
  diaHorario: string;
  local: string;
  catedras: string[];
  cidadePlanilha?: string;
}

export interface UpdateTurmaMetadataInput {
  nome: string;
  diaHorario: string;
  local: string;
  catedras: string[];
}

export function isValidAttendanceCode(value: unknown): value is AttendanceCode {
  return (
    typeof value === 'string' &&
    (ATTENDANCE_CODES as readonly string[]).includes(value)
  );
}

export interface CommentValidationResult {
  valid: boolean;
  trimmed?: string;
  error?: string;
}

export function validateCommentText(rawText: string): CommentValidationResult {
  const trimmed = (rawText ?? '').trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'O comentário não pode estar vazio.' };
  }
  if (trimmed.length > 2000) {
    return {
      valid: false,
      error: 'O comentário deve ter no máximo 2000 caracteres.',
    };
  }
  return { valid: true, trimmed };
}

export interface MetadataValidationResult {
  valid: boolean;
  normalized?: UpdateTurmaMetadataInput;
  error?: string;
}

export function validateTurmaMetadata(
  input: UpdateTurmaMetadataInput
): MetadataValidationResult {
  const nome = (input.nome ?? '').trim();
  if (!nome) {
    return { valid: false, error: 'Informe o nome da turma.' };
  }
  const diaHorario = (input.diaHorario ?? '').trim();
  if (!diaHorario) {
    return { valid: false, error: 'Informe o dia e horário das aulas.' };
  }
  const local = (input.local ?? '').trim();
  if (!local) {
    return { valid: false, error: 'Informe o local da turma.' };
  }
  const catedras = (input.catedras ?? [])
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  if (catedras.length === 0) {
    return { valid: false, error: 'Informe pelo menos uma cátedra.' };
  }
  return {
    valid: true,
    normalized: {
      nome,
      diaHorario,
      local,
      catedras,
    },
  };
}
