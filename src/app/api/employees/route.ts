import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { employees } from '@/db/schema';

export async function GET() {
  try {
    const allEmployees = await db
      .select()
      .from(employees)
      .orderBy(employees.name);
    return NextResponse.json(allEmployees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Erro ao carregar funcionários' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, department, position } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const [newEmployee] = await db
      .insert(employees)
      .values({
        name,
        email: email || null,
        department: department || null,
        position: position || null,
      })
      .returning();

    return NextResponse.json(newEmployee, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Erro ao criar funcionário' }, { status: 500 });
  }
}
