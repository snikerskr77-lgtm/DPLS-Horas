import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, timeEntries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { parseTimeEntryMessage, extractAgentName } from '@/lib/discord-parser';
import { getDiscordConfig } from '@/lib/get-discord-config';
import { getErrorMessage } from '@/lib/db-compat';
import { buildWorkPeriods, encodeTimeTrackMeta } from '@/lib/utils';
import { getChannel, getAllChannelMessages, getArchivedThreads, type DiscordThread, type DiscordMessage } from '@/lib/discord-api';

interface SyncStats {
  threadsProcessed: number;
  messagesProcessed: number;
  entriesCreated: number;
  entriesUpdated: number;
  employeesCreated: number;
  errors: string[];
}

const DISCORD_API_BASE = 'https://discord.com/api/v10';

async function discordFetch<T>(endpoint: string, token: string): Promise<T> {
  const response = await fetch(`${DISCORD_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord API error (${response.status}): ${error}`);
  }
  return response.json();
}

async function getActiveThreadsForChannel(token: string, channelId: string): Promise<DiscordThread[]> {
  const channel = await discordFetch<{ guild_id?: string }>(`/channels/${channelId}`, token);
  if (!channel.guild_id) return [];
  const data = await discordFetch<{ threads: DiscordThread[] }>(
    `/guilds/${channel.guild_id}/threads/active`,
    token
  );
  return data.threads.filter(t => t.parent_id === channelId);
}

export async function POST(_request: NextRequest): Promise<NextResponse> {
  const config = await getDiscordConfig();
  const DISCORD_TOKEN = config.token;
  const CHANNEL_ID = config.channelId;

  if (!DISCORD_TOKEN) {
    return NextResponse.json({ success: false, message: 'Token do Bot Discord não configurado.' }, { status: 400 });
  }
  if (!CHANNEL_ID) {
    return NextResponse.json({ success: false, message: 'ID do Canal Discord não configurado.' }, { status: 400 });
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
    for (const thread of activeThreads) {
      await processThread(token, thread, stats);
    }
    try {
      const archived = await getArchivedThreads(token, channelId);
      for (const thread of archived.threads) {
        await processThread(token, thread, stats);
      }
    } catch (error) {
      stats.errors.push(`Erro ao buscar threads arquivadas: ${error}`);
    }
  } catch (error) {
    stats.errors.push(`Erro ao processar fórum: ${error}`);
  }
}

// ─────────────────────────────────────────────
// AGRUPAMENTO DE MENSAGENS EM BLOCOS DE REGISTO
//
// O Discord (ou o pessoal) pode publicar a picagem de várias formas:
//   A) Tudo numa única mensagem (Data + Entrada + Pausa + Saída)
//   B) Cada campo na sua própria mensagem
//   C) A data numa mensagem e o resto noutra
//
// Regra: cada linha "Data:" num bloco que JÁ tem data → fecha bloco, começa um novo.
// Mensagens sem data juntam-se ao bloco anterior.
// Assim, o parser recebe sempre o registo COMPLETO — nunca fragmentos.
// ─────────────────────────────────────────────

const DATE_LINE_REGEX = /Data\s*[:]?\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/i;

function sortChronological(messages: DiscordMessage[]): DiscordMessage[] {
  return [...messages].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp.localeCompare(b.timestamp);
    return a.id < b.id ? -1 : 1;
  });
}

function splitIntoBlocks(messages: DiscordMessage[]): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let currentHasDate = false;

  for (const msg of messages) {
    const content = (msg.content || '').trim();
    if (!content) continue;
    const hasDate = DATE_LINE_REGEX.test(content);

    if (hasDate && currentHasDate) {
      // Bloco anterior já tinha data → é um novo registo
      blocks.push(current.join('\n'));
      current = [content];
      currentHasDate = true;
    } else {
      current.push(content);
      if (hasDate) currentHasDate = true;
    }
  }
  if (current.length > 0) blocks.push(current.join('\n'));
  return blocks;
}

