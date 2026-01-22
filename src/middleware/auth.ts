import { Request, Response, NextFunction } from 'express';
import { VerifyToken, JWTPayload } from '../utils/jwt';
import { GetLogger } from '../utils/loggerContext';
import { User } from '../models';
import { Role } from '../models';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      userModel?: User;
    }
  }
}

export async function AuthenticateMiddleware(req: Request, res: Response, next: NextFunction) {
  const logger = GetLogger();
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger?.warn('Authentication failed - No token provided');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = VerifyToken(token);
      req.user = decoded;

      // Fetch user and role to get current level
      const user = await User.findByPk(decoded.userId, {
        include: [{ association: 'role' }, { association: 'store' }],
      });

      if (!user) {
        logger?.warn('Authentication failed - User not found', { userId: decoded.userId });
        return res.status(401).json({ error: 'User not found' });
      }

      req.userModel = user;
      
      // Update user level in token payload if role exists
      const role = (user as any).role;
      if (role) {
        req.user.level = role.level;
      }

      logger?.debug('Authentication successful', { userId: decoded.userId, username: decoded.username });
      next();
    } catch (error: any) {
      logger?.warn('Authentication failed - Invalid token', { error: error.message });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error: any) {
    logger?.error('Authentication error', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

export function RequireLevel(minLevel: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const logger = GetLogger();
    
    if (!req.user) {
      logger?.warn('Authorization failed - No user in request');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userLevel = req.user.level;
    
    if (!userLevel || userLevel < minLevel) {
      logger?.warn('Authorization failed - Insufficient level', { 
        required: minLevel, 
        current: userLevel,
        userId: req.user.userId 
      });
      return res.status(403).json({ 
        error: `Access denied. Required level: ${minLevel}, Current level: ${userLevel || 'N/A'}` 
      });
    }

    logger?.debug('Authorization successful', { 
      userId: req.user.userId, 
      level: userLevel,
      required: minLevel 
    });
    next();
  };
}

/**
 * Middleware for internal API endpoints (e.g., cron jobs)
 * Validates Basic Authentication with username and password from environment variables
 * Uses INTERNAL_API_USERNAME and INTERNAL_API_PASSWORD environment variables
 */
export function InternalApiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const logger = GetLogger();
  const expectedUsername = process.env.INTERNAL_API_USERNAME;
  const expectedPassword = process.env.INTERNAL_API_PASSWORD;
  
  // If no credentials are configured, allow access (for development)
  if (!expectedUsername || !expectedPassword) {
    logger?.warn('InternalApiKeyMiddleware - No INTERNAL_API_USERNAME or INTERNAL_API_PASSWORD configured, allowing access');
    return next();
  }
  
  // Get Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    logger?.warn('InternalApiKeyMiddleware - No Basic authentication provided');
    res.setHeader('WWW-Authenticate', 'Basic realm="Internal API"');
    return res.status(401).json({ error: 'Basic authentication required' });
  }
  
  try {
    // Decode Basic Auth credentials
    const base64Credentials = authHeader.substring(6); // Remove 'Basic ' prefix
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    
    if (!username || !password) {
      logger?.warn('InternalApiKeyMiddleware - Invalid Basic auth format');
      res.setHeader('WWW-Authenticate', 'Basic realm="Internal API"');
      return res.status(401).json({ error: 'Invalid authentication format' });
    }
    
    if (username !== expectedUsername || password !== expectedPassword) {
      logger?.warn('InternalApiKeyMiddleware - Invalid username or password');
      res.setHeader('WWW-Authenticate', 'Basic realm="Internal API"');
      return res.status(403).json({ error: 'Invalid username or password' });
    }
    
    logger?.debug('InternalApiKeyMiddleware - Basic authentication validated', { username });
    next();
  } catch (error: any) {
    logger?.error('InternalApiKeyMiddleware - Error validating credentials', error);
    res.setHeader('WWW-Authenticate', 'Basic realm="Internal API"');
    return res.status(401).json({ error: 'Authentication error' });
  }
}

