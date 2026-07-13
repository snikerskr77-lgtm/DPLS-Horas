import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { startOfWeek, endOfWeek, format, eachDayOfInterval, parseISO } from 'date-fns';
import { formatMinutesToHours, todayInPortugal } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || todayInPortugal();
    const date = parseISO(dateParam);

    const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 0 });

    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(weekEnd, 'yyyy-MM-dd');

    // Buscar funcionários ativos
    const employeesData = await db.execute(sql`
      SELECT id::text, name FROM employees WHERE is_active = true ORDER BY name
    `);

    // Buscar registos da semana
    const entries = await db.execute(sql`
      SELECT te.employee_id, e.name as employee_name,
             te.date, te.entry_time, te.exit_time,
             te.total_minutes, te.alerts
      FROM time_entries te
      LEFT JOIN employees e ON te.employee_id = e.id
      WHERE te.date >= ${startStr}::date AND te.date <= ${endStr}::date
      ORDER BY e.name, te.date
    `);

    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const weekDayStrings = weekDays.map(d => format(d, 'yyyy-MM-dd'));

    // Agrupar registos por funcionário
    const employeeEntries: Record<string, {
      name: string;
      entries: Record<string, { totalMinutes: number; entryTime: string; exitTime: string | null; alerts: string | null }>;
    }> = {};

    for (const emp of employeesData.rows as Array<{ id: string; name: string }>) {
      employeeEntries[emp.id] = { name: emp.name, entries: {} };
    }

    for (const row of entries.rows as Array<{
      employee_id: string; employee_name: string; date: string;
      entry_time: string; exit_time: string | null;
      total_minutes: number; alerts: string | null;
    }>) {
      const eid: string = row.employee_id;
      if (employeeEntries[eid]) {
        employeeEntries[eid].entries[row.date] = {
          totalMinutes: Number(row.total_minutes || 0),
          entryTime: row.entry_time,
          exitTime: row.exit_time,
          alerts: row.alerts,
        };
      }
    }

    // Construir relatório
    const report = Object.entries(employeeEntries).map(([employeeId, data]) => {
      const totalMinutes = Object.values(data.entries).reduce((s, e) => s + e.totalMinutes, 0);
      const missingDays = weekDayStrings.filter(day => !data.entries[day]);
      const hasAlerts = Object.values(data.entries).some(e => e.alerts);

      return {
        employeeId,
        employeeName: data.name,
        weekRange: `${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`,
        daysWorked: Object.keys(data.entries).length,
        missingDays: missingDays.length,
        missingDaysList: missingDays.map(d => format(parseISO(d), 'dd/MM')),
        totalMinutes,
        totalFormatted: formatMinutesToHours(totalMinutes),
        hasUnjustifiedAbsence: missingDays.length >= 3,
        hasAlerts,
        dailyEntries: data.entries,
      };
    });

    return NextResponse.json({
      weekStart: startStr,
      weekEnd: endStr,
      weekRange: `${format(weekStart, 'dd/MM/yyyy')} - ${format(weekEnd, 'dd/MM/yyyy')}`,
      weekDays: weekDayStrings,
      report: report.sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    });
  } catch (error) {
    console.error('Erro no relatório:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}
