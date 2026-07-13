import { NextResponse } from 'next/server';
import { db } from '@/db';
import { timeEntries, employees, absences } from '@/db/schema';
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

    // Get total employees
    const [employeeCount] = await db
      .select({ count: count() })
      .from(employees)
      .where(eq(employees.isActive, true));

    // Get this week's entries
    const thisWeekEntries = await db
      .select({
        totalMinutes: sum(timeEntries.totalMinutes),
        entryCount: count(),
      })
      .from(timeEntries)
      .where(and(gte(timeEntries.date, startStr), lte(timeEntries.date, endStr)));

    // Get last week's entries
    const lastWeekEntries = await db
      .select({
        totalMinutes: sum(timeEntries.totalMinutes),
        entryCount: count(),
      })
      .from(timeEntries)
      .where(and(gte(timeEntries.date, lastStartStr), lte(timeEntries.date, lastEndStr)));

    // Get today's entries
    const todayStr = format(today, 'yyyy-MM-dd');
    const todayEntries = await db
      .select({
        employeeId: timeEntries.employeeId,
        employeeName: employees.name,
        entryTime: timeEntries.entryTime,
        exitTime: timeEntries.exitTime,
        totalMinutes: timeEntries.totalMinutes,
      })
      .from(timeEntries)
      .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
      .where(eq(timeEntries.date, todayStr));

    // Calculate weekly hours by day for chart
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

    // Get employees with most hours this week
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

    return NextResponse.json({
      stats: {
        totalEmployees: employeeCount?.count || 0,
        thisWeekHours: formatMinutesToHours(thisWeekMinutes),
        thisWeekMinutes,
        lastWeekMinutes,
        percentChange,
        todayEntries: todayEntries.length,
        totalEntries: Number(thisWeekEntries[0]?.entryCount || 0),
      },
      todayActivity: todayEntries.map(e => ({
        ...e,
        totalFormatted: formatMinutesToHours(e.totalMinutes || 0),
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
