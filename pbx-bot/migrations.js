const fs   = require("fs");
const path = require("path");

module.exports = async function runMigrations(pool) {
  const conn = await pool.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS migrations (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    const files = fs.readdirSync(path.join(__dirname, "migrations")).sort();
    for (const file of files) {
      const [existing] = await conn.query(
        "SELECT 1 FROM migrations WHERE name = ? LIMIT 1", [file]
      );
      if (existing) continue;
      const sql = fs.readFileSync(path.join(__dirname, "migrations", file), "utf8");
      await conn.query(sql);
      await conn.query("INSERT INTO migrations (name) VALUES (?)", [file]);
      console.log(`[migrations] applied ${file}`);
    }
  } finally {
    conn.release();
  }
};
