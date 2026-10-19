import { describe, it, expect } from 'vitest';
import {
  calculateAttendancePercentage,
  computeStudentMetrics,
  computeLessonPresenceRate,
} from '../attendanceCalc';
import type { AlunoRecord, AttendanceCode, LessonColumn } from '../types';

const PAMPULHA_DATES: Array<{ dateKey: string; isoDate: string }> = [
  { dateKey: '14/10/26', isoDate: '2026-10-14' },
  { dateKey: '30/09/26', isoDate: '2026-09-30' },
  { dateKey: '23/09/26', isoDate: '2026-09-23' },
  { dateKey: '09/09/26', isoDate: '2026-09-09' },
  { dateKey: '02/09/26', isoDate: '2026-09-02' },
  { dateKey: '26/08/26', isoDate: '2026-08-26' },
  { dateKey: '19/08/26', isoDate: '2026-08-19' },
  { dateKey: '12/08/26', isoDate: '2026-08-12' },
  { dateKey: '05/08/26', isoDate: '2026-08-05' },
  { dateKey: '15/07/26', isoDate: '2026-07-15' },
  { dateKey: '09/07/26', isoDate: '2026-07-09' },
  { dateKey: '01/07/26', isoDate: '2026-07-01' },
  { dateKey: '17/06/26', isoDate: '2026-06-17' },
  { dateKey: '10/06/26', isoDate: '2026-06-10' },
  { dateKey: '27/05/26', isoDate: '2026-05-27' },
  { dateKey: '20/05/26', isoDate: '2026-05-20' },
  { dateKey: '13/05/26', isoDate: '2026-05-13' },
  { dateKey: '06/05/26', isoDate: '2026-05-06' },
  { dateKey: '29/04/26', isoDate: '2026-04-29' },
  { dateKey: '15/04/26', isoDate: '2026-04-15' },
  { dateKey: '08/04/26', isoDate: '2026-04-08' },
  { dateKey: '01/04/26', isoDate: '2026-04-01' },
  { dateKey: '31/03/26', isoDate: '2026-03-31' },
  { dateKey: '25/03/26', isoDate: '2026-03-25' },
  { dateKey: '18/03/26', isoDate: '2026-03-18' },
  { dateKey: '11/03/26', isoDate: '2026-03-11' },
  { dateKey: '04/03/26', isoDate: '2026-03-04' },
  { dateKey: '25/02/26', isoDate: '2026-02-25' },
  { dateKey: '11/02/26', isoDate: '2026-02-11' },
  { dateKey: '04/02/26', isoDate: '2026-02-04' },
  { dateKey: '28/01/26', isoDate: '2026-01-28' },
];

const PAMPULHA_LESSONS: LessonColumn[] = PAMPULHA_DATES.map((d) => ({
  dateKey: d.dateKey,
  isoDate: d.isoDate,
  course: 'Filosofia para viver',
  theme: 'Tema',
  instructor: 'Willy Garabini Cornelissen',
}));

function buildPresencas(
  marks: Array<AttendanceCode | ''>
): Record<string, AttendanceCode> {
  const map: Record<string, AttendanceCode> = {};
  marks.forEach((mark, idx) => {
    if (mark) {
      map[PAMPULHA_DATES[idx].dateKey] = mark;
    }
  });
  return map;
}

