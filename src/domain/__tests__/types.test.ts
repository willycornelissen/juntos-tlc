import { describe, it, expect } from 'vitest';
import {
  ATTENDANCE_CODES,
  isValidAttendanceCode,
  validateCommentText,
  validateTurmaMetadata,
} from '../types';

describe('domain/types validation helpers', () => {
  it('validates canonical attendance codes P, A, R, F, J and rejects others', () => {
    expect(ATTENDANCE_CODES).toEqual(['P', 'A', 'R', 'F', 'J']);
    for (const code of ['P', 'A', 'R', 'F', 'J']) {
      expect(isValidAttendanceCode(code)).toBe(true);
    }
    expect(isValidAttendanceCode('X')).toBe(false);
    expect(isValidAttendanceCode('')).toBe(false);
    expect(isValidAttendanceCode('p')).toBe(false);
    expect(isValidAttendanceCode(null)).toBe(false);
    expect(isValidAttendanceCode(undefined)).toBe(false);
  });

  it('accepts valid trimmed comment text between 1 and 2000 characters', () => {
    const result = validateCommentText('  Aluno justificou ausência por viagem.  ');
    expect(result).toEqual({
      valid: true,
      trimmed: 'Aluno justificou ausência por viagem.',
    });
  });

  it('rejects empty or whitespace-only comments (ALUNO-03)', () => {
    const emptyResult = validateCommentText('');
    expect(emptyResult.valid).toBe(false);
    expect(emptyResult.error).toBe('O comentário não pode estar vazio.');

    const whitespaceResult = validateCommentText('   \n\t  ');
    expect(whitespaceResult.valid).toBe(false);
    expect(whitespaceResult.error).toBe('O comentário não pode estar vazio.');
  });

  it('rejects comments exceeding 2000 characters', () => {
    const tooLong = 'a'.repeat(2001);
    const result = validateCommentText(tooLong);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('O comentário deve ter no máximo 2000 caracteres.');
  });

  it('validates required turma metadata fields and normalizes catedras (TURMA-01)', () => {
    const valid = validateTurmaMetadata({
      nome: '  Turma Pampulha (QUA) ',
      diaHorario: ' Quarta-feira, 19h30 ',
      local: ' Pampulha - Belo Horizonte ',
      catedras: [' Filosofia para Viver ', 'Transpasso', '  '],
    });
    expect(valid).toEqual({
      valid: true,
      normalized: {
        nome: 'Turma Pampulha (QUA)',
        diaHorario: 'Quarta-feira, 19h30',
        local: 'Pampulha - Belo Horizonte',
        catedras: ['Filosofia para Viver', 'Transpasso'],
      },
    });

    const missingName = validateTurmaMetadata({
      nome: '   ',
      diaHorario: 'Quarta, 19h30',
      local: 'Pampulha',
      catedras: ['Filosofia'],
    });
    expect(missingName.valid).toBe(false);
    expect(missingName.error).toBe('Informe o nome da turma.');

    const missingCatedra = validateTurmaMetadata({
      nome: 'Turma Pampulha',
      diaHorario: 'Quarta, 19h30',
      local: 'Pampulha',
      catedras: ['   '],
    });
    expect(missingCatedra.valid).toBe(false);
    expect(missingCatedra.error).toBe('Informe pelo menos uma cátedra.');
  });
});
