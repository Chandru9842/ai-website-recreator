/**
 * Structured Logger for Website Recreator Pipeline
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export class Logger {
  private scope: string;

  constructor(scope: string) {
    this.scope = scope;
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: any) {
    this.log('error', message, meta);
  }

  debug(message: string, meta?: any) {
    if (process.env.DEBUG) {
      this.log('debug', message, meta);
    }
  }

  private log(level: LogLevel, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.scope}]`;
    if (meta !== undefined) {
      console.log(`${prefix} ${message}`, meta);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}
