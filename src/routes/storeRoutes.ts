import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { StoreUseCase } from '../usecase/StoreUseCase';
import { GetLogger } from '../utils/loggerContext';
import { AuthenticateMiddleware, RequireLevel } from '../middleware/auth';
import { formatModelWithUserRelations, formatModelsWithUserRelations } from '../utils/formatResponse';

const router = Router();
const storeUseCase = new StoreUseCase();

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/stores - Get all stores with pagination and search
router.get(
  '/',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    query('name').optional().isString().withMessage('Name must be a string'),
    query('phone').optional().isString().withMessage('Phone must be a string'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const searchName = req.query.name as string | undefined;
    const searchPhone = req.query.phone as string | undefined;
    logger?.info('GET /api/stores - Get all stores with pagination and search', { limit, offset, searchName, searchPhone });
    try {
      const { stores, total } = await storeUseCase.GetAllStoresWithPagination(limit, offset, searchName, searchPhone);
      logger?.info('Successfully retrieved stores', { count: stores.length, total, limit, offset, searchName, searchPhone });
      res.json({
        data: formatModelsWithUserRelations(stores),
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      logger?.error('Error retrieving stores', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/stores/:id - Get store by ID
router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid store ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('GET /api/stores/:id - Get store by ID', { id });
    try {
      const store = await storeUseCase.GetStoreById(id);
      logger?.info('Successfully retrieved store', { id });
      res.json(formatModelWithUserRelations(store as any));
    } catch (error: any) {
      logger?.error('Error retrieving store', error, { id });
      if (error.message === 'Store not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

// POST /api/stores - Create new store (requires level > 50)
router.post(
  '/',
  [
    AuthenticateMiddleware,
    RequireLevel(51),
    body('name').notEmpty().withMessage('Name is required').isString(),
    body('address').optional().isString(),
    body('phone').optional().isString(),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    logger?.info('POST /api/stores - Create new store', { body: req.body });
    try {
      // Set created_by and updated_by from authenticated user
      const storeData = {
        ...req.body,
        created_by: req.user?.userId || null,
        updated_by: req.user?.userId || null,
      };
      const store = await storeUseCase.CreateStore(storeData);
      logger?.info('Successfully created store', { id: store.id, name: store.name });
      res.status(201).json(formatModelWithUserRelations(store));
    } catch (error: any) {
      logger?.error('Error creating store', error, { body: req.body });
      res.status(400).json({ error: error.message });
    }
  }
);

// PUT /api/stores/:id - Update store
router.put(
  '/:id',
  [
    AuthenticateMiddleware,
    param('id').isUUID().withMessage('Invalid store ID format'),
    body('name').optional().isString(),
    body('address').optional().isString(),
    body('phone').optional().isString(),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('PUT /api/stores/:id - Update store', { id, body: req.body });
    try {
      // Set updated_by from authenticated user
      const updateData = {
        ...req.body,
        updated_by: req.user?.userId || null,
      };
      const store = await storeUseCase.UpdateStore(id, updateData);
      logger?.info('Successfully updated store', { id });
      res.json(formatModelWithUserRelations(store));
    } catch (error: any) {
      logger?.error('Error updating store', error, { id });
      if (error.message === 'Store not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  }
);

// DELETE /api/stores/:id - Delete store
router.delete(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid store ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('DELETE /api/stores/:id - Delete store', { id });
    try {
      await storeUseCase.DeleteStore(id);
      logger?.info('Successfully deleted store', { id });
      res.status(204).send();
    } catch (error: any) {
      logger?.error('Error deleting store', error, { id });
      if (error.message === 'Store not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

export default router;

