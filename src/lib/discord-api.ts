// Discord REST API client
const DISCORD_API_BASE = 'https://discord.com/api/v10';

interface DiscordReaction {
  emoji: { id: string | null; name: string };
  count: number;
}

interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    global_name?: string;
  };
  timestamp: string;
  reactions?: DiscordReaction[];
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
  type: number;
  guild_id?: string;
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

export async function getChannel(token: string, channelId: string): Promise<DiscordChannel> {
  return discordFetch<DiscordChannel>(`/channels/${channelId}`, token);
}

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

export async function getArchivedThreads(
  token: string,
  channelId: string
): Promise<{ threads: DiscordThread[] }> {
  return discordFetch<{ threads: DiscordThread[] }>(
    `/channels/${channelId}/threads/archived/public?limit=100`,
    token
  );
}

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
    if (messages.length < 100) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return allMessages;
}

/**
 * Verifica se uma mensagem tem reação ❌ (X)
 */
export function hasRejectReaction(message: DiscordMessage): boolean {
  if (!message.reactions) return false;
  return message.reactions.some(r =>
    r.emoji.name === '❌' || r.emoji.name === '✖️' || r.emoji.name === '✖' ||
    r.emoji.name === '🚫' || r.emoji.name === '⛔'
  );
}

export type { DiscordMessage, DiscordThread, DiscordChannel, DiscordReaction };
