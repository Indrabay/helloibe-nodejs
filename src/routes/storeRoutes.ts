import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { StoreUseCase } from '../usecase/StoreUseCase';
import { GetLogger } from '../utils/loggerContext';
import { AuthenticateMiddleware, RequireLevel } from '../middleware/auth';

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

// GET /api/stores - Get all stores
router.get('/', async (req: Request, res: Response) => {
  const logger = GetLogger();
  logger?.info('GET /api/stores - Get all stores');
  try {
    const stores = await storeUseCase.GetAllStores();
    logger?.info('Successfully retrieved all stores', { count: stores.length });
    res.json(stores);
  } catch (error: any) {
    logger?.error('Error retrieving stores', error);
    res.status(500).json({ error: error.message });
  }
});

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
      res.json(store);
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
    body('created_by').optional().isUUID().withMessage('Invalid created_by UUID'),
    body('updated_by').optional().isUUID().withMessage('Invalid updated_by UUID'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    logger?.info('POST /api/stores - Create new store', { body: req.body });
    try {
      const store = await storeUseCase.CreateStore(req.body);
      logger?.info('Successfully created store', { id: store.id, name: store.name });
      res.status(201).json(store);
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
    param('id').isUUID().withMessage('Invalid store ID format'),
    body('name').optional().isString(),
    body('address').optional().isString(),
    body('phone').optional().isString(),
    body('updated_by').optional().isUUID().withMessage('Invalid updated_by UUID'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('PUT /api/stores/:id - Update store', { id, body: req.body });
    try {
      const store = await storeUseCase.UpdateStore(id, req.body);
      logger?.info('Successfully updated store', { id });
      res.json(store);
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

