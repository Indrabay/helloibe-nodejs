import { Store, StoreAttributes, StoreCreationAttributes } from '../models/Store';
import { GetLogger } from '../utils/loggerContext';

export class StoreRepository {
  async FindAll(): Promise<Store[]> {
    const logger = GetLogger();
    logger?.debug('StoreRepository.FindAll - Executing query');
    const stores = await Store.findAll();
    logger?.debug('StoreRepository.FindAll - Query completed', { count: stores.length });
    return stores;
  }

  async FindById(id: string): Promise<Store | null> {
    const logger = GetLogger();
    logger?.debug('StoreRepository.FindById - Executing query', { id });
    const store = await Store.findByPk(id);
    logger?.debug('StoreRepository.FindById - Query completed', { id, found: !!store });
    return store;
  }

  async Create(data: StoreCreationAttributes): Promise<Store> {
    const logger = GetLogger();
    logger?.debug('StoreRepository.Create - Executing query', { name: data.name });
    const store = await Store.create(data);
    logger?.info('StoreRepository.Create - Query completed', { id: store.id });
    return store;
  }

  async Update(id: string, data: Partial<StoreAttributes>): Promise<[number, Store[]]> {
    const logger = GetLogger();
    logger?.debug('StoreRepository.Update - Executing query', { id });
    const result = await Store.update(data, {
      where: { id },
      returning: true,
    });
    logger?.info('StoreRepository.Update - Query completed', { id, affectedRows: result[0] });
    return result;
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

