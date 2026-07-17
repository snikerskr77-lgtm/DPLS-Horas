// Parser para mensagens de picagem de ponto do Discord
// Versão 3 — ordenação cronológica automática a partir da entrada + pairing robusto
//
// Princípios:
// 1) Tudo o que parece HH:MM é capturado, com qualquer separador ("as", "às", "E DAS", "-", ";", "|", espaços…)
// 2) As horas de pausa são ORDENADAS cronologicamente a partir da hora de entrada
//    (resolve o pessoal que "inventa" e escreve as pausas fora de ordem)
// 3) Suporta turnos que passam da meia-noite (entrada 22:00 → saída 06:00)
// 4) ; . h espaços dentro de horas são normalizados (19;20 → 19:20, 19.20 → 19:20, 19h20 → 19:20)

export type AlertLevel = 'error' | 'warning';

export interface ParsedAlert {
  level: AlertLevel;
  code: string;
  message: string;
  field?: string;
}

export interface WorkPeriod {
  start: string; // HH:MM (pode ser 25:00+ se cruzar meia-noite)
  end: string;
}

export interface ParsedTimeEntry {
  valid: boolean;
  complete: boolean;
  date?: string;
  dateDisplay?: string;
  entryTime?: string;
  exitTime?: string;
  breakTimes?: string[];       // ORDENADAS cronologicamente a partir da entrada
  totalMinutes?: number;
  totalFormatted?: string;
  periods?: WorkPeriod[];      // períodos de trabalho em pares
  alerts: ParsedAlert[];
  rawAlerts: string[];
  agentName?: string;
}

// ─────────────────────────────────────────────
// Utilitários de tempo
// ─────────────────────────────────────────────

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

