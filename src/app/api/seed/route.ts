import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, timeEntries } from '@/db/schema';
import { format, subDays, startOfWeek } from 'date-fns';
import { nowInPortugal } from '@/lib/utils';

const sampleEmployees = [
  { name: 'Ana Silva', email: 'ana.silva@empresa.pt', department: 'Vendas', position: 'Agente' },
  { name: 'Bruno Costa', email: 'bruno.costa@empresa.pt', department: 'Suporte', position: 'Técnico' },
  { name: 'Carla Ferreira', email: 'carla.ferreira@empresa.pt', department: 'Vendas', position: 'Agente Sénior' },
  { name: 'David Santos', email: 'david.santos@empresa.pt', department: 'Marketing', position: 'Designer' },
  { name: 'Eva Rodrigues', email: 'eva.rodrigues@empresa.pt', department: 'Suporte', position: 'Técnico' },
];

export async function POST() {
  try {
    // Create employees
    const createdEmployees = [];
    for (const emp of sampleEmployees) {
      const [created] = await db
        .insert(employees)
        .values(emp)
        .onConflictDoNothing()
        .returning();
      if (created) createdEmployees.push(created);
    }

    // If no new employees were created, fetch existing ones
    const allEmployees = createdEmployees.length > 0 
      ? createdEmployees 
      : await db.select().from(employees);

    // Create time entries for the current week
    const today = nowInPortugal();
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    
    const timeSlots = [
      { entry: '09:00', exit: '18:00', breakStart: '12:30', breakEnd: '13:30' },
      { entry: '08:30', exit: '17:30', breakStart: '12:00', breakEnd: '13:00' },
      { entry: '09:15', exit: '18:15', breakStart: '13:00', breakEnd: '14:00' },
      { entry: '08:00', exit: '17:00', breakStart: '12:00', breakEnd: '13:00' },
      { entry: '09:30', exit: '18:30', breakStart: '12:30', breakEnd: '13:30' },
    ];

    let entriesCreated = 0;

    for (const employee of allEmployees) {
      // Create entries for days that have passed this week
      const currentDayOfWeek = today.getDay();
      
      for (let dayOffset = 0; dayOffset <= Math.min(currentDayOfWeek, 5); dayOffset++) {
        // Skip Sunday (0) and Saturday (6)
        if (dayOffset === 0 || dayOffset === 6) continue;
        
        const entryDate = new Date(weekStart);
        entryDate.setDate(entryDate.getDate() + dayOffset);
        
        // Skip future dates
        if (entryDate > today) continue;
        
        const slot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
        const totalMinutes = 8 * 60; // 8 hours
        
        try {
          await db.insert(timeEntries).values({
            employeeId: employee.id,
            date: format(entryDate, 'yyyy-MM-dd'),
            entryTime: slot.entry,
            exitTime: slot.exit,
            breakStart: slot.breakStart,
            breakEnd: slot.breakEnd,
            totalMinutes,
          }).onConflictDoNothing();
          entriesCreated++;
        } catch (err) {
          // Skip duplicates
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${allEmployees.length} employees and ${entriesCreated} time entries`,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Erro ao popular base de dados' }, { status: 500 });
  }
}
