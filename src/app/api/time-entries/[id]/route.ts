import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { calculateWorkMinutes, validateTimeMinutes } from '@/lib/utils';

const n = (v: any) => (v === undefined || v === null || v === '') ? null : v;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { entryTime, exitTime, breakStart, breakEnd, breaksData, notes } = body;

    const totalMinutes = calculateWorkMinutes(entryTime, exitTime, breakStart, breakEnd, breaksData);

    const alerts: Array<{ level: string; code: string; message: string; field?: string }> = [];
    if (!validateTimeMinutes(entryTime)) alerts.push({ level: 'warning', code: 'ENTRY_NOT_ROUND', message: `Entrada ${entryTime} não termina em 0 ou 5`, field: 'entrada' });
    if (exitTime && !validateTimeMinutes(exitTime)) alerts.push({ level: 'warning', code: 'EXIT_NOT_ROUND', message: `Saída ${exitTime} não termina em 0 ou 5`, field: 'saida' });
    if (!exitTime) alerts.push({ level: 'error', code: 'EMPTY_EXIT', message: 'Hora de Saída não preenchida', field: 'saida' });

    const alertsJson = alerts.length > 0 ? JSON.stringify(alerts) : null;

    await db.execute(sql`
      UPDATE time_entries SET
        entry_time = ${entryTime},
        exit_time = ${n(exitTime)},
        break_start = ${n(breakStart)},
        break_end = ${n(breakEnd)},
        breaks_data = ${n(breaksData)},
        total_minutes = ${totalMinutes},
        notes = ${n(notes)},
        alerts = ${n(alertsJson)},
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `);

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Erro ao atualizar: ${msg}` }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.execute(sql`DELETE FROM time_entries WHERE id = ${id}::uuid`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao eliminar registo' }, { status: 500 });
  }
}
