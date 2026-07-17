import { NextResponse } from 'next/server';
import { db } from '@/db';
import { timeEntries, employees } from '@/db/schema';
import { eq, and, gte, lte, count, sum, sql } from 'drizzle-orm';
import { startOfWeek, endOfWeek, format, subWeeks, eachDayOfInterval } from 'date-fns';
import { formatMinutesToHours, nowInPortugal } from '@/lib/utils';

export async function GET() {
  try {
    const today = nowInPortugal();
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
    const lastWeekStart = subWeeks(weekStart, 1);
    const lastWeekEnd = subWeeks(weekEnd, 1);

    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(weekEnd, 'yyyy-MM-dd');
    const lastStartStr = format(lastWeekStart, 'yyyy-MM-dd');
    const lastEndStr = format(lastWeekEnd, 'yyyy-MM-dd');

    const [employeeCount] = await db
      .select({ count: count() })
      .from(employees)
      .where(eq(employees.isActive, true));

    const thisWeekEntries = await db
      .select({
        totalMinutes: sum(timeEntries.totalMinutes),
        entryCount: count(),
      })
      .from(timeEntries)
      .where(and(gte(timeEntries.date, startStr), lte(timeEntries.date, endStr)));

    const allTimeEntries = await db
      .select({
        totalMinutes: sum(timeEntries.totalMinutes),
        entryCount: count(),
      })
      .from(timeEntries);

    const lastWeekEntries = await db
      .select({
        totalMinutes: sum(timeEntries.totalMinutes),
        entryCount: count(),
      })
      .from(timeEntries)
      .where(and(gte(timeEntries.date, lastStartStr), lte(timeEntries.date, lastEndStr)));

    const todayStr = format(today, 'yyyy-MM-dd');
    const todayEntries = await db
      .select({
        employeeId: timeEntries.employeeId,
        employeeName: employees.name,
        entryTime: timeEntries.entryTime,
        exitTime: timeEntries.exitTime,
        totalMinutes: timeEntries.totalMinutes,
        breakStart: timeEntries.breakStart,
        breakEnd: timeEntries.breakEnd,
        breakTimes: timeEntries.breakTimes,
        notes: timeEntries.notes,
      })
      .from(timeEntries)
      .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
      .where(eq(timeEntries.date, todayStr));

    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const chartData = [];

    for (const day of weekDays) {
      const dayStr = format(day, 'yyyy-MM-dd');
      const [dayTotal] = await db
        .select({ totalMinutes: sum(timeEntries.totalMinutes) })
        .from(timeEntries)
        .where(eq(timeEntries.date, dayStr));

      chartData.push({
        day: format(day, 'EEE'),
        date: format(day, 'dd/MM'),
        hours: Math.round(Number(dayTotal?.totalMinutes || 0) / 60 * 10) / 10,
      });
    }

    const topEmployees = await db
      .select({
        employeeId: timeEntries.employeeId,
        employeeName: employees.name,
        totalMinutes: sum(timeEntries.totalMinutes),
      })
      .from(timeEntries)
      .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
      .where(and(gte(timeEntries.date, startStr), lte(timeEntries.date, endStr)))
      .groupBy(timeEntries.employeeId, employees.name)
      .orderBy(sql`sum(${timeEntries.totalMinutes}) DESC`)
      .limit(5);

    const thisWeekMinutes = Number(thisWeekEntries[0]?.totalMinutes || 0);
    const lastWeekMinutes = Number(lastWeekEntries[0]?.totalMinutes || 0);
    const percentChange = lastWeekMinutes > 0
      ? Math.round(((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100)
      : 0;

    // Extract break times from entries
    function getBreakTimesArr(entry: { breakTimes: string | null; notes: string | null; breakStart: string | null; breakEnd: string | null }): string[] {
      if (entry.breakTimes) {
        try { const arr = JSON.parse(entry.breakTimes); if (Array.isArray(arr)) return arr; } catch { /* ignore */ }
      }
      if (entry.notes && entry.notes.startsWith('__TTMETA__:')) {
        try {
          const meta = JSON.parse(entry.notes.slice('__TTMETA__:'.length));
          if (meta.breakTimes && Array.isArray(meta.breakTimes)) return meta.breakTimes;
        } catch { /* ignore */ }
      }
      return [entry.breakStart, entry.breakEnd].filter(Boolean) as string[];
    }

    return NextResponse.json({
      stats: {
        totalEmployees: employeeCount?.count || 0,
        thisWeekHours: formatMinutesToHours(thisWeekMinutes),
        thisWeekMinutes,
        lastWeekMinutes,
        percentChange,
        todayEntries: todayEntries.length,
        totalEntries: Number(thisWeekEntries[0]?.entryCount || 0),
        allTimeEntries: Number(allTimeEntries[0]?.entryCount || 0),
        allTimeMinutes: Number(allTimeEntries[0]?.totalMinutes || 0),
      },
      todayActivity: todayEntries.map(e => ({
        ...e,
        totalFormatted: formatMinutesToHours(e.totalMinutes || 0),
        breakTimesArr: getBreakTimesArr(e),
      })),
      chartData,
      topEmployees: topEmployees.map(e => ({
        name: e.employeeName,
        hours: formatMinutesToHours(Number(e.totalMinutes || 0)),
        minutes: Number(e.totalMinutes || 0),
      })),
      weekRange: `${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM/yyyy')}`,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500 });
  }
}
