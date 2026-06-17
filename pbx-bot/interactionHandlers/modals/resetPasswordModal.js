const crypto = require("crypto");

module.exports.execute = async (interaction) => {
  const { pool, fpbx, log } = global;
  const [row] = await pool.query("SELECT * FROM discord_users WHERE discordId = ?", [interaction.user.id]);
  if (!row) return interaction.reply({ content: "You don't have an extension.", ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  const input    = interaction.fields.getTextInputValue("newPassword").trim();
  const password = input || crypto.randomBytes(16).toString("hex");

  try {
    await fpbx.updatePassword(row.extension, password);
    await fpbx.reload();
    await interaction.editReply({ content: `Password updated. New password: ||\`${password}\`||` });
  } catch (err) {
    log.error(`Password reset failed: ${err}`);
    await interaction.editReply({ content: "Failed to reset password. Please try again." });
  }
};
