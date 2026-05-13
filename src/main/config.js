const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'tunnel-config.json');
    this.data = { rules: [] };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      }
    } catch (e) {
      this.data = { rules: [] };
    }
  }

  getAll() {
    return this.data;
  }

  saveAll(rules) {
    this.data.rules = rules;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    return { ok: true };
  }
}

module.exports = ConfigManager;
