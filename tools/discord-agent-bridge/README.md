# Luminary Discord Agent Bridge

This bridge runs on Node-02 and connects Discord to the local Luminary agent stack:

- OpenClaw Gateway: `http://127.0.0.1:18789`
- Hermes API Server: `http://127.0.0.1:8642`
- Hermes Dashboard API: `http://127.0.0.1:9119`

It creates/uses these Discord channels:

- `#node-02-status`
- `#node-02-agent-stream`
- `#openclaw-control`
- `#hermes-control`
- `#agent-alerts`
- `#agent-commands`
- `#audit-log`

It uses slash commands, so Andre can operate it from Discord on Windows or iPhone without enabling broad message-reading access.

## Official API Notes

- Discord application commands are the native slash-command interface: https://docs.discord.com/developers/interactions/application-commands
- Discord bots need only standard `Guilds` intent for this bridge. Message Content Intent is not required unless you later want the bot to read ordinary channel messages.
- Hermes exposes an OpenAI-compatible API at `/v1/chat/completions`, `/v1/models`, `/health`, and `/health/detailed`: https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server
- OpenClaw Gateway can expose OpenAI-compatible `/v1/models` and `/v1/chat/completions` on the gateway port when enabled: https://docs.openclaw.ai/gateway/openai-http-api

## One-Time Discord Bot Setup

In the Discord Developer Portal:

1. Open the bot application.
2. Copy the bot token.
3. Copy the Application ID. This is `DISCORD_CLIENT_ID`.
4. Invite the bot to your Discord server with the `bot` and `applications.commands` scopes.

The setup script prints an invite URL after `.env` is configured.

The bot needs these permissions:

- View Channels
- Send Messages
- Read Message History
- Embed Links
- Manage Channels, only for automatic channel creation

## Install On Node-02

From this folder:

```powershell
npm install
npm run setup:env
npm run setup
npm start
```

`npm run setup:env` writes a local `.env` file. Do not commit `.env`.

If `npm run setup` says `Missing Access`, open the invite URL printed by the setup command, select the correct Discord server, approve the bot, then run `npm run setup` again. This means Discord does not yet see the app as installed in the server/guild ID from `.env`.

If you do not know your Discord user ID yet:

1. Leave `DISCORD_ALLOWED_USER_IDS` blank during setup.
2. Start the bridge.
3. In Discord, run `/whoami`.
4. Copy the returned ID into `.env`:

```text
DISCORD_ALLOWED_USER_IDS=your-discord-user-id
```

5. Restart the bridge.

When `DISCORD_ALLOWED_USER_IDS` is blank, only `/whoami` is allowed.

## Required Environment Variables

```text
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DISCORD_ALLOWED_USER_IDS=

NODE_NAME=Node-02
POLL_INTERVAL_SECONDS=30
AUTO_SETUP_CHANNELS=true

OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_TOKEN=
OPENCLAW_MODEL=openclaw/default

HERMES_API_URL=http://127.0.0.1:8642
HERMES_API_KEY=
HERMES_MODEL=hermes-agent
HERMES_DASHBOARD_URL=http://127.0.0.1:9119

DISCORD_CATEGORY_NAME=Luminary Node-02
```

## Slash Commands

- `/whoami` shows your Discord user ID.
- `/help` lists commands.
- `/status` shows OpenClaw and Hermes status.
- `/health` forces a fresh health check and posts status.
- `/agents` shows Hermes models/details and OpenClaw agent targets.
- `/ask-hermes message:...` sends a message to Hermes.
- `/ask-openclaw message:...` sends a message to OpenClaw.
- `/logs system:hermes` shows Hermes dashboard logs.
- `/config system:hermes` shows redacted Hermes dashboard config.

## Security

- Keep `.env` only on Node-02.
- Do not commit tokens, API keys, passwords, or Discord IDs if you consider the Discord ID private.
- The bridge redacts common token patterns before posting to Discord.
- The bot rejects all commands except `/whoami` unless the Discord user ID appears in `DISCORD_ALLOWED_USER_IDS`.
- Hermes Dashboard on port `9119` is local-first. Do not expose it directly to the LAN unless you understand the risk.
- Prefer running this bridge directly on Node-02 so it can use `127.0.0.1` to reach agents.

## Run As A Persistent Windows Process

For initial testing, leave this running:

```powershell
npm start
```

For always-on use, install a process manager such as `pm2` on Node-02:

```powershell
npm install -g pm2
pm2 start "npm -- start" --name luminary-discord-agent-bridge
pm2 save
```

If Node-02 runs Linux instead of Windows, use a `systemd` service or `pm2`.

## Current Limitations

- OpenClaw logs are not read directly yet because the documented Gateway surface exposes model/agent targets and chat endpoints, not a general logs endpoint.
- OpenClaw `/v1/chat/completions` must be enabled in Gateway config before `/ask-openclaw` can work.
- Hermes `/ask-hermes` requires `API_SERVER_ENABLED=true` and a valid `API_SERVER_KEY` when Hermes auth is enabled.
