import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { OrderUseCase } from '../usecase/OrderUseCase';
import { GetLogger } from '../utils/loggerContext';
import { AuthenticateMiddleware, RequireLevel } from '../middleware/auth';
import { formatModelWithUserRelations, formatModelsWithUserRelations } from '../utils/formatResponse';
import { convertToCSV, sendCSVResponse } from '../utils/csvExporter';

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

// GET /api/orders/download - Download all orders as CSV (with filters)
router.get(
  '/download',
  [
    AuthenticateMiddleware,
    RequireLevel(40),
    query('store_id').optional().isUUID().withMessage('Invalid store ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const userLevel = req.user?.level;
    let storeId = req.query.store_id as string | undefined;
    
    logger?.info('GET /api/orders/download - Download orders as CSV', { storeId, userLevel });
    
    try {
      // For super admin, store_id is required
      if (userLevel === 99) {
        if (!storeId) {
          return res.status(400).json({ error: 'Store ID is required for super admin' });
        }
      } else {
        // For regular users, use their assigned store_id
        if (!req.userModel?.store_id) {
          return res.status(403).json({ error: 'User must have a store assigned' });
        }
        storeId = req.userModel.store_id;
      }
      
      const orders = await orderUseCase.GetAllOrdersWithFilters(storeId);
      
      // Convert to CSV format - flatten order items
      const headers = ['order_id', 'invoice_number', 'customer_name', 'store.name', 'store.store_code', 'total_price', 'created_at', 'creator.name', 'items'];
      const csvData: any[] = [];
      
      orders.forEach(order => {
        const orderJson: any = order.toJSON ? order.toJSON() : order;
        const items = orderJson.orderItems || [];
        
        if (items.length === 0) {
          // Order with no items
          csvData.push({
            order_id: orderJson.id,
            invoice_number: orderJson.invoice_number || '',
            customer_name: orderJson.customer_name || '',
            'store.name': orderJson.store?.name || '',
            'store.store_code': orderJson.store?.store_code || '',
            total_price: orderJson.total_price || '',
            created_at: orderJson.created_at,
            'creator.name': orderJson.creator?.name || '',
            items: '',
          });
        } else {
          // One row per order item
          items.forEach((item: any) => {
            csvData.push({
              order_id: orderJson.id,
              invoice_number: orderJson.invoice_number || '',
              customer_name: orderJson.customer_name || '',
              'store.name': orderJson.store?.name || '',
              'store.store_code': orderJson.store?.store_code || '',
              total_price: orderJson.total_price || '',
              created_at: orderJson.created_at,
              'creator.name': orderJson.creator?.name || '',
              items: `${item.product?.name || ''} (Qty: ${item.quantity}, Price: ${item.total_price})`,
            });
          });
        }
      });
      
      const csvContent = convertToCSV(csvData, headers);
      const filename = `orders_${new Date().toISOString().split('T')[0]}.csv`;
      sendCSVResponse(res, csvContent, filename);
      logger?.info('Successfully downloaded orders', { count: orders.length });
    } catch (error: any) {
      logger?.error('Error downloading orders', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;

