import { format, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, differenceInMinutes, parse, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { TZDate } from '@date-fns/tz';

// Timezone de Portugal continental
export const PT_TIMEZONE = 'Europe/Lisbon';

// Retorna a data/hora atual na timezone de Portugal
export function nowInPortugal(): Date {
  return new TZDate(new Date(), PT_TIMEZONE);
}

// Formata a data atual na timezone de Portugal para yyyy-MM-dd
export function todayInPortugal(): string {
  return format(nowInPortugal(), 'yyyy-MM-dd');
}

export interface TimeTrackMeta {
  breakTimes?: string[];
  periods?: string[];
  source?: 'discord' | 'manual';
}

const META_PREFIX = '__TTMETA__:';

// Format time from minutes to display string
export function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins.toString().padStart(2, '0')}m`;
}

export function encodeTimeTrackMeta(meta: TimeTrackMeta): string {
  return `${META_PREFIX}${JSON.stringify(meta)}`;
}

export function decodeTimeTrackMeta(notes: string | null | undefined): TimeTrackMeta | null {
  if (!notes || !notes.startsWith(META_PREFIX)) return null;
  try {
    return JSON.parse(notes.slice(META_PREFIX.length)) as TimeTrackMeta;
  } catch {
    return null;
  }
}

// Parse time string to minutes since midnight
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function buildWorkPeriods(
  entryTime: string,
  exitTime: string | null,
  breakTimes: string[] = []
): string[] {
  const sequence: number[] = [timeToMinutes(entryTime)];
  for (const bt of breakTimes) {
    sequence.push(timeToMinutes(bt));
  }
  if (exitTime) {
    sequence.push(timeToMinutes(exitTime));
  }

  if (sequence.length < 2) return [];

  const adjusted: number[] = [sequence[0]];
  for (let i = 1; i < sequence.length; i++) {
    let val = sequence[i];
    while (val < adjusted[i - 1]) {
      val += 1440;
    }
    adjusted.push(val);
  }

  const periods: string[] = [];
  for (let i = 0; i < adjusted.length - 1; i += 2) {
    if (i + 1 < adjusted.length) {
      periods.push(`${minutesToTime(adjusted[i])}-${minutesToTime(adjusted[i + 1])}`);
    }
  }
  return periods;
}

// Calculate work minutes from entry/exit/break times
// Usa mesma lógica sequencial do parser Discord
// Sequência: [entrada, pausaInicio, pausaFim, saída]
// Períodos de trabalho = pares: [entrada→pausaInicio], [pausaFim→saída]
export function calculateWorkMinutes(
  entryTime: string,
  exitTime: string | null,
  breakStart?: string | null,
  breakEnd?: string | null
): number {
  if (!exitTime) return 0;

  // Constrói sequência
  const sequence: number[] = [];
  sequence.push(timeToMinutes(entryTime));

  const hasValidBreakStart = !!breakStart && validateTimeMinutes(breakStart);
  const hasValidBreakEnd = !!breakEnd && validateTimeMinutes(breakEnd);

  if (hasValidBreakStart) {
    sequence.push(timeToMinutes(breakStart!));
  }
  if (hasValidBreakEnd) {
    sequence.push(timeToMinutes(breakEnd!));
  }

  sequence.push(timeToMinutes(exitTime));

  // Ajusta para turnos noturnos
  const adjusted: number[] = [sequence[0]];
  for (let i = 1; i < sequence.length; i++) {
    let val = sequence[i];
    if (val < adjusted[i - 1]) {
      val += 1440;
    }
    adjusted.push(val);
  }

  // Soma períodos de trabalho (pares)
  let total = 0;
  for (let i = 0; i < adjusted.length - 1; i += 2) {
    if (i + 1 < adjusted.length) {
      total += adjusted[i + 1] - adjusted[i];
    }
  }

  return Math.max(0, total);
}

// Check if time ends in 0 or 5 minutes
export function validateTimeMinutes(time: string): boolean {
  const minutes = parseInt(time.split(':')[1], 10);
  return minutes % 5 === 0;
}

// Get week boundaries (Sunday to Saturday)
export function getWeekBoundaries(date: Date): { start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 0 }); // Sunday
  const end = endOfWeek(date, { weekStartsOn: 0 }); // Saturday
  return { start, end };
}

// Get all days in a week
export function getWeekDays(date: Date): Date[] {
  const { start, end } = getWeekBoundaries(date);
  return eachDayOfInterval({ start, end });
}

// Format date for display
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy');
}

// Format week range for display
export function formatWeekRange(date: Date): string {
  const { start, end } = getWeekBoundaries(date);
  return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}`;
}

// Get ISO week number
export function getWeekNumber(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

// CN utility for className merging
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Day of week names in Portuguese
export const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const fullDayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
