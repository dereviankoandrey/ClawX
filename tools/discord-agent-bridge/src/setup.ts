import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { slashCommands } from './commands.js';
import { loadConfig } from './config.js';
import { ensureBridgeChannels } from './discordChannels.js';

const config = loadConfig();

const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${config.discordClientId}&permissions=85008&integration_type=0&scope=bot+applications.commands`;

console.log('Invite URL if the bot is not in your server yet:');
console.log(inviteUrl);
console.log('');
console.log('Registering slash commands...');

const rest = new REST({ version: '10' }).setToken(config.discordToken);
try {
  await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId), {
    body: slashCommands,
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Missing Access')) {
    console.error('');
    console.error('Discord returned Missing Access while registering slash commands.');
    console.error('This usually means the bot is not installed in that server, the server/guild ID is wrong,');
    console.error('or the bot was invited without the applications.commands scope.');
    console.error('');
    console.error('Open this invite URL, choose the target server, approve it, then run npm run setup again:');
    console.error(inviteUrl);
    throw new Error('Bot is not installed in the configured Discord server yet.');
  }
  throw error;
}

console.log('Slash commands registered.');
console.log('Connecting to Discord to create/find channels...');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  try {
    const guild = await client.guilds.fetch(config.discordGuildId);
    await guild.channels.fetch();
    const channels = await ensureBridgeChannels(guild, config.categoryName);
    console.log(`Ready. Created/found ${Object.keys(channels).length} Luminary channels in ${guild.name}.`);
    console.log('');
    console.log('If DISCORD_ALLOWED_USER_IDS is blank, run /whoami in Discord, paste your user ID into .env, then restart the bridge.');
  } finally {
    client.destroy();
  }
});

await client.login(config.discordToken);
