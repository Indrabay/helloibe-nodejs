import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { UserUseCase } from '../usecase/UserUseCase';
import { GetLogger } from '../utils/loggerContext';
import { AuthenticateMiddleware, RequireLevel } from '../middleware/auth';

const router = Router();
const userUseCase = new UserUseCase();

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/users - Get all users
router.get('/', async (req: Request, res: Response) => {
  const logger = GetLogger();
  logger?.info('GET /api/users - Get all users');
  try {
    const users = await userUseCase.GetAllUsers();
    logger?.info('Successfully retrieved all users', { count: users.length });
    res.json(users);
  } catch (error: any) {
    logger?.error('Error retrieving users', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/:id - Get user by ID
router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid user ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('GET /api/users/:id - Get user by ID', { id });
    try {
      const user = await userUseCase.GetUserById(id);
      logger?.info('Successfully retrieved user', { id });
      res.json(user);
    } catch (error: any) {
      logger?.error('Error retrieving user', error, { id });
      if (error.message === 'User not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

// POST /api/users - Create new user (requires level > 50)
router.post(
  '/',
  [
    AuthenticateMiddleware,
    RequireLevel(51),
    body('username').notEmpty().withMessage('Username is required').isString().isLength({ min: 3, max: 50 }),
    body('email').notEmpty().withMessage('Email is required').isEmail(),
    body('name').notEmpty().withMessage('Name is required').isString(),
    body('password').notEmpty().withMessage('Password is required').isString().isLength({ min: 6 }),
    body('role_id').optional().isUUID().withMessage('Invalid role_id UUID'),
    body('store_id').optional().isUUID().withMessage('Invalid store_id UUID'),
    body('created_by').optional().isUUID().withMessage('Invalid created_by UUID'),
    body('updated_by').optional().isUUID().withMessage('Invalid updated_by UUID'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    logger?.info('POST /api/users - Create new user', { body: { ...req.body, password: '[REDACTED]' } });
    try {
      const user = await userUseCase.CreateUser(req.body);
      logger?.info('Successfully created user', { id: user.id, username: user.username });
      res.status(201).json(user);
    } catch (error: any) {
      logger?.error('Error creating user', error, { body: { ...req.body, password: '[REDACTED]' } });
      res.status(400).json({ error: error.message });
    }
  }
);

// PUT /api/users/:id - Update user
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid user ID format'),
    body('username').optional().isString().isLength({ min: 3, max: 50 }),
    body('email').optional().isEmail(),
    body('name').optional().isString(),
    body('password').optional().isString().isLength({ min: 6 }),
    body('role_id').optional().isUUID().withMessage('Invalid role_id UUID'),
    body('store_id').optional().isUUID().withMessage('Invalid store_id UUID'),
    body('updated_by').optional().isUUID().withMessage('Invalid updated_by UUID'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('PUT /api/users/:id - Update user', { id, body: { ...req.body, password: req.body.password ? '[REDACTED]' : undefined } });
    try {
      const user = await userUseCase.UpdateUser(id, req.body);
      logger?.info('Successfully updated user', { id });
      res.json(user);
    } catch (error: any) {
      logger?.error('Error updating user', error, { id });
      if (error.message === 'User not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  }
);

// DELETE /api/users/:id - Delete user
router.delete(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid user ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('DELETE /api/users/:id - Delete user', { id });
    try {
      await userUseCase.DeleteUser(id);
      logger?.info('Successfully deleted user', { id });
      res.status(204).send();
    } catch (error: any) {
      logger?.error('Error deleting user', error, { id });
      if (error.message === 'User not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

export default router;

