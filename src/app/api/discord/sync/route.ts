import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { parseTimeEntryMessage, extractAgentName } from '@/lib/discord-parser';
import { getDiscordConfig } from '@/lib/get-discord-config';
import { getChannel, getAllChannelMessages, getArchivedThreads, type DiscordThread } from '@/lib/discord-api';

interface SyncStats {
  threadsProcessed: number; messagesProcessed: number;
  entriesCreated: number; entriesUpdated: number;
  employeesCreated: number; errors: string[];
}

interface SyncResult { success: boolean; message: string; stats?: SyncStats; }

const DISCORD_API_BASE = 'https://discord.com/api/v10';
async function discordFetch<T>(endpoint: string, token: string): Promise<T> {
  const res = await fetch(`${DISCORD_API_BASE}${endpoint}`, {
    headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Discord API error (${res.status}): ${await res.text()}`);
  return res.json();
}

async function getActiveThreadsForChannel(token: string, channelId: string): Promise<DiscordThread[]> {
  const channel = await discordFetch<{ guild_id?: string }>(`/channels/${channelId}`, token);
  if (!channel.guild_id) return [];
  const data = await discordFetch<{ threads: DiscordThread[] }>(`/guilds/${channel.guild_id}/threads/active`, token);
  return data.threads.filter(t => t.parent_id === channelId);
}

export async function POST(): Promise<NextResponse<SyncResult>> {
  const config = await getDiscordConfig();
  const DISCORD_TOKEN = config.token;
  const CHANNEL_ID = config.channelId;

  if (!DISCORD_TOKEN || !CHANNEL_ID) {
    return NextResponse.json({ success: false, message: 'Token/Canal não configurados.' }, { status: 400 });
  }

  const stats: SyncStats = { threadsProcessed: 0, messagesProcessed: 0, entriesCreated: 0, entriesUpdated: 0, employeesCreated: 0, errors: [] };

  try {
    const channel = await getChannel(DISCORD_TOKEN, CHANNEL_ID);
    if (channel.type === 15) {
      const activeThreads = await getActiveThreadsForChannel(DISCORD_TOKEN, CHANNEL_ID);
      for (const t of activeThreads) await processThread(DISCORD_TOKEN, t, stats);
      try {
        const archived = await getArchivedThreads(DISCORD_TOKEN, CHANNEL_ID);
        for (const t of archived.threads) await processThread(DISCORD_TOKEN, t, stats);
      } catch (e) { stats.errors.push(`Arquivo: ${e}`); }
    } else {
      const msgs = await getAllChannelMessages(DISCORD_TOKEN, CHANNEL_ID, 500);
      for (const m of msgs) {
        if (m.author.id === 'bot') continue;
        await processMessage(m.content, m.author.global_name || m.author.username, stats);
      }
    }
    return NextResponse.json({
      success: true,
      message: `Sincronização concluída! ${stats.entriesCreated} novos, ${stats.entriesUpdated} atualizados.`,
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

async function processThread(token: string, thread: DiscordThread, stats: SyncStats) {
  const agentName = extractAgentName(thread.name);
  stats.threadsProcessed++;
  try {
    const msgs = await getAllChannelMessages(token, thread.id, 200);
    for (const m of msgs) await processMessage(m.content, agentName, stats);
  } catch (e) { stats.errors.push(`Erro na thread "${thread.name}": ${e}`); }
}

async function processMessage(content: string, agentName: string, stats: SyncStats) {
  stats.messagesProcessed++;
  const parsed = parseTimeEntryMessage(content);
  if (!parsed.valid || !parsed.date || !parsed.entryTime) return;

  const alertsJson = parsed.alerts.length > 0 ? JSON.stringify(parsed.alerts) : null;
  const breaksDataJson = parsed.breakTimes && parsed.breakTimes.length > 0 ? JSON.stringify(parsed.breakTimes) : null;

  try {
    // Busca ou cria employee
    const emps = await db.execute(sql`SELECT id FROM employees WHERE name = ${agentName} LIMIT 1`);
    let employeeId: string;
    if (emps.rows.length === 0) {
      const newEmp = await db.execute(sql`INSERT INTO employees (name) VALUES (${agentName}) RETURNING id`);
      employeeId = String(newEmp.rows[0].id);
      stats.employeesCreated++;
    } else {
      employeeId = String(emps.rows[0].id);
    }

    // Verifica duplicado
    const existing = await db.execute(sql`SELECT id FROM time_entries WHERE employee_id = ${employeeId}::uuid AND date = ${parsed.date}::date LIMIT 1`);

    if (existing.rows.length > 0) {
      const n = (v: any) => (v === undefined || v === null || v === '') ? null : v;
      await db.execute(sql`
        UPDATE time_entries SET
          entry_time = ${parsed.entryTime},
          exit_time = ${n(parsed.exitTime)},
          break_start = ${n(parsed.breakTimes?.[0])},
          break_end = ${n(parsed.breakTimes?.[1])},
          breaks_data = ${n(breaksDataJson)},
          total_minutes = ${parsed.totalMinutes ?? 0},
          alerts = ${n(alertsJson)},
          updated_at = NOW()
        WHERE id = ${String(existing.rows[0].id)}::uuid
      `);
      stats.entriesUpdated++;
    } else {
      const n = (v: any) => (v === undefined || v === null || v === '') ? null : v;
      await db.execute(sql`
        INSERT INTO time_entries (employee_id, date, entry_time, exit_time, break_start, break_end, breaks_data, total_minutes, alerts)
        VALUES (
          ${employeeId}::uuid,
          ${parsed.date}::date,
          ${parsed.entryTime},
          ${n(parsed.exitTime)},
          ${n(parsed.breakTimes?.[0])},
          ${n(parsed.breakTimes?.[1])},
          ${n(breaksDataJson)},
          ${parsed.totalMinutes ?? 0},
          ${n(alertsJson)}
        )
      `);
      stats.entriesCreated++;
    }
  } catch (error) {
    stats.errors.push(`Erro ao processar ${agentName}: ${error}`);
  }
}

export async function GET() {
  const config = await getDiscordConfig();
  return NextResponse.json({
    configured: !!config.token && !!config.channelId,
    hasToken: !!config.token,
    hasChannel: !!config.channelId,
    channelId: config.channelId || null,
  });
}