async function processTextChannel(token: string, channelId: string, stats: SyncStats) {
  try {
    const messages = await getAllChannelMessages(token, channelId, 500);
    stats.messagesProcessed += messages.length;

    // Agrupa por autor para não misturar registos de agentes diferentes
    const byAuthor = new Map<string, DiscordMessage[]>();
    for (const m of messages) {
      const key = m.author.id;
      if (!byAuthor.has(key)) byAuthor.set(key, []);
      byAuthor.get(key)!.push(m);
    }

    for (const msgs of byAuthor.values()) {
      const sorted = sortChronological(msgs);
      const agentName = sorted[0].author.global_name || sorted[0].author.username;
      const blocks = splitIntoBlocks(sorted);
      for (const block of blocks) {
        await processMessage(block, agentName, stats);
      }
    }
  } catch (error) {
    stats.errors.push(`Erro ao processar canal de texto: ${error}`);
  }
}

async function processThread(token: string, thread: DiscordThread, stats: SyncStats) {
  const agentName = extractAgentName(thread.name);
  stats.threadsProcessed++;
  try {
    const messages = await getAllChannelMessages(token, thread.id, 200);
    stats.messagesProcessed += messages.length;
    const sorted = sortChronological(messages);
    const blocks = splitIntoBlocks(sorted);
    for (const block of blocks) {
      await processMessage(block, agentName, stats);
    }
  } catch (error) {
    stats.errors.push(`Erro na thread "${thread.name}": ${error}`);
  }
}

async function processMessage(content: string, agentName: string, stats: SyncStats) {
  const parsed = parseTimeEntryMessage(content);
  const resolvedAgentName = parsed.agentName || agentName;

  if (!parsed.valid || !parsed.date || !parsed.entryTime) return;

  const periods = buildWorkPeriods(parsed.entryTime, parsed.exitTime || null, parsed.breakTimes || []);
  const notesMeta = encodeTimeTrackMeta({
    breakTimes: parsed.breakTimes || [],
    periods,
    source: 'discord',
  });

  const alertsJson = parsed.alerts.length > 0 ? JSON.stringify(parsed.alerts) : null;

  try {
    let [employee] = await db.select().from(employees).where(eq(employees.name, resolvedAgentName));
    if (!employee) {
      [employee] = await db.insert(employees).values({ name: resolvedAgentName }).returning();
      stats.employeesCreated++;
    }

    const [existingEntry] = await db
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(and(eq(timeEntries.employeeId, employee.id), eq(timeEntries.date, parsed.date)));

    // Limpa breakTimes: remove última se igual à saída (fim de pausa = fim do turno)
    let cleanBreaks = (parsed.breakTimes || []).filter(Boolean);
    if (parsed.exitTime && cleanBreaks.length > 0) {
      if (cleanBreaks[cleanBreaks.length - 1] === parsed.exitTime) {
        cleanBreaks = cleanBreaks.slice(0, -1);
      }
    }

    const breakTimesJson = cleanBreaks.length > 0 ? JSON.stringify(cleanBreaks) : null;

    const baseValues = {
      entryTime: parsed.entryTime,
      exitTime: parsed.exitTime || null,
      breakStart: cleanBreaks[0] || null,
      breakEnd: cleanBreaks[1] || null,
      breakTimes: breakTimesJson,
      totalMinutes: parsed.totalMinutes ?? 0,
      notes: notesMeta,
      alerts: alertsJson,
      updatedAt: new Date(),
    };

    if (existingEntry) {
      await db.update(timeEntries).set(baseValues).where(eq(timeEntries.id, existingEntry.id));
      stats.entriesUpdated++;
    } else {
      await db.insert(timeEntries).values({
        employeeId: employee.id,
        date: parsed.date,
        ...baseValues,
      });
      stats.entriesCreated++;
    }
  } catch (error) {
    stats.errors.push(`Erro ao processar mensagem de ${resolvedAgentName}: ${getErrorMessage(error)}`);
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
