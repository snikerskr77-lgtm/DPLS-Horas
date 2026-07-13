import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

// Converte undefined/empty para null (Neon trata null como SQL NULL)
const n = (v: any) => (v === undefined || v === null || v === '') ? null : v;

export async function GET() {
  try {
    const result = await db.execute(sql`
      SELECT id::text, name, email, department, position,
             is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      FROM employees
      ORDER BY name
    `);
    return NextResponse.json(result.rows);
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

    await db.execute(sql`
      INSERT INTO employees (name, email, department, position)
      VALUES (${name}, ${n(email)}, ${n(department)}, ${n(position)})
    `);

    const result = await db.execute(sql`
      SELECT id::text, name, email, department, position,
             is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      FROM employees WHERE name = ${name} ORDER BY created_at DESC LIMIT 1
    `);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error creating employee:', msg);
    return NextResponse.json({ error: `Erro ao criar funcionário: ${msg}` }, { status: 500 });
  }
}
