import { ProductRepository } from '../repository/ProductRepository';
import { CategoryRepository } from '../repository/CategoryRepository';
import { StoreRepository } from '../repository/StoreRepository';
import { Product, ProductCreationAttributes, ProductAttributes } from '../models/Product';
import { GetLogger } from '../utils/loggerContext';
import { User } from '../models';

export class ProductUseCase {
  private productRepository: ProductRepository;
  private categoryRepository: CategoryRepository;
  private storeRepository: StoreRepository;

  constructor() {
    this.productRepository = new ProductRepository();
    this.categoryRepository = new CategoryRepository();
    this.storeRepository = new StoreRepository();
  }

  /**
   * Generate SKU: store_code-category_code-timestamp (yyyymmddHHss)
   */
  private async generateSku(storeCode: string, categoryCode: string): Promise<string> {
    const logger = GetLogger();
    logger?.debug('ProductUseCase.generateSku - Starting', { storeCode, categoryCode });
    
    // Generate timestamp in format: yyyymmddHHss
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    // Format: yyyymmddHHss
    const timestamp = `${year}${month}${day}${hours}${seconds}`;
    const sku = `${storeCode}-${categoryCode}-${timestamp}`;
    
    logger?.debug('ProductUseCase.generateSku - Completed', { sku, timestamp });
    return sku;
  }

  async GetAllProducts(): Promise<Product[]> {
    const logger = GetLogger();
    logger?.debug('ProductUseCase.GetAllProducts - Starting');
    const products = await this.productRepository.FindAll();
    logger?.debug('ProductUseCase.GetAllProducts - Completed', { count: products.length });
    return products;
  }

  async GetAllProductsWithPagination(limit: number, offset: number, searchName?: string, searchSku?: string, storeId?: string): Promise<{ products: Product[]; total: number }> {
    const logger = GetLogger();
    logger?.debug('ProductUseCase.GetAllProductsWithPagination - Starting', { limit, offset, searchName, searchSku, storeId });
    
    // If storeId is provided, get store_code
    let storeCode: string | undefined = undefined;
    if (storeId) {
      const store = await this.storeRepository.FindById(storeId);
      if (!store) {
        throw new Error('Store not found');
      }
      if (!store.store_code) {
        throw new Error(`Store "${store.name}" does not have a store_code`);
      }
      storeCode = store.store_code;
    }
    
    const result = await this.productRepository.FindAllWithPagination(limit, offset, searchName, searchSku, storeCode);
    logger?.debug('ProductUseCase.GetAllProductsWithPagination - Completed', { count: result.products.length, total: result.total });
    return result;
  }

  async GetProductById(id: string): Promise<Product | null> {
    const logger = GetLogger();
    logger?.debug('ProductUseCase.GetProductById - Starting', { id });
    if (!id) {
      logger?.error('ProductUseCase.GetProductById - Product ID is required');
      throw new Error('Product ID is required');
    }
    const product = await this.productRepository.FindById(id);
    if (!product) {
      logger?.warn('ProductUseCase.GetProductById - Product not found', { id });
      throw new Error('Product not found');
    }
    logger?.debug('ProductUseCase.GetProductById - Completed', { id });
    return product;
  }

