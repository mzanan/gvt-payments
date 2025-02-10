import pino from 'pino';

const transport = process.env.NODE_ENV !== 'production' 
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
      },
    }
  : undefined;

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV !== 'production' ? transport : undefined,
}); 