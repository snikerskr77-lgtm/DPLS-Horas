import { NextResponse } from 'next/server';
import { db } from '@/db';
import { timeEntries, employees, absences } from '@/db/schema';

async function clearAllData() {
  // Elimina por ordem correta para evitar erros de FK
  const deletedEntries = await db.delete(timeEntries).returning();
  const deletedAbsences = await db.delete(absences).returning();
  const deletedEmployees = await db.delete(employees).returning();

  return {
    registosEliminados: deletedEntries.length,
    faltasEliminadas: deletedAbsences.length,
    funcionariosEliminados: deletedEmployees.length,
  };
}

// DELETE - método principal
export async function DELETE() {
  try {
    const stats = await clearAllData();
    return NextResponse.json({
      success: true,
      message: 'Todos os dados foram eliminados com sucesso.',
      stats,
    });
  } catch (error) {
    console.error('Erro ao limpar dados (DELETE):', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao limpar dados',
    }, { status: 500 });
  }
}

// POST - fallback para ambientes que não permitem DELETE
export async function POST() {
  try {
    const stats = await clearAllData();
    return NextResponse.json({
      success: true,
      message: 'Todos os dados foram eliminados com sucesso.',
      stats,
    });
  } catch (error) {
    console.error('Erro ao limpar dados (POST):', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao limpar dados',
    }, { status: 500 });
  }
}
