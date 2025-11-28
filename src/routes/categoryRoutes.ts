import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CategoryUseCase } from '../usecase/CategoryUseCase';
import { GetLogger } from '../utils/loggerContext';
import { AuthenticateMiddleware, RequireLevel } from '../middleware/auth';
import { formatModelWithUserRelations, formatModelsWithUserRelations } from '../utils/formatResponse';

const router = Router();
const categoryUseCase = new CategoryUseCase();

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/categories - Get all categories with pagination
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
    logger?.info('GET /api/categories - Get all categories with pagination', { limit, offset });
    try {
      const { categories, total } = await categoryUseCase.GetAllCategoriesWithPagination(limit, offset);
      logger?.info('Successfully retrieved categories', { count: categories.length, total, limit, offset });
      res.json({
        data: formatModelsWithUserRelations(categories),
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      logger?.error('Error retrieving categories', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/categories/:id - Get category by ID
router.get(
  '/:id',
  [
    param('id').isInt().withMessage('Invalid category ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = parseInt(req.params.id as string, 10);
    logger?.info('GET /api/categories/:id - Get category by ID', { id });
    try {
      const category = await categoryUseCase.GetCategoryById(id);
      logger?.info('Successfully retrieved category', { id });
      res.json(formatModelWithUserRelations(category as any));
    } catch (error: any) {
      logger?.error('Error retrieving category', error, { id });
      if (error.message === 'Category not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

// POST /api/categories - Create new category (requires level > 50)
router.post(
  '/',
  [
    AuthenticateMiddleware,
    RequireLevel(51),
    body('name').notEmpty().withMessage('Name is required').isString(),
    body('category_code').notEmpty().withMessage('Category code is required').isString(),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    logger?.info('POST /api/categories - Create new category', { body: req.body });
    try {
      // Set created_by and updated_by from authenticated user
      const categoryData = {
        ...req.body,
        created_by: req.user?.userId || null,
        updated_by: req.user?.userId || null,
      };
      const category = await categoryUseCase.CreateCategory(categoryData);
      logger?.info('Successfully created category', { id: category.id, name: category.name });
      res.status(201).json(formatModelWithUserRelations(category));
    } catch (error: any) {
      logger?.error('Error creating category', error, { body: req.body });
      res.status(400).json({ error: error.message });
    }
  }
);

// PUT /api/categories/:id - Update category
router.put(
  '/:id',
  [
    AuthenticateMiddleware,
    param('id').isInt().withMessage('Invalid category ID format'),
    body('name').optional().isString(),
    body('category_code').optional().isString(),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('PUT /api/categories/:id - Update category', { id, body: req.body });
    try {
      // Set updated_by from authenticated user
      const updateData = {
        ...req.body,
        updated_by: req.user?.userId || null,
      };
      const category = await categoryUseCase.UpdateCategory(id, updateData);
      logger?.info('Successfully updated category', { id });
      res.json(formatModelWithUserRelations(category));
    } catch (error: any) {
      logger?.error('Error updating category', error, { id });
      if (error.message === 'Category not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  }
);

// DELETE /api/categories/:id - Delete category
router.delete(
  '/:id',
  [
    AuthenticateMiddleware,
    param('id').isInt().withMessage('Invalid category ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = parseInt(req.params.id as string, 10);
    logger?.info('DELETE /api/categories/:id - Delete category', { id });
    try {
      await categoryUseCase.DeleteCategory(id);
      logger?.info('Successfully deleted category', { id });
      res.status(204).send();
    } catch (error: any) {
      logger?.error('Error deleting category', error, { id });
      if (error.message === 'Category not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

export default router;

