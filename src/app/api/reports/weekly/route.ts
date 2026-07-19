import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { timeEntries, employees, absences } from '@/db/schema';
import { eq, and, gte, lte, ilike } from 'drizzle-orm';
import { startOfWeek, endOfWeek, format, eachDayOfInterval, parseISO } from 'date-fns';
import { buildWorkPeriods, decodeTimeTrackMeta, formatMinutesToHours, todayInPortugal } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || todayInPortugal();
    const agentQuery = searchParams.get('agent')?.trim() || '';

    const date = parseISO(dateParam);
    const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(weekEnd, 'yyyy-MM-dd');

    const allEmployees = await db
      .select()
      .from(employees)
      .where(
        agentQuery
          ? and(eq(employees.isActive, true), ilike(employees.name, `%${agentQuery}%`))
          : eq(employees.isActive, true)
      );

    const entries = await db
      .select({
        employeeId: timeEntries.employeeId,
        employeeName: employees.name,
        date: timeEntries.date,
        totalMinutes: timeEntries.totalMinutes,
        entryTime: timeEntries.entryTime,
        exitTime: timeEntries.exitTime,
        breakStart: timeEntries.breakStart,
        breakEnd: timeEntries.breakEnd,
        notes: timeEntries.notes,
        alerts: timeEntries.alerts,
      })
      .from(timeEntries)
      .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
      .where(
        agentQuery
          ? and(
              gte(timeEntries.date, startStr),
              lte(timeEntries.date, endStr),
              ilike(employees.name, `%${agentQuery}%`)
            )
          : and(gte(timeEntries.date, startStr), lte(timeEntries.date, endStr))
      );

    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const weekDayStrings = weekDays.map(d => format(d, 'yyyy-MM-dd'));

    const employeeEntries: Record<string, {
      name: string;
      entries: Record<string, {
        totalMinutes: number;
        entryTime: string;
        exitTime: string | null;
        breakStart: string | null;
        breakEnd: string | null;
        breakTimes: string[];
        periods: string[];
        alerts: string | null;
      }>;
    }> = {};

    for (const emp of allEmployees) {
      employeeEntries[emp.id] = { name: emp.name, entries: {} };
    }

    for (const entry of entries) {
      if (entry.employeeId && employeeEntries[entry.employeeId]) {
        const meta = decodeTimeTrackMeta(entry.notes);
        const breakTimes = meta?.breakTimes || [entry.breakStart, entry.breakEnd].filter(Boolean) as string[];
        const periods = meta?.periods || buildWorkPeriods(entry.entryTime, entry.exitTime, breakTimes);

        employeeEntries[entry.employeeId].entries[entry.date] = {
          totalMinutes: entry.totalMinutes || 0,
          entryTime: entry.entryTime,
          exitTime: entry.exitTime,
          breakStart: entry.breakStart,
          breakEnd: entry.breakEnd,
          breakTimes,
          periods,
          alerts: entry.alerts,
        };
      }
    }

    // ── AUSÊNCIAS JUSTIFICADAS ──
    const weekAbsences = await db
      .select({
        employeeId: absences.employeeId,
        employeeName: employees.name,
        date: absences.date,
        type: absences.type,
        reason: absences.reason,
      })
      .from(absences)
      .leftJoin(employees, eq(absences.employeeId, employees.id))
      .where(and(gte(absences.date, startStr), lte(absences.date, endStr)));

    // Mapa: employeeId → { date → { type, reason } }
    const absenceMap: Record<string, Record<string, { type: string; reason: string | null }>> = {};
    for (const a of weekAbsences) {
      if (!a.employeeId) continue;
      if (!absenceMap[a.employeeId]) absenceMap[a.employeeId] = {};
      absenceMap[a.employeeId][a.date] = { type: a.type, reason: a.reason };

      // Garante que o funcionário aparece no report mesmo sem time entries
      if (!employeeEntries[a.employeeId] && a.employeeName) {
        employeeEntries[a.employeeId] = { name: a.employeeName, entries: {} };
      }
    }

    const report = Object.entries(employeeEntries).map(([employeeId, data]) => {
      const daysWorked = Object.keys(data.entries).length;
      const totalMinutes = Object.values(data.entries).reduce((sum, e) => sum + e.totalMinutes, 0);
      const empAbsences = absenceMap[employeeId] || {};
      const missingDays = weekDayStrings.filter(day => !data.entries[day] && !empAbsences[day]);
      const hasAlerts = Object.values(data.entries).some(e => e.alerts);

      return {
        employeeId,
        employeeName: data.name,
        weekRange: `${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`,
        daysWorked,
        missingDays: missingDays.length,
        missingDaysList: missingDays.map(d => format(parseISO(d), 'dd/MM')),
        totalMinutes,
        totalFormatted: formatMinutesToHours(totalMinutes),
        hasUnjustifiedAbsence: missingDays.length >= 3,
        hasAlerts,
        dailyEntries: data.entries,
        absences: empAbsences,
      };
    });

    // Pre-format day headers for the client (so client doesn't need date-fns)
    const dowLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dayHeaders = weekDays.map(d => ({
      date: format(d, 'yyyy-MM-dd'),
      dayOfWeek: d.getDay(),
      dowLabel: dowLabels[d.getDay()],
      dayMonth: format(d, 'dd/MM'),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    }));

    // Previous / next week helper dates
    const prevWeekDate = format(startOfWeek(new Date(weekStart.getTime() - 7 * 86400000), { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const nextWeekDate = format(startOfWeek(new Date(weekStart.getTime() + 7 * 86400000), { weekStartsOn: 0 }), 'yyyy-MM-dd');

    return NextResponse.json({
      weekStart: startStr,
      weekEnd: endStr,
      weekRange: `${format(weekStart, 'dd/MM/yyyy')} - ${format(weekEnd, 'dd/MM/yyyy')}`,
      weekDays: weekDayStrings,
      dayHeaders,
      prevWeekDate,
      nextWeekDate,
      report: report.sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    });
  } catch (error) {
    console.error('Error generating weekly report:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}
