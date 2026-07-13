import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

const n = (v: any) => (v === undefined || v === null || v === '') ? null : v;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await db.execute(sql`
      SELECT * FROM employees WHERE id = ${id}::uuid LIMIT 1
    `);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching employee:', error);
    return NextResponse.json({ error: 'Erro ao carregar funcionário' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, department, position, isActive } = body;

    await db.execute(sql`
      UPDATE employees SET
        name = ${name},
        email = ${n(email)},
        department = ${n(department)},
        position = ${n(position)},
        is_active = ${isActive ?? true},
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `);

    const result = await db.execute(sql`
      SELECT * FROM employees WHERE id = ${id}::uuid LIMIT 1
    `);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Erro ao atualizar funcionário' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await db.execute(sql`
      DELETE FROM employees WHERE id = ${id}::uuid
    `);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: 'Erro ao eliminar funcionário' }, { status: 500 });
  }
}
