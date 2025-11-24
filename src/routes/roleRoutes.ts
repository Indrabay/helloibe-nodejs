import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { RoleUseCase } from '../usecase/RoleUseCase';
import { GetLogger } from '../utils/loggerContext';

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

// GET /api/roles - Get all roles
router.get('/', async (req: Request, res: Response) => {
  const logger = GetLogger();
  logger?.info('GET /api/roles - Get all roles');
  try {
    const roles = await roleUseCase.GetAllRoles();
    logger?.info('Successfully retrieved all roles', { count: roles.length });
    res.json(roles);
  } catch (error: any) {
    logger?.error('Error retrieving roles', error);
    res.status(500).json({ error: error.message });
  }
});

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
      res.json(role);
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

// POST /api/roles - Create new role
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required').isString(),
    body('level').isInt({ min: 0 }).withMessage('Level must be a non-negative integer'),
    body('created_by').optional().isUUID().withMessage('Invalid created_by UUID'),
    body('updated_by').optional().isUUID().withMessage('Invalid updated_by UUID'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    logger?.info('POST /api/roles - Create new role', { body: req.body });
    try {
      const role = await roleUseCase.CreateRole(req.body);
      logger?.info('Successfully created role', { id: role.id, name: role.name });
      res.status(201).json(role);
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
    param('id').isUUID().withMessage('Invalid role ID format'),
    body('name').optional().isString(),
    body('level').optional().isInt({ min: 0 }).withMessage('Level must be a non-negative integer'),
    body('updated_by').optional().isUUID().withMessage('Invalid updated_by UUID'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('PUT /api/roles/:id - Update role', { id, body: req.body });
    try {
      const role = await roleUseCase.UpdateRole(id, req.body);
      logger?.info('Successfully updated role', { id });
      res.json(role);
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

