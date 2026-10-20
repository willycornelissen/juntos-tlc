import React, { useState } from 'react';
import {
  ChamadaParseError,
  parseChamadaBuffer,
} from '../domain/chamadaParser';
import { computeReimportPlan } from '../domain/syncEngine';
import type { AlunoRecord, ReimportPlan, Turma } from '../domain/types';
import { readFileAsArrayBuffer } from './TurmasDashboard';

export interface ReimportModalProps {
  turma: Turma;
  alunos: AlunoRecord[];
  onClose: () => void;
  onConfirmReimport: (plan: ReimportPlan) => Promise<void>;
  nowIso?: string;
}

export function ReimportModal({
  turma,
  alunos,
  onClose,
  onConfirmReimport,
  nowIso,
}: ReimportModalProps): React.ReactElement {
  const [fileName, setFileName] = useState('');
  const [plan, setPlan] = useState<ReimportPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setErrorMessage(null);
    setFileName(file.name);

    try {
      const buffer = await readFileAsArrayBuffer(file);
      const parsed = parseChamadaBuffer(buffer);
      const effectiveIso = nowIso ?? new Date().toISOString();
      const computedPlan = computeReimportPlan(
        turma,
        alunos,
        parsed,
        effectiveIso
      );
      setPlan(computedPlan);
    } catch (err) {
      setPlan(null);
      if (err instanceof ChamadaParseError || err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Não foi possível ler a planilha Excel (.xlsx).');
      }
    }
  };

  const handleConfirm = async () => {
    if (!plan) {
      return;
    }
    setErrorMessage(null);
    setConfirming(true);
    try {
      await onConfirmReimport(plan);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Erro ao aplicar a reimportação da planilha.'
      );
    } finally {
      setConfirming(false);
    }
  };

  const diff = plan?.diffSummary;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reimport-modal-title"
    >
      <div className="modal-content">
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
          <h2 id="reimport-modal-title" className="card-title">
            Reimportar Planilha (.xlsx) — {turma.nome}
          </h2>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <p className="card-meta" style={{ marginBottom: '1rem' }}>
          Selecione uma planilha de chamada atualizada para sincronizar novas
          datas de aula, novos alunos e identificar inscrições baixadas.
        </p>

        {errorMessage && (
          <div className="warning" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="reimport-xlsx-input">
            Selecionar planilha (.xlsx)
          </label>
          <input
            id="reimport-xlsx-input"
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
          />
        </div>

        {plan && diff && (
          <div
            style={{
              background: 'var(--surface-muted)',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <h3 className="card-title" style={{ fontSize: '1.05rem' }}>
              Resumo da Sincronização ({fileName})
            </h3>

            <div className="card-meta">
              <div>
                <strong>Novas datas de aula ({diff.addedLessonDates.length}):</strong>{' '}
                {diff.addedLessonDates.length > 0
                  ? diff.addedLessonDates.join(', ')
                  : 'Nenhuma'}
              </div>
              <div>
                <strong>
                  Datas atualizadas ({diff.updatedLessonDates.length}):
                </strong>{' '}
                {diff.updatedLessonDates.length > 0
                  ? diff.updatedLessonDates.join(', ')
                  : 'Nenhuma'}
              </div>
              <div>
                <strong>Alunos ativos mantidos:</strong>{' '}
                {diff.unchangedActiveCount}
              </div>
            </div>

            {diff.newStudents.length > 0 && (
              <div>
                <strong>
                  Novos alunos matriculados ({diff.newStudents.length}):
                </strong>
                <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.25rem' }}>
                  {diff.newStudents.map((s) => (
                    <li key={s.studentKey}>
                      {s.externalId ? `[${s.externalId}] ` : ''}
                      {s.nome}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {diff.droppedStudents.length > 0 && (
              <div
                style={{
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                }}
              >
                <strong>
                  Inscrição Baixada ({diff.droppedStudents.length}):
                </strong>{' '}
                Estes alunos não constam na nova planilha e receberão
                automaticamente o status <em>Inscrição Baixada</em> com
                registro na ficha particular:
                <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.25rem' }}>
                  {diff.droppedStudents.map((s) => (
                    <li key={s.studentKey}>
                      {s.externalId ? `[${s.externalId}] ` : ''}
                      {s.nome}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {diff.reenrolledStudents.length > 0 && (
              <div>
                <strong>
                  Inscrição Reativada ({diff.reenrolledStudents.length}):
                </strong>
                <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.25rem' }}>
                  {diff.reenrolledStudents.map((s) => (
                    <li key={s.studentKey}>
                      {s.externalId ? `[${s.externalId}] ` : ''}
                      {s.nome}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={confirming}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void handleConfirm()}
            disabled={!plan || confirming}
          >
            {confirming ? 'Sincronizando...' : 'Confirmar sincronização'}
          </button>
        </div>
      </div>
    </div>
  );
}
