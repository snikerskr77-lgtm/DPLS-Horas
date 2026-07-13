import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { calculateWorkMinutes, validateTimeMinutes } from '@/lib/utils';

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

    const esc = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const nn = (s: string | null | undefined) => (s && s.length > 0) ? esc(s) : 'NULL';

    const result = await db.execute(sql.raw(`
      UPDATE time_entries SET
        entry_time = ${esc(entryTime)},
        exit_time = ${nn(exitTime)},
        break_start = ${nn(breakStart)},
        break_end = ${nn(breakEnd)},
        breaks_data = ${nn(breaksData)},
        total_minutes = ${totalMinutes},
        notes = ${nn(notes)},
        alerts = ${nn(alertsJson)},
        updated_at = NOW()
      WHERE id = '${id.replace(/'/g, "''")}'::uuid
    `));

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Registo não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating time entry:', error);
    return NextResponse.json({ error: 'Erro ao atualizar registo' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await db.execute(sql`
      DELETE FROM time_entries WHERE id = ${id}::uuid
    `);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Registo não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting time entry:', error);
    return NextResponse.json({ error: 'Erro ao eliminar registo' }, { status: 500 });
  }
}
