import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { timeEntries, employees, absences } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { startOfWeek, endOfWeek, format, eachDayOfInterval, parseISO, addWeeks, subWeeks } from 'date-fns';
import { formatMinutesToHours, decodeTimeTrackMeta, buildWorkPeriods, nowInPortugal } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date'); // format: YYYY-MM-DD (any day in the week)

    let targetDate: Date;
    if (dateParam) {
      targetDate = parseISO(dateParam);
    } else {
      targetDate = nowInPortugal();
    }

    const weekStart = startOfWeek(targetDate, { weekStartsOn: 0 }); // Sunday
    const weekEnd = endOfWeek(targetDate, { weekStartsOn: 0 });     // Saturday
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(weekEnd, 'yyyy-MM-dd');

    // Week days array (Dom-Sáb)
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const dayHeaders = weekDays.map(d => ({
      date: format(d, 'yyyy-MM-dd'),
      dayOfWeek: d.getDay(),
      dayNum: parseInt(format(d, 'd')),
      monthDay: format(d, 'dd/MM'),
    }));

    // Previous and next week references
    const prevWeekDate = format(subWeeks(weekStart, 1), 'yyyy-MM-dd');
    const nextWeekDate = format(addWeeks(weekStart, 1), 'yyyy-MM-dd');

    // Get all active employees that have entries in this week, plus all active ones
    const allEmployees = await db
      .select()
      .from(employees)
      .where(eq(employees.isActive, true))
      .orderBy(employees.name);

    // Get all time entries for the week with full details
    const entries = await db
      .select({
        employeeId: timeEntries.employeeId,
        employeeName: employees.name,
        date: timeEntries.date,
        entryTime: timeEntries.entryTime,
        exitTime: timeEntries.exitTime,
        breakStart: timeEntries.breakStart,
        breakEnd: timeEntries.breakEnd,
        breakTimes: timeEntries.breakTimes,
        totalMinutes: timeEntries.totalMinutes,
        notes: timeEntries.notes,
        alerts: timeEntries.alerts,
      })
      .from(timeEntries)
      .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
      .where(and(gte(timeEntries.date, startStr), lte(timeEntries.date, endStr)));

    // Build employee rows
    const employeeRows = allEmployees.map(emp => {
      const empEntries = entries.filter(e => e.employeeId === emp.id);

      const dailyData: Record<string, {
        entryTime: string;
        exitTime: string | null;
        breakTimes: string[];
        periods: string[];
        totalMinutes: number;
        totalFormatted: string;
        hasAlerts: boolean;
        alertLevel: 'ok' | 'warning' | 'error';
      }> = {};

      for (const entry of empEntries) {
        // Extract break times from meta or fallback to columns
        const meta = decodeTimeTrackMeta(entry.notes);
        let breakTimes: string[] = [];
        if (meta?.breakTimes && meta.breakTimes.length > 0) {
          breakTimes = meta.breakTimes;
        } else if (entry.breakTimes) {
          try { breakTimes = JSON.parse(entry.breakTimes); } catch { /* ignore */ }
        } else {
          breakTimes = [entry.breakStart, entry.breakEnd].filter(Boolean) as string[];
        }

        // Build periods
        const periods = meta?.periods || buildWorkPeriods(entry.entryTime, entry.exitTime, breakTimes);

        // Alerts
        let alertLevel: 'ok' | 'warning' | 'error' = 'ok';
        let hasAlerts = false;
        if (entry.alerts) {
          try {
            const alerts = JSON.parse(entry.alerts) as Array<{ level: string }>;
            hasAlerts = alerts.length > 0;
            if (alerts.some(a => a.level === 'error')) alertLevel = 'error';
            else if (alerts.some(a => a.level === 'warning')) alertLevel = 'warning';
          } catch { /* ignore */ }
        }

        dailyData[entry.date] = {
          entryTime: entry.entryTime,
          exitTime: entry.exitTime,
          breakTimes,
          periods,
          totalMinutes: entry.totalMinutes || 0,
          totalFormatted: formatMinutesToHours(entry.totalMinutes || 0),
          hasAlerts,
          alertLevel,
        };
      }

      const totalWeekMinutes = empEntries.reduce((sum, e) => sum + (e.totalMinutes || 0), 0);
      const daysWorked = empEntries.length;

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        position: emp.position,
        dailyData,
        totalWeekMinutes,
        totalWeekFormatted: formatMinutesToHours(totalWeekMinutes),
        daysWorked,
      };
    });

    // ── AUSÊNCIAS JUSTIFICADAS ──
    const weekAbsences = await db
      .select({ employeeId: absences.employeeId, date: absences.date, type: absences.type, reason: absences.reason })
      .from(absences)
      .where(and(gte(absences.date, startStr), lte(absences.date, endStr)));

    const absenceMap: Record<string, Record<string, { type: string; reason: string | null }>> = {};
    for (const a of weekAbsences) {
      if (!absenceMap[a.employeeId]) absenceMap[a.employeeId] = {};
      absenceMap[a.employeeId][a.date] = { type: a.type, reason: a.reason };
    }

    // Add absences to each employee row
    const enrichedRows = employeeRows.map(r => ({
      ...r,
      absences: absenceMap[r.employeeId] || {},
    }));

    // Filter: employees with at least 1 entry OR 1 absence this week
    const activeRows = enrichedRows.filter(r => r.daysWorked > 0 || Object.keys(r.absences).length > 0);

    // Grand totals per day
    const dailyTotals: Record<string, number> = {};
    for (const dh of dayHeaders) {
      dailyTotals[dh.date] = activeRows.reduce((s, r) => s + (r.dailyData[dh.date]?.totalMinutes || 0), 0);
    }
    const grandTotalMinutes = activeRows.reduce((s, r) => s + r.totalWeekMinutes, 0);

    return NextResponse.json({
      weekStart: startStr,
      weekEnd: endStr,
      weekRange: `${format(weekStart, 'dd/MM/yyyy')} — ${format(weekEnd, 'dd/MM/yyyy')}`,
      weekRangeShort: `${format(weekStart, 'dd/MM')} — ${format(weekEnd, 'dd/MM')}`,
      prevWeekDate,
      nextWeekDate,
      dayHeaders,
      employees: activeRows,
      dailyTotals,
      grandTotalMinutes,
      grandTotalFormatted: formatMinutesToHours(grandTotalMinutes),
      totalEmployees: activeRows.length,
    });
  } catch (error) {
    console.error('Error generating folha de horas:', error);
    return NextResponse.json({ error: 'Erro ao gerar folha de horas' }, { status: 500 });
  }
}
