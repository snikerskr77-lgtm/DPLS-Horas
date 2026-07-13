import { NextResponse } from 'next/server';
import { db } from '@/db';
import { timeEntries, employees, absences } from '@/db/schema';

export async function DELETE() {
  try {
    // Elimina por ordem (time_entries e absences primeiro por causa das foreign keys)
    const deletedEntries = await db.delete(timeEntries).returning();
    const deletedAbsences = await db.delete(absences).returning();
    const deletedEmployees = await db.delete(employees).returning();

    return NextResponse.json({
      success: true,
      message: 'Todos os dados foram eliminados com sucesso.',
      stats: {
        registosEliminados: deletedEntries.length,
        faltasEliminadas: deletedAbsences.length,
        funcionariosEliminados: deletedEmployees.length,
      },
    });
  } catch (error) {
    console.error('Erro ao limpar dados:', error);
    return NextResponse.json({ error: 'Erro ao limpar dados' }, { status: 500 });
  }
}
