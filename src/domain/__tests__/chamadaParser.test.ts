import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as XLSX from 'xlsx';
import {
  ChamadaParseError,
  normalizeStudentKey,
  parseChamadaBuffer,
  parseLessonDateKey,
} from '../chamadaParser';
import { computeStudentMetrics } from '../attendanceCalc';

function readFixtureBuffer(): ArrayBuffer {
  const filePath = path.resolve(process.cwd(), 'Turma Pampulha QUA.xlsx');
  const nodeBuf = fs.readFileSync(filePath);
  return nodeBuf.buffer.slice(
    nodeBuf.byteOffset,
    nodeBuf.byteOffset + nodeBuf.byteLength
  );
}

function createWorkbookBuffer(rows: unknown[][], sheetName = 'chamada'): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return out;
}

describe('domain/chamadaParser', () => {
  it('normalizes DD/MM/YY and DD/MM/YYYY dates into dateKey and sortable isoDate', () => {
    expect(parseLessonDateKey('14/10/26')).toEqual({
      dateKey: '14/10/26',
      isoDate: '2026-10-14',
      displayDate: '14/10/26',
    });
    expect(parseLessonDateKey('28/01/2026')).toEqual({
      dateKey: '28/01/26',
      isoDate: '2026-01-28',
      displayDate: '28/01/26',
    });
  });

  it('throws ChamadaParseError on invalid lesson date format', () => {
    expect(() => parseLessonDateKey('2026-10-14')).toThrow(ChamadaParseError);
    expect(() => parseLessonDateKey('32/13/26')).toThrow(ChamadaParseError);
  });

  it('normalizes student key by preferring ID and falling back to normalized name slug', () => {
    expect(normalizeStudentKey(' 14820 ', 'Claudia Marcia Marques')).toBe('14820');
    expect(normalizeStudentKey('', '  João da Silva Júnior  ')).toBe(
      'nome:joao-da-silva-junior'
    );
  });

  it('parses the real Turma Pampulha QUA.xlsx file with 100% fidelity (XLSX-01)', () => {
    const buffer = readFixtureBuffer();
    const parsed = parseChamadaBuffer(buffer);

    expect(parsed.cidadePlanilha).toBe('Belo Horizonte');
    expect(parsed.nomeTurmaPlanilha).toBe('Turma Pampulha (QUA)');
    expect(parsed.lessons).toHaveLength(31);

    expect(parsed.lessons[0]).toEqual({
      dateKey: '14/10/26',
      isoDate: '2026-10-14',
      course: 'Filosofia para viver',
      theme: 'Transpasso Aula 10',
      instructor: 'Willy Garabini Cornelissen',
    });

    expect(parsed.lessons[30]).toEqual({
      dateKey: '28/01/26',
      isoDate: '2026-01-28',
      course: 'Filosofia para viver',
      theme: 'Aula de apresentação',
      instructor: 'Willy Garabini Cornelissen',
    });

    expect(parsed.students).toHaveLength(3);
    expect(parsed.students.map((s) => s.externalId)).toEqual([
      '14820',
      '7728',
      '14779',
    ]);
    expect(parsed.students.map((s) => s.nome)).toEqual([
      'Claudia Marcia Marques (Sala Pampulha)',
      'Lucas Selani de Melo (Sala Pampulha)',
      'Maria Regina de Araujo Borges (Sala Pampulha)',
    ]);

    const metrics14820 = computeStudentMetrics(
      parsed.lessons,
      parsed.students[0].presencas
    );
    expect(metrics14820.percentTrim).toBe(78);
    expect(metrics14820.percentAno).toBe(80);

    const metrics7728 = computeStudentMetrics(
      parsed.lessons,
      parsed.students[1].presencas
    );
    expect(metrics7728.percentTrim).toBe(89);
    expect(metrics7728.percentAno).toBe(81);

    const metrics14779 = computeStudentMetrics(
      parsed.lessons,
      parsed.students[2].presencas
    );
    expect(metrics14779.percentTrim).toBe(89);
    expect(metrics14779.percentAno).toBe(87);
  });

  it('rejects empty or corrupted non-xlsx buffers with ChamadaParseError (XLSX-02)', () => {
    expect(() => parseChamadaBuffer(new ArrayBuffer(0))).toThrow(
      ChamadaParseError
    );
    const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    expect(() => parseChamadaBuffer(garbage)).toThrow(ChamadaParseError);
  });

  it('rejects workbooks missing required Row 6 headers ID and Nome (XLSX-02)', () => {
    const badHeaderRows = [
      ['Belo Horizonte'],
      ['Turma X', '', '', '', '', '', 'Filosofia'],
      ['Tema', '', '', '', '', '', 'Aula 1'],
      ['Instrutores', '', '', '', '', '', 'Prof'],
      ['', '', '% Presença'],
      ['Codigo', '1', 'Aluno', 'Status', '% Trim', '% Ano', '14/10/26'],
      ['100', '1', 'Maria', 'Ativo', '', '', 'P'],
    ];
    const buf = createWorkbookBuffer(badHeaderRows);
    expect(() => parseChamadaBuffer(buf)).toThrow(
      /cabeçalho obrigatório ausente na linha 6/i
    );
  });

  it('rejects workbooks with no lesson dates in Row 6 columns G+ (XLSX-02)', () => {
    const noDatesRows = [
      ['Belo Horizonte'],
      ['Turma X'],
      ['Tema'],
      ['Instrutores'],
      ['', '', '% Presença'],
      ['ID', '1', 'Nome', 'Status', '% Trim', '% Ano'],
      ['100', '1', 'Maria', 'Ativo', '', ''],
    ];
    const buf = createWorkbookBuffer(noDatesRows);
    expect(() => parseChamadaBuffer(buf)).toThrow(
      /nenhuma data de aula encontrada/i
    );
  });

  it('rejects workbooks with 0 student rows below Row 6 to prevent mass drop (Edge Case 4)', () => {
    const zeroStudentsRows = [
      ['Belo Horizonte'],
      ['Turma X', '', '', '', '', '', 'Filosofia'],
      ['Tema', '', '', '', '', '', 'Aula 1'],
      ['Instrutores', '', '', '', '', '', 'Prof'],
      ['', '', '% Presença'],
      ['ID', '0', 'Nome', 'Status', '% Trim', '% Ano', '14/10/26'],
    ];
    const buf = createWorkbookBuffer(zeroStudentsRows);
    expect(() => parseChamadaBuffer(buf)).toThrow(
      /nenhum aluno encontrado abaixo da linha 6/i
    );
  });
});