describe('domain/attendanceCalc', () => {
  it('counts P, A, R as present and P, A, R, F, J in denominator', () => {
    expect(calculateAttendancePercentage(['P', 'A', 'R', 'F', 'J'])).toBe(60);
    expect(calculateAttendancePercentage(['P', 'P', 'A', 'R'])).toBe(100);
    expect(calculateAttendancePercentage(['F', 'J'])).toBe(0);
  });

  it('returns null when there are no counted attendance codes', () => {
    expect(calculateAttendancePercentage([])).toBeNull();
    expect(calculateAttendancePercentage([undefined, null])).toBeNull();
  });

  it('computes exact metrics for student 14820 (Claudia Marcia Marques) from Turma Pampulha QUA.xlsx', () => {
    const marks14820: Array<AttendanceCode | ''> = [
      'F', 'P', 'P', 'P', 'F', 'P', 'P', 'P', 'P',
      'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
      'P', 'P', 'F', 'F', '',  'P', 'F', 'P', 'P',
      'P', 'F', 'P', 'P',
    ];
    const metrics = computeStudentMetrics(
      PAMPULHA_LESSONS,
      buildPresencas(marks14820)
    );
    expect(metrics).toEqual({
      percentTrim: 78,
      percentAno: 80,
      counts: { P: 24, A: 0, R: 0, F: 6, J: 0 },
      totalCounted: 30,
    });
  });

  it('computes exact metrics for student 7728 (Lucas Selani de Melo) from Turma Pampulha QUA.xlsx', () => {
    const marks7728: Array<AttendanceCode | ''> = [
      'P', 'P', 'P', 'P', 'P', 'P', 'J', 'P', 'P',
      'P', 'P', 'F', 'P', 'P', 'F', 'F', 'F', 'F',
      'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
      'P', 'P', 'P', 'P',
    ];
    const metrics = computeStudentMetrics(
      PAMPULHA_LESSONS,
      buildPresencas(marks7728)
    );
    expect(metrics).toEqual({
      percentTrim: 89,
      percentAno: 81,
      counts: { P: 25, A: 0, R: 0, F: 5, J: 1 },
      totalCounted: 31,
    });
  });

  it('computes exact metrics for student 14779 (Maria Regina de Araujo Borges) from Turma Pampulha QUA.xlsx', () => {
    const marks14779: Array<AttendanceCode | ''> = [
      'P', 'P', 'P', 'P', 'P', 'P', 'P', 'J', 'P',
      'P', 'F', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
      'P', 'P', 'P', 'P', 'P', 'P', 'P', 'F', 'F',
      'P', 'P', 'P', 'P',
    ];
    const metrics = computeStudentMetrics(
      PAMPULHA_LESSONS,
      buildPresencas(marks14779)
    );
    expect(metrics).toEqual({
      percentTrim: 89,
      percentAno: 87,
      counts: { P: 27, A: 0, R: 0, F: 3, J: 1 },
      totalCounted: 31,
    });
  });

  it('sorts unordered lessons chronologically by isoDate descending before slicing the 9 most recent lessons for % Trim', () => {
    const ascendingLessons = [...PAMPULHA_LESSONS].reverse();
    const marks14820: Array<AttendanceCode | ''> = [
      'F', 'P', 'P', 'P', 'F', 'P', 'P', 'P', 'P',
      'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
      'P', 'P', 'F', 'F', '',  'P', 'F', 'P', 'P',
      'P', 'F', 'P', 'P',
    ];
    const metrics = computeStudentMetrics(
      ascendingLessons,
      buildPresencas(marks14820)
    );
    expect(metrics.percentTrim).toBe(78);
    expect(metrics.percentAno).toBe(80);
  });

  it('returns null percentages when student has no attendance marks or lesson list is empty', () => {
    const emptyMetrics = computeStudentMetrics(PAMPULHA_LESSONS, {});
    expect(emptyMetrics).toEqual({
      percentTrim: null,
      percentAno: null,
      counts: { P: 0, A: 0, R: 0, F: 0, J: 0 },
      totalCounted: 0,
    });
  });

  it('computes per-lesson class presence rate and returns null for unmarked lessons (Edge Case 2)', () => {
    const students: AlunoRecord[] = [
      {
        studentKey: '14820',
        externalId: '14820',
        nome: 'Claudia',
        status: 'Ativo',
        presencas: { '14/10/26': 'F', '31/03/26': 'P' },
        comentarios: [],
        enrolledAt: '2026-01-28T00:00:00.000Z',
        updatedAt: '2026-10-14T00:00:00.000Z',
      },
      {
        studentKey: '7728',
        externalId: '7728',
        nome: 'Lucas',
        status: 'Ativo',
        presencas: { '14/10/26': 'P', '31/03/26': 'A' },
        comentarios: [],
        enrolledAt: '2026-01-28T00:00:00.000Z',
        updatedAt: '2026-10-14T00:00:00.000Z',
      },
      {
        studentKey: '14779',
        externalId: '14779',
        nome: 'Maria',
        status: 'Ativo',
        presencas: { '14/10/26': 'P', '31/03/26': 'R' },
        comentarios: [],
        enrolledAt: '2026-01-28T00:00:00.000Z',
        updatedAt: '2026-10-14T00:00:00.000Z',
      },
    ];

    expect(computeLessonPresenceRate('14/10/26', students)).toBe(67);
    expect(computeLessonPresenceRate('31/03/26', students)).toBe(100);
    expect(computeLessonPresenceRate('21/10/26', students)).toBeNull();
  });
});
