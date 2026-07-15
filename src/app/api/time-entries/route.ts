import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { timeEntries, employees } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { calculateWorkMinutes, validateTimeMinutes } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const conditions = [];
    if (employeeId) conditions.push(eq(timeEntries.employeeId, employeeId));
    if (startDate) conditions.push(gte(timeEntries.date, startDate));
    if (endDate) conditions.push(lte(timeEntries.date, endDate));

    const baseQuery = db
      .select({
        id: timeEntries.id,
        employeeId: timeEntries.employeeId,
        employeeName: employees.name,
        date: timeEntries.date,
        entryTime: timeEntries.entryTime,
        exitTime: timeEntries.exitTime,
        breakStart: timeEntries.breakStart,
        breakEnd: timeEntries.breakEnd,
        breakTimes: timeEntries.breakTimes,
        totalMinutes: timeEntries.totalMinutes,
        notes: timeEntries.notes,
        alerts: timeEntries.alerts,
        createdAt: timeEntries.createdAt,
      })
      .from(timeEntries)
      .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
      .orderBy(desc(timeEntries.date), employees.name);

    const result = conditions.length > 0
      ? await baseQuery.where(and(...conditions))
      : await baseQuery;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return NextResponse.json({ error: 'Erro ao carregar registos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, date, entryTime, exitTime, breakStart, breakEnd, notes } = body;

    if (!employeeId || !date || !entryTime) {
      return NextResponse.json({ error: 'Funcionário, data e entrada são obrigatórios' }, { status: 400 });
    }

    const existing = await db
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(and(eq(timeEntries.employeeId, employeeId), eq(timeEntries.date, date)));

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Já existe um registo para esta data' }, { status: 409 });
    }

    const totalMinutes = calculateWorkMinutes(entryTime, exitTime, breakStart, breakEnd);

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

    const breakTimesArr = [breakStart, breakEnd].filter(Boolean);

    const [newEntry] = await db
      .insert(timeEntries)
      .values({
        employeeId,
        date,
        entryTime,
        exitTime: exitTime || null,
        breakStart: breakStart || null,
        breakEnd: breakEnd || null,
        breakTimes: breakTimesArr.length > 0 ? JSON.stringify(breakTimesArr) : null,
        totalMinutes,
        notes: notes || null,
        alerts: alerts.length > 0 ? JSON.stringify(alerts) : null,
      })
      .returning();

    return NextResponse.json(newEntry, { status: 201 });
  } catch (error) {
    console.error('Error creating time entry:', error);
    return NextResponse.json({ error: 'Erro ao criar registo' }, { status: 500 });
  }
}
