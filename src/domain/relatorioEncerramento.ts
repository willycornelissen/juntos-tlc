import {
  type AlunoRecord,
  type AttendanceCode,
  type LessonColumn,
  type Turma,
  isValidAttendanceCode,
} from './types';
import {
  calculateAttendancePercentage,
  computeStudentMetrics,
} from './attendanceCalc';

export interface RelatorioKPIs {
  totalAlunos: number;
  activeStudentsCount: number;
  droppedStudentsCount: number;
  retentionRate: number | null;
  averageAttendanceRate: number | null;
  totalLessons: number;
  totalPresents: number;
  totalLates: number;
  totalReplacements: number;
  totalAbsences: number;
  totalJustified: number;
}

export interface CurvaPresencaAula {
  dateKey: string;
  isoDate: string;
  course: string;
  theme: string;
  instructor: string;
  presenceRate: number | null;
  presentCount: number;
  totalActiveCount: number;
}

export interface DistribuicaoOcorrenciaItem {
  code: AttendanceCode;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface FaixaAssiduidadeItem {
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
  color: string;
}

export interface MediaInstrutorItem {
  instructor: string;
  lessonCount: number;
  averageRate: number | null;
}

export interface EvolucaoEvasaoItem {
  dateKey: string;
  isoDate: string;
  droppedCountCumulative: number;
  activeCountRemaining: number;
}

export interface RelatorioEncerramentoData {
  kpis: RelatorioKPIs;
  curvaAulas: CurvaPresencaAula[];
  ocorrencias: DistribuicaoOcorrenciaItem[];
  faixasAssiduidade: FaixaAssiduidadeItem[];
  mediaInstrutores: MediaInstrutorItem[];
  evolucaoEvasao: EvolucaoEvasaoItem[];
}

const OCCURRENCE_CONFIG: Record<
  AttendanceCode,
  { label: string; color: string }
> = {
  P: { label: 'Presença (P)', color: '#2c5f4a' },
  A: { label: 'Atraso (A)', color: '#f59e0b' },
  R: { label: 'Reposição (R)', color: '#3b82f6' },
  F: { label: 'Falta (F)', color: '#ef4444' },
  J: { label: 'Justificada (J)', color: '#8b5cf6' },
};

const PRESENT_CODES: ReadonlySet<AttendanceCode> = new Set(['P', 'A', 'R']);

export function computeRelatorioEncerramento(
  turma: Turma,
  alunos: AlunoRecord[]
): RelatorioEncerramentoData {
  const activeAlunos = alunos.filter((a) => a.status === 'Ativo');
  const droppedAlunos = alunos.filter((a) => a.status === 'Inscrição Baixada');
  const totalAlunos = alunos.length;

  const retentionRate =
    totalAlunos > 0
      ? Math.round((100 * activeAlunos.length) / totalAlunos)
      : null;

  // Occurrence totals across all students
  const counts: Record<AttendanceCode, number> = {
    P: 0,
    A: 0,
    R: 0,
    F: 0,
    J: 0,
  };
  let totalOccurrencesCounted = 0;

  for (const aluno of alunos) {
    for (const code of Object.values(aluno.presencas)) {
      if (isValidAttendanceCode(code)) {
        counts[code] += 1;
        totalOccurrencesCounted += 1;
      }
    }
  }

  // Chronological lessons
  const sortedLessons = [...turma.lessons].sort((a, b) =>
    a.isoDate.localeCompare(b.isoDate)
  );

  // Lesson presence curve (calculated for active students on that class)
  const curvaAulas: CurvaPresencaAula[] = sortedLessons.map((lesson) => {
    let presentCount = 0;
    let totalCount = 0;

    for (const aluno of activeAlunos) {
      const code = aluno.presencas[lesson.dateKey];
      if (isValidAttendanceCode(code)) {
        totalCount += 1;
        if (PRESENT_CODES.has(code)) {
          presentCount += 1;
        }
      }
    }

    const presenceRate =
      totalCount > 0 ? Math.round((100 * presentCount) / totalCount) : null;

    return {
      dateKey: lesson.dateKey,
      isoDate: lesson.isoDate,
      course: lesson.course,
      theme: lesson.theme,
      instructor: lesson.instructor,
      presenceRate,
      presentCount,
      totalActiveCount: totalCount,
    };
  });

  // Average attendance rate of active students
  const studentMetricsList = activeAlunos
    .map((aluno) => computeStudentMetrics(turma.lessons, aluno.presencas))
    .filter((m) => m.percentAno !== null);

  const averageAttendanceRate =
    studentMetricsList.length > 0
      ? Math.round(
          studentMetricsList.reduce((acc, m) => acc + (m.percentAno ?? 0), 0) /
            studentMetricsList.length
        )
      : null;

  // Occurrences breakdown
  const ocorrencias: DistribuicaoOcorrenciaItem[] = (
    ['P', 'A', 'R', 'F', 'J'] as AttendanceCode[]
  ).map((code) => {
    const count = counts[code];
    const percentage =
      totalOccurrencesCounted > 0
        ? Math.round((1000 * count) / totalOccurrencesCounted) / 10
        : 0;
    return {
      code,
      label: OCCURRENCE_CONFIG[code].label,
      count,
      percentage,
      color: OCCURRENCE_CONFIG[code].color,
    };
  });

  // Attendance Tiers (Histogram) across active students
  const tierConfigs: Array<{
    label: string;
    min: number;
    max: number;
    color: string;
  }> = [
    { label: '≥ 90% (Excelente)', min: 90, max: 100, color: '#10b981' },
    { label: '75% – 89% (Adequado)', min: 75, max: 89, color: '#3b82f6' },
    { label: '50% – 74% (Atenção)', min: 50, max: 74, color: '#f59e0b' },
    { label: '< 50% (Crítico)', min: 0, max: 49, color: '#ef4444' },
  ];

  const faixasAssiduidade: FaixaAssiduidadeItem[] = tierConfigs.map((tier) => {
    const matchingCount = studentMetricsList.filter((m) => {
      const pct = m.percentAno ?? 0;
      return pct >= tier.min && pct <= tier.max;
    }).length;

    const percentage =
      studentMetricsList.length > 0
        ? Math.round((1000 * matchingCount) / studentMetricsList.length) / 10
        : 0;

    return {
      label: tier.label,
      min: tier.min,
      max: tier.max,
      count: matchingCount,
      percentage,
      color: tier.color,
    };
  });

  // Instructor average presence
  const instructorLessonsMap = new Map<
    string,
    { totalRates: number; count: number }
  >();

  for (const aula of curvaAulas) {
    const rawInstructor = aula.instructor?.trim();
    if (!rawInstructor) continue;

    const existing = instructorLessonsMap.get(rawInstructor) ?? {
      totalRates: 0,
      count: 0,
    };

    if (aula.presenceRate !== null) {
      existing.totalRates += aula.presenceRate;
      existing.count += 1;
      instructorLessonsMap.set(rawInstructor, existing);
    }
  }

  const mediaInstrutores: MediaInstrutorItem[] = Array.from(
    instructorLessonsMap.entries()
  )
    .map(([instructor, data]) => ({
      instructor,
      lessonCount: data.count,
      averageRate: data.count > 0 ? Math.round(data.totalRates / data.count) : null,
    }))
    .sort((a, b) => (b.averageRate ?? 0) - (a.averageRate ?? 0));

  // Drop evolution across lesson dates
  // For each lesson, determine how many students had already dropped by or on that date
  const evolucaoEvasao: EvolucaoEvasaoItem[] = [];
  if (sortedLessons.length > 0 && totalAlunos > 0) {
    let runningDropped = 0;
    for (const lesson of sortedLessons) {
      // Find students who dropped on or before this lesson's isoDate
      const droppedOnOrBefore = droppedAlunos.filter((a) => {
        if (!a.droppedAt) return false;
        const dropDateIso = a.droppedAt.slice(0, 10);
        return dropDateIso <= lesson.isoDate;
      }).length;

      // Ensure monotonic growth
      runningDropped = Math.max(runningDropped, droppedOnOrBefore);

      evolucaoEvasao.push({
        dateKey: lesson.dateKey,
        isoDate: lesson.isoDate,
        droppedCountCumulative: runningDropped,
        activeCountRemaining: Math.max(0, totalAlunos - runningDropped),
      });
    }

    // If there were dropped students without a droppedAt matching lesson dates, ensure end matches
    if (
      evolucaoEvasao.length > 0 &&
      evolucaoEvasao[evolucaoEvasao.length - 1].droppedCountCumulative <
        droppedAlunos.length
    ) {
      evolucaoEvasao[evolucaoEvasao.length - 1].droppedCountCumulative =
        droppedAlunos.length;
      evolucaoEvasao[evolucaoEvasao.length - 1].activeCountRemaining =
        activeAlunos.length;
    }
  }

  return {
    kpis: {
      totalAlunos,
      activeStudentsCount: activeAlunos.length,
      droppedStudentsCount: droppedAlunos.length,
      retentionRate,
      averageAttendanceRate,
      totalLessons: sortedLessons.length,
      totalPresents: counts.P,
      totalLates: counts.A,
      totalReplacements: counts.R,
      totalAbsences: counts.F,
      totalJustified: counts.J,
    },
    curvaAulas,
    ocorrencias,
    faixasAssiduidade,
    mediaInstrutores,
    evolucaoEvasao,
  };
}
