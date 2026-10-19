import { normalizeStudentKey } from './chamadaParser';
import type {
  AlunoRecord,
  CommentEntry,
  LessonColumn,
  ParsedChamada,
  ParsedStudentRow,
  ReimportDiffSummary,
  ReimportPlan,
  Turma,
} from './types';

export function formatDatePtBr(isoOrDate: string): string {
  const cleaned = (isoOrDate ?? '').trim();

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(cleaned);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${dd}/${mm}/${yyyy}`;
  }

  const brMatch = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(cleaned);
  if (brMatch) {
    const [, dd, mm, rawYear] = brMatch;
    const yyyy = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${dd}/${mm}/${yyyy}`;
  }

  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) {
    const dd = String(parsed.getUTCDate()).padStart(2, '0');
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = String(parsed.getUTCFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }

  return cleaned;
}

export function computeReimportPlan(
  existingTurma: Turma,
  existingStudents: AlunoRecord[],
  parsed: ParsedChamada,
  importDateIso: string
): ReimportPlan {
  const formattedImportDate = formatDatePtBr(importDateIso);

  const existingLessonsByDateKey = new Map<string, LessonColumn>();
  for (const lesson of existingTurma.lessons) {
    existingLessonsByDateKey.set(lesson.dateKey, lesson);
  }

  const existingStudentsByKey = new Map<string, AlunoRecord>();
  for (const student of existingStudents) {
    const key =
      student.studentKey ||
      normalizeStudentKey(student.externalId, student.nome);
    existingStudentsByKey.set(key, { ...student, studentKey: key });
  }

  const parsedStudentsByKey = new Map<string, ParsedStudentRow>();
  for (const row of parsed.students) {
    const key = normalizeStudentKey(row.externalId, row.nome);
    parsedStudentsByKey.set(key, { ...row, studentKey: key });
  }

  const addedLessonDates: string[] = [];
  const updatedLessonDates: string[] = [];
  const mergedLessonsMap = new Map<string, LessonColumn>(
    existingLessonsByDateKey
  );

  for (const incomingLesson of parsed.lessons) {
    const existingLesson = existingLessonsByDateKey.get(incomingLesson.dateKey);
    if (!existingLesson) {
      addedLessonDates.push(incomingLesson.dateKey);
      mergedLessonsMap.set(incomingLesson.dateKey, { ...incomingLesson });
    } else {
      const mergedLesson: LessonColumn = {
        dateKey: existingLesson.dateKey,
        isoDate: incomingLesson.isoDate || existingLesson.isoDate,
        course:
          incomingLesson.course.trim() !== ''
            ? incomingLesson.course
            : existingLesson.course,
        theme:
          incomingLesson.theme.trim() !== ''
            ? incomingLesson.theme
            : existingLesson.theme,
        instructor:
          incomingLesson.instructor.trim() !== ''
            ? incomingLesson.instructor
            : existingLesson.instructor,
      };
      mergedLessonsMap.set(existingLesson.dateKey, mergedLesson);

      const metadataChanged =
        mergedLesson.course !== existingLesson.course ||
        mergedLesson.theme !== existingLesson.theme ||
        mergedLesson.instructor !== existingLesson.instructor;

      let attendanceChanged = false;
      for (const [studentKey, parsedStudent] of parsedStudentsByKey.entries()) {
        const existingStudent = existingStudentsByKey.get(studentKey);
        if (existingStudent) {
          const prevMark = existingStudent.presencas[existingLesson.dateKey];
          const nextMark = parsedStudent.presencas[existingLesson.dateKey];
          if (nextMark !== undefined && nextMark !== prevMark) {
            attendanceChanged = true;
            break;
          }
        }
      }

      if (metadataChanged || attendanceChanged) {
        updatedLessonDates.push(existingLesson.dateKey);
      }
    }
  }

  const updatedLessons = Array.from(mergedLessonsMap.values()).sort((a, b) =>
    b.isoDate.localeCompare(a.isoDate)
  );

  const newStudents: ReimportDiffSummary['newStudents'] = [];
  const droppedStudents: ReimportDiffSummary['droppedStudents'] = [];
  const reenrolledStudents: ReimportDiffSummary['reenrolledStudents'] = [];
  let unchangedActiveCount = 0;
  let alreadyDroppedCount = 0;

  const updatedStudentsMap = new Map<string, AlunoRecord>();

  // 1. Process existing students (update present ones, drop missing active ones, keep already dropped ones)
  for (const [key, existing] of existingStudentsByKey.entries()) {
    const incoming = parsedStudentsByKey.get(key);

    if (incoming) {
      const updatedNome = incoming.nome.trim() || existing.nome;
      const updatedExternalId =
        incoming.externalId.trim() || existing.externalId;
      const updatedSequencia =
        incoming.sequencia !== undefined
          ? incoming.sequencia
          : existing.sequencia;
      const mergedPresencas = {
        ...existing.presencas,
        ...incoming.presencas,
      };

      if (existing.status === 'Inscrição Baixada') {
        const reenrollComment: CommentEntry = {
          id: `sys-reenroll-${key}-${importDateIso}`,
          authorType: 'sistema',
          text: `Inscrição reativada: aluno voltou a constar na planilha importada em ${formattedImportDate}.`,
          createdAt: importDateIso,
        };
        const reactivated: AlunoRecord = {
          ...existing,
          studentKey: key,
          externalId: updatedExternalId,
          sequencia: updatedSequencia,
          nome: updatedNome,
          status: 'Ativo',
          droppedAt: undefined,
          presencas: mergedPresencas,
          comentarios: [...existing.comentarios, reenrollComment],
          updatedAt: importDateIso,
        };
        delete reactivated.droppedAt;
        updatedStudentsMap.set(key, reactivated);
        reenrolledStudents.push({
          studentKey: key,
          externalId: updatedExternalId,
          nome: updatedNome,
        });
      } else {
        updatedStudentsMap.set(key, {
          ...existing,
          studentKey: key,
          externalId: updatedExternalId,
          sequencia: updatedSequencia,
          nome: updatedNome,
          status: 'Ativo',
          presencas: mergedPresencas,
          comentarios: [...existing.comentarios],
          updatedAt: importDateIso,
        });
        unchangedActiveCount += 1;
      }
    } else {
      if (existing.status === 'Ativo') {
        const dropComment: CommentEntry = {
          id: `sys-drop-${key}-${importDateIso}`,
          authorType: 'sistema',
          text: `Inscrição baixada: aluno não consta na planilha importada em ${formattedImportDate}.`,
          createdAt: importDateIso,
        };
        updatedStudentsMap.set(key, {
          ...existing,
          status: 'Inscrição Baixada',
          droppedAt: importDateIso,
          presencas: { ...existing.presencas },
          comentarios: [...existing.comentarios, dropComment],
          updatedAt: importDateIso,
        });
        droppedStudents.push({
          studentKey: key,
          externalId: existing.externalId,
          nome: existing.nome,
        });
      } else {
        // Already 'Inscrição Baixada' — preserve state without duplicate system drop comment
        updatedStudentsMap.set(key, {
          ...existing,
          presencas: { ...existing.presencas },
          comentarios: [...existing.comentarios],
        });
        alreadyDroppedCount += 1;
      }
    }
  }

  // 2. Process newly enrolled students present in parsed.students but not in existingStudents
  for (const [key, incoming] of parsedStudentsByKey.entries()) {
    if (!existingStudentsByKey.has(key)) {
      const novoAluno: AlunoRecord = {
        studentKey: key,
        externalId: incoming.externalId.trim(),
        sequencia: incoming.sequencia,
        nome: incoming.nome.trim(),
        status: 'Ativo',
        presencas: { ...incoming.presencas },
        comentarios: [],
        enrolledAt: importDateIso,
        updatedAt: importDateIso,
      };
      updatedStudentsMap.set(key, novoAluno);
      newStudents.push({
        studentKey: key,
        externalId: novoAluno.externalId,
        nome: novoAluno.nome,
      });
    }
  }

  const updatedStudents = Array.from(updatedStudentsMap.values());
  const activeStudentsCount = updatedStudents.filter(
    (s) => s.status === 'Ativo'
  ).length;
  const droppedStudentsCount = updatedStudents.filter(
    (s) => s.status === 'Inscrição Baixada'
  ).length;

  return {
    diffSummary: {
      addedLessonDates,
      updatedLessonDates,
      newStudents,
      droppedStudents,
      reenrolledStudents,
      unchangedActiveCount,
      alreadyDroppedCount,
    },
    updatedLessons,
    updatedStudents,
    activeStudentsCount,
    droppedStudentsCount,
  };
}
