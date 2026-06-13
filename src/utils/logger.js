const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.info;

export const logger = {
  debug: (...args) => { if (currentLevel <= 0) console.log("[DEBUG]", ...args); },
  info: (...args) => { if (currentLevel <= 1) console.log("[INFO]", ...args); },
  warn: (...args) => { if (currentLevel <= 2) console.warn("[WARN]", ...args); },
  error: (...args) => { if (currentLevel <= 3) console.error("[ERROR]", ...args); },
};
