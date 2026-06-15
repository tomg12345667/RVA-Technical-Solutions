require("dotenv").config();
const cron    = require("node-cron");
const Discord = require("discord.js");
const mariadb = require("mariadb");
const colors  = require("colors");

const FreepbxManager = require("./freepbx");
const runMigrations  = require("./migrations");
const deletion       = require("./deletions");
const commands       = require("./commands");

const pool = mariadb.createPool({
  host:            process.env.DB_HOST,
  port:            process.env.DB_PORT || 3306,
  user:            process.env.DB_USER,
  password:        process.env.DB_PASS,
  database:        "asterisk",
  connectionLimit: 5,
});

const fpbx = new FreepbxManager(pool);

const client = new Discord.Client({
  intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMembers],
});

const log = {
  info:    (m) => console.log(`${colors.cyan("[INFO]")} ${m}`),
  warn:    (m) => console.log(`${colors.yellow("[WARN]")} ${m}`),
  error:   (m) => console.log(`${colors.red("[ERROR]")} ${m}`),
  success: (m) => console.log(`${colors.green("[SUCCESS]")} ${m}`),
};

global.pool   = pool;
global.fpbx   = fpbx;
global.client = client;
global.log    = log;

client.on("ready", async () => {
  log.success(`Logged in as ${client.user.displayName}`);

  const rest = new Discord.REST().setToken(client.token);
  await rest.put(Discord.Routes.applicationCommands(client.user.id), { body: commands });
  log.success("Commands registered");

  cron.schedule("* * * * *",  () => deletion.handleScheduled().catch(err => log.error(`Deletion task: ${err}`)));
  cron.schedule("0 * * * *",  () => deletion.findOrphans().catch(err => log.error(`Orphan task: ${err}`)));
  deletion.findOrphans();
  deletion.handleScheduled();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: "Use this in the server.", ephemeral: true });
  }

  let handler;
  try {
    if (interaction.type === Discord.InteractionType.ApplicationCommand) {
      handler = require(`./interactionHandlers/commands/${interaction.commandName}`);
    } else if (interaction.type === Discord.InteractionType.MessageComponent) {
      handler = require(`./interactionHandlers/components/${interaction.customId}`);
    } else if (interaction.type === Discord.InteractionType.ModalSubmit) {
      handler = require(`./interactionHandlers/modals/${interaction.customId}`);
    } else {
      return;
    }
  } catch {
    log.warn(`No handler found for: ${interaction.customId || interaction.commandName}`);
    return;
  }

  try {
    await handler.execute(interaction);
  } catch (err) {
    log.error(`Handler error: ${err}`);
    const reply = { content: "Something went wrong.", ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

client.on("guildMemberRemove", async (member) => {
  const [user]     = await pool.query("SELECT * FROM discord_users WHERE discordId = ?", [member.id]);
  const [deletion] = await pool.query("SELECT * FROM discord_deletions WHERE discordId = ?", [member.id]);
  if (!user || deletion) return;
  const deleteAt = new Date(Date.now() + 60 * 60 * 1000);
  await pool.query(
    "INSERT INTO discord_deletions (discordId, extension, deleteAt) VALUES (?, ?, ?)",
    [member.id, user.extension, deleteAt]
  );
  log.info(`${member.id} left — extension ${user.extension} marked for deletion in 1h`);
});

client.on("guildMemberAdd", async (member) => {
  const [pending] = await pool.query("SELECT * FROM discord_deletions WHERE discordId = ?", [member.id]);
  if (pending) {
    await pool.query("DELETE FROM discord_deletions WHERE discordId = ?", [member.id]);
    log.info(`${member.id} rejoined — deletion cancelled`);
  }
});

runMigrations(pool)
  .then(() => {
    log.success("Migrations complete");
    client.login(process.env.DISCORD_TOKEN);
  })
  .catch((err) => {
    log.error(`Migrations failed: ${err}`);
    process.exit(1);
  });
