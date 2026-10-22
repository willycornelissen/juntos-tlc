import React, { useMemo, useState } from 'react';
import type { AlunoRecord, Turma } from '../domain/types';
import {
  computeRelatorioEncerramento,
  type CurvaPresencaAula,
} from '../domain/relatorioEncerramento';

interface RelatorioEncerramentoViewProps {
  turma: Turma;
  alunos: AlunoRecord[];
}

export const RelatorioEncerramentoView: React.FC<
  RelatorioEncerramentoViewProps
> = ({ turma, alunos }) => {
  const data = useMemo(
    () => computeRelatorioEncerramento(turma, alunos),
    [turma, alunos]
  );
  const [activeLessonHover, setActiveLessonHover] =
    useState<CurvaPresencaAula | null>(null);

  const { kpis, curvaAulas, ocorrencias, faixasAssiduidade, mediaInstrutores, evolucaoEvasao } =
    data;

  // Donut chart math
  const donutTotal = kpis.totalAlunos || 1;
  const activeAngle = (kpis.activeStudentsCount / donutTotal) * 360;
  const droppedAngle = 360 - activeAngle;

  // SVG Donut calculation
  const donutRadius = 60;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const activeStrokeLength = (kpis.activeStudentsCount / donutTotal) * donutCircumference;
  const droppedStrokeLength = (kpis.droppedStudentsCount / donutTotal) * donutCircumference;

  // Curve chart coordinates
  const curveWidth = 600;
  const curveHeight = 220;
  const paddingX = 50;
  const paddingY = 30;
  const graphWidth = curveWidth - paddingX * 2;
  const graphHeight = curveHeight - paddingY * 2;

  const points = useMemo(() => {
    if (curvaAulas.length === 0) return [];
    return curvaAulas.map((aula, idx) => {
      const x =
        curvaAulas.length === 1
          ? paddingX + graphWidth / 2
          : paddingX + (idx / (curvaAulas.length - 1)) * graphWidth;
      const rate = aula.presenceRate ?? 0;
      const y = paddingY + graphHeight - (rate / 100) * graphHeight;
      return { x, y, aula };
    });
  }, [curvaAulas, graphWidth, graphHeight]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [points]);

  // Drop timeline coordinates
  const dropPoints = useMemo(() => {
    if (evolucaoEvasao.length === 0) return [];
    const maxDrop = Math.max(kpis.totalAlunos, 1);
    return evolucaoEvasao.map((item, idx) => {
      const x =
        evolucaoEvasao.length === 1
          ? paddingX + graphWidth / 2
          : paddingX + (idx / (evolucaoEvasao.length - 1)) * graphWidth;
      const y =
        paddingY +
        graphHeight -
        (item.droppedCountCumulative / maxDrop) * graphHeight;
      return { x, y, item };
    });
  }, [evolucaoEvasao, graphWidth, graphHeight, kpis.totalAlunos]);

  const dropPathD = useMemo(() => {
    if (dropPoints.length === 0) return '';
    return dropPoints.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [dropPoints]);

  return (
    <div className="relatorio-encerramento-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Intro Header */}
      <div
        className="card"
        style={{
          borderLeft: '4px solid var(--primary)',
          background: 'var(--surface)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--primary)' }}>
              Relatório de Encerramento
            </h2>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.95rem' }}>
              Balanço retrospectivo e consolidação estatística da turma <strong>{turma.nome}</strong>.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 600 }}>
              Status: {turma.status}
            </span>
            {turma.closedAt && (
              <span className="badge" style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}>
                Encerrada em: {new Date(turma.closedAt).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Retenção */}
        <div className="card" style={{ padding: '1.2rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Taxa de Retenção
          </span>
          <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--primary)', margin: '0.2rem 0' }}>
            {kpis.retentionRate !== null ? `${kpis.retentionRate}%` : '-'}
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
            {kpis.activeStudentsCount} concluintes de {kpis.totalAlunos} alunos
          </span>
        </div>

        {/* Frequência Média Global */}
        <div className="card" style={{ padding: '1.2rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Frequência Média Global
          </span>
          <div style={{ fontSize: '2.2rem', fontWeight: 700, color: '#3b82f6', margin: '0.2rem 0' }}>
            {kpis.averageAttendanceRate !== null ? `${kpis.averageAttendanceRate}%` : '-'}
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
            Média de assiduidade no ciclo
          </span>
        </div>

        {/* Total de Aulas */}
        <div className="card" style={{ padding: '1.2rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total de Aulas
          </span>
          <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--text)', margin: '0.2rem 0' }}>
            {kpis.totalLessons}
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
            Aulas ministradas no período
          </span>
        </div>

        {/* Reposições e Justificativas */}
        <div className="card" style={{ padding: '1.2rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Reposições e Justificativas
          </span>
          <div style={{ fontSize: '2.2rem', fontWeight: 700, color: '#8b5cf6', margin: '0.2rem 0' }}>
            {kpis.totalReplacements + kpis.totalJustified}
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
            {kpis.totalReplacements} reposições (R) / {kpis.totalJustified} justif. (J)
          </span>
        </div>
      </div>

      {curvaAulas.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
          Sem aulas registradas para gerar as visualizações gráficas desta turma.
        </div>
      ) : (
        <>
          {/* Top Charts Row: Donut + Evasão */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {/* Chart 1: Donut Conclusão vs Evasão */}
            <section
              className="card"
              role="region"
              aria-label="Conclusão vs. Evasão"
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Conclusão vs. Evasão</h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                Distribuição final entre alunos concluintes ativos e inscrições baixadas.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap', flex: 1 }}>
                <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden="true">
                  <circle
                    cx="80"
                    cy="80"
                    r={donutRadius}
                    fill="none"
                    stroke="var(--surface-muted)"
                    strokeWidth="20"
                  />
                  {/* Active segment */}
                  <circle
                    cx="80"
                    cy="80"
                    r={donutRadius}
                    fill="none"
                    stroke="#2c5f4a"
                    strokeWidth="20"
                    strokeDasharray={`${activeStrokeLength} ${donutCircumference}`}
                    strokeDashoffset={donutCircumference * 0.25}
                    transform="rotate(-90 80 80)"
                  />
                  {/* Dropped segment */}
                  <circle
                    cx="80"
                    cy="80"
                    r={donutRadius}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="20"
                    strokeDasharray={`${droppedStrokeLength} ${donutCircumference}`}
                    strokeDashoffset={`${donutCircumference * 0.25 - activeStrokeLength}`}
                    transform="rotate(-90 80 80)"
                  />
                  <text
                    x="80"
                    y="76"
                    textAnchor="middle"
                    fill="var(--text)"
                    fontSize="1.3rem"
                    fontWeight="700"
                  >
                    {kpis.retentionRate !== null ? `${kpis.retentionRate}%` : '-'}
                  </text>
                  <text
                    x="80"
                    y="94"
                    textAnchor="middle"
                    fill="var(--muted)"
                    fontSize="0.75rem"
                  >
                    Retenção
                  </text>
                </svg>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: '#2c5f4a', display: 'inline-block' }} />
                    <strong>Ativos / Concluintes:</strong> {kpis.activeStudentsCount} ({kpis.retentionRate ?? 0}%)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: '#ef4444', display: 'inline-block' }} />
                    <strong>Inscrição Baixada:</strong> {kpis.droppedStudentsCount} ({100 - (kpis.retentionRate ?? 0)}%)
                  </div>
                </div>
              </div>
            </section>

            {/* Chart 2: Linha do Tempo de Evasão */}
            <section
              className="card"
              role="region"
              aria-label="Linha do Tempo de Evasão"
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Linha do Tempo de Evasão</h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                Evolução cumulativa de baixas de inscrição ao longo das datas de aula.
              </p>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {kpis.droppedStudentsCount === 0 ? (
                  <div style={{ color: 'var(--success)', fontWeight: 500, fontSize: '0.95rem', padding: '1rem' }}>
                    Nenhuma evasão registrada nesta turma (100% de retenção).
                  </div>
                ) : (
                  <svg
                    width="100%"
                    height="180"
                    viewBox={`0 0 ${curveWidth} 180`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ overflow: 'visible' }}
                  >
                    {/* Grid lines */}
                    <line x1={paddingX} y1={paddingY} x2={curveWidth - paddingX} y2={paddingY} stroke="var(--border)" strokeDasharray="3 3" />
                    <line x1={paddingX} y1={180 - paddingY} x2={curveWidth - paddingX} y2={180 - paddingY} stroke="var(--border)" />

                    {/* Step / Line Path */}
                    {dropPathD && (
                      <path
                        d={dropPathD}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Points */}
                    {dropPoints.map((pt, idx) => (
                      <g key={idx}>
                        <circle cx={pt.x} cy={pt.y} r="5" fill="#ef4444" stroke="var(--surface)" strokeWidth="2" />
                        <text
                          x={pt.x}
                          y={180 - 10}
                          textAnchor="middle"
                          fill="var(--muted)"
                          fontSize="10"
                        >
                          {pt.item.dateKey}
                        </text>
                        <text
                          x={pt.x}
                          y={pt.y - 10}
                          textAnchor="middle"
                          fill="#ef4444"
                          fontSize="11"
                          fontWeight="600"
                        >
                          {pt.item.droppedCountCumulative}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            </section>
          </div>

          {/* Chart 3: Curva de Presença por Aula */}
          <section
            className="card"
            role="region"
            aria-label="Curva de Presença por Aula"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Curva de Presença por Aula</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Percentual de presença dos alunos ativos aula a aula (Presenças + Atrasos + Reposições).
                </p>
              </div>
              {kpis.averageAttendanceRate !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  <span style={{ width: 16, height: 2, background: 'var(--accent)', display: 'inline-block' }} />
                  Linha de referência: <strong>Média ({kpis.averageAttendanceRate}%)</strong>
                </div>
              )}
            </div>

            <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
              <svg
                width="100%"
                height={curveHeight}
                viewBox={`0 0 ${curveWidth} ${curveHeight}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ overflow: 'visible', minWidth: '480px' }}
              >
                {/* Y-axis guidelines */}
                {[0, 25, 50, 75, 100].map((level) => {
                  const y = paddingY + graphHeight - (level / 100) * graphHeight;
                  return (
                    <g key={level}>
                      <line
                        x1={paddingX}
                        y1={y}
                        x2={curveWidth - paddingX}
                        y2={y}
                        stroke="var(--border)"
                        strokeDasharray={level === 0 ? 'none' : '3 3'}
                      />
                      <text
                        x={paddingX - 10}
                        y={y + 4}
                        textAnchor="end"
                        fontSize="11"
                        fill="var(--muted)"
                      >
                        {level}%
                      </text>
                    </g>
                  );
                })}

                {/* Average Reference Line */}
                {kpis.averageAttendanceRate !== null && (
                  <line
                    x1={paddingX}
                    y1={paddingY + graphHeight - (kpis.averageAttendanceRate / 100) * graphHeight}
                    x2={curveWidth - paddingX}
                    y2={paddingY + graphHeight - (kpis.averageAttendanceRate / 100) * graphHeight}
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                )}

                {/* Line Path */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Points */}
                {points.map((pt, idx) => {
                  const isHovered = activeLessonHover?.dateKey === pt.aula.dateKey;
                  return (
                    <g
                      key={idx}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setActiveLessonHover(pt.aula)}
                      onMouseLeave={() => setActiveLessonHover(null)}
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 7 : 4.5}
                        fill={isHovered ? 'var(--accent)' : 'var(--primary)'}
                        stroke="var(--surface)"
                        strokeWidth="2"
                      />
                      <text
                        x={pt.x}
                        y={curveHeight - 8}
                        textAnchor="middle"
                        fontSize="10"
                        fill="var(--muted)"
                      >
                        {pt.aula.dateKey}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Hovered Lesson Details */}
            {activeLessonHover && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.6rem 1rem',
                  background: 'var(--surface-muted)',
                  borderRadius: 6,
                  fontSize: '0.85rem',
                  display: 'flex',
                  gap: '1.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <span><strong>Data:</strong> {activeLessonHover.dateKey} ({activeLessonHover.isoDate})</span>
                <span><strong>Tema:</strong> {activeLessonHover.theme || '-'}</span>
                <span><strong>Instrutor:</strong> {activeLessonHover.instructor || '-'}</span>
                <span><strong>Presença:</strong> {activeLessonHover.presenceRate !== null ? `${activeLessonHover.presenceRate}%` : '-'} ({activeLessonHover.presentCount} presentes de {activeLessonHover.totalActiveCount})</span>
              </div>
            )}
          </section>

          {/* Bottom Grid: Ocorrências + Histograma + Instrutores */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {/* Chart 4: Distribuição Geral de Ocorrências */}
            <section
              className="card"
              role="region"
              aria-label="Distribuição Geral de Ocorrências"
            >
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Distribuição Geral de Ocorrências</h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                Frequência de registros por código de chamada (P, A, R, F, J).
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {ocorrencias.map((oc) => (
                  <div key={oc.code}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 600 }}>{oc.label}</span>
                      <span style={{ color: 'var(--muted)' }}>
                        {oc.count} ({oc.percentage}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 10, background: 'var(--surface-muted)', borderRadius: 5, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${oc.percentage}%`,
                          height: '100%',
                          background: oc.color,
                          borderRadius: 5,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Chart 5: Histograma de Faixas de Assiduidade */}
            <section
              className="card"
              role="region"
              aria-label="Faixas de Assiduidade Final"
            >
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Faixas de Assiduidade Final</h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                Classificação dos alunos por percentual total de presença no ano.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {faixasAssiduidade.map((faixa) => (
                  <div key={faixa.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 600 }}>{faixa.label}</span>
                      <span style={{ color: 'var(--muted)' }}>
                        {faixa.count} aluno(s) ({faixa.percentage}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 12, background: 'var(--surface-muted)', borderRadius: 6, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${faixa.percentage}%`,
                          height: '100%',
                          background: faixa.color,
                          borderRadius: 6,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Chart 6: Frequência Média por Instrutor */}
            <section
              className="card"
              role="region"
              aria-label="Frequência Média por Instrutor"
            >
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Frequência Média por Instrutor</h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                Assiduidade média dos alunos nas aulas ministradas por cada professor.
              </p>

              {mediaInstrutores.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '0.9rem', padding: '1rem 0' }}>
                  Nenhum instrutor identificado nas aulas.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {mediaInstrutores.map((item) => (
                    <div key={item.instructor}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 600 }}>{item.instructor}</span>
                        <span style={{ color: 'var(--muted)' }}>
                          {item.averageRate !== null ? `${item.averageRate}%` : '-'} ({item.lessonCount} aula{item.lessonCount > 1 ? 's' : ''})
                        </span>
                      </div>
                      <div style={{ width: '100%', height: 10, background: 'var(--surface-muted)', borderRadius: 5, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${item.averageRate ?? 0}%`,
                            height: '100%',
                            background: 'var(--primary)',
                            borderRadius: 5,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};
