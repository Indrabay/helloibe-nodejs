import { Inventory, InventoryAttributes, InventoryCreationAttributes } from '../models/Inventory';
import { GetLogger } from '../utils/loggerContext';
import { Op } from 'sequelize';
import { Sequelize, QueryTypes } from 'sequelize';
import { sequelize } from '../models';

export class InventoryRepository {
  async FindAllWithPagination(limit: number, offset: number, productId?: string, status?: string | string[], productName?: string, sku?: string, categoryId?: number, search?: string): Promise<{ inventory: Inventory[]; total: number }> {
    const logger = GetLogger();
    logger?.debug('InventoryRepository.FindAllWithPagination - Executing query', { limit, offset, productId, status, productName, sku, categoryId, search });
    
    let where: any = {};
    if (productId) {
      where.product_id = productId;
    }
    if (status) {
      if (Array.isArray(status) && status.length > 0) {
        where.status = {
          [Op.in]: status,
        };
      } else if (typeof status === 'string') {
        where.status = status;
      }
    }
    
    // Build product filter conditions
    let productWhere: any = {};
    if (productName) {
      productWhere.name = {
        [Op.like]: `%${productName}%`,
      };
    }
    if (sku) {
      productWhere.sku = sku;
    }
    if (categoryId) {
      productWhere.category_id = categoryId;
    }
    
    // If search is provided, add OR conditions for product name (LIKE), SKU (exact), or category name (LIKE)
    // We need to include category to search by category name
    const needsCategoryInclude = !!search;
    
    if (search) {
      // Build OR conditions for product (name LIKE or SKU exact)
      const searchConditions: any[] = [
        { name: { [Op.like]: `%${search}%` } }, // Product name LIKE
        { sku: search }, // SKU exact match
      ];
      
      // If there are existing product filters, combine them
      if (Object.keys(productWhere).length > 0) {
        // Wrap existing conditions with OR search
        const existingConditions = { ...productWhere };
        productWhere = {
          [Op.and]: [
            existingConditions,
            { [Op.or]: searchConditions },
          ],
        };
      } else {
        productWhere = {
          [Op.or]: searchConditions,
        };
      }
      
      // Add category name search to the main where clause using nested column reference
      // This allows us to search across product and category in one OR condition
      const searchOrConditions: any[] = [
        { '$product.name$': { [Op.like]: `%${search}%` } },
        { '$product.sku$': search },
        { '$product.category.name$': { [Op.like]: `%${search}%` } },
      ];
      
      // Combine with existing where conditions
      if (Object.keys(where).length > 0) {
        const existingWhere = { ...where };
        where = {
          [Op.and]: [
            existingWhere,
            { [Op.or]: searchOrConditions },
          ],
        };
      } else {
        where = {
          [Op.or]: searchOrConditions,
        };
      }
    }
    
    // Build includes array
    const includes: any[] = [
      { 
        association: 'product', 
        attributes: ['id', 'name', 'sku', 'category_id', 'selling_price'],
        where: Object.keys(productWhere).length > 0 ? productWhere : undefined,
        required: Object.keys(productWhere).length > 0 || needsCategoryInclude, // Use INNER JOIN if filtering by product or searching
        ...(needsCategoryInclude ? {
          include: [
            {
              association: 'category',
              attributes: ['id', 'name', 'category_code'],
              required: false, // LEFT JOIN for category to allow searching by category name
            },
          ],
        } : {}),
      },
      { association: 'creator', attributes: ['id', 'name', 'email'] },
    ];
    
    const { count, rows } = await Inventory.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: includes,
      distinct: true, // Important when using JOINs with count to avoid duplicate counting
    });
    logger?.debug('InventoryRepository.FindAllWithPagination - Query completed', { count, returned: rows.length });
    return { inventory: rows, total: count };
  }

  async FindById(id: string): Promise<Inventory | null> {
    const logger = GetLogger();
    logger?.debug('InventoryRepository.FindById - Executing query', { id });
    const inventory = await Inventory.findByPk(id, {
      include: [
        { association: 'product', attributes: ['id', 'name', 'sku', 'selling_price'] },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('InventoryRepository.FindById - Query completed', { id, found: !!inventory });
    return inventory;
  }

  async Create(data: InventoryCreationAttributes): Promise<Inventory> {
    const logger = GetLogger();
    logger?.debug('InventoryRepository.Create - Executing query', { product_id: data.product_id, quantity: data.quantity });
    const inventory = await Inventory.create(data);
    await inventory.reload({
      include: [
        { association: 'product', attributes: ['id', 'name', 'sku', 'selling_price'] },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.info('InventoryRepository.Create - Query completed', { id: inventory.id });
    return inventory;
  }

  async CreateBatch(data: InventoryCreationAttributes[]): Promise<Inventory[]> {
    const logger = GetLogger();
    logger?.debug('InventoryRepository.CreateBatch - Executing batch create', { count: data.length });
    const inventory = await Inventory.bulkCreate(data, { returning: true });
    // Reload each inventory to include associations
    const reloadedInventory = await Promise.all(inventory.map(i => i.reload({
      include: [
        { association: 'product', attributes: ['id', 'name', 'sku', 'selling_price'] },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    })));
    logger?.info('InventoryRepository.CreateBatch - Batch create completed', { count: inventory.length });
    return reloadedInventory;
  }

  async GetTotalInventoryQuantity(productId: string): Promise<number> {
    const logger = GetLogger();
    logger?.debug('InventoryRepository.GetTotalInventoryQuantity - Executing query', { productId });
    
    const result = await sequelize.query(
      `SELECT COALESCE(SUM(quantity), 0) as total_quantity 
       FROM inventories 
       WHERE product_id = :productId 
       AND status IN ('active', 'near_expiry')`,
      {
        replacements: { productId },
        type: QueryTypes.SELECT,
      }
    ) as any[];
    
    const totalQuantity = result[0]?.total_quantity || 0;
    logger?.debug('InventoryRepository.GetTotalInventoryQuantity - Query completed', { productId, totalQuantity });
    return parseFloat(totalQuantity.toString());
  }

  async FindByProductIdOrderedByExpiry(productId: string): Promise<Inventory[]> {
    const logger = GetLogger();
    logger?.debug('InventoryRepository.FindByProductIdOrderedByExpiry - Executing query', { productId });
    
    const inventories = await Inventory.findAll({
      where: {
        product_id: productId,
        status: {
          [Op.in]: ['active', 'near_expiry'],
        },
      },
      order: [
        ['expiry_date', 'ASC NULLS LAST'], // Order by expiry_date ascending (FIFO), nulls last
        ['created_at', 'ASC'], // Secondary sort by created_at
      ],
    });
    
    logger?.debug('InventoryRepository.FindByProductIdOrderedByExpiry - Query completed', { productId, count: inventories.length });
    return inventories;
  }

  async ReduceInventoryQuantity(productId: string, quantityToReduce: number): Promise<void> {
    const logger = GetLogger();
    logger?.debug('InventoryRepository.ReduceInventoryQuantity - Starting', { productId, quantityToReduce });
    
    // Get available inventory items ordered by expiry (FIFO)
    const inventories = await this.FindByProductIdOrderedByExpiry(productId);
    
    if (inventories.length === 0) {
      logger?.error('InventoryRepository.ReduceInventoryQuantity - No inventory found', { productId });
      throw new Error(`No inventory found for product ${productId}`);
    }
    
    let remainingQuantity = quantityToReduce;
    
    for (const inventory of inventories) {
      if (remainingQuantity <= 0) {
        break;
      }
      
      const currentQuantity = parseFloat(inventory.quantity.toString());
      
      if (currentQuantity <= remainingQuantity) {
        // This inventory item will be fully consumed
        await Inventory.destroy({
          where: { id: inventory.id },
        });
        remainingQuantity -= currentQuantity;
        logger?.debug('InventoryRepository.ReduceInventoryQuantity - Deleted inventory item', { 
          inventoryId: inventory.id, 
          quantity: currentQuantity 
        });
      } else {
        // Partially reduce this inventory item
        const newQuantity = currentQuantity - remainingQuantity;
        await Inventory.update(
          { quantity: newQuantity },
          { where: { id: inventory.id } }
        );
        logger?.debug('InventoryRepository.ReduceInventoryQuantity - Updated inventory item', { 
          inventoryId: inventory.id, 
          oldQuantity: currentQuantity,
          newQuantity,
          reduced: remainingQuantity
        });
        remainingQuantity = 0;
      }
    }
    
    if (remainingQuantity > 0) {
      logger?.error('InventoryRepository.ReduceInventoryQuantity - Insufficient inventory', { 
        productId, 
        requested: quantityToReduce,
        available: quantityToReduce - remainingQuantity,
        missing: remainingQuantity
      });
      throw new Error(`Insufficient inventory. Requested: ${quantityToReduce}, Available: ${quantityToReduce - remainingQuantity}, Missing: ${remainingQuantity}`);
    }
    
    logger?.info('InventoryRepository.ReduceInventoryQuantity - Completed', { productId, quantityReduced: quantityToReduce });
  }
}

