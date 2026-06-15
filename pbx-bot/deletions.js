module.exports.handleScheduled = async () => {
  const { pool, fpbx, client, log } = global;
  const deletions = await pool.query("SELECT * FROM discord_deletions");
  if (!deletions.length) return;

  const guild = client.guilds.cache.get(process.env.DISCORD_GUILD);
  for (const d of deletions) {
    const member = guild ? await guild.members.fetch(d.discordId).catch(() => null) : null;
    if (member) {
      await pool.query("DELETE FROM discord_deletions WHERE discordId = ?", [d.discordId]);
      log.info(`User ${d.discordId} rejoined — deletion cancelled`);
      continue;
    }
    if (new Date(d.deleteAt) < new Date()) {
      log.info(`Deleting extension ${d.extension} for ${d.discordId}`);
      await fpbx.deleteExtension(d.extension);
      await fpbx.reload();
      await pool.query("DELETE FROM discord_users WHERE discordId = ?", [d.discordId]);
      await pool.query("DELETE FROM discord_deletions WHERE discordId = ?", [d.discordId]);
    }
  }
};

module.exports.findOrphans = async () => {
  const { pool, client, log } = global;
  const users     = await pool.query("SELECT * FROM discord_users");
  const deletions = await pool.query("SELECT * FROM discord_deletions");
  const guild     = client.guilds.cache.get(process.env.DISCORD_GUILD);
  if (!users.length) return;

  for (const user of users) {
    const member  = guild ? await guild.members.fetch(user.discordId).catch(() => null) : null;
    const pending = deletions.some(d => d.discordId === user.discordId);
    if (!member && !pending) {
      const deleteAt = new Date(Date.now() + 60 * 60 * 1000);
      await pool.query(
        "INSERT INTO discord_deletions (discordId, extension, deleteAt) VALUES (?, ?, ?)",
        [user.discordId, user.extension, deleteAt]
      );
      log.info(`Marked ${user.discordId} (ext ${user.extension}) for deletion in 1h`);
    }
  }
};
