// Discord REST API client para sincronização de mensagens
// Não usa discord.js para evitar problemas com bundling do Next.js

const DISCORD_API_BASE = 'https://discord.com/api/v10';

interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    global_name?: string;
  };
  timestamp: string;
}

interface DiscordThread {
  id: string;
  name: string;
  type: number;
  parent_id: string;
}

interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0 = text, 15 = forum
  threads?: DiscordThread[];
}

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

// Busca informações do canal
export async function getChannel(token: string, channelId: string): Promise<DiscordChannel> {
  return discordFetch<DiscordChannel>(`/channels/${channelId}`, token);
}

// Busca mensagens de um canal
export async function getChannelMessages(
  token: string, 
  channelId: string, 
  limit: number = 100,
  before?: string
): Promise<DiscordMessage[]> {
  let endpoint = `/channels/${channelId}/messages?limit=${limit}`;
  if (before) {
    endpoint += `&before=${before}`;
  }
  return discordFetch<DiscordMessage[]>(endpoint, token);
}

// Busca threads ativas de um canal
export async function getActiveThreads(
  token: string, 
  guildId: string
): Promise<{ threads: DiscordThread[] }> {
  return discordFetch<{ threads: DiscordThread[] }>(`/guilds/${guildId}/threads/active`, token);
}

// Busca threads arquivadas de um canal
export async function getArchivedThreads(
  token: string, 
  channelId: string
): Promise<{ threads: DiscordThread[] }> {
  return discordFetch<{ threads: DiscordThread[] }>(
    `/channels/${channelId}/threads/archived/public?limit=100`, 
    token
  );
}

// Busca informações do bot para obter guild IDs
export async function getBotGuilds(token: string): Promise<Array<{ id: string; name: string }>> {
  return discordFetch<Array<{ id: string; name: string }>>('/users/@me/guilds', token);
}

// Busca todas as mensagens de um canal (com paginação)
export async function getAllChannelMessages(
  token: string,
  channelId: string,
  maxMessages: number = 500
): Promise<DiscordMessage[]> {
  const allMessages: DiscordMessage[] = [];
  let lastMessageId: string | undefined;

  while (allMessages.length < maxMessages) {
    const messages = await getChannelMessages(token, channelId, 100, lastMessageId);
    
    if (messages.length === 0) break;
    
    allMessages.push(...messages);
    lastMessageId = messages[messages.length - 1].id;

    // Rate limiting - aguarda um pouco entre requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return allMessages;
}

export type { DiscordMessage, DiscordThread, DiscordChannel };
