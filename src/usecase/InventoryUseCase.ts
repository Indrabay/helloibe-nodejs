import { InventoryRepository } from '../repository/InventoryRepository';
import { Inventory, InventoryCreationAttributes } from '../models/Inventory';
import { GetLogger } from '../utils/loggerContext';
import { ProductRepository } from '../repository/ProductRepository';
import { StoreRepository } from '../repository/StoreRepository';
import { User } from '../models';

export class InventoryUseCase {
  private inventoryRepository: InventoryRepository;
  private productRepository: ProductRepository;
  private storeRepository: StoreRepository;

  constructor() {
    this.inventoryRepository = new InventoryRepository();
    this.productRepository = new ProductRepository();
    this.storeRepository = new StoreRepository();
  }

  async GetAllInventoryWithPagination(limit: number, offset: number, productId?: string, status?: string | string[], storeId?: string, productName?: string, sku?: string, categoryId?: number | string, search?: string): Promise<{ inventory: Inventory[]; total: number }> {
    const logger = GetLogger();
    logger?.debug('InventoryUseCase.GetAllInventoryWithPagination - Starting', { limit, offset, productId, status, storeId, productName, sku, categoryId });
    
    // Convert categoryId to number if it's a string
    let categoryIdNum: number | undefined = undefined;
    if (categoryId) {
      categoryIdNum = typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId;
      if (isNaN(categoryIdNum)) {
        throw new Error('Invalid category ID format');
      }
    }
    
    // If storeId is provided, we need to filter products by store
    // We'll add store_id filter to productWhere in the repository
    // For now, we'll pass storeId to repository if needed
    // Note: Since products now have store_id, we can filter directly
    
    const result = await this.inventoryRepository.FindAllWithPagination(limit, offset, productId, status, productName, sku, categoryIdNum, search);
    logger?.debug('InventoryUseCase.GetAllInventoryWithPagination - Completed', { count: result.inventory.length, total: result.total });
    return result;
  }

  async GetInventoryById(id: string): Promise<Inventory> {
    const logger = GetLogger();
    logger?.debug('InventoryUseCase.GetInventoryById - Starting', { id });
    if (!id) {
      logger?.error('InventoryUseCase.GetInventoryById - Inventory ID is required');
      throw new Error('Inventory ID is required');
    }
    const inventory = await this.inventoryRepository.FindById(id);
    if (!inventory) {
      logger?.warn('InventoryUseCase.GetInventoryById - Inventory not found', { id });
      throw new Error('Inventory not found');
    }
    logger?.debug('InventoryUseCase.GetInventoryById - Completed', { id });
    return inventory;
  }

  async CreateInventory(data: InventoryCreationAttributes & { store_id?: string }, userId: string, userLevel?: number): Promise<Inventory> {
    const logger = GetLogger();
    logger?.debug('InventoryUseCase.CreateInventory - Starting', { product_id: data.product_id, quantity: data.quantity, userLevel, store_id: data.store_id });
    
    if (!data.product_id) {
      logger?.error('InventoryUseCase.CreateInventory - Product ID is required');
      throw new Error('Product ID is required');
    }
    if (data.quantity === undefined || data.quantity === null) {
      logger?.error('InventoryUseCase.CreateInventory - Quantity is required');
      throw new Error('Quantity is required');
    }
    
    // Get user's store
    const user = await User.findByPk(userId, {
      include: [{ association: 'store' }, { association: 'role' }],
    });
    
    if (!user) {
      logger?.error('InventoryUseCase.CreateInventory - User not found');
      throw new Error('User not found');
    }
    
    // Determine store_id: super admin (level 99) must provide store_id, others use their assigned store
    let storeId: string | null = null;
    const actualUserLevel = userLevel || (user as any).role?.level;
    
    if (actualUserLevel === 99) {
      // Super admin must provide store_id
      if (!data.store_id) {
        logger?.error('InventoryUseCase.CreateInventory - Store ID is required for super admin');
        throw new Error('Store ID is required for super admin');
      }
      storeId = data.store_id;
    } else {
      // Regular user uses their assigned store
      if (!user.store_id) {
        logger?.error('InventoryUseCase.CreateInventory - User must have a store assigned');
        throw new Error('User must have a store assigned');
      }
      storeId = user.store_id;
    }
    
    // Verify product exists and belongs to the store (check via SKU pattern)
    const product = await this.productRepository.FindById(data.product_id);
    if (!product) {
      logger?.error('InventoryUseCase.CreateInventory - Product not found');
      throw new Error('Product not found');
    }
    
    const store = await this.storeRepository.FindById(storeId);
    if (!store || !store.store_code) {
      logger?.error('InventoryUseCase.CreateInventory - Store not found or store_code is missing');
      throw new Error('Store not found or store_code is missing');
    }
    
    // Verify product belongs to store
    if (product.store_id !== storeId) {
      logger?.error('InventoryUseCase.CreateInventory - Product does not belong to the specified store');
      throw new Error('Product does not belong to the specified store');
    }
    
    // Set status based on expiry_date
    let status: 'active' | 'near_expiry' | 'expired' = 'active';
    if (data.expiry_date) {
      const expiryDate = new Date(data.expiry_date);
      const now = new Date();
      const nearExpiryDays = 7; // Consider near expiry if within 7 days
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < 0) {
        status = 'expired';
      } else if (daysUntilExpiry <= nearExpiryDays) {
        status = 'near_expiry';
      } else {
        status = 'active';
      }
    }
    
