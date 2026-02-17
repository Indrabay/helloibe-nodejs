import { Product, ProductAttributes, ProductCreationAttributes } from '../models/Product';
import { GetLogger } from '../utils/loggerContext';
import { Op } from 'sequelize';

export class ProductRepository {
  async FindAll(): Promise<Product[]> {
    const logger = GetLogger();
    logger?.debug('ProductRepository.FindAll - Executing query');
    const products = await Product.findAll({
      include: [
        { association: 'category', attributes: ['id', 'name', 'category_code'] },
        { association: 'store', attributes: ['id', 'name', 'store_code'] },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('ProductRepository.FindAll - Query completed', { count: products.length });
    return products;
  }

  async FindAllWithFilters(searchName?: string, searchSku?: string, storeId?: string): Promise<Product[]> {
    const logger = GetLogger();
    logger?.debug('ProductRepository.FindAllWithFilters - Executing query', { searchName, searchSku, storeId });
    
    // Build where clause for search
    const where: any = {};
    if (searchName) {
      where.name = {
        [Op.like]: `%${searchName}%`,
      };
    }
    if (searchSku) {
      where.sku = searchSku;
    }
    if (storeId) {
      where.store_id = storeId;
    }
    
    const products = await Product.findAll({
      where,
      order: [['created_at', 'DESC']],
      include: [
        { association: 'category', attributes: ['id', 'name', 'category_code'] },
        { association: 'store', attributes: ['id', 'name', 'store_code'] },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('ProductRepository.FindAllWithFilters - Query completed', { count: products.length });
    return products;
  }

  async FindAllWithPagination(limit: number, offset: number, searchName?: string, searchSku?: string, storeCode?: string): Promise<{ products: Product[]; total: number }> {
    const logger = GetLogger();
    logger?.debug('ProductRepository.FindAllWithPagination - Executing query', { limit, offset, searchName, searchSku, storeCode, status });
    
    // Build where clause for search
    const where: any = {};
    if (searchName) {
      where.name = {
        [Op.like]: `%${searchName}%`,
      };
    }
    if (searchSku) {
      where.sku = searchSku;
    } else if (storeCode) {
      // Filter by store_code pattern in SKU (SKU format: store_code-category_code-sequence)
      where.sku = {
        [Op.like]: `${storeCode}-%`,
      };
    }
    
    // Build include array
    const include: any[] = [
      { association: 'category', attributes: ['id', 'name', 'category_code'] },
      { association: 'store', attributes: ['id', 'name', 'store_code'] },
      { association: 'creator', attributes: ['id', 'name', 'email'] },
      { association: 'updater', attributes: ['id', 'name', 'email'] },
    ];
    
    // If status is provided, filter products that have inventory with that status
    if (status) {
      const inventoryWhere: any = {};
      if (Array.isArray(status) && status.length > 0) {
        inventoryWhere.status = {
          [Op.in]: status,
        };
      } else if (typeof status === 'string') {
        inventoryWhere.status = status;
      }
      
      include.push({
        association: 'inventory',
        attributes: ['id', 'status'],
        where: inventoryWhere,
        required: true, // INNER JOIN - only products with inventory matching the status
      });
    }
    
    const { count, rows } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include,
      distinct: true, // Important when using includes to avoid duplicate counts
    });
    logger?.debug('ProductRepository.FindAllWithPagination - Query completed', { count, returned: rows.length });
    return { products: rows, total: count };
  }

  async FindById(id: string): Promise<Product | null> {
    const logger = GetLogger();
    logger?.debug('ProductRepository.FindById - Executing query', { id });
    const product = await Product.findByPk(id, {
      include: [
        { association: 'category', attributes: ['id', 'name', 'category_code'] },
        { association: 'store', attributes: ['id', 'name', 'store_code'] },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('ProductRepository.FindById - Query completed', { id, found: !!product });
    return product;
  }

  async FindBySku(sku: string): Promise<Product | null> {
    const logger = GetLogger();
    logger?.debug('ProductRepository.FindBySku - Executing query', { sku });
    const product = await Product.findOne({
      where: { sku },
      include: [
        { association: 'category', attributes: ['id', 'name', 'category_code'] },
        { association: 'store', attributes: ['id', 'name', 'store_code'] },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('ProductRepository.FindBySku - Query completed', { sku, found: !!product });
    return product;
  }

  async FindByCategoryAndStore(categoryId: number | string, storeCode: string): Promise<Product[]> {
    const logger = GetLogger();
    logger?.debug('ProductRepository.FindByCategoryAndStore - Executing query', { categoryId, storeCode });
    // Find products where SKU starts with storeCode-categoryCode pattern
    const categoryIdNum = typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId;
    const products = await Product.findAll({
      where: {
        category_id: categoryIdNum,
        sku: {
          [Op.like]: `${storeCode}-%`,
        },
      },
      order: [['sku', 'DESC']],
    });
    logger?.debug('ProductRepository.FindByCategoryAndStore - Query completed', { count: products.length });
    return products;
  }

  async Create(data: ProductCreationAttributes): Promise<Product> {
    const logger = GetLogger();
    logger?.debug('ProductRepository.Create - Executing query', { name: data.name, sku: data.sku });
    const product = await Product.create(data);
    // Reload with associations
    await product.reload({
      include: [
        { association: 'category', attributes: ['id', 'name', 'category_code'] },
        { association: 'store', attributes: ['id', 'name', 'store_code'] },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.info('ProductRepository.Create - Query completed', { id: product.id });
    return product;
  }

  async CreateMany(data: ProductCreationAttributes[]): Promise<Product[]> {
    const logger = GetLogger();
    logger?.debug('ProductRepository.CreateMany - Executing query', { count: data.length });
    const products = await Product.bulkCreate(data, { returning: true });
    logger?.info('ProductRepository.CreateMany - Query completed', { count: products.length });
    return products;
  }

  async Update(id: string, data: Partial<ProductAttributes>): Promise<[number, Product[]]> {
    const logger = GetLogger();
    logger?.debug('ProductRepository.Update - Executing query', { id });
    const affectedCount = await Product.update(data, {
      where: { id },
    });
    
    // Fetch the updated product after update (MySQL doesn't support returning)
    let updatedProduct: Product | null = null;
    if (affectedCount[0] > 0) {
      updatedProduct = await Product.findByPk(id, {
        include: [
          { association: 'category' },
          { association: 'creator', attributes: ['id', 'name', 'email'] },
          { association: 'updater', attributes: ['id', 'name', 'email'] },
        ],
      });
    }
    
    logger?.info('ProductRepository.Update - Query completed', { id, affectedRows: affectedCount[0] });
    return [affectedCount[0], updatedProduct ? [updatedProduct] : []];
  }

  async Delete(id: string): Promise<number> {
    const logger = GetLogger();
    logger?.debug('ProductRepository.Delete - Executing query', { id });
    const deletedCount = await Product.destroy({
      where: { id },
    });
    logger?.info('ProductRepository.Delete - Query completed', { id, deletedCount });
    return deletedCount;
  }

  async DeleteMany(ids: string[]): Promise<number> {
    const logger = GetLogger();
    logger?.debug('ProductRepository.DeleteMany - Executing query', { count: ids.length });
    const deletedCount = await Product.destroy({
      where: {
        id: {
          [Op.in]: ids,
        },
      },
    });
    logger?.info('ProductRepository.DeleteMany - Query completed', { deletedCount });
    return deletedCount;
  }
}