  async CreateProduct(data: ProductCreationAttributes & { store_id?: string }, userId: string, userLevel?: number): Promise<Product> {
    const logger = GetLogger();
    logger?.debug('ProductUseCase.CreateProduct - Starting', { name: data.name, userLevel, store_id: data.store_id });
    
    if (!data.name) {
      logger?.error('ProductUseCase.CreateProduct - Product name is required');
      throw new Error('Product name is required');
    }
    if (!data.category_id) {
      logger?.error('ProductUseCase.CreateProduct - Category ID is required');
      throw new Error('Category ID is required');
    }
    if (!data.selling_price) {
      logger?.error('ProductUseCase.CreateProduct - Selling price is required');
      throw new Error('Selling price is required');
    }
    if (!data.purchase_price) {
      logger?.error('ProductUseCase.CreateProduct - Purchase price is required');
      throw new Error('Purchase price is required');
    }
    
    // Get user's store
    const user = await User.findByPk(userId, {
      include: [{ association: 'store' }, { association: 'role' }],
    });
    
    if (!user) {
      logger?.error('ProductUseCase.CreateProduct - User not found');
      throw new Error('User not found');
    }
    
    // Determine store_id: super admin (level 99) must provide store_id, others use their assigned store
    let storeId: string | null = null;
    const actualUserLevel = userLevel || (user as any).role?.level;
    
    if (actualUserLevel === 99) {
      // Super admin must provide store_id
      if (!data.store_id) {
        logger?.error('ProductUseCase.CreateProduct - Store ID is required for super admin');
        throw new Error('Store ID is required for super admin');
      }
      storeId = data.store_id;
    } else {
      // Regular user uses their assigned store
      if (!user.store_id) {
        logger?.error('ProductUseCase.CreateProduct - User must have a store assigned');
        throw new Error('User must have a store assigned');
      }
      storeId = user.store_id;
    }
    
    const store = await this.storeRepository.FindById(storeId);
    if (!store) {
      logger?.error('ProductUseCase.CreateProduct - Store not found', { storeId });
      throw new Error('Store not found');
    }
    if (!store.store_code) {
      logger?.error('ProductUseCase.CreateProduct - Store code is required', { storeId, storeName: store.name });
      throw new Error(`Store "${store.name}" does not have a store_code. Please set store_code for this store.`);
    }
    
    // Get category
    const category = await this.categoryRepository.FindById(data.category_id);
    if (!category) {
      logger?.error('ProductUseCase.CreateProduct - Category not found');
      throw new Error('Category not found');
    }
    
    // Generate SKU if not provided
    let sku = data.sku;
    if (!sku) {
      sku = await this.generateSku(store.store_code, category.category_code);
    } else {
      // Check if SKU already exists
      const existingProduct = await this.productRepository.FindBySku(sku);
      if (existingProduct) {
        logger?.error('ProductUseCase.CreateProduct - SKU already exists', { sku });
        throw new Error('SKU already exists');
      }
    }
    
    const productData: ProductCreationAttributes = {
      ...data,
      sku,
      created_by: userId,
      updated_by: userId,
    };
    
    const product = await this.productRepository.Create(productData);
    logger?.info('ProductUseCase.CreateProduct - Completed', { id: product.id, name: product.name, sku: product.sku });
    return product;
  }

