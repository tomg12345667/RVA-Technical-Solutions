const fs   = require("fs");
const path = require("path");

module.exports.execute = async (interaction) => {
  const { pool, log } = global;
  await interaction.deferReply({ ephemeral: true });

  const [row] = await pool.query("SELECT * FROM discord_users WHERE discordId = ?", [interaction.user.id]);
  if (!row) return interaction.editReply({ content: "You don't have an extension." });

  const callDir  = process.env.ASTERISK_CALL_DIR || "/var/spool/asterisk/outgoing";
  const filename = path.join(callDir, `test_${row.extension}_${Date.now()}.call`);

  const content = [
    `Channel: PJSIP/${row.extension}`,
    `MaxRetries: 0`,
    `RetryTime: 30`,
    `WaitTime: 30`,
    `Context: from-internal`,
    `Extension: s`,
    `Priority: 1`,
    `Callerid: Test Call <0000>`,
  ].join("\n") + "\n";

  try {
    fs.writeFileSync(filename, content, "utf8");
    setTimeout(() => { if (fs.existsSync(filename)) fs.unlinkSync(filename); }, 60_000);
    await interaction.editReply({ content: `Calling **${row.extension}** now. Pick up your phone.` });
  } catch (err) {
    log.error(`Test call failed: ${err}`);
    await interaction.editReply({ content: "Failed to initiate test call." });
  }
};
