import { ChannelType, type CategoryChannel, type Guild, type TextChannel } from 'discord.js';
import { channelNames, type BridgeChannelKey } from './commands.js';

export type BridgeChannels = Partial<Record<BridgeChannelKey, TextChannel>>;

async function findOrCreateCategory(guild: Guild, name: string): Promise<CategoryChannel> {
  const existing = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name === name,
  );
  if (existing?.type === ChannelType.GuildCategory) {
    return existing;
  }
  return guild.channels.create({ name, type: ChannelType.GuildCategory });
}

export async function ensureBridgeChannels(guild: Guild, categoryName: string): Promise<BridgeChannels> {
  const category = await findOrCreateCategory(guild, categoryName);
  const result: BridgeChannels = {};

  for (const [key, name] of Object.entries(channelNames) as [BridgeChannelKey, string][]) {
    const existing = guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildText && channel.name === name,
    );
    if (existing?.type === ChannelType.GuildText) {
      result[key] = existing;
      continue;
    }

    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Luminary ${name} channel managed by the Node-02 Discord bridge.`,
    });
    result[key] = channel;
  }

  return result;
}

export function findBridgeChannels(guild: Guild): BridgeChannels {
  const result: BridgeChannels = {};

  for (const [key, name] of Object.entries(channelNames) as [BridgeChannelKey, string][]) {
    const existing = guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildText && channel.name === name,
    );
    if (existing?.type === ChannelType.GuildText) {
      result[key] = existing;
    }
  }

  return result;
}
