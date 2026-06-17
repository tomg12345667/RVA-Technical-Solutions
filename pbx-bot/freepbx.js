const { execFile } = require("child_process");
const crypto = require("crypto");

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
    const rows = await this.query("SELECT id FROM devices WHERE tech = 'pjsip' ORDER BY CAST(id AS UNSIGNED) ASC");
    const startExt = process.env.START_EXT ? parseInt(process.env.START_EXT, 10) : 1000;
    const existingExtsSet = new Set(rows.map(r => parseInt(r.id, 10)));
    const existingExts = Array.from(existingExtsSet).sort((a, b) => a - b);
    let nextExt = startExt;
    for (let i = 0; i < existingExts.length; i++) {
      if (existingExts[i] !== nextExt) break;
      nextExt++;
    }
    return nextExt;
  }

  async getExtension(ext) {
    const [device] = await this.query("SELECT * FROM devices WHERE id = ?", [String(ext)]);
    if (!device) return null;
    const [secretRow] = await this.query(
      "SELECT data FROM pjsip WHERE id = ? AND keyword = 'secret'", [String(ext)]
    );
    const [user] = await this.query("SELECT * FROM users WHERE extension = ?", [String(ext)]);
    return {
      extension: String(ext),
      name:      user?.name || device.description,
      secret:    secretRow?.data,
    };
  }

  async addExtension(ext, name) {
    ext  = String(ext);
    name = String(name).replace(/[^a-zA-Z0-9\s]/g, "");
    const secret = crypto.randomBytes(16).toString("hex");

    await this.query(
      `INSERT INTO devices (id, tech, dial, devicetype, user, description, emergency_cid)
       VALUES (?, 'pjsip', ?, 'fixed', ?, ?, '')`,
      [ext, `PJSIP/${ext}`, ext, name]
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
      `INSERT INTO users (extension, name, voicemail, ringtimer, noanswer, outboundcid, mohclass, noanswer_cid, busy_cid, chanunavail_cid, noanswer_dest, busy_dest, chanunavail_dest)
       VALUES (?, ?, 'novm', 0, '', '', 'default', '', '', '', '', '', '')`,
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

  async joinPageGroup(ext, pageGroup) {
    const [lookup] = await this.query(
      "SELECT * FROM paging_groups WHERE page_number = ? AND ext = ?", [pageGroup, ext]
    );
    if (lookup) return false;
    await this.query("INSERT INTO paging_groups (page_number, ext) VALUES (?, ?)", [pageGroup, ext]);
    return true;
  }

  async leavePageGroup(ext, pageGroup) {
    const [lookup] = await this.query(
      "SELECT * FROM paging_groups WHERE page_number = ? AND ext = ?", [pageGroup, ext]
    );
    if (!lookup) return false;
    await this.query("DELETE FROM paging_groups WHERE page_number = ? AND ext = ?", [pageGroup, ext]);
    return true;
  }
}

module.exports = FreepbxManager;