  async CreateProductsBatch(productsData: (ProductCreationAttributes & { store_id?: string })[], userId: string, userLevel?: number): Promise<Product[]> {
    const logger = GetLogger();
    logger?.debug('ProductUseCase.CreateProductsBatch - Starting', { count: productsData.length, userLevel });
    
    // Get user's store
    const user = await User.findByPk(userId, {
      include: [{ association: 'store' }, { association: 'role' }],
    });
    
    if (!user) {
      logger?.error('ProductUseCase.CreateProductsBatch - User not found');
      throw new Error('User not found');
    }
    
    // Determine default store_id: super admin (level 99) must provide store_id in each product, others use their assigned store
    const actualUserLevel = userLevel || (user as any).role?.level;
    let defaultStoreId: string | null = null;
    
    if (actualUserLevel === 99) {
      // Super admin must provide store_id for each product (will be checked in the loop)
      logger?.debug('ProductUseCase.CreateProductsBatch - Super admin mode, store_id required per product');
    } else {
      // Regular user uses their assigned store
      if (!user.store_id) {
        logger?.error('ProductUseCase.CreateProductsBatch - User must have a store assigned');
        throw new Error('User must have a store assigned');
      }
      defaultStoreId = user.store_id;
    }
    
    // Get default store for validation (if not super admin)
    let defaultStore = null;
    if (defaultStoreId) {
      defaultStore = await this.storeRepository.FindById(defaultStoreId);
      if (!defaultStore || !defaultStore.store_code) {
        logger?.error('ProductUseCase.CreateProductsBatch - Store code is required');
        throw new Error('Store code is required');
      }
    }
    
    const products: ProductCreationAttributes[] = [];
    
    for (const data of productsData) {
      if (!data.name) {
        throw new Error('Product name is required');
      }
      if (!data.category_id) {
        throw new Error('Category ID is required');
      }
      if (!data.selling_price) {
        throw new Error('Selling price is required');
      }
      if (!data.purchase_price) {
        throw new Error('Purchase price is required');
      }
      
      // Get category - category_id should already be a number from the route handler
      const categoryId = typeof data.category_id === 'string' ? parseInt(data.category_id, 10) : data.category_id;
      if (!categoryId || isNaN(categoryId)) {
        throw new Error(`Invalid category ID for product: ${data.name}`);
      }
      
      // Determine store_id for this product
      let productStoreId: string | null = null;
      if (actualUserLevel === 99) {
        // Super admin must provide store_id
        if (!data.store_id) {
          throw new Error(`Store ID is required for product: ${data.name}`);
        }
        productStoreId = data.store_id;
      } else {
        // Regular user uses their assigned store
        productStoreId = defaultStoreId;
      }
      
      // Get store for this product
      const productStore = actualUserLevel === 99 
        ? await this.storeRepository.FindById(productStoreId!)
        : defaultStore;
      
      if (!productStore) {
        throw new Error(`Store not found for product: ${data.name}`);
      }
      if (!productStore.store_code) {
        throw new Error(`Store "${productStore.name}" does not have a store_code. Please set store_code for this store.`);
      }
      
      const category = await this.categoryRepository.FindById(categoryId);
      if (!category) {
        throw new Error(`Category not found for product: ${data.name}`);
      }
      
      // Generate SKU if not provided
      let sku = data.sku;
      if (!sku) {
        sku = await this.generateSku(productStore.store_code, category.category_code);
      } else {
        // Check if SKU already exists
        const existingProduct = await this.productRepository.FindBySku(sku);
        if (existingProduct) {
          throw new Error(`SKU already exists: ${sku}`);
        }
      }
      
      products.push({
        ...data,
        category_id: categoryId,
        sku,
        created_by: userId,
        updated_by: userId,
      });
    }
    
    const createdProducts = await this.productRepository.CreateMany(products);
    logger?.info('ProductUseCase.CreateProductsBatch - Completed', { count: createdProducts.length });
    return createdProducts;
  }

  async UpdateProduct(id: string, data: Partial<ProductAttributes>, userId: string): Promise<Product> {
    const logger = GetLogger();
    logger?.debug('ProductUseCase.UpdateProduct - Starting', { id });
    if (!id) {
      logger?.error('ProductUseCase.UpdateProduct - Product ID is required');
      throw new Error('Product ID is required');
    }
    
    const updateData = {
      ...data,
      updated_by: userId,
    };
    
    const [affectedCount, updatedProducts] = await this.productRepository.Update(id, updateData);
    if (affectedCount === 0 || !updatedProducts[0]) {
      logger?.warn('ProductUseCase.UpdateProduct - Product not found', { id });
      throw new Error('Product not found');
    }
    logger?.info('ProductUseCase.UpdateProduct - Completed', { id });
    return updatedProducts[0];
  }

  async DeleteProduct(id: string): Promise<void> {
    const logger = GetLogger();
    logger?.debug('ProductUseCase.DeleteProduct - Starting', { id });
    if (!id) {
      logger?.error('ProductUseCase.DeleteProduct - Product ID is required');
      throw new Error('Product ID is required');
    }
    const deletedCount = await this.productRepository.Delete(id);
    if (deletedCount === 0) {
      logger?.warn('ProductUseCase.DeleteProduct - Product not found', { id });
      throw new Error('Product not found');
    }
    logger?.info('ProductUseCase.DeleteProduct - Completed', { id });
  }

  async DeleteProductsBulk(ids: string[]): Promise<void> {
    const logger = GetLogger();
    logger?.debug('ProductUseCase.DeleteProductsBulk - Starting', { count: ids.length });
    if (!ids || ids.length === 0) {
      logger?.error('ProductUseCase.DeleteProductsBulk - Product IDs are required');
      throw new Error('Product IDs are required');
    }
    const deletedCount = await this.productRepository.DeleteMany(ids);
    if (deletedCount === 0) {
      logger?.warn('ProductUseCase.DeleteProductsBulk - No products deleted');
      throw new Error('No products deleted');
    }
    logger?.info('ProductUseCase.DeleteProductsBulk - Completed', { deletedCount });
  }
}

