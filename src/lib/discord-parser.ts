// Parser para mensagens de picagem de ponto do Discord
// Baseado na lógica do bot Python original

export type AlertLevel = 'error' | 'warning';

export interface ParsedAlert {
  level: AlertLevel;
  code: string;       // código curto para identificar o tipo
  message: string;    // mensagem descritiva
  field?: string;     // campo afetado (data, entrada, saida, pausa)
}

export interface ParsedTimeEntry {
  valid: boolean;       // true = pode ser guardado (tem pelo menos data + entrada)
  complete: boolean;    // true = tem todos os campos preenchidos sem erros
  date?: string;        // formato YYYY-MM-DD para a BD
  dateDisplay?: string; // formato DD/MM/YYYY para exibição
  entryTime?: string;
  exitTime?: string;
  breakTimes?: string[];
  totalMinutes?: number;
  totalFormatted?: string;
  alerts: ParsedAlert[];
  rawAlerts: string[];  // lista simples para compatibilidade
  agentName?: string;
}

// Verifica se os minutos terminam em 0 ou 5
function validateTimeMinutes(timeStr: string): boolean {
  try {
    const minutes = parseInt(timeStr.split(':')[1], 10);
    return minutes % 5 === 0;
  } catch {
    return false;
  }
}

// Verifica se um horário é válido (HH:MM)
function isValidTime(timeStr: string): boolean {
  if (!timeStr) return false;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  return hours >= 0 && hours <= 23 && mins >= 0 && mins <= 59;
}

// Converte horário para minutos desde meia-noite
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Extrai nome do agente do título da thread
export function extractAgentName(threadTitle: string): string {
  let name = threadTitle
    .replace(/picagem de ponto\s*[-–—]?\s*/i, '')
    .replace(/picagem\s*[-–—]?\s*/i, '')
    .trim();
  return name || threadTitle;
}

