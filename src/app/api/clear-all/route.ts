import { NextResponse } from 'next/server';
import { db } from '@/db';
import { timeEntries, employees, absences } from '@/db/schema';
import { sql } from 'drizzle-orm';

async function clearAllData() {
  // Usa SQL direto para evitar problemas de compatibilidade com o driver serverless
  await db.execute(sql`DELETE FROM time_entries`);
  await db.execute(sql`DELETE FROM absences`);
  await db.execute(sql`DELETE FROM employees`);

  return { success: true };
}

export async function POST() {
  try {
    await clearAllData();
    return NextResponse.json({
      success: true,
      message: 'Todos os dados foram eliminados com sucesso.',
    });
  } catch (error) {
    console.error('Erro ao limpar dados:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao limpar dados',
    }, { status: 500 });
  }
}

export async function DELETE() {
  return POST();
}
