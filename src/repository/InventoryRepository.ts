import { Inventory, InventoryAttributes, InventoryCreationAttributes } from '../models/Inventory';
import { GetLogger } from '../utils/loggerContext';
import { Op } from 'sequelize';

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
}

