import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import multer from 'multer';
import { ProductUseCase } from '../usecase/ProductUseCase';
import { CategoryRepository } from '../repository/CategoryRepository';
import { GetLogger } from '../utils/loggerContext';
import { AuthenticateMiddleware, RequireLevel } from '../middleware/auth';
import { formatModelWithUserRelations, formatModelsWithUserRelations } from '../utils/formatResponse';
import { parseBuffer, ProductRow } from '../utils/fileParser';
import { convertToCSV, sendCSVResponse } from '../utils/csvExporter';

const router = Router();
const productUseCase = new ProductUseCase();
const categoryRepository = new CategoryRepository();

// Configure multer for file uploads
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

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/products - Get all products with pagination and search
router.get(
  '/',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    query('name').optional().isString().withMessage('Name must be a string'),
    query('sku').optional().isString().withMessage('SKU must be a string'),
    query('store_id').optional().isUUID().withMessage('Invalid store ID format'),
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
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const searchName = req.query.name as string | undefined;
    const searchSku = req.query.sku as string | undefined;
    const storeId = req.query.store_id as string | undefined;
    // Handle status as single string or array
    let status: string | string[] | undefined = undefined;
    if (req.query.status) {
      if (Array.isArray(req.query.status)) {
        status = req.query.status as string[];
      } else {
        status = req.query.status as string;
      }
    }
    logger?.info('GET /api/products - Get all products with pagination and search', { limit, offset, searchName, searchSku, storeId, status });
    try {
      const { products, total } = await productUseCase.GetAllProductsWithPagination(limit, offset, searchName, searchSku, storeId, status);
      logger?.info('Successfully retrieved products', { count: products.length, total, limit, offset, searchName, searchSku, storeId });
      res.json({
        data: formatModelsWithUserRelations(products),
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      logger?.error('Error retrieving products', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/products/:id - Get product by ID
router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid product ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('GET /api/products/:id - Get product by ID', { id });
    try {
      const product = await productUseCase.GetProductById(id);
      logger?.info('Successfully retrieved product', { id });
      res.json(formatModelWithUserRelations(product as any));
    } catch (error: any) {
      logger?.error('Error retrieving product', error, { id });
      if (error.message === 'Product not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

// POST /api/products - Create new product (requires level > 39 and store assigned)
router.post(
  '/',
  [
    AuthenticateMiddleware,
    RequireLevel(40),
    body('name').notEmpty().withMessage('Name is required').isString(),
    body('category_id').notEmpty().withMessage('Category ID is required').isInt(),
    body('store_id').optional().isUUID().withMessage('Invalid store ID format'),
    body('sku').optional().isString(),
    body('selling_price').notEmpty().withMessage('Selling price is required').isFloat({ min: 0 }),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    logger?.info('POST /api/products - Create new product', { body: req.body });
    try {
      const userLevel = req.user?.level;
      
      // For non-super-admin users, validate they have a store assigned
      if (userLevel !== 99 && !req.userModel?.store_id) {
        return res.status(403).json({ error: 'User must have a store assigned to create products' });
      }
      
      const product = await productUseCase.CreateProduct(req.body, req.user?.userId || '', userLevel);
      logger?.info('Successfully created product', { id: product.id, name: product.name });
      res.status(201).json(formatModelWithUserRelations(product));
    } catch (error: any) {
      logger?.error('Error creating product', error, { body: req.body });
      res.status(400).json({ error: error.message });
    }
  }
);

// POST /api/products/batch - Create products from CSV/XLSX file (requires level > 39 and store assigned)
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
    logger?.info('POST /api/products/batch - Create products from file');
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'File is required' });
      }

      // Parse file
      const rows = await parseBuffer(req.file.buffer, req.file.mimetype, 'product') as ProductRow[];
      
      if (rows.length === 0) {
        return res.status(400).json({ error: 'No data found in file' });
      }

      // Get user level and store_id
      const userLevel = req.user?.level;
      const userStoreId = req.userModel?.store_id;
      
      // For super admin, validate that store_id is provided in each row
      if (userLevel === 99) {
        const rowsWithoutStoreId = rows.filter(row => !row.store_id);
        if (rowsWithoutStoreId.length > 0) {
          return res.status(400).json({ 
            error: `Store ID is required for all products when uploading as super admin. Missing store_id in ${rowsWithoutStoreId.length} row(s).` 
          });
        }
      }
      
      // For regular users, validate they have a store assigned
      if (userLevel !== 99 && !userStoreId) {
        return res.status(400).json({ 
          error: 'User must have a store assigned to upload products' 
        });
      }

      // Convert rows to product creation attributes
      const productsData = await Promise.all(
        rows.map(async (row: ProductRow) => {
          let categoryId = row.category_id;
          
          // If category_code is provided, find category by code
          if (!categoryId && row.category_code) {
            const category = await categoryRepository.FindByCategoryCode(row.category_code);
            if (!category) {
              throw new Error(`Category not found with code: ${row.category_code}`);
            }
            categoryId = category.id;
          }
          
          if (!categoryId) {
            throw new Error('Category ID or Category Code is required');
          }

          const productData: any = {
            name: row.name,
            category_id: categoryId,
            selling_price: row.selling_price,
          };
          if (row.sku) {
            productData.sku = row.sku;
          }
          
          // Set store_id based on user level
          if (userLevel === 99) {
            // Super admin: use store_id from file
            if (!row.store_id) {
              throw new Error(`Store ID is required for product: ${row.name}`);
            }
            productData.store_id = row.store_id;
          } else {
            // Regular user: automatically use their assigned store_id (ignore any store_id in file)
            productData.store_id = userStoreId;
          }
          
          return productData;
        })
      );

      const result = await productUseCase.UpsertProductsBatch(productsData, req.user?.userId || '', userLevel);
      logger?.info('Successfully processed products from file', { created: result.created.length, updated: result.updated.length });
      res.status(200).json({
        message: `Successfully processed ${result.created.length + result.updated.length} products`,
        created: result.created.length,
        updated: result.updated.length,
        data: {
          created: formatModelsWithUserRelations(result.created),
          updated: formatModelsWithUserRelations(result.updated),
        },
      });
    } catch (error: any) {
      logger?.error('Error creating products from file', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// PUT /api/products/:id - Update product (requires level > 39 and store assigned)
router.put(
  '/:id',
  [
    AuthenticateMiddleware,
    RequireLevel(40),
    param('id').isUUID().withMessage('Invalid product ID format'),
    body('name').optional().isString(),
    body('category_id').optional().isInt(),
    body('sku').optional().isString(),
    body('selling_price').optional().isFloat({ min: 0 }),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('PUT /api/products/:id - Update product', { id, body: req.body });
    try {
      const userLevel = req.user?.level;
      
      // For non-super-admin users, validate they have a store assigned
      if (userLevel !== 99 && !req.userModel?.store_id) {
        return res.status(403).json({ error: 'User must have a store assigned to update products' });
      }
      
      const product = await productUseCase.UpdateProduct(id, req.body, req.user?.userId || '');
      logger?.info('Successfully updated product', { id });
      res.json(formatModelWithUserRelations(product));
    } catch (error: any) {
      logger?.error('Error updating product', error, { id });
      if (error.message === 'Product not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  }
);

// DELETE /api/products/:id - Delete product (requires level > 39 and store assigned)
router.delete(
  '/:id',
  [
    AuthenticateMiddleware,
    RequireLevel(40),
    param('id').isUUID().withMessage('Invalid product ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const id = req.params.id as string;
    logger?.info('DELETE /api/products/:id - Delete product', { id });
    try {
      const userLevel = req.user?.level;
      
      // For non-super-admin users, validate they have a store assigned
      if (userLevel !== 99 && !req.userModel?.store_id) {
        return res.status(403).json({ error: 'User must have a store assigned to delete products' });
      }
      
      await productUseCase.DeleteProduct(id);
      logger?.info('Successfully deleted product', { id });
      res.status(204).send();
    } catch (error: any) {
      logger?.error('Error deleting product', error, { id });
      if (error.message === 'Product not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

// DELETE /api/products/bulk - Delete multiple products (requires level > 39 and store assigned)
router.delete(
  '/bulk',
  [
    AuthenticateMiddleware,
    RequireLevel(40),
    body('ids').isArray({ min: 1 }).withMessage('IDs array is required'),
    body('ids.*').isUUID().withMessage('All IDs must be valid UUIDs'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const ids = req.body.ids as string[];
    logger?.info('DELETE /api/products/bulk - Delete multiple products', { count: ids.length });
    try {
      const userLevel = req.user?.level;
      
      // For non-super-admin users, validate they have a store assigned
      if (userLevel !== 99 && !req.userModel?.store_id) {
        return res.status(403).json({ error: 'User must have a store assigned to delete products' });
      }
      
      await productUseCase.DeleteProductsBulk(ids);
      logger?.info('Successfully deleted products', { count: ids.length });
      res.status(204).send();
    } catch (error: any) {
      logger?.error('Error deleting products', error, { count: ids.length });
      res.status(400).json({ error: error.message });
    }
  }
);

// GET /api/products/download - Download all products as CSV (with filters)
router.get(
  '/download',
  [
    AuthenticateMiddleware,
    RequireLevel(40),
    query('name').optional().isString().withMessage('Name must be a string'),
    query('sku').optional().isString().withMessage('SKU must be a string'),
    query('store_id').optional().isUUID().withMessage('Invalid store ID format'),
    handleValidationErrors,
  ],
  async (req: Request, res: Response) => {
    const logger = GetLogger();
    const userLevel = req.user?.level;
    const searchName = req.query.name as string | undefined;
    const searchSku = req.query.sku as string | undefined;
    let storeId = req.query.store_id as string | undefined;
    
    logger?.info('GET /api/products/download - Download products as CSV', { searchName, searchSku, storeId, userLevel });
    
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
      
      const products = await productUseCase.GetAllProductsWithFilters(searchName, searchSku, storeId);
      
      // Convert to CSV format
      const headers = ['id', 'name', 'sku', 'category.name', 'category.category_code', 'store.name', 'store.store_code', 'selling_price', 'purchase_price', 'created_at', 'creator.name'];
      const csvData = products.map(prod => {
        const prodJson: any = prod.toJSON ? prod.toJSON() : prod;
        return {
          id: prodJson.id,
          name: prodJson.name,
          sku: prodJson.sku || '',
          'category.name': prodJson.category?.name || '',
          'category.category_code': prodJson.category?.category_code || '',
          'store.name': prodJson.store?.name || '',
          'store.store_code': prodJson.store?.store_code || '',
          selling_price: prodJson.selling_price || '',
          purchase_price: prodJson.purchase_price || '',
          created_at: prodJson.created_at,
          'creator.name': prodJson.creator?.name || '',
        };
      });
      
      const csvContent = convertToCSV(csvData, headers);
      const filename = `products_${new Date().toISOString().split('T')[0]}.csv`;
      sendCSVResponse(res, csvContent, filename);
      logger?.info('Successfully downloaded products', { count: products.length });
    } catch (error: any) {
      logger?.error('Error downloading products', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;

