import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { timeEntries, employees } from '@/db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { calculateWorkMinutes, validateTimeMinutes } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let conditions = ['1=1'];
    const params: (string | undefined)[] = [];

    if (employeeId) {
      conditions.push(`te.employee_id = $${params.length + 1}::uuid`);
      params.push(employeeId);
    }
    if (startDate) {
      conditions.push(`te.date >= $${params.length + 1}::date`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`te.date <= $${params.length + 1}::date`);
      params.push(endDate);
    }

    const whereClause = conditions.join(' AND ');

    const result = await db.execute(sql`
      SELECT
        te.id, te.employee_id as "employeeId", e.name as "employeeName",
        te.date, te.entry_time as "entryTime", te.exit_time as "exitTime",
        te.break_start as "breakStart", te.break_end as "breakEnd",
        te.breaks_data as "breaksData",
        te.total_minutes as "totalMinutes", te.notes, te.alerts,
        te.created_at as "createdAt"
      FROM time_entries te
      LEFT JOIN employees e ON te.employee_id = e.id
      ORDER BY te.date DESC, e.name
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return NextResponse.json({ error: 'Erro ao carregar registos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, date, entryTime, exitTime, breakStart, breakEnd, breaksData, notes } = body;

    if (!employeeId || !date || !entryTime) {
      return NextResponse.json({ error: 'Funcionário, data e entrada são obrigatórios' }, { status: 400 });
    }

    // Check for duplicate entry
    const existing = await db.execute(sql`
      SELECT id FROM time_entries WHERE employee_id = ${employeeId}::uuid AND date = ${date}::date LIMIT 1
    `);

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Já existe um registo para esta data' }, { status: 409 });
    }

    // Calculate total minutes
    const totalMinutes = calculateWorkMinutes(entryTime, exitTime, breakStart, breakEnd, breaksData);

    // Generate alerts
    const alerts: Array<{ level: string; code: string; message: string; field?: string }> = [];
    if (!validateTimeMinutes(entryTime)) {
      alerts.push({ level: 'warning', code: 'ENTRY_NOT_ROUND', message: `Entrada ${entryTime} não termina em 0 ou 5`, field: 'entrada' });
    }
    if (exitTime && !validateTimeMinutes(exitTime)) {
      alerts.push({ level: 'warning', code: 'EXIT_NOT_ROUND', message: `Saída ${exitTime} não termina em 0 ou 5`, field: 'saida' });
    }
    if (!exitTime) {
      alerts.push({ level: 'error', code: 'EMPTY_EXIT', message: 'Hora de Saída não preenchida', field: 'saida' });
    }
    if (breakStart && !validateTimeMinutes(breakStart)) {
      alerts.push({ level: 'error', code: 'BREAK_NOT_ROUND', message: `Início pausa ${breakStart} não termina em 0 ou 5 — não entra no cálculo`, field: 'pausa' });
    }
    if (breakEnd && !validateTimeMinutes(breakEnd)) {
      alerts.push({ level: 'error', code: 'BREAK_NOT_ROUND', message: `Fim pausa ${breakEnd} não termina em 0 ou 5 — não entra no cálculo`, field: 'pausa' });
    }

    const alertsJson = alerts.length > 0 ? JSON.stringify(alerts) : null;

    // Constrói SQL com raw para garantir NULL real no Neon
    const esc = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const nn = (s: string | null | undefined) => (s && s.length > 0) ? esc(s) : 'NULL';

    await db.execute(sql.raw(`
      INSERT INTO time_entries (employee_id, date, entry_time, exit_time, break_start, break_end, breaks_data, total_minutes, notes, alerts)
      VALUES (
        '${employeeId.replace(/'/g, "''")}'::uuid,
        ${esc(date)}::date,
        ${esc(entryTime)},
        ${nn(exitTime)},
        ${nn(breakStart)},
        ${nn(breakEnd)},
        ${nn(breaksData)},
        ${totalMinutes},
        ${nn(notes)},
        ${nn(alertsJson)}
      )
    `));

    return NextResponse.json({ success: true, message: 'Registo criado com sucesso!' }, { status: 201 });
  } catch (error) {
    console.error('Error creating time entry:', error);
    return NextResponse.json({ error: 'Erro ao criar registo' }, { status: 500 });
  }
}
