import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { calculateWorkMinutes, validateTimeMinutes } from '@/lib/utils';

const n = (v: any) => (v === undefined || v === null || v === '') ? null : v;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let result;

    if (employeeId && startDate && endDate) {
      result = await db.execute(sql`
        SELECT te.id, te.employee_id as employee_id, e.name as employee_name,
               te.date, te.entry_time, te.exit_time,
               te.break_start, te.break_end,
               te.breaks_data,
               te.total_minutes, te.notes, te.alerts
        FROM time_entries te
        LEFT JOIN employees e ON te.employee_id = e.id
        WHERE te.employee_id = ${employeeId}::uuid
          AND te.date >= ${startDate}::date
          AND te.date <= ${endDate}::date
        ORDER BY te.date DESC, e.name
      `);
    } else if (startDate && endDate) {
      result = await db.execute(sql`
        SELECT te.id, te.employee_id as employee_id, e.name as employee_name,
               te.date, te.entry_time, te.exit_time,
               te.break_start, te.break_end,
               te.breaks_data,
               te.total_minutes, te.notes, te.alerts
        FROM time_entries te
        LEFT JOIN employees e ON te.employee_id = e.id
        WHERE te.date >= ${startDate}::date
          AND te.date <= ${endDate}::date
        ORDER BY te.date DESC, e.name
      `);
    } else if (employeeId) {
      result = await db.execute(sql`
        SELECT te.id, te.employee_id as employee_id, e.name as employee_name,
               te.date, te.entry_time, te.exit_time,
               te.break_start, te.break_end,
               te.breaks_data,
               te.total_minutes, te.notes, te.alerts
        FROM time_entries te
        LEFT JOIN employees e ON te.employee_id = e.id
        WHERE te.employee_id = ${employeeId}::uuid
        ORDER BY te.date DESC, e.name
      `);
    } else {
      result = await db.execute(sql`
        SELECT te.id, te.employee_id as employee_id, e.name as employee_name,
               te.date, te.entry_time, te.exit_time,
               te.break_start, te.break_end,
               te.breaks_data,
               te.total_minutes, te.notes, te.alerts
        FROM time_entries te
        LEFT JOIN employees e ON te.employee_id = e.id
        ORDER BY te.date DESC, e.name
      `);
    }

    const rows = result.rows.map((r: any) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      date: r.date,
      entryTime: r.entry_time,
      exitTime: r.exit_time,
      breakStart: r.break_start,
      breakEnd: r.break_end,
      breaksData: r.breaks_data,
      totalMinutes: r.total_minutes,
      notes: r.notes,
      alerts: r.alerts,
    }));

    return NextResponse.json(rows);
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

    const existing = await db.execute(sql`SELECT id FROM time_entries WHERE employee_id = ${employeeId}::uuid AND date = ${date}::date LIMIT 1`);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Já existe um registo para esta data' }, { status: 409 });
    }

    const totalMinutes = calculateWorkMinutes(entryTime, exitTime, breakStart, breakEnd, breaksData);

    const alerts: Array<{ level: string; code: string; message: string; field?: string }> = [];
    if (!validateTimeMinutes(entryTime)) alerts.push({ level: 'warning', code: 'ENTRY_NOT_ROUND', message: `Entrada ${entryTime} não termina em 0 ou 5`, field: 'entrada' });
    if (exitTime && !validateTimeMinutes(exitTime)) alerts.push({ level: 'warning', code: 'EXIT_NOT_ROUND', message: `Saída ${exitTime} não termina em 0 ou 5`, field: 'saida' });
    if (!exitTime) alerts.push({ level: 'error', code: 'EMPTY_EXIT', message: 'Hora de Saída não preenchida', field: 'saida' });

    const alertsJson = alerts.length > 0 ? JSON.stringify(alerts) : null;

    // INSERT com n() helper - converte undefined/empty para null (SQL NULL)
    await db.execute(sql`
      INSERT INTO time_entries (employee_id, date, entry_time, exit_time, break_start, break_end, breaks_data, total_minutes, notes, alerts)
      VALUES (
        ${employeeId}::uuid,
        ${date}::date,
        ${entryTime},
        ${n(exitTime)},
        ${n(breakStart)},
        ${n(breakEnd)},
        ${n(breaksData)},
        ${totalMinutes},
        ${n(notes)},
        ${n(alertsJson)}
      )
    `);

    return NextResponse.json({ success: true, message: 'Registo criado com sucesso!' }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error creating time entry:', msg);
    return NextResponse.json({ error: `Erro ao criar registo: ${msg}` }, { status: 500 });
  }
}
