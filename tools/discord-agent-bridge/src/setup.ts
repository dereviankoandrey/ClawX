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
await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId), {
  body: slashCommands,
});

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