function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function minutesToTimeExt(totalMinutes: number): string {
  // Permite 25:40 etc. para períodos após meia-noite
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// Normalização do texto (anti-truques)
// ─────────────────────────────────────────────

function normalizeText(raw: string): string {
  let text = raw;

  // 1. Remove emojis comuns (com e sem variation selector)
  text = text.replace(
    /[🕐🕑🕒🕓🕔🕕🕖🕗🕘🕙🕚🕛⏰📆📅🖊📝📋✅❌🔴🟢🟡•]\uFE0F?/g,
    ''
  );

  // 2. Datas com pontos: 15.07.2026 → 15/07/2026 (ANTES de converter pontos em horas)
  text = text.replace(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g, '$1/$2/$3');

  // 3. Notação hH: 19h20 → 19:20, 8H30 → 8:30
  text = text.replace(/\b(\d{1,2})\s*[hH]\s*(\d{2})\b/g, '$1:$2');

  // 4. Ponto-e-vírgula DENTRO de hora (apenas sem espaços, direto entre dígitos):
  //    "19;20" → "19:20"
  //    NOTA: "13:05 ; 16:30" NÃO é convertido — o ; com espaços é separador de pausas!
  text = text.replace(/\b(\d{1,2});(\d{2})\b/g, '$1:$2');

  // 5. Ponto DENTRO de hora (apenas sem espaços): "19.20" → "19:20"
  text = text.replace(/\b(\d{1,2})\.(\d{2})\b/g, '$1:$2');

  // 6. Espaços dentro de horas: "19 : 20" → "19:20"
  text = text.replace(/\b(\d{1,2})\s*:\s*(\d{2})\b/g, '$1:$2');

  return text.trim();
}

// ─────────────────────────────────────────────
// Extração de horas de um texto
// ─────────────────────────────────────────────

function extractAllTimes(text: string): string[] {
  const matches = text.match(/\d{1,2}:\d{2}/g) || [];
  return matches.filter(t => isValidTime(t));
}

// ─────────────────────────────────────────────
// Nomes de agente
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// PARSER PRINCIPAL
// ─────────────────────────────────────────────

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
  const dateParts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');

  if (dateParts.length !== 3) {
    alerts.push({ level: 'error', code: 'INVALID_DATE_FORMAT', message: `Formato de data inválido: "${dateStr}".`, field: 'data' });
    return { valid: false, complete: false, alerts, rawAlerts: alerts.map(a => a.message) };
  }

  const [day, month, yearRaw] = dateParts;
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  const dayN = parseInt(day, 10);
  const monthN = parseInt(month, 10);

  if (dayN < 1 || dayN > 31 || monthN < 1 || monthN > 12) {
    alerts.push({ level: 'error', code: 'INVALID_DATE', message: `Data inválida: "${dateStr}".`, field: 'data' });
    return { valid: false, complete: false, alerts, rawAlerts: alerts.map(a => a.message) };
  }

  const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const displayDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;

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

  // ========== 4. EXTRAI PAUSAS (linha a linha) ==========
  const rawBreakTimes: string[] = [];
  const lines = normalizedText.split(/\r?\n/);
  const pauseContents: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    // Ignora linhas de Entrada, Saída, Data, Resumo
    if (/(?:Hora\s*(?:De\s*)?Entrada|Entrada)\s*[:]?\s*\d/i.test(trimmedLine)) continue;
    if (/(?:Hora\s*(?:De\s*)?Sa[íi]da|Sa[íi]da)\s*[:]?\s*/i.test(trimmedLine)) continue;
    if (/Data\s*[:]?\s*\d/i.test(trimmedLine)) continue;
    if (/Resumo/i.test(trimmedLine)) continue;

    const pauseMatch = trimmedLine.match(/(?:Hora\s*(?:De\s*)?Pausa|Pausa)\s*[:]?\s*(.*)/i);
    if (pauseMatch && pauseMatch[1] && pauseMatch[1].trim()) {
      pauseContents.push(pauseMatch[1].trim());
    }
  }

  for (const pauseContent of pauseContents) {
    // Extrai TODAS as horas — separadores podem ser qualquer coisa:
    // "as", "às", "E DAS", "-", ";", "|", "/", espaços, vírgulas…
    const allTimes = extractAllTimes(pauseContent);

    for (const t of allTimes) {
      if (!validateTimeMinutes(t)) {
        // AVISO, mas aceita a hora
        alerts.push({ level: 'warning', code: 'BREAK_NOT_ROUND', message: `Pausa ${t} não termina em 0 ou 5.`, field: 'pausa' });
      }
      rawBreakTimes.push(t);
    }
  }

  // ========== 5. LIMPA + ORDENA PAUSAS ==========
  // Remove breaks iguais à entrada ou saída (capturas duplicadas)
  const dedupedBreaks: string[] = [];
  for (const bt of rawBreakTimes) {
    if (bt === entryTime) continue;
    if (bt === exitTime) continue;
    dedupedBreaks.push(bt);
  }

  // Remove duplicados exatos consecutivos (ex: "12:35 - 12:35")
  const uniqueBreaks = dedupedBreaks.filter((t, i) => i === 0 || t !== dedupedBreaks[i - 1]);

  // ---- ORDENAÇÃO CRONOLÓGICA A PARTIR DA ENTRADA ----
  // Resolve o pessoal que escreve as pausas fora de ordem.
  // Converte cada hora para minutos "relativos" à entrada:
  //   hora >= entrada → fica igual
  //   hora < entrada  → soma 1440 (é do dia seguinte)
  // Depois ordena e volta a converter para HH:MM.
  let breakTimes: string[] = uniqueBreaks;
  let sortedRelativeBreaks: number[] = [];

  if (entryTime && uniqueBreaks.length > 0) {
    const entryMin = timeToMinutes(entryTime);
    sortedRelativeBreaks = uniqueBreaks
      .map(bt => {
        let m = timeToMinutes(bt);
        if (m < entryMin) m += 1440;
        return m;
      })
      .sort((a, b) => a - b);
    breakTimes = sortedRelativeBreaks.map(m => minutesToTime(m));
  }

  // Validação: número de pausas deve ser par
  if (breakTimes.length > 0 && breakTimes.length % 2 !== 0) {
    alerts.push({
      level: 'warning',
      code: 'ODD_BREAKS',
      message: `Número ímpar de horários de pausa (${breakTimes.length}). Verifique se falta um horário.`,
      field: 'pausa',
    });
  }

  // ========== 6. CALCULA TOTAL (com sequência ordenada) ==========
  let totalMinutes = 0;
  let totalFormatted = '0h00m';
  const periods: WorkPeriod[] = [];

  if (entryTime && exitTime) {
    const entryMin = timeToMinutes(entryTime);

    // Saída: deve ser >= última hora da sequência
    let exitMin = timeToMinutes(exitTime);
    const lastBreak = sortedRelativeBreaks[sortedRelativeBreaks.length - 1] ?? entryMin;
    while (exitMin < lastBreak) exitMin += 1440;
    // Se a saída ainda for <= entrada (ex: entrada 22:00 saída 22:00), assume +24h
    if (exitMin <= entryMin) exitMin += 1440;

    // Sequência relativa completa: [entrada, ...pausas ordenadas, saída]
    const sequence = [entryMin, ...sortedRelativeBreaks, exitMin];

    // Emparelha: [entrada→pausa1], [pausa2→pausa3], ..., [pausaN→saída]
    for (let i = 0; i + 1 < sequence.length; i += 2) {
      const start = sequence[i];
      const end = sequence[i + 1];
      if (end > start) {
        totalMinutes += end - start;
        periods.push({ start: minutesToTimeExt(start), end: minutesToTimeExt(end) });
      } else if (end === start) {
        // Período zero (hora repetida) — ignora mas avisa
        alerts.push({
          level: 'warning',
          code: 'ZERO_PERIOD',
          message: `Período com duração zero detetado em ${minutesToTime(start)}. Verifique horários duplicados.`,
          field: 'pausa',
        });
      }
    }

    // Segurança: mais de 18h de trabalho é quase de certeza erro
    if (totalMinutes > 1080) {
      alerts.push({
        level: 'warning',
        code: 'EXCESSIVE_HOURS',
        message: `Total de ${Math.floor(totalMinutes / 60)}h${(totalMinutes % 60).toString().padStart(2, '0')}m parece excessivo. Verifique os horários.`,
        field: 'total',
      });
    }

    totalMinutes = Math.max(0, totalMinutes);
    totalFormatted = `${Math.floor(totalMinutes / 60)}h${(totalMinutes % 60).toString().padStart(2, '0')}m`;
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
    periods: periods.length > 0 ? periods : undefined,
    alerts,
    rawAlerts: alerts.map(a => a.message),
    agentName,
  };
}
