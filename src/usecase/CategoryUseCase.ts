import { CategoryRepository } from '../repository/CategoryRepository';
import { Category, CategoryCreationAttributes, CategoryAttributes } from '../models/Category';
import { GetLogger } from '../utils/loggerContext';

export class CategoryUseCase {
  private categoryRepository: CategoryRepository;

  constructor() {
    this.categoryRepository = new CategoryRepository();
  }

  async GetAllCategories(): Promise<Category[]> {
    const logger = GetLogger();
    logger?.debug('CategoryUseCase.GetAllCategories - Starting');
    const categories = await this.categoryRepository.FindAll();
    logger?.debug('CategoryUseCase.GetAllCategories - Completed', { count: categories.length });
    return categories;
  }

  async GetAllCategoriesWithPagination(limit: number, offset: number): Promise<{ categories: Category[]; total: number }> {
    const logger = GetLogger();
    logger?.debug('CategoryUseCase.GetAllCategoriesWithPagination - Starting', { limit, offset });
    const result = await this.categoryRepository.FindAllWithPagination(limit, offset);
    logger?.debug('CategoryUseCase.GetAllCategoriesWithPagination - Completed', { count: result.categories.length, total: result.total });
    return result;
  }

  async GetCategoryById(id: number | string): Promise<Category | null> {
    const logger = GetLogger();
    logger?.debug('CategoryUseCase.GetCategoryById - Starting', { id });
    const categoryId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (!categoryId || isNaN(categoryId)) {
      logger?.error('CategoryUseCase.GetCategoryById - Category ID is required');
      throw new Error('Category ID is required');
    }
    const category = await this.categoryRepository.FindById(categoryId);
    if (!category) {
      logger?.warn('CategoryUseCase.GetCategoryById - Category not found', { id });
      throw new Error('Category not found');
    }
    logger?.debug('CategoryUseCase.GetCategoryById - Completed', { id });
    return category;
  }

  async CreateCategory(data: CategoryCreationAttributes): Promise<Category> {
    const logger = GetLogger();
    logger?.debug('CategoryUseCase.CreateCategory - Starting', { name: data.name });
    if (!data.name) {
      logger?.error('CategoryUseCase.CreateCategory - Category name is required');
      throw new Error('Category name is required');
    }
    if (!data.category_code) {
      logger?.error('CategoryUseCase.CreateCategory - Category code is required');
      throw new Error('Category code is required');
    }
    
    // Check if category_code already exists
    const existingCategory = await this.categoryRepository.FindByCategoryCode(data.category_code);
    if (existingCategory) {
      logger?.error('CategoryUseCase.CreateCategory - Category code already exists', { category_code: data.category_code });
      throw new Error('Category code already exists');
    }
    
    const category = await this.categoryRepository.Create(data);
    logger?.info('CategoryUseCase.CreateCategory - Completed', { id: category.id, name: category.name });
    return category;
  }

  async UpdateCategory(id: number | string, data: Partial<CategoryAttributes>): Promise<Category> {
    const logger = GetLogger();
    logger?.debug('CategoryUseCase.UpdateCategory - Starting', { id });
    const categoryId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (!categoryId || isNaN(categoryId)) {
      logger?.error('CategoryUseCase.UpdateCategory - Category ID is required');
      throw new Error('Category ID is required');
    }
    
    // If category_code is being updated, check if it already exists
    if (data.category_code) {
      const existingCategory = await this.categoryRepository.FindByCategoryCode(data.category_code);
      if (existingCategory && existingCategory.id !== categoryId) {
        logger?.error('CategoryUseCase.UpdateCategory - Category code already exists', { category_code: data.category_code });
        throw new Error('Category code already exists');
      }
    }
    
    const updateData = { ...data };
    const [affectedCount, updatedCategories] = await this.categoryRepository.Update(categoryId, updateData);
    if (affectedCount === 0 || !updatedCategories[0]) {
      logger?.warn('CategoryUseCase.UpdateCategory - Category not found', { id });
      throw new Error('Category not found');
    }
    logger?.info('CategoryUseCase.UpdateCategory - Completed', { id });
    return updatedCategories[0];
  }

  async DeleteCategory(id: number | string): Promise<void> {
    const logger = GetLogger();
    logger?.debug('CategoryUseCase.DeleteCategory - Starting', { id });
    const categoryId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (!categoryId || isNaN(categoryId)) {
      logger?.error('CategoryUseCase.DeleteCategory - Category ID is required');
      throw new Error('Category ID is required');
    }
    const deletedCount = await this.categoryRepository.Delete(categoryId);
    if (deletedCount === 0) {
      logger?.warn('CategoryUseCase.DeleteCategory - Category not found', { id });
      throw new Error('Category not found');
    }
    logger?.info('CategoryUseCase.DeleteCategory - Completed', { id });
  }
}

