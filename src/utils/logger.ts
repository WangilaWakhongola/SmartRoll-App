// ============================================================
// SmartRoll — Lightweight Debug Logger
//
// Usage:
//   import { logger } from '../utils/logger'
//   logger.debug('useAttendanceFlow', 'GPS updated', { inside, distanceM })
//   logger.warn('AuthContext', 'fetchProfile failed', error)
//   logger.error('useStudentSessions', 'fetch error', err)
//
// In development (__DEV__ = true) all levels are printed.
// In production only 'warn' and 'error' are printed.
// Each message is prefixed with [SmartRoll/<tag>] for easy filtering.
// ============================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function log(level: LogLevel, tag: string, message: string, data?: unknown): void {
  if (!__DEV__ && (level === 'debug' || level === 'info')) return;

  const prefix = `[SmartRoll/${tag}]`;
  const args = data !== undefined ? [prefix, message, data] : [prefix, message];

  switch (level) {
    case 'debug': console.debug(...args); break;
    case 'info':  console.info(...args);  break;
    case 'warn':  console.warn(...args);  break;
    case 'error': console.error(...args); break;
  }
}

export const logger = {
  debug: (tag: string, message: string, data?: unknown) => log('debug', tag, message, data),
  info:  (tag: string, message: string, data?: unknown) => log('info',  tag, message, data),
  warn:  (tag: string, message: string, data?: unknown) => log('warn',  tag, message, data),
  error: (tag: string, message: string, data?: unknown) => log('error', tag, message, data),
};
