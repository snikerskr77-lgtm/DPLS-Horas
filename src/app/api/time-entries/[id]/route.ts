import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { timeEntries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { calculateWorkMinutes, validateTimeMinutes } from '@/lib/utils';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { entryTime, exitTime, breakStart, breakEnd, notes } = body;

    // Calculate total minutes
    const totalMinutes = calculateWorkMinutes(entryTime, exitTime, breakStart, breakEnd);

    // Generate alerts (rich format)
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

    const [updated] = await db
      .update(timeEntries)
      .set({
        entryTime,
        exitTime: exitTime || null,
        breakStart: breakStart || null,
        breakEnd: breakEnd || null,
        totalMinutes,
        notes: notes || null,
        alerts: alerts.length > 0 ? JSON.stringify(alerts) : null,
        updatedAt: new Date(),
      })
      .where(eq(timeEntries.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Registo não encontrado' }, { status: 404 });
    }

    return NextResponse.json(updated);
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
    const [deleted] = await db
      .delete(timeEntries)
      .where(eq(timeEntries.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Registo não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting time entry:', error);
    return NextResponse.json({ error: 'Erro ao eliminar registo' }, { status: 500 });
  }
}
