import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, timeEntries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { parseTimeEntryMessage, extractAgentName } from '@/lib/discord-parser';
import { getDiscordConfig } from '@/lib/get-discord-config';
import { getErrorMessage, isMissingBreakTimesColumnError } from '@/lib/db-compat';
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
  // Busca o canal para obter o guild_id
  const channel = await discordFetch<{ guild_id?: string }>(`/channels/${channelId}`, token);
  
  if (!channel.guild_id) {
    return [];
  }

  // Busca todas as threads ativas do servidor
  const data = await discordFetch<{ threads: DiscordThread[] }>(
    `/guilds/${channel.guild_id}/threads/active`, 
    token
  );

  // Filtra apenas as threads do canal específico
  return data.threads.filter(t => t.parent_id === channelId);
}

export async function POST(request: NextRequest): Promise<NextResponse<SyncResult>> {
  // Busca configurações da base de dados ou env vars
  const config = await getDiscordConfig();
  const DISCORD_TOKEN = config.token;
  const CHANNEL_ID = config.channelId;

  if (!DISCORD_TOKEN) {
    return NextResponse.json({
      success: false,
      message: 'Token do Bot Discord não configurado. Vá às configurações e adicione o token.',
    }, { status: 400 });
  }

  if (!CHANNEL_ID) {
    return NextResponse.json({
      success: false,
      message: 'ID do Canal Discord não configurado. Vá às configurações e adicione o ID do canal.',
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
    // Busca informações do canal
    const channel = await getChannel(DISCORD_TOKEN, CHANNEL_ID);
    
    // Tipo 15 = Forum, Tipo 0 = Text
    if (channel.type === 15) {
      // É um canal de fórum - processa threads
      await processForumChannel(DISCORD_TOKEN, CHANNEL_ID, stats);
    } else {
      // É um canal de texto normal
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
    // Busca threads ativas
    const activeThreads = await getActiveThreadsForChannel(token, channelId);
    
    for (const thread of activeThreads) {
      await processThread(token, thread, stats);
    }

    // Busca threads arquivadas
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

async function processTextChannel(token: string, channelId: string, stats: SyncStats) {
  try {
    const messages = await getAllChannelMessages(token, channelId, 500);
    
    for (const message of messages) {
      if (message.author.id === 'bot') continue; // Skip bot messages
      
      const agentName = message.author.global_name || message.author.username;
      await processMessage(message.content, agentName, stats);
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
    
    for (const message of messages) {
      await processMessage(message.content, agentName, stats);
    }
  } catch (error) {
    stats.errors.push(`Erro na thread "${thread.name}": ${error}`);
  }
}

async function processMessage(content: string, agentName: string, stats: SyncStats) {
  stats.messagesProcessed++;

  const parsed = parseTimeEntryMessage(content);
  
  if (!parsed.valid || !parsed.date || !parsed.entryTime) {
    return;
  }

  // Serializa alertas com level e code para exibição rica
  const alertsJson = parsed.alerts.length > 0
    ? JSON.stringify(parsed.alerts)
    : null;

  try {
    // Busca ou cria o funcionário
    let [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.name, agentName));

    if (!employee) {
      [employee] = await db
        .insert(employees)
        .values({ name: agentName })
        .returning();
      stats.employeesCreated++;
    }

    // Verifica se já existe entrada para esta data
    const [existingEntry] = await db
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(and(
        eq(timeEntries.employeeId, employee.id),
        eq(timeEntries.date, parsed.date)
      ));

    const baseValues = {
      entryTime: parsed.entryTime,
      exitTime: parsed.exitTime || null,
      breakStart: parsed.breakTimes?.[0] || null,
      breakEnd: parsed.breakTimes?.[1] || null,
      totalMinutes: parsed.totalMinutes ?? 0,
      alerts: alertsJson,
      updatedAt: new Date(),
    };

    if (existingEntry) {
      // Atualiza entrada existente
      try {
        await db
          .update(timeEntries)
          .set({
            ...baseValues,
            breakTimes: parsed.breakTimes?.length ? JSON.stringify(parsed.breakTimes) : null,
          })
          .where(eq(timeEntries.id, existingEntry.id));
      } catch (error) {
        if (!isMissingBreakTimesColumnError(error)) throw error;
        await db
          .update(timeEntries)
          .set(baseValues)
          .where(eq(timeEntries.id, existingEntry.id));
      }
      stats.entriesUpdated++;
    } else {
      // Cria nova entrada
      const insertBaseValues = {
        employeeId: employee.id,
        date: parsed.date,
        entryTime: parsed.entryTime,
        exitTime: parsed.exitTime || null,
        breakStart: parsed.breakTimes?.[0] || null,
        breakEnd: parsed.breakTimes?.[1] || null,
        totalMinutes: parsed.totalMinutes ?? 0,
        alerts: alertsJson,
      };

      try {
        await db
          .insert(timeEntries)
          .values({
            ...insertBaseValues,
            breakTimes: parsed.breakTimes?.length ? JSON.stringify(parsed.breakTimes) : null,
          });
      } catch (error) {
        if (!isMissingBreakTimesColumnError(error)) throw error;
        await db.insert(timeEntries).values(insertBaseValues);
      }
      stats.entriesCreated++;
    }
  } catch (error) {
    stats.errors.push(`Erro ao processar mensagem de ${agentName}: ${getErrorMessage(error)}`);
  }
}

// GET para verificar status da configuração
export async function GET() {
  const config = await getDiscordConfig();
  const hasToken = !!config.token;
  const hasChannel = !!config.channelId;
  
  return NextResponse.json({
    configured: hasToken && hasChannel,
    hasToken,
    hasChannel,
    channelId: config.channelId || null,
  });
}
