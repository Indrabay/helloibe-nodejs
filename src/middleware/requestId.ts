import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { Logger } from '../utils/logger';
import { RunWithLogger } from '../utils/loggerContext';

declare global {
  namespace Express {
    interface Request {
      request_id?: string;
      logger?: Logger;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Use existing request_id from header or generate new one
  req.request_id = req.headers['x-request-id'] as string || randomUUID();
  
  // Create logger once per request
  req.logger = new Logger(req.request_id);
  
  // Set response header
  res.setHeader('X-Request-ID', req.request_id);
  
  // Run the rest of the request in the logger context
  RunWithLogger(req.logger, () => {
    next();
  });
}

