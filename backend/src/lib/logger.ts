// ==============================================
// Pino Logger Configuration
// ==============================================

import pino from 'pino';
import { config } from './config';

const isDevelopment = config.nodeEnv === 'development';

export const logger = pino({
  level: config.logLevel,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Child loggers for specific modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};
