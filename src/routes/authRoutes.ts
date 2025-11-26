import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthUseCase } from '../usecase/AuthUseCase';
import { GetLogger } from '../utils/loggerContext';

const router = Router();
const authUseCase = new AuthUseCase();

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// POST /api/auth/login - Login user
router.post(
  '/login',
  [
    body('usernameOrEmail').notEmpty().withMessage('Username or email is required').isString(),
    body('password').notEmpty().withMessage('Password is required').isString(),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    logger?.info('POST /api/auth/login - Login attempt', { usernameOrEmail: req.body.usernameOrEmail });
    try {
      const { token, user } = await authUseCase.Login(req.body.usernameOrEmail, req.body.password);
      logger?.info('Login successful', { userId: user.id, username: user.username });
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role_id: user.role_id,
          store_id: user.store_id,
        },
      });
    } catch (error: any) {
      logger?.error('Login failed', error, { usernameOrEmail: req.body.usernameOrEmail });
      res.status(401).json({ error: error.message });
    }
  }
);

export default router;

