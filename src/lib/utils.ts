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

// Format time from minutes to display string
export function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins.toString().padStart(2, '0')}m`;
}

// Parse time string to minutes since midnight
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Calculate work minutes from entry/exit/break times
// Regras:
// - sem saída => 0 (as entradas Discord usam o parser avançado para parcial)
// - sem pausa => entrada até saída normal
// - pausa inválida (não termina em 0 ou 5) não entra no cálculo
// - se há início de pausa válido mas fim inválido/ausente, conta só até ao início da pausa
export function calculateWorkMinutes(
  entryTime: string,
  exitTime: string | null,
  breakStart?: string | null,
  breakEnd?: string | null
): number {
  if (!exitTime) return 0;

  const entryMinutes = timeToMinutes(entryTime);
  let exitMinutes = timeToMinutes(exitTime);

  // Handle overnight shifts
  if (exitMinutes < entryMinutes) {
    exitMinutes += 24 * 60;
  }

  // Se não tem pausa, conta normal
  if (!breakStart && !breakEnd) {
    return Math.max(0, exitMinutes - entryMinutes);
  }

  const hasValidBreakStart = !!breakStart && validateTimeMinutes(breakStart);
  const hasValidBreakEnd = !!breakEnd && validateTimeMinutes(breakEnd);

  // Se só existe um início de pausa válido, conta até aí e ignora o resto
  if (hasValidBreakStart && !hasValidBreakEnd) {
    let breakStartMinutes = timeToMinutes(breakStart!);
    if (breakStartMinutes < entryMinutes) {
      breakStartMinutes += 24 * 60;
    }
    return Math.max(0, breakStartMinutes - entryMinutes);
  }

  // Se só existe fim de pausa válido mas não início válido, ignora a pausa
  if (!hasValidBreakStart && hasValidBreakEnd) {
    return Math.max(0, exitMinutes - entryMinutes);
  }

  // Se ambas as pausas são válidas, subtrai normalmente
  let totalMinutes = exitMinutes - entryMinutes;
  if (hasValidBreakStart && hasValidBreakEnd) {
    const breakStartMinutes = timeToMinutes(breakStart!);
    let breakEndMinutes = timeToMinutes(breakEnd!);

    if (breakEndMinutes < breakStartMinutes) {
      breakEndMinutes += 24 * 60;
    }

    totalMinutes -= (breakEndMinutes - breakStartMinutes);
  }

  return Math.max(0, totalMinutes);
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
