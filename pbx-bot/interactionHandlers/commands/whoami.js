module.exports.execute = async (interaction) => {
  const { pool, fpbx } = global;
  const [row] = await pool.query("SELECT * FROM discord_users WHERE discordId = ?", [interaction.user.id]);
  if (!row) return interaction.reply({ content: "You don't have an extension.", ephemeral: true });
  const ext = await fpbx.getExtension(row.extension);
  if (!ext) return interaction.reply({ content: "Extension not found in FreePBX.", ephemeral: true });
  await interaction.reply({
    ephemeral: true,
    embeds: [{
      title: "Your Extension",
      color: 0x5865f2,
      fields: [
        { name: "Extension",  value: `\`${ext.extension}\``,            inline: true },
        { name: "Caller ID",  value: `\`${ext.name}\``,                 inline: true },
        { name: "SIP Server", value: `\`${process.env.PBX_HOSTNAME}\``, inline: false },
        { name: "Password",   value: `||\`${ext.secret}\`||`,           inline: false },
      ],
    }]
  });
};
