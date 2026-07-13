import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface DiscordConfig {
  token: string | null;
  channelId: string | null;
}

export async function getDiscordConfig(): Promise<DiscordConfig> {
  try {
    const tokenSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'discord_bot_token'));
    
    const channelSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'discord_channel_id'));

    return {
      token: tokenSetting[0]?.value || process.env.DISCORD_BOT_TOKEN || null,
      channelId: channelSetting[0]?.value || process.env.DISCORD_CHANNEL_ID || null,
    };
  } catch (error) {
    // Se a tabela não existir ainda, usa env vars
    return {
      token: process.env.DISCORD_BOT_TOKEN || null,
      channelId: process.env.DISCORD_CHANNEL_ID || null,
    };
  }
}
