import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { OrderUseCase } from '../usecase/OrderUseCase';
import { GetLogger } from '../utils/loggerContext';
import { AuthenticateMiddleware, RequireLevel } from '../middleware/auth';
import { formatModelWithUserRelations, formatModelsWithUserRelations } from '../utils/formatResponse';

const router = Router();
const orderUseCase = new OrderUseCase();

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// POST /api/orders/checkout - Create new order (checkout)
router.post(
  '/checkout',
  [
    AuthenticateMiddleware,
    RequireLevel(40), // Require level > 39
    body('customer_name').optional().isString().withMessage('Customer name must be a string'),
    body('grand_total').notEmpty().isFloat({ min: 0.01 }).withMessage('Grand total is required and must be greater than 0'),
    body('items').isArray({ min: 1 }).withMessage('Items array is required with at least one item'),
    body('items.*.product_id').notEmpty().isUUID().withMessage('Product ID is required and must be a valid UUID for all items'),
    body('items.*.quantity').notEmpty().isFloat({ min: 0.01 }).withMessage('Quantity is required and must be greater than 0 for all items'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    logger?.info('POST /api/orders/checkout - Create new order', { body: req.body });
    try {
      const order = await orderUseCase.Checkout(req.body, req.user?.userId || '');
      logger?.info('Successfully created order', { id: order.id, invoice_number: order.invoice_number });
      res.status(201).json(formatModelWithUserRelations(order));
    } catch (error: any) {
      logger?.error('Error creating order', error, { body: req.body });
      res.status(400).json({ error: error.message });
    }
  }
);

// GET /api/orders - Get all orders with pagination
router.get(
  '/',
  [
    AuthenticateMiddleware,
    RequireLevel(40), // Require level > 39
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    logger?.info('GET /api/orders - Get all orders with pagination', { limit, offset });
    try {
      const { orders, total } = await orderUseCase.GetAllOrdersWithPagination(limit, offset);
      logger?.info('Successfully retrieved orders', { count: orders.length, total, limit, offset });
      res.json({
        data: formatModelsWithUserRelations(orders),
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      logger?.error('Error retrieving orders', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/orders/:id - Get order by ID
router.get(
  '/:id',
  [
    AuthenticateMiddleware,
    RequireLevel(40), // Require level > 39
    param('id').isInt({ min: 1 }).withMessage('Invalid order ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = parseInt(req.params.id as string, 10);
    logger?.info('GET /api/orders/:id - Get order by ID', { id });
    try {
      const order = await orderUseCase.GetOrderById(id);
      logger?.info('Successfully retrieved order', { id });
      res.json(formatModelWithUserRelations(order as any));
    } catch (error: any) {
      logger?.error('Error retrieving order', error, { id });
      if (error.message === 'Order not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

export default router;