// Parser principal para mensagens de picagem
export function parseTimeEntryMessage(content: string): ParsedTimeEntry {
  // Remove emojis comuns mas mantém o texto
  let cleanText = content
    .replace(/🕐|📆|🖊️|•|📝/g, '')
    .trim();

  // ===== NORMALIZAÇÃO: converte formatos alternativos =====
  // 1. "14h40" → "14:40"  (h minúsculo entre números)
  cleanText = cleanText.replace(/(\d{1,2})[hH](\d{2})/g, '$1:$2');
  // 2. "Hora entrada" → "Hora De Entrada"
  cleanText = cleanText.replace(/(?:hora\s*)?entrada\s*[:]?\s*/gi, 'Hora De Entrada: ');
  // 3. "Hora saída" → "Hora De Saída"
  cleanText = cleanText.replace(/(?:hora\s*)?(saída|saida)\s*[:]?\s*/gi, 'Hora De Saída: ');
  // 4. "Nome do Agente" removido para evitar confundir o parser
  cleanText = cleanText.replace(/nome do agente\s*[:]?\s*@?\d*\s*[|].*/gi, '');
  // 5. Limpeza de espaços duplos
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

  const alerts: ParsedAlert[] = [];

  // ========== 1. EXTRAI DATA ==========
  const dateRegex = /Data\s*[:]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i;
  const dateMatch = cleanText.match(dateRegex);
  
  if (!dateMatch) {
    alerts.push({
      level: 'error',
      code: 'NO_DATE',
      message: 'Data não encontrada na mensagem. Formato esperado: Data: DD/MM/AAAA',
      field: 'data',
    });
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
    alerts.push({
      level: 'error',
      code: 'INVALID_DATE_FORMAT',
      message: `Formato de data inválido: "${dateStr}". Use DD/MM/AAAA`,
      field: 'data',
    });
    return { valid: false, complete: false, alerts, rawAlerts: alerts.map(a => a.message) };
  }
  
  const [day, month, year] = dateParts;
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  // Validação de data
  if (monthNum < 1 || monthNum > 12) {
    alerts.push({ level: 'error', code: 'INVALID_MONTH', message: `Mês inválido: ${monthNum}`, field: 'data' });
  }
  if (dayNum < 1 || dayNum > 31) {
    alerts.push({ level: 'error', code: 'INVALID_DAY', message: `Dia inválido: ${dayNum}`, field: 'data' });
  }
  if (yearNum < 2020 || yearNum > 2030) {
    alerts.push({ level: 'warning', code: 'SUSPECT_YEAR', message: `Ano suspeito: ${yearNum}`, field: 'data' });
  }

  const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const displayDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;

  // ========== 2. EXTRAI HORA DE ENTRADA ==========
  const entryRegex = /(?:Hora\s*De\s*Entrada|Entrada)\s*[:]?\s*(\d{1,2}:\d{2})?/i;
  const entryMatch = cleanText.match(entryRegex);
  
  let entryTime: string | undefined;
  
  if (!entryMatch) {
    alerts.push({
      level: 'error',
      code: 'NO_ENTRY',
      message: 'Campo "Hora De Entrada" não encontrado na mensagem',
      field: 'entrada',
    });
  } else if (!entryMatch[1]) {
    alerts.push({
      level: 'error',
      code: 'EMPTY_ENTRY',
      message: 'Hora de Entrada está vazia — falta preencher!',
      field: 'entrada',
    });
  } else {
    entryTime = entryMatch[1].trim();
    if (!isValidTime(entryTime)) {
      alerts.push({
        level: 'error',
        code: 'INVALID_ENTRY_TIME',
        message: `Hora de Entrada inválida: "${entryTime}"`,
        field: 'entrada',
      });
      entryTime = undefined;
    } else if (!validateTimeMinutes(entryTime)) {
      alerts.push({
        level: 'warning',
        code: 'ENTRY_NOT_ROUND',
        message: `Entrada ${entryTime} não termina em 0 ou 5 — deve ser arredondada (ex: ${entryTime.split(':')[0]}:${Math.round(parseInt(entryTime.split(':')[1]) / 5) * 5 === 60 ? '00' : String(Math.round(parseInt(entryTime.split(':')[1]) / 5) * 5).padStart(2, '0')})`,
        field: 'entrada',
      });
    }
  }

  // ========== 3. EXTRAI HORA DE SAÍDA ==========
  const exitRegex = /(?:Hora\s*De\s*Saída|Saída)\s*[:]?\s*(\d{1,2}:\d{2}|xx:xx)?/i;
  const exitMatch = cleanText.match(exitRegex);
  
  let exitTime: string | undefined;
  
  if (!exitMatch) {
    alerts.push({
      level: 'error',
      code: 'NO_EXIT',
      message: 'Campo "Hora De Saída" não encontrado na mensagem',
      field: 'saida',
    });
  } else if (!exitMatch[1] || exitMatch[1].trim() === '') {
    alerts.push({
      level: 'error',
      code: 'EMPTY_EXIT',
      message: 'Hora de Saída está vazia — o funcionário não registou a saída!',
      field: 'saida',
    });
  } else if (exitMatch[1].trim().toLowerCase() === 'xx:xx') {
    alerts.push({
      level: 'error',
      code: 'PLACEHOLDER_EXIT',
      message: 'Hora de Saída contém "xx:xx" — não foi preenchida',
      field: 'saida',
    });
  } else {
    exitTime = exitMatch[1].trim();
    if (!isValidTime(exitTime)) {
      alerts.push({
        level: 'error',
        code: 'INVALID_EXIT_TIME',
        message: `Hora de Saída inválida: "${exitTime}"`,
        field: 'saida',
      });
      exitTime = undefined;
    } else if (!validateTimeMinutes(exitTime)) {
      alerts.push({
        level: 'warning',
        code: 'EXIT_NOT_ROUND',
        message: `Saída ${exitTime} não termina em 0 ou 5 — deve ser arredondada (ex: ${exitTime.split(':')[0]}:${Math.round(parseInt(exitTime.split(':')[1]) / 5) * 5 === 60 ? '00' : String(Math.round(parseInt(exitTime.split(':')[1]) / 5) * 5).padStart(2, '0')})`,
        field: 'saida',
      });
    }
  }

  // ========== 4. EXTRAI PAUSAS ==========
  // Regras:
  // - Pausa é opcional — sem pausa = verde/OK
  // - Aceita qualquer sequência de horários na linha da pausa
  //   Ex.: "13:50/16:00-17:00/21:00"
  //   vira [13:50, 16:00, 17:00, 21:00]
  // - A ordem dos horários é preservada para o cálculo
  // - Horário que não termina em 0 ou 5 = erro vermelho, NÃO entra no cálculo
  const breakTimes: string[] = []; // só horários válidos (terminam em 0/5)

  const pauseLineRegex = /Pausa\s*[:]?\s*([^\n\r]+)/i;
  const pauseLineMatch = cleanText.match(pauseLineRegex);

  if (pauseLineMatch) {
    const pauseContent = pauseLineMatch[1].trim();
    const allTimesRegex = /(\d{1,2}:\d{2})/g;
    let timeMatch;

    while ((timeMatch = allTimesRegex.exec(pauseContent)) !== null) {
      const bt = timeMatch[1].trim();
      if (!isValidTime(bt)) {
        alerts.push({
          level: 'error',
          code: 'INVALID_BREAK_TIME',
          message: `Horário de pausa inválido: ${bt}`,
          field: 'pausa',
        });
        continue;
      }

      if (validateTimeMinutes(bt)) {
        breakTimes.push(bt);
      } else {
        alerts.push({
          level: 'error',
          code: 'BREAK_NOT_ROUND',
          message: `Pausa ${bt} não termina em 0 ou 5 — não entra no cálculo`,
          field: 'pausa',
        });
      }
    }
  }

  // ========== 5. CALCULA TOTAL ==========
  // Lógica: construir períodos de trabalho sequenciais
  // Entrada → Pausa1Start = trabalho
  // Pausa1End → Pausa2Start = trabalho
  // Pausa2End → Saída = trabalho
  // Suporta turnos noturnos (cruza meia-noite)
  let totalMinutes: number | undefined;
  let totalFormatted: string | undefined;

  if (entryTime) {
    // Constrói sequência: [entrada, pausa1_inicio, pausa1_fim, pausa2_inicio, pausa2_fim, ..., saída]
    const sequence: number[] = [];
    const entryMin = timeToMinutes(entryTime);
    sequence.push(entryMin);
    
    for (const bt of breakTimes) {
      sequence.push(timeToMinutes(bt));
    }
    
    if (exitTime) {
      sequence.push(timeToMinutes(exitTime));
    }

    if (sequence.length >= 2) {
      // Ajusta para turnos noturnos: se um horário é "antes" do anterior,
      // significa que cruzou meia-noite, então soma 1440
      const adjusted: number[] = [sequence[0]];
      for (let i = 1; i < sequence.length; i++) {
        let val = sequence[i];
        // Se este valor é menor que o anterior, cruzou meia-noite
        if (val < adjusted[i - 1]) {
          val += 1440;
        }
        adjusted.push(val);
      }

      // Calcula: soma dos períodos de trabalho (pares: trabalho, pausa, trabalho, pausa, ...)
      // [entrada, p1start] = trabalho
      // [p1start, p1end] = pausa (não conta)
      // [p1end, p2start] = trabalho
      // etc.
      totalMinutes = 0;
      for (let i = 0; i < adjusted.length - 1; i += 2) {
        if (i + 1 < adjusted.length) {
          totalMinutes += adjusted[i + 1] - adjusted[i];
        }
      }

      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      totalFormatted = `${hours}h${mins.toString().padStart(2, '0')}m`;

      if (!exitTime) {
        totalFormatted += ' (parcial)';
      }

      // Alertas de validação
      if (totalMinutes > 16 * 60) {
        alerts.push({
          level: 'warning',
          code: 'EXCESSIVE_HOURS',
          message: `Total de ${totalFormatted} excede 16 horas — verificar horários`,
          field: 'total',
        });
      }
      if (exitTime && totalMinutes < 15) {
        alerts.push({
          level: 'warning',
          code: 'TOO_SHORT',
          message: `Total de apenas ${totalFormatted} — turno demasiado curto`,
          field: 'total',
        });
      }
    }
  }

  // ========== 6. DETERMINA VALIDADE ==========
  // valid = tem pelo menos data + entrada (pode ser guardado com alertas)
  // complete = data + entrada + saída, sem erros (pausa é opcional)
  const hasDate = !!formattedDate && !alerts.some(a => a.code === 'INVALID_DATE_FORMAT');
  const hasEntry = !!entryTime;
  const hasExit = !!exitTime;
  const hasErrors = alerts.some(a => a.level === 'error');
  const isComplete = hasDate && hasEntry && hasExit && !hasErrors;

  return {
    valid: hasDate && hasEntry, // pode guardar se tem data + entrada
    complete: isComplete,       // data + entrada + saída sem erros (pausa é opcional)
    date: hasDate ? formattedDate : undefined,
    dateDisplay: hasDate ? displayDate : undefined,
    entryTime,
    exitTime,
    breakTimes: breakTimes.length > 0 ? breakTimes : undefined,
    totalMinutes,
    totalFormatted,
    alerts,
    rawAlerts: alerts.map(a => a.message),
  };
}
