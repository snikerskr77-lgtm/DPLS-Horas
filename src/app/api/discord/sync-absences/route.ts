import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, absences, settings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { parseAbsenceMessage } from '@/lib/absence-parser';
import { getAllChannelMessages, hasRejectReaction } from '@/lib/discord-api';

interface SyncAbsenceStats {
  messagesProcessed: number;
  messagesRejected: number;
  absencesCreated: number;
  absencesSkipped: number;
  employeesCreated: number;
  errors: string[];
}

async function getAbsenceChannelId(): Promise<string | null> {
  try {
    const [setting] = await db.select().from(settings).where(eq(settings.key, 'discord_absence_channel_id'));
    return setting?.value || process.env.DISCORD_ABSENCE_CHANNEL_ID || null;
  } catch {
    return process.env.DISCORD_ABSENCE_CHANNEL_ID || null;
  }
}

async function getToken(): Promise<string | null> {
  try {
    const [setting] = await db.select().from(settings).where(eq(settings.key, 'discord_bot_token'));
    return setting?.value || process.env.DISCORD_BOT_TOKEN || null;
  } catch {
    return process.env.DISCORD_BOT_TOKEN || null;
  }
}

export async function POST() {
  const DISCORD_TOKEN = await getToken();
  const absenceChannelId = await getAbsenceChannelId();

  if (!DISCORD_TOKEN) {
    return NextResponse.json({ success: false, message: 'Token do Bot Discord não configurado.' }, { status: 400 });
  }
  if (!absenceChannelId) {
    return NextResponse.json({ success: false, message: 'ID do Canal de Ausências não configurado.' }, { status: 400 });
  }

  const stats: SyncAbsenceStats = {
    messagesProcessed: 0,
    messagesRejected: 0,
    absencesCreated: 0,
    absencesSkipped: 0,
    employeesCreated: 0,
    errors: [],
  };

  try {
    const messages = await getAllChannelMessages(DISCORD_TOKEN, absenceChannelId, 300);
    stats.messagesProcessed = messages.length;

    for (const message of messages) {
      // Reação ❌ → rejeitado, não gravar
      if (hasRejectReaction(message)) {
        stats.messagesRejected++;
        continue;
      }

      const content = (message.content || '').trim();
      if (!content) continue;

      const parsed = parseAbsenceMessage(content);
      if (!parsed.valid || !parsed.name || parsed.dates.length === 0) continue;

      try {
        let [employee] = await db.select().from(employees).where(eq(employees.name, parsed.name));
        if (!employee) {
          [employee] = await db.insert(employees).values({ name: parsed.name }).returning();
          stats.employeesCreated++;
        }

        for (const dateStr of parsed.dates) {
          const [existing] = await db
            .select({ id: absences.id })
            .from(absences)
            .where(and(eq(absences.employeeId, employee.id), eq(absences.date, dateStr)));

          if (existing) {
            stats.absencesSkipped++;
            continue;
          }

          await db.insert(absences).values({
            employeeId: employee.id,
            date: dateStr,
            type: 'justificada',
            reason: parsed.reason || null,
          });
          stats.absencesCreated++;
        }
      } catch (error) {
        stats.errors.push(`Erro ${parsed.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Ausências sincronizadas! ${stats.absencesCreated} novas, ${stats.messagesRejected} rejeitadas (❌), ${stats.absencesSkipped} já existiam.`,
      stats,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      stats,
    }, { status: 500 });
  }
}

export async function GET() {
  const absenceChannelId = await getAbsenceChannelId();
  return NextResponse.json({ configured: !!absenceChannelId, channelId: absenceChannelId });
}
