import { StoreRepository } from '../repository/StoreRepository';
import { Store, StoreCreationAttributes, StoreAttributes } from '../models/Store';
import { GetLogger } from '../utils/loggerContext';

export class StoreUseCase {
  private storeRepository: StoreRepository;

  constructor() {
    this.storeRepository = new StoreRepository();
  }

  async GetAllStores(): Promise<Store[]> {
    const logger = GetLogger();
    logger?.debug('StoreUseCase.GetAllStores - Starting');
    const stores = await this.storeRepository.FindAll();
    logger?.debug('StoreUseCase.GetAllStores - Completed', { count: stores.length });
    return stores;
  }

  async GetStoreById(id: string): Promise<Store | null> {
    const logger = GetLogger();
    logger?.debug('StoreUseCase.GetStoreById - Starting', { id });
    if (!id) {
      logger?.error('StoreUseCase.GetStoreById - Store ID is required');
      throw new Error('Store ID is required');
    }
    const store = await this.storeRepository.FindById(id);
    if (!store) {
      logger?.warn('StoreUseCase.GetStoreById - Store not found', { id });
      throw new Error('Store not found');
    }
    logger?.debug('StoreUseCase.GetStoreById - Completed', { id });
    return store;
  }

  async CreateStore(data: StoreCreationAttributes): Promise<Store> {
    const logger = GetLogger();
    logger?.debug('StoreUseCase.CreateStore - Starting', { name: data.name });
    if (!data.name) {
      logger?.error('StoreUseCase.CreateStore - Store name is required');
      throw new Error('Store name is required');
    }
    const store = await this.storeRepository.Create(data);
    logger?.info('StoreUseCase.CreateStore - Completed', { id: store.id, name: store.name });
    return store;
  }

  async UpdateStore(id: string, data: Partial<StoreAttributes>): Promise<Store> {
    const logger = GetLogger();
    logger?.debug('StoreUseCase.UpdateStore - Starting', { id });
    if (!id) {
      logger?.error('StoreUseCase.UpdateStore - Store ID is required');
      throw new Error('Store ID is required');
    }
    const [affectedCount, updatedStores] = await this.storeRepository.Update(id, data);
    if (affectedCount === 0 || !updatedStores[0]) {
      logger?.warn('StoreUseCase.UpdateStore - Store not found', { id });
      throw new Error('Store not found');
    }
    logger?.info('StoreUseCase.UpdateStore - Completed', { id });
    return updatedStores[0];
  }

  async DeleteStore(id: string): Promise<void> {
    const logger = GetLogger();
    logger?.debug('StoreUseCase.DeleteStore - Starting', { id });
    if (!id) {
      logger?.error('StoreUseCase.DeleteStore - Store ID is required');
      throw new Error('Store ID is required');
    }
    const deletedCount = await this.storeRepository.Delete(id);
    if (deletedCount === 0) {
      logger?.warn('StoreUseCase.DeleteStore - Store not found', { id });
      throw new Error('Store not found');
    }
    logger?.info('StoreUseCase.DeleteStore - Completed', { id });
  }
}

