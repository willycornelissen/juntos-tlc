import {
  type AlunoRecord,
  type AttendanceCode,
  type LessonColumn,
  type StudentMetrics,
  isValidAttendanceCode,
} from './types';

const PRESENT_CODES: ReadonlySet<AttendanceCode> = new Set(['P', 'A', 'R']);

export function calculateAttendancePercentage(
  codes: Array<AttendanceCode | undefined | null>
): number | null {
  let presentCount = 0;
  let totalCount = 0;

  for (const code of codes) {
    if (isValidAttendanceCode(code)) {
      totalCount += 1;
      if (PRESENT_CODES.has(code)) {
        presentCount += 1;
      }
    }
  }

  if (totalCount === 0) {
    return null;
  }

  return Math.round((100 * presentCount) / totalCount);
}

export function computeStudentMetrics(
  lessons: LessonColumn[],
  presencas: Record<string, AttendanceCode>
): StudentMetrics {
  const sortedLessons = [...lessons].sort((a, b) =>
    b.isoDate.localeCompare(a.isoDate)
  );

  const trimLessons = sortedLessons.slice(0, 9);
  const trimCodes = trimLessons.map((lesson) => presencas[lesson.dateKey]);
  const allCodes = sortedLessons.map((lesson) => presencas[lesson.dateKey]);

  const counts: Record<AttendanceCode, number> = {
    P: 0,
    A: 0,
    R: 0,
    F: 0,
    J: 0,
  };

  let totalCounted = 0;
  for (const code of allCodes) {
    if (isValidAttendanceCode(code)) {
      counts[code] += 1;
      totalCounted += 1;
    }
  }

  return {
    percentTrim: calculateAttendancePercentage(trimCodes),
    percentAno: calculateAttendancePercentage(allCodes),
    counts,
    totalCounted,
  };
}

export function computeLessonPresenceRate(
  dateKey: string,
  students: AlunoRecord[]
): number | null {
  const codes = students.map((student) => student.presencas[dateKey]);
  return calculateAttendancePercentage(codes);
}
