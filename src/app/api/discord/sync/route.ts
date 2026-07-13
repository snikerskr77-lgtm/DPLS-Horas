import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { parseTimeEntryMessage, extractAgentName } from '@/lib/discord-parser';
import { getDiscordConfig } from '@/lib/get-discord-config';
import { 
  getChannel, 
  getAllChannelMessages, 
  getArchivedThreads,
  type DiscordThread
} from '@/lib/discord-api';

interface SyncStats {
  threadsProcessed: number;
  messagesProcessed: number;
  entriesCreated: number;
  entriesUpdated: number;
  employeesCreated: number;
  errors: string[];
}

interface SyncResult {
  success: boolean;
  message: string;
  stats?: SyncStats;
}

export async function POST(request: NextRequest): Promise<NextResponse<SyncResult>> {
  const config = await getDiscordConfig();
  const DISCORD_TOKEN = config.token;
  const CHANNEL_ID = config.channelId;

  if (!DISCORD_TOKEN || !CHANNEL_ID) {
    return NextResponse.json({
      success: false,
      message: 'Token do Bot ou ID do Canal não configurados. Vá às configurações.',
    }, { status: 400 });
  }

  const stats: SyncStats = {
    threadsProcessed: 0,
    messagesProcessed: 0,
    entriesCreated: 0,
    entriesUpdated: 0,
    employeesCreated: 0,
    errors: [],
  };

  try {
    const channel = await getChannel(DISCORD_TOKEN, CHANNEL_ID);

    if (channel.type === 15) {
      await processForumChannel(DISCORD_TOKEN, CHANNEL_ID, stats);
    } else {
      await processTextChannel(DISCORD_TOKEN, CHANNEL_ID, stats);
    }

    return NextResponse.json({
      success: true,
      message: `Sincronização concluída! ${stats.entriesCreated} novos registos, ${stats.entriesUpdated} atualizados.`,
      stats,
    });

  } catch (error) {
    console.error('Erro na sincronização Discord:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido na sincronização',
      stats,
    }, { status: 500 });
  }
}

async function processForumChannel(token: string, channelId: string, stats: SyncStats) {
  try {
    const activeThreads = await getActiveThreadsForChannel(token, channelId);
    for (const thread of activeThreads) { await processThread(token, thread, stats); }

    try {
      const archived = await getArchivedThreads(token, channelId);
      for (const thread of archived.threads) { await processThread(token, thread, stats); }
    } catch (error) { stats.errors.push(`Erro ao buscar threads arquivadas: ${error}`); }
  } catch (error) { stats.errors.push(`Erro ao processar fórum: ${error}`); }
}

async function processTextChannel(token: string, channelId: string, stats: SyncStats) {
  try {
    const messages = await getAllChannelMessages(token, channelId, 500);
    for (const message of messages) {
      if (message.author.id === 'bot') continue;
      await processMessage(message.content, message.author.global_name || message.author.username, stats);
    }
  } catch (error) { stats.errors.push(`Erro ao processar canal: ${error}`); }
}

async function processThread(token: string, thread: DiscordThread, stats: SyncStats) {
  const agentName = extractAgentName(thread.name);
  stats.threadsProcessed++;
  try {
    const messages = await getAllChannelMessages(token, thread.id, 200);
    for (const message of messages) { await processMessage(message.content, agentName, stats); }
  } catch (error) { stats.errors.push(`Erro na thread "${thread.name}": ${error}`); }
}

async function getActiveThreadsForChannel(token: string, channelId: string): Promise<DiscordThread[]> {
  const channel = await discordFetch<{ guild_id?: string }>(`/channels/${channelId}`, token);
  if (!channel.guild_id) return [];
  const data = await discordFetch<{ threads: DiscordThread[] }>(`/guilds/${channel.guild_id}/threads/active`, token);
  return data.threads.filter(t => t.parent_id === channelId);
}

async function discordFetch<T>(endpoint: string, token: string): Promise<T> {
  const DISCORD_API_BASE = 'https://discord.com/api/v10';
  const response = await fetch(`${DISCORD_API_BASE}${endpoint}`, {
    headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord API error (${response.status}): ${error}`);
  }
  return response.json();
}

async function processMessage(content: string, agentName: string, stats: SyncStats) {
  stats.messagesProcessed++;

  const parsed = parseTimeEntryMessage(content);

  if (!parsed.valid || !parsed.date || !parsed.entryTime) {
    return;
  }

  const alertsJson = parsed.alerts.length > 0 ? JSON.stringify(parsed.alerts) : null;
  const breaksDataJson = parsed.breakTimes && parsed.breakTimes.length > 0 ? JSON.stringify(parsed.breakTimes) : null;

  try {
    // Usa SQL direto (funciona com pg Pool e Neon)
    const emps = await db.execute(sql`
      SELECT id FROM employees WHERE name = ${agentName} LIMIT 1
    `);

    let employeeId: string;
    if (emps.rows.length === 0) {
      const newEmp = await db.execute(sql`
        INSERT INTO employees (name) VALUES (${agentName}) RETURNING id
      `);
      employeeId = String(newEmp.rows[0].id);
      stats.employeesCreated++;
    } else {
      employeeId = String(emps.rows[0].id);
    }

    // Verifica se já existe registo para esta data
    const existing = await db.execute(sql`
      SELECT id FROM time_entries WHERE employee_id = ${employeeId}::uuid AND date = ${parsed.date}::date LIMIT 1
    `);

    if (existing.rows.length > 0) {
      await db.execute(sql`
        UPDATE time_entries SET
          entry_time = ${parsed.entryTime},
          exit_time = ${parsed.exitTime || null},
          break_start = ${parsed.breakTimes?.[0] || null},
          break_end = ${parsed.breakTimes?.[1] || null},
          breaks_data = ${breaksDataJson},
          total_minutes = ${parsed.totalMinutes ?? 0},
          alerts = ${alertsJson},
          updated_at = NOW()
        WHERE id = ${String(existing.rows[0].id)}::uuid
      `);
      stats.entriesUpdated++;
    } else {
      await db.execute(sql`
        INSERT INTO time_entries (employee_id, date, entry_time, exit_time, break_start, break_end, breaks_data, total_minutes, alerts)
        VALUES (
          ${employeeId}::uuid,
          ${parsed.date}::date,
          ${parsed.entryTime},
          ${parsed.exitTime || null},
          ${parsed.breakTimes?.[0] || null},
          ${parsed.breakTimes?.[1] || null},
          ${breaksDataJson},
          ${parsed.totalMinutes ?? 0},
          ${alertsJson}
        )
      `);
      stats.entriesCreated++;
    }
  } catch (error) {
    stats.errors.push(`Erro ao processar mensagem de ${agentName}: ${error}`);
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
