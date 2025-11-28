import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { RoleUseCase } from '../usecase/RoleUseCase';
import { GetLogger } from '../utils/loggerContext';
import { AuthenticateMiddleware, RequireLevel } from '../middleware/auth';
import { formatModelWithUserRelations, formatModelsWithUserRelations } from '../utils/formatResponse';

const router = Router();
const roleUseCase = new RoleUseCase();

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/roles - Get all roles with pagination
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
    logger?.info('GET /api/roles - Get all roles with pagination', { limit, offset });
    try {
      const { roles, total } = await roleUseCase.GetAllRolesWithPagination(limit, offset);
      logger?.info('Successfully retrieved roles', { count: roles.length, total, limit, offset });
      res.json({
        data: formatModelsWithUserRelations(roles),
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      logger?.error('Error retrieving roles', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/roles/:id - Get role by ID
router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid role ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('GET /api/roles/:id - Get role by ID', { id });
    try {
      const role = await roleUseCase.GetRoleById(id);
      logger?.info('Successfully retrieved role', { id });
      res.json(formatModelWithUserRelations(role as any));
    } catch (error: any) {
      logger?.error('Error retrieving role', error, { id });
      if (error.message === 'Role not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

// POST /api/roles - Create new role (requires level > 50)
router.post(
  '/',
  [
    AuthenticateMiddleware,
    RequireLevel(51),
    body('name').notEmpty().withMessage('Name is required').isString(),
    body('level').isInt({ min: 0 }).withMessage('Level must be a non-negative integer'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    logger?.info('POST /api/roles - Create new role', { body: req.body });
    try {
      // Set created_by and updated_by from authenticated user
      const roleData = {
        ...req.body,
        created_by: req.user?.userId || null,
        updated_by: req.user?.userId || null,
      };
      const role = await roleUseCase.CreateRole(roleData);
      logger?.info('Successfully created role', { id: role.id, name: role.name });
      res.status(201).json(formatModelWithUserRelations(role));
    } catch (error: any) {
      logger?.error('Error creating role', error, { body: req.body });
      res.status(400).json({ error: error.message });
    }
  }
);

// PUT /api/roles/:id - Update role
router.put(
  '/:id',
  [
    AuthenticateMiddleware,
    param('id').isUUID().withMessage('Invalid role ID format'),
    body('name').optional().isString(),
    body('level').optional().isInt({ min: 0 }).withMessage('Level must be a non-negative integer'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('PUT /api/roles/:id - Update role', { id, body: req.body });
    try {
      // Set updated_by from authenticated user
      const updateData = {
        ...req.body,
        updated_by: req.user?.userId || null,
      };
      const role = await roleUseCase.UpdateRole(id, updateData);
      logger?.info('Successfully updated role', { id });
      res.json(formatModelWithUserRelations(role));
    } catch (error: any) {
      logger?.error('Error updating role', error, { id });
      if (error.message === 'Role not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  }
);

// DELETE /api/roles/:id - Delete role
router.delete(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid role ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('DELETE /api/roles/:id - Delete role', { id });
    try {
      await roleUseCase.DeleteRole(id);
      logger?.info('Successfully deleted role', { id });
      res.status(204).send();
    } catch (error: any) {
      logger?.error('Error deleting role', error, { id });
      if (error.message === 'Role not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

export default router;

