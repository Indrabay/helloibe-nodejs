import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'helloibe-nodejs' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, request_id, ...meta }) => {
          const requestIdStr = request_id ? `[${request_id}]` : '';
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} ${requestIdStr} ${level}: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

export class Logger {
  private requestId: string | undefined;

  constructor(requestId?: string) {
    this.requestId = requestId ?? undefined;
  }

  private getMeta(additionalMeta?: Record<string, any>) {
    return {
      request_id: this.requestId,
      ...additionalMeta,
    };
  }

  info(message: string, meta?: Record<string, any>) {
    logger.info(message, this.getMeta(meta));
  }

  error(message: string, error?: Error | any, meta?: Record<string, any>) {
    const errorMeta = error instanceof Error 
      ? { error: error.message, stack: error.stack }
      : { error };
    logger.error(message, this.getMeta({ ...errorMeta, ...meta }));
  }

  warn(message: string, meta?: Record<string, any>) {
    logger.warn(message, this.getMeta(meta));
  }

  debug(message: string, meta?: Record<string, any>) {
    logger.debug(message, this.getMeta(meta));
  }
}

export default logger;

