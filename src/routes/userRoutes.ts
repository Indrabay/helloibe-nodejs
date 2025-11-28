import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { UserUseCase } from '../usecase/UserUseCase';
import { GetLogger } from '../utils/loggerContext';
import { AuthenticateMiddleware, RequireLevel } from '../middleware/auth';
import { formatModelWithUserRelations, formatModelsWithUserRelations } from '../utils/formatResponse';

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

// GET /api/users - Get all users with pagination
router.get(
  '/',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    logger?.info('GET /api/users - Get all users with pagination', { limit, offset });
    try {
      const { users, total } = await userUseCase.GetAllUsersWithPagination(limit, offset);
      logger?.info('Successfully retrieved users', { count: users.length, total, limit, offset });
      res.json({
        data: formatModelsWithUserRelations(users),
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      logger?.error('Error retrieving users', error);
      res.status(500).json({ error: error.message });
    }
  }
);

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
      res.json(formatModelWithUserRelations(user as any));
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
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    logger?.info('POST /api/users - Create new user', { body: { ...req.body, password: '[REDACTED]' } });
    try {
      // Set created_by and updated_by from authenticated user
      const userData = {
        ...req.body,
        created_by: req.user?.userId || null,
        updated_by: req.user?.userId || null,
      };
      const user = await userUseCase.CreateUser(userData);
      logger?.info('Successfully created user', { id: user.id, username: user.username });
      res.status(201).json(formatModelWithUserRelations(user));
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
    AuthenticateMiddleware,
    param('id').isUUID().withMessage('Invalid user ID format'),
    body('username').optional().isString().isLength({ min: 3, max: 50 }),
    body('email').optional().isEmail(),
    body('name').optional().isString(),
    body('password').optional().isString().isLength({ min: 6 }),
    body('role_id').optional().isUUID().withMessage('Invalid role_id UUID'),
    body('store_id').optional().isUUID().withMessage('Invalid store_id UUID'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('PUT /api/users/:id - Update user', { id, body: { ...req.body, password: req.body.password ? '[REDACTED]' : undefined } });
    try {
      // Set updated_by from authenticated user
      const updateData = {
        ...req.body,
        updated_by: req.user?.userId || null,
      };
      const user = await userUseCase.UpdateUser(id, updateData);
      logger?.info('Successfully updated user', { id });
      res.json(formatModelWithUserRelations(user));
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

