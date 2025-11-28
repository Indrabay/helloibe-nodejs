import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { InventoryUseCase } from '../usecase/InventoryUseCase';
import { GetLogger } from '../utils/loggerContext';
import { AuthenticateMiddleware, RequireLevel } from '../middleware/auth';
import { formatModelWithUserRelations, formatModelsWithUserRelations } from '../utils/formatResponse';
import multer from 'multer';
import { parseBuffer, InventoryRow } from '../utils/fileParser';
import { ProductRepository } from '../repository/ProductRepository';

const router = Router();
const inventoryUseCase = new InventoryUseCase();
const productRepository = new ProductRepository();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and XLSX files are allowed.'));
    }
  },
});

const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/inventory - Get all inventory with pagination
router.get(
  '/',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    query('product_id').optional().isUUID().withMessage('Invalid product ID format'),
    query('product_name').optional().isString().withMessage('Product name must be a string'),
    query('sku').optional().isString().withMessage('SKU must be a string'),
    query('category_id').optional().isInt().withMessage('Category ID must be an integer'),
    query('search').optional().isString().withMessage('Search must be a string'),
    query('status').optional().custom((value) => {
      if (typeof value === 'string') {
        const validStatuses = ['active', 'near_expiry', 'expired'];
        if (!validStatuses.includes(value)) {
          throw new Error('Status must be active, near_expiry, or expired');
        }
      } else if (Array.isArray(value)) {
        const validStatuses = ['active', 'near_expiry', 'expired'];
        const invalidStatuses = value.filter((s: string) => !validStatuses.includes(s));
        if (invalidStatuses.length > 0) {
          throw new Error(`Invalid status values: ${invalidStatuses.join(', ')}`);
        }
      }
      return true;
    }),
    query('store_id').optional().isUUID().withMessage('Invalid store ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const productId = req.query.product_id as string | undefined;
    const productName = req.query.product_name as string | undefined;
    const sku = req.query.sku as string | undefined;
    const categoryId = req.query.category_id ? parseInt(req.query.category_id as string, 10) : undefined;
    const search = req.query.search as string | undefined;
    // Handle status as single string or array
    let status: string | string[] | undefined = undefined;
    if (req.query.status) {
      if (Array.isArray(req.query.status)) {
        status = req.query.status as string[];
      } else {
        status = req.query.status as string;
      }
    }
    const storeId = req.query.store_id as string | undefined;
    logger?.info('GET /api/inventory - Get all inventory with pagination', { limit, offset, productId, productName, sku, categoryId, search, status, storeId });
    try {
      const { inventory, total } = await inventoryUseCase.GetAllInventoryWithPagination(limit, offset, productId, status, storeId, productName, sku, categoryId, search);
      logger?.info('Successfully retrieved inventory', { count: inventory.length, total, limit, offset, productId, productName, sku, categoryId, search, status, storeId });
      res.json({
        data: formatModelsWithUserRelations(inventory),
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      logger?.error('Error retrieving inventory', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/inventory/:id - Get inventory by ID
router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid inventory ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('GET /api/inventory/:id - Get inventory by ID', { id });
    try {
      const inventory = await inventoryUseCase.GetInventoryById(id);
      logger?.info('Successfully retrieved inventory', { id });
      res.json(formatModelWithUserRelations(inventory as any));
    } catch (error: any) {
      logger?.error('Error retrieving inventory', error, { id });
      if (error.message === 'Inventory not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

// POST /api/inventory - Create new inventory (requires level > 39 and store assigned)
router.post(
  '/',
  [
    AuthenticateMiddleware,
    RequireLevel(40),
    body('product_id').notEmpty().withMessage('Product ID is required').isUUID().withMessage('Invalid product ID format'),
    body('quantity').notEmpty().withMessage('Quantity is required').isFloat({ min: 0 }).withMessage('Quantity must be a non-negative number'),
    body('location').optional().isString(),
    body('expiry_date').optional().isISO8601().withMessage('Invalid expiry date format'),
    body('store_id').optional().isUUID().withMessage('Invalid store ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    logger?.info('POST /api/inventory - Create new inventory', { body: req.body });
    try {
      const userLevel = req.user?.level;
      
      // For non-super-admin users, validate they have a store assigned
      if (userLevel !== 99 && !req.userModel?.store_id) {
        return res.status(403).json({ error: 'User must have a store assigned to create inventory' });
      }
      
      const inventory = await inventoryUseCase.CreateInventory(req.body, req.user?.userId || '', userLevel);
      logger?.info('Successfully created inventory', { id: inventory.id });
      res.status(201).json(formatModelWithUserRelations(inventory));
    } catch (error: any) {
      logger?.error('Error creating inventory', error, { body: req.body });
      res.status(400).json({ error: error.message });
    }
  }
);

// POST /api/inventory/batch - Create inventory from CSV/XLSX file (requires level > 39 and store assigned)
router.post(
  '/batch',
  [
    AuthenticateMiddleware,
    RequireLevel(40),
    upload.single('file'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    logger?.info('POST /api/inventory/batch - Create inventory from file');
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'File is required' });
      }

      // Parse file
      const rows = await parseBuffer(req.file.buffer, req.file.mimetype, 'inventory') as InventoryRow[];
      
      if (rows.length === 0) {
        return res.status(400).json({ error: 'No data found in file' });
      }

      // Get user level and store_id
      const userLevel = req.user?.level;
      const userStoreId = req.userModel?.store_id;
      
      // For super admin, validate that store_id is provided in each row
      if (userLevel === 99) {
        const rowsWithoutStoreId = rows.filter((row) => !row.store_id);
        if (rowsWithoutStoreId.length > 0) {
          return res.status(400).json({ 
            error: `Store ID is required for all inventory when uploading as super admin. Missing store_id in ${rowsWithoutStoreId.length} row(s).` 
          });
        }
      }
      
      // For regular users, validate they have a store assigned
      if (userLevel !== 99 && !userStoreId) {
        return res.status(400).json({ 
          error: 'User must have a store assigned to upload inventory' 
        });
      }

      // Convert rows to inventory creation attributes
      const inventoryData = await Promise.all(
        rows.map(async (row: InventoryRow) => {
          let productId = row.product_id;
          
          // If SKU is provided, find product by SKU
          if (!productId && row.sku) {
            const product = await productRepository.FindBySku(row.sku);
            if (!product) {
              throw new Error(`Product not found with SKU: ${row.sku}`);
            }
            productId = product.id;
          }
          
          if (!productId) {
            throw new Error('Product ID or SKU is required');
          }

          const inventoryItem: any = {
            product_id: productId,
            quantity: row.quantity,
          };
          
          if (row.location) {
            inventoryItem.location = row.location;
          }
          if (row.expiry_date) {
            inventoryItem.expiry_date = new Date(row.expiry_date);
          }
          
          // Set store_id based on user level
          if (userLevel === 99) {
            // Super admin: use store_id from file
            if (!row.store_id) {
              throw new Error(`Store ID is required for inventory with product: ${productId}`);
            }
            inventoryItem.store_id = row.store_id;
          } else {
            // Regular user: automatically use their assigned store_id (ignore any store_id in file)
            inventoryItem.store_id = userStoreId;
          }
          
          return inventoryItem;
        })
      );

      const inventory = await inventoryUseCase.CreateInventoryBatch(inventoryData, req.user?.userId || '', userLevel);
      logger?.info('Successfully created inventory from file', { count: inventory.length });
      res.status(201).json({
        message: `Successfully created ${inventory.length} inventory items`,
        count: inventory.length,
        data: formatModelsWithUserRelations(inventory),
      });
    } catch (error: any) {
      logger?.error('Error creating inventory from file', error);
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;

