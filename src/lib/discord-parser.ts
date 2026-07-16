// Parser para mensagens de picagem de ponto do Discord
// Versão robusta — lida com erros de formatação comuns (;  .  espaços  etc.)

export type AlertLevel = 'error' | 'warning';

export interface ParsedAlert {
  level: AlertLevel;
  code: string;
  message: string;
  field?: string;
}

export interface ParsedTimeEntry {
  valid: boolean;
  complete: boolean;
  date?: string;
  dateDisplay?: string;
  entryTime?: string;
  exitTime?: string;
  breakTimes?: string[];
  totalMinutes?: number;
  totalFormatted?: string;
  alerts: ParsedAlert[];
  rawAlerts: string[];
  agentName?: string;
}

function validateTimeMinutes(timeStr: string): boolean {
  try {
    const minutes = parseInt(timeStr.split(':')[1], 10);
    return minutes % 5 === 0;
  } catch {
    return false;
  }
}

function isValidTime(timeStr: string): boolean {
  if (!timeStr) return false;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  return hours >= 0 && hours <= 23 && mins >= 0 && mins <= 59;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Normalização agressiva do texto para lidar com erros de formatação comuns:
 * - Substitui ; por : em contextos de hora (19;20 → 19:20)
 * - Substitui . por : em contextos de hora (19.20 → 19:20)
 * - Remove espaços dentro de horas (19 : 20 → 19:20)
 * - Converte notação hH (19h20 → 19:20)
 * - Remove emojis comuns
 */
function normalizeText(raw: string): string {
  let text = raw;

  // Remove emojis comuns de picagem
  text = text.replace(/🕐|📆|🖊️|•|📝|⏰|🕑|🕒|🕓|🕔|🕕|🕖|🕗|🕘|🕙|🕚|🕛|⏱️|📋|✅|❌|🔴|🟢|🟡/g, '');

  // Normaliza notação hH: 19h20 → 19:20, 8H30 → 8:30
  text = text.replace(/\b(\d{1,2})\s*[hH]\s*(\d{2})\b/g, '$1:$2');

  // Normaliza ; para : em contexto de hora: 19;20 → 19:20
  text = text.replace(/\b(\d{1,2})\s*;\s*(\d{2})\b/g, '$1:$2');

  // Normaliza . para : em contexto de hora: 19.20 → 19:20
  // Cuidado para não converter datas (15/07/2026)
  text = text.replace(/\b(\d{1,2})\s*\.\s*(\d{2})\b(?!\s*[/-]\s*\d)/g, '$1:$2');

  // Remove espaços dentro de horas: 19 : 20 → 19:20
  text = text.replace(/\b(\d{1,2})\s*:\s*(\d{2})\b/g, '$1:$2');

  return text.trim();
}

export function extractAgentName(threadTitle: string): string {
  const name = threadTitle
    .replace(/picagem de ponto\s*[-–—]?\s*/i, '')
    .replace(/picagem\s*[-–—]?\s*/i, '')
    .trim();
  return name || threadTitle;
}

function extractAgentNameFromContent(text: string): string | undefined {
  const match = text.match(/Nome\s+do\s+Agente\s*:\s*(.+)/i);
  if (!match) return undefined;
  const raw = match[1].trim();
  if (raw.includes('|')) {
    const parts = raw.split('|');
    const last = parts[parts.length - 1]?.trim();
    return last || raw;
  }
  return raw;
}

/**
 * Extrai todas as horas HH:MM de uma string, incluindo variantes com ;  .  h  espaços
 * Retorna horas já normalizadas no formato HH:MM
 */
function extractAllTimes(text: string): string[] {
  // Já normalizado pelo normalizeText, mas fazemos outra passagem por segurança
  const normalized = text
    .replace(/\b(\d{1,2})\s*[hH]\s*(\d{2})\b/g, '$1:$2')
    .replace(/\b(\d{1,2})\s*;\s*(\d{2})\b/g, '$1:$2')
    .replace(/\b(\d{1,2})\s*\.\s*(\d{2})\b(?!\s*[/-]\s*\d)/g, '$1:$2')
    .replace(/\b(\d{1,2})\s*:\s*(\d{2})\b/g, '$1:$2');

  const matches = normalized.match(/\d{1,2}:\d{2}/g) || [];
  return matches.filter(t => isValidTime(t));
}

export function parseTimeEntryMessage(content: string): ParsedTimeEntry {
  const normalizedText = normalizeText(content);

  const alerts: ParsedAlert[] = [];
  const agentName = extractAgentNameFromContent(normalizedText);

  // ========== 1. EXTRAI DATA ==========
  const dateRegex = /Data\s*[:]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i;
  const dateMatch = normalizedText.match(dateRegex);

  if (!dateMatch) {
    alerts.push({ level: 'error', code: 'NO_DATE', message: 'Data não encontrada na mensagem.', field: 'data' });
    return { valid: false, complete: false, alerts, rawAlerts: alerts.map(a => a.message) };
  }

  const dateStr = dateMatch[1].trim();
  let dateParts: string[];
  if (dateStr.includes('/')) {
    dateParts = dateStr.split('/');
  } else {
    dateParts = dateStr.split('-');
  }

  if (dateParts.length !== 3) {
    alerts.push({ level: 'error', code: 'INVALID_DATE_FORMAT', message: `Formato de data inválido: "${dateStr}".`, field: 'data' });
    return { valid: false, complete: false, alerts, rawAlerts: alerts.map(a => a.message) };
  }

  const [day, month, yearRaw] = dateParts;
  // Handle 2-digit year
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const displayDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;

  // Validate date is real
  const dateObj = new Date(`${formattedDate}T00:00:00`);
  if (isNaN(dateObj.getTime())) {
    alerts.push({ level: 'error', code: 'INVALID_DATE', message: `Data inválida: "${dateStr}".`, field: 'data' });
    return { valid: false, complete: false, alerts, rawAlerts: alerts.map(a => a.message) };
  }

  // ========== 2. EXTRAI HORA DE ENTRADA ==========
  const entryRegex = /(?:Hora\s*(?:De\s*)?Entrada|Entrada)\s*[:]?\s*(\d{1,2}:\d{2})?/i;
  const entryMatch = normalizedText.match(entryRegex);

  let entryTime: string | undefined;

  if (!entryMatch) {
    alerts.push({ level: 'error', code: 'NO_ENTRY', message: 'Campo "Hora De Entrada" não encontrado.', field: 'entrada' });
  } else if (!entryMatch[1]) {
    alerts.push({ level: 'error', code: 'EMPTY_ENTRY', message: 'Hora de Entrada está vazia.', field: 'entrada' });
  } else {
    entryTime = entryMatch[1].trim();
    if (!isValidTime(entryTime)) {
      alerts.push({ level: 'error', code: 'INVALID_ENTRY_TIME', message: `Hora de Entrada inválida: "${entryTime}".`, field: 'entrada' });
      entryTime = undefined;
    } else if (!validateTimeMinutes(entryTime)) {
      alerts.push({ level: 'warning', code: 'ENTRY_NOT_ROUND', message: `Entrada ${entryTime} não termina em 0 ou 5.`, field: 'entrada' });
    }
  }

  // ========== 3. EXTRAI HORA DE SAÍDA ==========
  const exitRegex = /(?:Hora\s*(?:De\s*)?Sa[íi]da|Sa[íi]da)\s*[:]?\s*(\d{1,2}:\d{2}|xx:xx)?/i;
  const exitMatch = normalizedText.match(exitRegex);

  let exitTime: string | undefined;

  if (!exitMatch) {
    alerts.push({ level: 'error', code: 'NO_EXIT', message: 'Campo "Hora De Saída" não encontrado.', field: 'saida' });
  } else if (!exitMatch[1] || exitMatch[1].trim() === '') {
    alerts.push({ level: 'error', code: 'EMPTY_EXIT', message: 'Hora de Saída não preenchida.', field: 'saida' });
  } else if (exitMatch[1].trim().toLowerCase() === 'xx:xx') {
    alerts.push({ level: 'error', code: 'PLACEHOLDER_EXIT', message: 'Hora de Saída contém "xx:xx".', field: 'saida' });
  } else {
    exitTime = exitMatch[1].trim();
    if (!isValidTime(exitTime)) {
      alerts.push({ level: 'error', code: 'INVALID_EXIT_TIME', message: `Hora de Saída inválida: "${exitTime}".`, field: 'saida' });
      exitTime = undefined;
    } else if (!validateTimeMinutes(exitTime)) {
      alerts.push({ level: 'warning', code: 'EXIT_NOT_ROUND', message: `Saída ${exitTime} não termina em 0 ou 5.`, field: 'saida' });
    }
  }

  // ========== 4. EXTRAI PAUSAS ==========
  const breakTimes: string[] = [];

  // Processa linha a linha para evitar capturar conteúdo de outras linhas
  const lines = normalizedText.split(/\n/);
  const pauseContents: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    // Ignora linhas que são de Entrada, Saída, Data, Resumo
    if (/(?:Hora\s*(?:De\s*)?Entrada|Entrada)\s*[:]?\s*\d/i.test(trimmedLine)) continue;
    if (/(?:Hora\s*(?:De\s*)?Sa[íi]da|Sa[íi]da)\s*[:]?\s*/i.test(trimmedLine)) continue;
    if (/Data\s*[:]?\s*\d/i.test(trimmedLine)) continue;
    if (/Resumo/i.test(trimmedLine)) continue;

    const pauseMatch = trimmedLine.match(/(?:Hora\s*(?:De\s*)?Pausa|Pausa)\s*[:]?\s*(.*)/i);
    if (pauseMatch && pauseMatch[1] && pauseMatch[1].trim()) {
      pauseContents.push(pauseMatch[1].trim());
    }
  }

  for (const content of pauseContents) {
    // Estratégia robusta: extrair TODAS as horas de qualquer formato
    // Funciona com qualquer separador: - / | espaço , as das e etc.
    // Ex: "18:30 as 19;20 E DAS 20:10 as 22:15" → [18:30, 19:20, 20:10, 22:15]
    const allTimes = extractAllTimes(content);

    for (const t of allTimes) {
      if (!validateTimeMinutes(t)) {
        // AVISO, mas aceita a hora (não bloqueia como erro)
        alerts.push({ level: 'warning', code: 'BREAK_NOT_ROUND', message: `Pausa ${t} não termina em 0 ou 5.`, field: 'pausa' });
      }
      breakTimes.push(t);
    }
  }

  // ========== 4b. LIMPA PAUSAS ==========
  // Remove break que é igual à entrada ou saída (bug de captura)
  const cleanedBreaks: string[] = [];
  for (const bt of breakTimes) {
    if (bt === entryTime) continue;
    if (bt === exitTime) continue;
    cleanedBreaks.push(bt);
  }
  breakTimes.length = 0;
  breakTimes.push(...cleanedBreaks);

  // Validação: número de breakTimes deve ser par (início/fim de cada pausa)
  if (breakTimes.length > 0 && breakTimes.length % 2 !== 0) {
    alerts.push({
      level: 'warning',
      code: 'ODD_BREAKS',
      message: `Número ímpar de horários de pausa (${breakTimes.length}). Verifique se falta um horário.`,
      field: 'pausa',
    });
  }

  // ========== 5. CALCULA TOTAL ==========
  let totalMinutes = 0;
  let totalFormatted = '0h00m';

  if (entryTime && exitTime) {
    const sequence: number[] = [timeToMinutes(entryTime)];
    for (const bt of breakTimes) {
      sequence.push(timeToMinutes(bt));
    }
    sequence.push(timeToMinutes(exitTime));

    // Ajusta para turnos noturnos (cada tempo deve ser >= ao anterior)
    const adjusted: number[] = [sequence[0]];
    for (let i = 1; i < sequence.length; i++) {
      let val = sequence[i];
      while (val < adjusted[i - 1]) {
        val += 1440;
      }
      adjusted.push(val);
    }

    // Soma períodos de trabalho (pares: [0→1], [2→3], [4→5], ...)
    for (let i = 0; i < adjusted.length - 1; i += 2) {
      if (i + 1 < adjusted.length) {
        totalMinutes += adjusted[i + 1] - adjusted[i];
      }
    }
    totalMinutes = Math.max(0, totalMinutes);

    // Sanity check: mais de 16h de trabalho é suspeito
    if (totalMinutes > 960) {
      alerts.push({
        level: 'warning',
        code: 'EXCESSIVE_HOURS',
        message: `Total de ${Math.floor(totalMinutes / 60)}h${(totalMinutes % 60).toString().padStart(2, '0')}m parece excessivo. Verifique os horários.`,
        field: 'total',
      });
    }

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    totalFormatted = `${hours}h${mins.toString().padStart(2, '0')}m`;
  }

  const hasErrors = alerts.some(a => a.level === 'error');
  const valid = !!formattedDate && !!entryTime;
  const complete = valid && !!exitTime && !hasErrors;

  return {
    valid,
    complete,
    date: formattedDate,
    dateDisplay: displayDate,
    entryTime,
    exitTime,
    breakTimes: breakTimes.length > 0 ? breakTimes : undefined,
    totalMinutes,
    totalFormatted,
    alerts,
    rawAlerts: alerts.map(a => a.message),
    agentName,
  };
}
