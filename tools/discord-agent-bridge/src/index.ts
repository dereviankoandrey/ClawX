import {
  ChatInputCommandInteraction,
  Client,
  GatewayIntentBits,
  type Guild,
  type TextChannel,
} from 'discord.js';
import {
  askHermes,
  askOpenClaw,
  formatAgents,
  formatStatus,
  getConfigView,
  getLogs,
  getSnapshot,
  snapshotDigest,
} from './agents.js';
import { loadConfig } from './config.js';
import { ensureBridgeChannels, findBridgeChannels, type BridgeChannels } from './discordChannels.js';
import { redact, truncateDiscord } from './redact.js';

const config = loadConfig();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let channels: BridgeChannels = {};
let lastDigest = '';

function isAuthorized(interaction: ChatInputCommandInteraction): boolean {
  if (interaction.commandName === 'whoami') {
    return true;
  }
  return config.allowedUserIds.has(interaction.user.id);
}

async function sendAudit(message: string): Promise<void> {
  await channels.audit?.send(truncateDiscord(redact(message))).catch(() => undefined);
}

async function replyLong(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
  const safe = truncateDiscord(redact(content));
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(safe);
  } else {
    await interaction.reply(safe);
  }
}

async function initializeChannels(guild: Guild): Promise<void> {
  await guild.channels.fetch();
  channels = config.autoSetupChannels
    ? await ensureBridgeChannels(guild, config.categoryName)
    : findBridgeChannels(guild);
}

async function pollAndPublish(force = false): Promise<void> {
  const snapshot = await getSnapshot(config);
  const digest = snapshotDigest(snapshot);

  if (force || digest !== lastDigest) {
    lastDigest = digest;
    await channels.status?.send(formatStatus(snapshot, config.nodeName)).catch(() => undefined);

    if (!snapshot.hermes.health.ok || !snapshot.openclaw.health.ok) {
      await channels.alerts
        ?.send(`Alert from ${config.nodeName}:\n${formatStatus(snapshot, config.nodeName)}`)
        .catch(() => undefined);
    }
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAuthorized(interaction)) {
    await interaction.reply({
      content:
        'This bridge is locked. Ask Andre to add your Discord user ID to DISCORD_ALLOWED_USER_IDS in the Node-02 .env file.',
      ephemeral: true,
    });
    await sendAudit(`Rejected unauthorized command /${interaction.commandName} from ${interaction.user.tag} (${interaction.user.id})`);
    return;
  }

  await sendAudit(`/${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id}) in #${interaction.channel?.isTextBased() ? (interaction.channel as TextChannel).name : 'unknown'}`);

  if (interaction.commandName === 'whoami') {
    await interaction.reply({
      content: `Your Discord user ID is:\n\`${interaction.user.id}\``,
      ephemeral: true,
    });
    return;
  }

  if (config.allowedUserIds.size === 0) {
    await interaction.reply({
      content: 'DISCORD_ALLOWED_USER_IDS is empty. Run `/whoami`, add your user ID to .env, and restart the bridge.',
      ephemeral: true,
    });
    return;
  }

  switch (interaction.commandName) {
    case 'help':
      await replyLong(
        interaction,
        [
          '**Luminary Discord bridge**',
          '/status - show current Node-02 status',
          '/health - force a fresh health check',
          '/agents - show Hermes models/detail and OpenClaw agent targets',
          '/ask-hermes message:... - send a message to Hermes',
          '/ask-openclaw message:... - send a message to OpenClaw',
          '/logs system:hermes - show Hermes dashboard logs',
          '/config system:hermes - show redacted Hermes config',
          '/whoami - show your Discord user ID',
        ].join('\n'),
      );
      break;

    case 'status':
    case 'health': {
      await interaction.deferReply();
      const snapshot = await getSnapshot(config);
      await interaction.editReply(formatStatus(snapshot, config.nodeName));
      if (interaction.commandName === 'health') {
        await pollAndPublish(true);
      }
      break;
    }

    case 'agents': {
      await interaction.deferReply();
      const snapshot = await getSnapshot(config);
      await interaction.editReply(formatAgents(snapshot));
      break;
    }

    case 'ask-hermes': {
      await interaction.deferReply();
      const message = interaction.options.getString('message', true);
      const answer = await askHermes(config, message);
      await interaction.editReply(answer);
      await channels.stream?.send(`Hermes reply for ${interaction.user.tag}:\n${truncateDiscord(redact(answer))}`).catch(() => undefined);
      break;
    }

    case 'ask-openclaw': {
      await interaction.deferReply();
      const message = interaction.options.getString('message', true);
      const answer = await askOpenClaw(config, message);
      await interaction.editReply(answer);
      await channels.stream?.send(`OpenClaw reply for ${interaction.user.tag}:\n${truncateDiscord(redact(answer))}`).catch(() => undefined);
      break;
    }

    case 'logs': {
      await interaction.deferReply({ ephemeral: true });
      const system = interaction.options.getString('system', true);
      await interaction.editReply(await getLogs(config, system));
      break;
    }

    case 'config': {
      await interaction.deferReply({ ephemeral: true });
      const system = interaction.options.getString('system', true);
      await interaction.editReply(await getConfigView(config, system));
      break;
    }

    default:
      await interaction.reply({ content: 'Unknown command.', ephemeral: true });
  }
}

client.once('ready', async () => {
  if (!client.user) {
    throw new Error('Discord client is not ready.');
  }

  const guild = await client.guilds.fetch(config.discordGuildId);
  await initializeChannels(guild);
  await channels.status?.send(`Luminary Discord bridge started for ${config.nodeName}.`).catch(() => undefined);
  await pollAndPublish(true);
  setInterval(() => {
    pollAndPublish().catch((error) => {
      channels.alerts?.send(`Bridge poll failed: ${redact(error)}`).catch(() => undefined);
    });
  }, config.pollIntervalMs);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  handleCommand(interaction).catch(async (error) => {
    const message = `Command failed: ${redact(error)}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(truncateDiscord(message)).catch(() => undefined);
    } else {
      await interaction.reply({ content: truncateDiscord(message), ephemeral: true }).catch(() => undefined);
    }
    await sendAudit(message);
  });
});

await client.login(config.discordToken);
