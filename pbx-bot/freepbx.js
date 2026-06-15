const { execFile } = require("child_process");

class FreepbxManager {
  constructor(pool) {
    this.pool = pool;
  }

  async query(sql, params) {
    const conn = await this.pool.getConnection();
    try {
      return await conn.query(sql, params);
    } finally {
      conn.release();
    }
  }

  reload() {
    return new Promise((resolve, reject) => {
      execFile("/usr/sbin/fwconsole", ["reload", "--quiet"], (err, _out, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve();
      });
    });
  }

  async getNextAvailableExtension() {
    const rows = await this.query("SELECT id FROM devices WHERE tech = 'pjsip' ORDER BY id ASC");
    const start = parseInt(process.env.START_EXT) || 1000;
    const existing = new Set(rows.map(r => parseInt(r.id)));
    let next = start;
    while (existing.has(next)) next++;
    return next;
  }

  async getExtension(ext) {
    const [device] = await this.query("SELECT * FROM devices WHERE id = ?", [String(ext)]);
    if (!device) return null;
    const [secret] = await this.query(
      "SELECT data FROM pjsip WHERE id = ? AND keyword = 'secret'", [String(ext)]
    );
    const [user] = await this.query("SELECT * FROM users WHERE extension = ?", [String(ext)]);
    return { extension: String(ext), name: user?.name || device.description, secret: secret?.data };
  }

  async addExtension(ext, name) {
    ext  = String(ext);
    name = name.replace(/[^a-zA-Z0-9 ]/g, "");
    const secret = require("crypto").randomBytes(16).toString("hex");

    await this.query(
      `INSERT INTO devices (id, tech, dial, devicetype, description, emergency_cid, outboundcid, ringtimer, noanswer, callwaiting, mohclass, category)
       VALUES (?, 'pjsip', ?, 'fixed', ?, '', '', 0, '', 'enabled', 'default', 'following')`,
      [ext, `PJSIP/${ext}`, name]
    );

    const pjsipFields = [
      ["secret",           secret],
      ["dtmfmode",         "rfc4733"],
      ["transport",        "udp"],
      ["nat",              "force_rport,comedia"],
      ["qualify",          "yes"],
      ["qualifyfreq",      "60"],
      ["disallow",         "all"],
      ["allow",            "ulaw,alaw,g722"],
      ["rewrite_contact",  "yes"],
      ["rtp_symmetric",    "yes"],
      ["send_rpid",        "yes"],
      ["trust_id_inbound", "yes"],
    ];
    for (const [key, val] of pjsipFields) {
      await this.query("INSERT INTO pjsip (id, keyword, data, flags) VALUES (?, ?, ?, 0)", [ext, key, val]);
    }

    await this.query(
      `INSERT INTO users (extension, name, voicemail, ringtimer, noanswer, callwaiting, mohclass, outboundcid)
       VALUES (?, ?, 'novm', 0, '', 'enabled', 'default', '')`,
      [ext, name]
    );

    return secret;
  }

  async updatePassword(ext, password) {
    await this.query(
      "UPDATE pjsip SET data = ? WHERE id = ? AND keyword = 'secret'",
      [password, String(ext)]
    );
  }

  async deleteExtension(ext) {
    ext = String(ext);
    await this.query("DELETE FROM devices WHERE id = ?", [ext]);
    await this.query("DELETE FROM pjsip WHERE id = ?", [ext]);
    await this.query("DELETE FROM users WHERE extension = ?", [ext]);
  }
}

module.exports = FreepbxManager;
