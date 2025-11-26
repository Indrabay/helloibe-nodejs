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
        include: [{ association: 'role' }],
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

