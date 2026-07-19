// ============================================================
// logger.ts — simple console logger used by TikTokApi
// ============================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export class Logger {
  private level: LogLevel;
  private name: string;

  constructor(name: string, level: LogLevel = "warn") {
    this.name = name;
    this.level = level;
  }

  private _levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

  private _log(severity: LogLevel, message: string): void {
    if (this._levels[severity] >= this._levels[this.level]) {
      const ts = new Date().toISOString();
      console[severity === "warn" ? "warn" : severity](
        `${ts} - ${this.name} - ${severity.toUpperCase()} - ${message}`
      );
    }
  }

  debug(msg: string): void {
    this._log("debug", msg);
  }
  info(msg: string): void {
    this._log("info", msg);
  }
  warn(msg: string): void {
    this._log("warn", msg);
  }
  error(msg: string): void {
    this._log("error", msg);
  }
}