    const inventoryData: InventoryCreationAttributes = {
      ...data,
      status,
      created_by: userId,
    };
    
    const inventory = await this.inventoryRepository.Create(inventoryData);
    logger?.info('InventoryUseCase.CreateInventory - Completed', { id: inventory.id });
    return inventory;
  }

  async CreateInventoryBatch(productsData: (InventoryCreationAttributes & { store_id?: string })[], userId: string, userLevel?: number): Promise<Inventory[]> {
    const logger = GetLogger();
    logger?.debug('InventoryUseCase.CreateInventoryBatch - Starting', { count: productsData.length, userLevel });
    
    // Get user's store
    const user = await User.findByPk(userId, {
      include: [{ association: 'store' }, { association: 'role' }],
    });
    
    if (!user) {
      logger?.error('InventoryUseCase.CreateInventoryBatch - User not found');
      throw new Error('User not found');
    }
    
    // Determine default store_id: super admin (level 99) must provide store_id in each inventory, others use their assigned store
    const actualUserLevel = userLevel || (user as any).role?.level;
    let defaultStoreId: string | null = null;
    
    if (actualUserLevel === 99) {
      // Super admin must provide store_id for each inventory (will be checked in the loop)
      logger?.debug('InventoryUseCase.CreateInventoryBatch - Super admin mode, store_id required per inventory');
    } else {
      // Regular user uses their assigned store
      if (!user.store_id) {
        logger?.error('InventoryUseCase.CreateInventoryBatch - User must have a store assigned');
        throw new Error('User must have a store assigned');
      }
      defaultStoreId = user.store_id;
    }
    
    // Get default store for validation (if not super admin)
    let defaultStore = null;
    if (defaultStoreId) {
      defaultStore = await this.storeRepository.FindById(defaultStoreId);
      if (!defaultStore || !defaultStore.store_code) {
        logger?.error('InventoryUseCase.CreateInventoryBatch - Store code is required');
        throw new Error('Store code is required');
      }
    }
    
    const inventoryToCreate: InventoryCreationAttributes[] = [];
    
    for (const data of productsData) {
      if (!data.product_id) {
        throw new Error('Product ID is required');
      }
      if (data.quantity === undefined || data.quantity === null) {
        throw new Error('Quantity is required');
      }
      
      // Determine store_id for this inventory
      let inventoryStoreId: string | null = null;
      if (actualUserLevel === 99) {
        // Super admin must provide store_id
        if (!data.store_id) {
          throw new Error(`Store ID is required for inventory with product: ${data.product_id}`);
        }
        inventoryStoreId = data.store_id;
      } else {
        // Regular user uses their assigned store
        inventoryStoreId = defaultStoreId;
      }
      
      // Get store for this inventory
      const inventoryStore = actualUserLevel === 99 
        ? await this.storeRepository.FindById(inventoryStoreId!)
        : defaultStore;
      
      if (!inventoryStore) {
        throw new Error(`Store not found for inventory with product: ${data.product_id}`);
      }
      if (!inventoryStore.store_code) {
        throw new Error(`Store "${inventoryStore.name}" does not have a store_code. Please set store_code for this store.`);
      }
      
      // Verify product exists and belongs to the store
      const product = await this.productRepository.FindById(data.product_id);
      if (!product) {
        throw new Error(`Product not found: ${data.product_id}`);
      }
      
      // Verify product belongs to store
      if (product.store_id !== inventoryStoreId) {
        throw new Error(`Product ${product.name} does not belong to store ${inventoryStore.name}`);
      }
      
      // Set status based on expiry_date
      let status: 'active' | 'near_expiry' | 'expired' = 'active';
      if (data.expiry_date) {
        const expiryDate = new Date(data.expiry_date);
        const now = new Date();
        const nearExpiryDays = 7; // Consider near expiry if within 7 days
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) {
          status = 'expired';
        } else if (daysUntilExpiry <= nearExpiryDays) {
          status = 'near_expiry';
        } else {
          status = 'active';
        }
      }
      
      inventoryToCreate.push({
        ...data,
        status,
        created_by: userId,
      });
    }
    
    const inventory = await this.inventoryRepository.CreateBatch(inventoryToCreate);
    logger?.info('InventoryUseCase.CreateInventoryBatch - Completed', { count: inventory.length });
    return inventory;
  }
}

