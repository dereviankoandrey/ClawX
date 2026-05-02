import { SlashCommandBuilder } from 'discord.js';

export const channelNames = {
  status: 'node-02-status',
  stream: 'node-02-agent-stream',
  openclaw: 'openclaw-control',
  hermes: 'hermes-control',
  alerts: 'agent-alerts',
  commands: 'agent-commands',
  audit: 'audit-log',
} as const;

export type BridgeChannelKey = keyof typeof channelNames;

const systemOption = [
  { name: 'hermes', value: 'hermes' },
  { name: 'openclaw', value: 'openclaw' },
] as const;

export const slashCommands = [
  new SlashCommandBuilder().setName('whoami').setDescription('Show your Discord user ID for bridge authorization.'),
  new SlashCommandBuilder().setName('help').setDescription('Show Luminary Discord bridge commands.'),
  new SlashCommandBuilder().setName('status').setDescription('Show Node-02 OpenClaw and Hermes status.'),
  new SlashCommandBuilder().setName('health').setDescription('Run a fresh health check against Node-02 agents.'),
  new SlashCommandBuilder().setName('agents').setDescription('List known OpenClaw and Hermes agent/model targets.'),
  new SlashCommandBuilder()
    .setName('ask-hermes')
    .setDescription('Send a message to Hermes on Node-02.')
    .addStringOption((option) =>
      option.setName('message').setDescription('Message for Hermes.').setRequired(true).setMaxLength(1800),
    ),
  new SlashCommandBuilder()
    .setName('ask-openclaw')
    .setDescription('Send a message to OpenClaw on Node-02.')
    .addStringOption((option) =>
      option.setName('message').setDescription('Message for OpenClaw.').setRequired(true).setMaxLength(1800),
    ),
  new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Show recent agent logs when exposed by the local service.')
    .addStringOption((option) =>
      option
        .setName('system')
        .setDescription('Agent system.')
        .setRequired(true)
        .addChoices(...systemOption),
    ),
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Show non-secret agent configuration where exposed by the local service.')
    .addStringOption((option) =>
      option
        .setName('system')
        .setDescription('Agent system.')
        .setRequired(true)
        .addChoices(...systemOption),
    ),
].map((command) => command.toJSON());
