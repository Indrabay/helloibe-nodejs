import { Category, CategoryAttributes, CategoryCreationAttributes } from '../models/Category';
import { GetLogger } from '../utils/loggerContext';

export class CategoryRepository {
  async FindAll(): Promise<Category[]> {
    const logger = GetLogger();
    logger?.debug('CategoryRepository.FindAll - Executing query');
    const categories = await Category.findAll({
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('CategoryRepository.FindAll - Query completed', { count: categories.length });
    return categories;
  }

  async FindAllWithPagination(limit: number, offset: number): Promise<{ categories: Category[]; total: number }> {
    const logger = GetLogger();
    logger?.debug('CategoryRepository.FindAllWithPagination - Executing query', { limit, offset });
    const { count, rows } = await Category.findAndCountAll({
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('CategoryRepository.FindAllWithPagination - Query completed', { count, returned: rows.length });
    return { categories: rows, total: count };
  }

  async FindById(id: number): Promise<Category | null> {
    const logger = GetLogger();
    logger?.debug('CategoryRepository.FindById - Executing query', { id });
    const category = await Category.findByPk(id, {
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('CategoryRepository.FindById - Query completed', { id, found: !!category });
    return category;
  }

  async FindByCategoryCode(categoryCode: string): Promise<Category | null> {
    const logger = GetLogger();
    logger?.debug('CategoryRepository.FindByCategoryCode - Executing query', { categoryCode });
    const category = await Category.findOne({
      where: { category_code: categoryCode },
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('CategoryRepository.FindByCategoryCode - Query completed', { categoryCode, found: !!category });
    return category;
  }

  async Create(data: CategoryCreationAttributes): Promise<Category> {
    const logger = GetLogger();
    logger?.debug('CategoryRepository.Create - Executing query', { name: data.name });
    const category = await Category.create(data);
    // Reload with associations
    await category.reload({
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.info('CategoryRepository.Create - Query completed', { id: category.id });
    return category;
  }

  async Update(id: number, data: Partial<CategoryAttributes>): Promise<[number, Category[]]> {
    const logger = GetLogger();
    logger?.debug('CategoryRepository.Update - Executing query', { id });
    const affectedCount = await Category.update(data, {
      where: { id },
    });
    
    // Fetch the updated category after update (MySQL doesn't support returning)
    let updatedCategory: Category | null = null;
    if (affectedCount[0] > 0) {
      updatedCategory = await Category.findByPk(id, {
        include: [
          { association: 'creator', attributes: ['id', 'name', 'email'] },
          { association: 'updater', attributes: ['id', 'name', 'email'] },
        ],
      });
    }
    
    logger?.info('CategoryRepository.Update - Query completed', { id, affectedRows: affectedCount[0] });
    return [affectedCount[0], updatedCategory ? [updatedCategory] : []];
  }

  async Delete(id: number): Promise<number> {
    const logger = GetLogger();
    logger?.debug('CategoryRepository.Delete - Executing query', { id });
    const deletedCount = await Category.destroy({
      where: { id },
    });
    logger?.info('CategoryRepository.Delete - Query completed', { id, deletedCount });
    return deletedCount;
  }
}

