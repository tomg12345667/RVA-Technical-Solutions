const Discord = require("discord.js");

module.exports.execute = async (interaction) => {
  const { pool, fpbx, log } = global;

  await interaction.deferReply({ ephemeral: true });

  const [existing] = await pool.query(
    "SELECT * FROM discord_users WHERE discordId = ?", [interaction.user.id]
  );
  if (existing) {
    return interaction.editReply({ content: `You already have extension **${existing.extension}**.` });
  }

  const ext = await fpbx.getNextAvailableExtension();
  await interaction.editReply({ content: `Creating extension **${ext}**...` });

  let secret;
  try {
    secret = await fpbx.addExtension(ext, interaction.user.username);
    await fpbx.reload();
  } catch (err) {
    log.error(`Failed to create extension: ${err}`);
    return interaction.editReply({ content: "Failed to create your extension. Please try again later." });
  }

  await pool.query(
    "INSERT INTO discord_users (discordId, extension) VALUES (?, ?)",
    [interaction.user.id, String(ext)]
  );

  try {
    await interaction.user.send({
      embeds: [{
        title: "Your Extension",
        color: 0x5865f2,
        fields: [
          { name: "Extension",   value: `\`${ext}\``,                        inline: true },
          { name: "Caller ID",   value: `\`${interaction.user.username}\``,  inline: true },
          { name: "SIP Server",  value: `\`${process.env.PBX_HOSTNAME}\``,   inline: false },
          { name: "Password",    value: `||\`${secret}\`||`,                 inline: false },
        ],
        footer: { text: "Keep your password private." },
      }],
      components: [{
        type: 1,
        components: [
          { type: Discord.ComponentType.Button, label: "Reset Password", style: Discord.ButtonStyle.Secondary, custom_id: "resetPassword" },
          { type: Discord.ComponentType.Button, label: "Test Call",      style: Discord.ButtonStyle.Primary,   custom_id: "testCall" },
        ]
      }]
    });
    await interaction.editReply({ content: "Done — check your DMs." });
  } catch {
    await interaction.editReply({ content: "Extension created but I couldn't DM you. Enable DMs from server members." });
  }
};
