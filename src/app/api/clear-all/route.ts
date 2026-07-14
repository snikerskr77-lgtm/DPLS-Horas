import { NextResponse } from 'next/server';
import { db } from '@/db';
import { timeEntries, employees, absences } from '@/db/schema';
import { count } from 'drizzle-orm';

export async function DELETE() {
  try {
    // Conta primeiro, depois apaga sem returning()
    // Isto evita erros se a base remota estiver com schema ligeiramente diferente.
    const [entriesCount] = await db.select({ value: count() }).from(timeEntries);
    const [absencesCount] = await db.select({ value: count() }).from(absences);
    const [employeesCount] = await db.select({ value: count() }).from(employees);

    // Elimina por ordem por causa das foreign keys
    await db.delete(timeEntries);
    await db.delete(absences);
    await db.delete(employees);

    return NextResponse.json({
      success: true,
      message: 'Todos os dados foram eliminados com sucesso.',
      stats: {
        registosEliminados: entriesCount?.value ?? 0,
        faltasEliminadas: absencesCount?.value ?? 0,
        funcionariosEliminados: employeesCount?.value ?? 0,
      },
    });
  } catch (error) {
    console.error('Erro ao limpar dados:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao limpar dados',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    }, { status: 500 });
  }
}
