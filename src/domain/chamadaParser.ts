import * as XLSX from 'xlsx';
import {
  type AttendanceCode,
  type LessonColumn,
  type ParsedChamada,
  type ParsedStudentRow,
  isValidAttendanceCode,
} from './types';

const MAX_XLSX_BYTES = 5 * 1024 * 1024; // 5 MB

export class ChamadaParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChamadaParseError';
  }
}

export function normalizeStudentKey(id: string, name: string): string {
  const trimmedId = (id ?? '').trim();
  if (trimmedId.length > 0) {
    return trimmedId;
  }
  const normalizedName = (name ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `nome:${normalizedName}`;
}

export function parseLessonDateKey(rawDate: string): {
  dateKey: string;
  isoDate: string;
  displayDate: string;
} {
  const cleaned = (rawDate ?? '').trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(cleaned);
  if (!match) {
    throw new ChamadaParseError(
      `Data de aula inválida na linha 6: "${rawDate}". Use o formato DD/MM/AA.`
    );
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = match[3];
  const fullYear =
    rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  const twoDigitYear = String(fullYear % 100).padStart(2, '0');

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new ChamadaParseError(
      `Data de aula fora do intervalo na linha 6: "${rawDate}".`
    );
  }

  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const dateKey = `${dd}/${mm}/${twoDigitYear}`;
  const isoDate = `${fullYear}-${mm}-${dd}`;

  return {
    dateKey,
    isoDate,
    displayDate: dateKey,
  };
}

/**
 * Resolves 0xFFFFFFFF ZIP64 sentinel sizes in Central Directory and Local File Headers
 * from the 0x0001 ZIP64 extra field so SheetJS 0.18.5 does not attempt 4 GB allocations.
 */
function normalizeZip64Headers(buffer: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(buffer.slice(0));
  if (bytes.byteLength < 22) {
    return bytes;
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== 0x04034b50) {
    return bytes;
  }

  let eocd = bytes.byteLength - 22;
  const minEocd = Math.max(0, bytes.byteLength - 65557);
  while (eocd >= minEocd && dv.getUint32(eocd, true) !== 0x06054b50) {
    eocd -= 1;
  }
  if (eocd < minEocd) {
    return bytes;
  }

  const count = dv.getUint16(eocd + 8, true);
  let cd = dv.getUint32(eocd + 16, true);

  for (let i = 0; i < count; i++) {
    if (cd + 46 > bytes.byteLength || dv.getUint32(cd, true) !== 0x02014b50) {
      break;
    }
    const namelen = dv.getUint16(cd + 28, true);
    const efsz = dv.getUint16(cd + 30, true);
    const fcsz = dv.getUint16(cd + 32, true);
    const lhoff = dv.getUint32(cd + 42, true);

    let efPos = cd + 46 + namelen;
    const efEnd = Math.min(bytes.byteLength, efPos + efsz);
    while (efPos + 4 <= efEnd) {
      const headerId = dv.getUint16(efPos, true);
      const dataSize = dv.getUint16(efPos + 2, true);
      if (headerId === 0x0001 && dataSize >= 16 && efPos + 20 <= efEnd) {
        const realUsz = dv.getUint32(efPos + 4, true);
        const realCsz = dv.getUint32(efPos + 12, true);
        dv.setUint32(cd + 20, realCsz, true);
        dv.setUint32(cd + 24, realUsz, true);
        if (
          lhoff + 30 <= bytes.byteLength &&
          dv.getUint32(lhoff, true) === 0x04034b50
        ) {
          dv.setUint32(lhoff + 18, realCsz, true);
          dv.setUint32(lhoff + 22, realUsz, true);
        }
        break;
      }
      efPos += 4 + dataSize;
    }

    cd += 46 + namelen + efsz + fcsz;
  }

  return bytes;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

export function parseChamadaBuffer(buffer: ArrayBuffer): ParsedChamada {
  if (!buffer || buffer.byteLength === 0) {
    throw new ChamadaParseError('O arquivo enviado está vazio.');
  }
  if (buffer.byteLength > MAX_XLSX_BYTES) {
    throw new ChamadaParseError(
      'O arquivo excede o tamanho máximo permitido de 5 MB.'
    );
  }

  const normalizedBytes = normalizeZip64Headers(buffer);
  if (
    normalizedBytes.byteLength < 4 ||
    normalizedBytes[0] !== 0x50 ||
    normalizedBytes[1] !== 0x4b
  ) {
    throw new ChamadaParseError(
      'Arquivo inválido: envie uma planilha Excel (.xlsx) válida.'
    );
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(normalizedBytes, { type: 'array' });
  } catch {
    throw new ChamadaParseError(
      'Não foi possível ler a planilha Excel (.xlsx).'
    );
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new ChamadaParseError('A planilha não contém nenhuma aba.');
  }

  const sheetName =
    workbook.SheetNames.find((n) => n.trim().toLowerCase() === 'chamada') ??
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new ChamadaParseError('Aba de chamada não encontrada na planilha.');
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (rows.length < 6) {
    throw new ChamadaParseError(
      'Estrutura inválida: a planilha deve conter o cabeçalho na linha 6.'
    );
  }

  const row1 = rows[0] ?? [];
  const row2 = rows[1] ?? [];
  const row3 = rows[2] ?? [];
  const row4 = rows[3] ?? [];
  const row6 = rows[5] ?? [];

  const cidadePlanilha = cellToString(row1[0]);
  const nomeTurmaPlanilha = cellToString(row2[0]);

  const colAHeader = cellToString(row6[0]).toUpperCase();
  const colCHeader = cellToString(row6[2]).toUpperCase();

  if (colAHeader !== 'ID' || colCHeader !== 'NOME') {
    throw new ChamadaParseError(
      'Cabeçalho obrigatório ausente na linha 6: esperado "ID" na coluna A e "Nome" na coluna C.'
    );
  }

  const lessons: LessonColumn[] = [];
  const colIndexToDateKey = new Map<number, string>();

  for (let colIdx = 6; colIdx < row6.length; colIdx++) {
    const rawDate = cellToString(row6[colIdx]);
    if (!rawDate) {
      continue;
    }
    const parsedDate = parseLessonDateKey(rawDate);
    colIndexToDateKey.set(colIdx, parsedDate.dateKey);
    lessons.push({
      dateKey: parsedDate.dateKey,
      isoDate: parsedDate.isoDate,
      course: cellToString(row2[colIdx]),
      theme: cellToString(row3[colIdx]),
      instructor: cellToString(row4[colIdx]),
    });
  }

  if (lessons.length === 0) {
    throw new ChamadaParseError(
      'Nenhuma data de aula encontrada na linha 6 (colunas G em diante).'
    );
  }

  const students: ParsedStudentRow[] = [];
  for (let rowIdx = 6; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx] ?? [];
    const externalId = cellToString(row[0]);
    const rawSeq = cellToString(row[1]);
    const nome = cellToString(row[2]);
    const rawStatus = cellToString(row[3]) || 'Ativo';

    if (!externalId && !nome) {
      continue;
    }
    if (!nome) {
      throw new ChamadaParseError(
        `Aluno sem nome na linha ${rowIdx + 1} da planilha.`
      );
    }

    const presencas: Record<string, AttendanceCode> = {};
    for (const [colIdx, dateKey] of colIndexToDateKey.entries()) {
      const rawMark = cellToString(row[colIdx]).toUpperCase();
      if (isValidAttendanceCode(rawMark)) {
        presencas[dateKey] = rawMark;
      }
    }

    const parsedSeq = rawSeq ? Number(rawSeq) : undefined;
    students.push({
      studentKey: normalizeStudentKey(externalId, nome),
      externalId,
      sequencia:
        parsedSeq !== undefined && !Number.isNaN(parsedSeq)
          ? parsedSeq
          : undefined,
      nome,
      rawStatus,
      presencas,
    });
  }

  if (students.length === 0) {
    throw new ChamadaParseError(
      'Nenhum aluno encontrado abaixo da linha 6 na planilha.'
    );
  }

  return {
    cidadePlanilha,
    nomeTurmaPlanilha,
    lessons,
    students,
  };
}
