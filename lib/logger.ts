// ============================================
// RAM Dosya Atama - Logger Utility
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const getLogLevel = (): LogLevel => {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV === 'production' ? 'warn' : 'debug';
  }
  // Client-side: production'da sadece warn/error
  return process.env.NODE_ENV === 'production' ? 'warn' : 'debug';
};

const shouldLog = (level: LogLevel): boolean => {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
};

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.debug('[DEBUG]', ...args);
    }
  },
  
  info: (...args: unknown[]) => {
    if (shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  },
  
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  },
  
  error: (...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  },
};

