import { Store, StoreAttributes, StoreCreationAttributes } from '../models/Store';
import { GetLogger } from '../utils/loggerContext';
import { Op } from 'sequelize';

export class StoreRepository {
  async FindAll(): Promise<Store[]> {
    const logger = GetLogger();
    logger?.debug('StoreRepository.FindAll - Executing query');
    const stores = await Store.findAll({
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('StoreRepository.FindAll - Query completed', { count: stores.length });
    return stores;
  }

  async FindAllWithPagination(limit: number, offset: number, searchName?: string, searchPhone?: string): Promise<{ stores: Store[]; total: number }> {
    const logger = GetLogger();
    logger?.debug('StoreRepository.FindAllWithPagination - Executing query', { limit, offset, searchName, searchPhone });
    
    // Build where clause for search
    const where: any = {};
    if (searchName) {
      where.name = {
        [Op.like]: `%${searchName}%`,
      };
    }
    if (searchPhone) {
      where.phone = searchPhone;
    }
    
    const { count, rows } = await Store.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('StoreRepository.FindAllWithPagination - Query completed', { count, returned: rows.length });
    return { stores: rows, total: count };
  }

  async FindById(id: string): Promise<Store | null> {
    const logger = GetLogger();
    logger?.debug('StoreRepository.FindById - Executing query', { id });
    const store = await Store.findByPk(id, {
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('StoreRepository.FindById - Query completed', { id, found: !!store });
    return store;
  }

  async Create(data: StoreCreationAttributes): Promise<Store> {
    const logger = GetLogger();
    logger?.debug('StoreRepository.Create - Executing query', { name: data.name });
    const store = await Store.create(data);
    // Reload with associations
    await store.reload({
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.info('StoreRepository.Create - Query completed', { id: store.id });
    return store;
  }

  async Update(id: string, data: Partial<StoreAttributes>): Promise<[number, Store[]]> {
    const logger = GetLogger();
    logger?.debug('StoreRepository.Update - Executing query', { id });
    const affectedCount = await Store.update(data, {
      where: { id },
    });
    
    // Fetch the updated store after update (MySQL doesn't support returning)
    let updatedStore: Store | null = null;
    if (affectedCount[0] > 0) {
      updatedStore = await Store.findByPk(id, {
        include: [
          { association: 'creator', attributes: ['id', 'name', 'email'] },
          { association: 'updater', attributes: ['id', 'name', 'email'] },
        ],
      });
    }
    
    logger?.info('StoreRepository.Update - Query completed', { id, affectedRows: affectedCount[0] });
    return [affectedCount[0], updatedStore ? [updatedStore] : []];
  }

  async Delete(id: string): Promise<number> {
    const logger = GetLogger();
    logger?.debug('StoreRepository.Delete - Executing query', { id });
    const deletedCount = await Store.destroy({
      where: { id },
    });
    logger?.info('StoreRepository.Delete - Query completed', { id, deletedCount });
    return deletedCount;
  }
}

