import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
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
    const todayStr = format(today, 'yyyy-MM-dd');

    // Total de funcionários ativos
    const empCount = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM employees WHERE is_active = true
    `);
    const totalEmployees = empCount.rows[0]?.count || 0;

    // Total de minutos esta semana
    const thisWeek = await db.execute(sql`
      SELECT COALESCE(SUM(total_minutes), 0)::int as total, COUNT(*)::int as count
      FROM time_entries WHERE date >= ${startStr}::date AND date <= ${endStr}::date
    `);
    const thisWeekMinutes = Number(thisWeek.rows[0]?.total || 0);
    const totalEntries = Number(thisWeek.rows[0]?.count || 0);

    // Total de minutos semana passada
    const lastWeek = await db.execute(sql`
      SELECT COALESCE(SUM(total_minutes), 0)::int as total
      FROM time_entries WHERE date >= ${lastStartStr}::date AND date <= ${lastEndStr}::date
    `);
    const lastWeekMinutes = Number(lastWeek.rows[0]?.total || 0);
    const percentChange = lastWeekMinutes > 0
      ? Math.round(((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100)
      : 0;

    // Registo de hoje
    const todayData = await db.execute(sql`
      SELECT te.employee_id, e.name as employee_name,
             te.entry_time, te.exit_time, te.total_minutes
      FROM time_entries te
      LEFT JOIN employees e ON te.employee_id = e.id
      WHERE te.date = ${todayStr}::date
      ORDER BY e.name
    `);
    const todayEntries = todayData.rows.length;
    const todayActivity = todayData.rows.map((r: any) => ({
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      entryTime: r.entry_time,
      exitTime: r.exit_time,
      totalMinutes: r.total_minutes,
      totalFormatted: formatMinutesToHours(r.total_minutes || 0),
    }));

    // Horas por dia para gráfico
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const chartData = [];

    for (const day of weekDays) {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayResult = await db.execute(sql`
        SELECT COALESCE(SUM(total_minutes), 0)::int as total
        FROM time_entries WHERE date = ${dayStr}::date
      `);
      const totalMins = Number(dayResult.rows[0]?.total || 0);
      chartData.push({
        day: format(day, 'EEE'),
        date: format(day, 'dd/MM'),
        hours: Math.round((totalMins / 60) * 10) / 10,
      });
    }

    // Top 5 funcionários com mais horas esta semana
    const topData = await db.execute(sql`
      SELECT e.name, COALESCE(SUM(te.total_minutes), 0)::int as total
      FROM time_entries te
      LEFT JOIN employees e ON te.employee_id = e.id
      WHERE te.date >= ${startStr}::date AND te.date <= ${endStr}::date
      GROUP BY e.name
      ORDER BY total DESC
      LIMIT 5
    `);
    const topEmployees = topData.rows.map((r: any) => ({
      name: r.name,
      hours: formatMinutesToHours(r.total || 0),
      minutes: Number(r.total || 0),
    }));

    return NextResponse.json({
      stats: {
        totalEmployees,
        thisWeekHours: formatMinutesToHours(thisWeekMinutes),
        thisWeekMinutes,
        lastWeekMinutes,
        percentChange,
        todayEntries,
        totalEntries,
      },
      todayActivity,
      chartData,
      topEmployees,
      weekRange: `${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM/yyyy')}`,
    });
  } catch (error) {
    console.error('Erro no dashboard:', error);
    return NextResponse.json({
      error: 'Erro ao carregar dashboard',
      stats: {
        totalEmployees: 0,
        thisWeekHours: '0h00m',
        thisWeekMinutes: 0,
        lastWeekMinutes: 0,
        percentChange: 0,
        todayEntries: 0,
        totalEntries: 0,
      },
      todayActivity: [],
      chartData: [],
      topEmployees: [],
      weekRange: '',
    });
  }
}
