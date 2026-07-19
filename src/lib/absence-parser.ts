// Parser para mensagens de ausência do Discord
//
// Formato esperado:
//   Nome: @504 | Correia Maurittetas
//   Patente: Recruta
//   Data: 17/07 - 20/07
//   Motivo: fora de casa
//
// Também aceita:
//   Data: 17/07          (dia único)
//   Data: 17/07/2026     (com ano)
//   Data: 17/07 a 20/07  ("a" em vez de "-")
//   Data: 17/07 até 20/07

export interface ParsedAbsence {
  valid: boolean;
  name?: string;
  rank?: string;
  dates: string[];         // Array de datas ISO: ["2026-07-17", "2026-07-18", ...]
  datesDisplay: string[];  // Array de datas display: ["17/07", "18/07", ...]
  reason?: string;
  rawDateStr?: string;
  error?: string;
}

function normalizeText(raw: string): string {
  return raw
    .replace(/[📆📅📋🗓️✅❌🔴🟢🟡•🕐🖊📝]\uFE0F?/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function extractName(text: string): string | undefined {
  // "Nome: @504 | Correia Maurittetas" → "Correia Maurittetas"
  const match = text.match(/Nome\s*[:]?\s*(.+)/i);
  if (!match) return undefined;
  const raw = match[1].trim();
  if (raw.includes('|')) {
    const parts = raw.split('|');
    return parts[parts.length - 1]?.trim() || raw;
  }
  // Remove @mentions: "@504 Correia" → "Correia"
  return raw.replace(/@\d+\s*/g, '').trim() || raw;
}

function extractRank(text: string): string | undefined {
  const match = text.match(/Patente\s*[:]?\s*(.+)/i);
  return match ? match[1].trim() : undefined;
}

function extractReason(text: string): string | undefined {
  const match = text.match(/Motivo\s*[:]?\s*(.+)/i);
  return match ? match[1].trim() : undefined;
}

/**
 * Expande uma string de data(s) para um array de datas ISO.
 * Suporta:
 *   "17/07"            → ["2026-07-17"]
 *   "17/07/2026"       → ["2026-07-17"]
 *   "17/07 - 20/07"    → ["2026-07-17", "2026-07-18", "2026-07-19", "2026-07-20"]
 *   "17/07 a 20/07"    → idem
 *   "17/07 até 20/07"  → idem
 */
function parseDateRange(dateStr: string): { dates: string[]; displays: string[]; error?: string } {
  // Extrair todas as datas dd/mm ou dd/mm/yyyy
  const datePattern = /(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/g;
  const found: { day: number; month: number; year: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = datePattern.exec(dateStr)) !== null) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    let year: number;
    if (m[3]) {
      year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
    } else {
      // Assume ano corrente
      year = new Date().getFullYear();
    }
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      found.push({ day, month, year });
    }
  }

  if (found.length === 0) {
    return { dates: [], displays: [], error: `Nenhuma data encontrada em "${dateStr}".` };
  }

  if (found.length === 1) {
    // Data única
    const d = found[0];
    const iso = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
    const disp = `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}`;
    return { dates: [iso], displays: [disp] };
  }

  // Range: da primeira data à última
  const start = found[0];
  const end = found[found.length - 1];

  const startDate = new Date(start.year, start.month - 1, start.day);
  const endDate = new Date(end.year, end.month - 1, end.day);

  if (endDate < startDate) {
    return { dates: [], displays: [], error: `Data final (${end.day}/${end.month}) é anterior à inicial (${start.day}/${start.month}).` };
  }

  // Máximo 60 dias de ausência (segurança)
  const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 60) {
    return { dates: [], displays: [], error: `Range de ${diffDays} dias é demasiado longo (máx 60).` };
  }

  const dates: string[] = [];
  const displays: string[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const y = current.getFullYear();
    const mo = current.getMonth() + 1;
    const dy = current.getDate();
    dates.push(`${y}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`);
    displays.push(`${String(dy).padStart(2, '0')}/${String(mo).padStart(2, '0')}`);
    current.setDate(current.getDate() + 1);
  }

  return { dates, displays };
}

export function parseAbsenceMessage(content: string): ParsedAbsence {
  const text = normalizeText(content);

  const name = extractName(text);
  const rank = extractRank(text);
  const reason = extractReason(text);

  // Extrair a linha "Data:"
  const dateMatch = text.match(/Data\s*[:]?\s*(.+)/i);
  if (!dateMatch) {
    return { valid: false, dates: [], datesDisplay: [], error: 'Campo "Data" não encontrado na mensagem.' };
  }

  const rawDateStr = dateMatch[1].trim();
  const { dates, displays, error } = parseDateRange(rawDateStr);

  if (error || dates.length === 0) {
    return { valid: false, dates: [], datesDisplay: [], rawDateStr, error: error || 'Nenhuma data válida.' };
  }

  if (!name) {
    return { valid: false, dates, datesDisplay: displays, rawDateStr, error: 'Nome não encontrado na mensagem.' };
  }

  return {
    valid: true,
    name,
    rank,
    dates,
    datesDisplay: displays,
    reason,
    rawDateStr,
  };
}
