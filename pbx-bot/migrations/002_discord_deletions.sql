CREATE TABLE IF NOT EXISTS discord_deletions (
  extension VARCHAR(20) PRIMARY KEY,
  discordId VARCHAR(25) NOT NULL,
  deleteAt  TIMESTAMP NOT NULL
);
