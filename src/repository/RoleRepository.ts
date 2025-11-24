import { Role, RoleAttributes, RoleCreationAttributes } from '../models/Role';
import { GetLogger } from '../utils/loggerContext';

export class RoleRepository {
  async FindAll(): Promise<Role[]> {
    const logger = GetLogger();
    logger?.debug('RoleRepository.FindAll - Executing query');
    const roles = await Role.findAll();
    logger?.debug('RoleRepository.FindAll - Query completed', { count: roles.length });
    return roles;
  }

  async FindById(id: string): Promise<Role | null> {
    const logger = GetLogger();
    logger?.debug('RoleRepository.FindById - Executing query', { id });
    const role = await Role.findByPk(id);
    logger?.debug('RoleRepository.FindById - Query completed', { id, found: !!role });
    return role;
  }

  async Create(data: RoleCreationAttributes): Promise<Role> {
    const logger = GetLogger();
    logger?.debug('RoleRepository.Create - Executing query', { name: data.name });
    const role = await Role.create(data);
    logger?.info('RoleRepository.Create - Query completed', { id: role.id });
    return role;
  }

  async Update(id: string, data: Partial<RoleAttributes>): Promise<[number, Role[]]> {
    const logger = GetLogger();
    logger?.debug('RoleRepository.Update - Executing query', { id });
    const result = await Role.update(data, {
      where: { id },
      returning: true,
    });
    logger?.info('RoleRepository.Update - Query completed', { id, affectedRows: result[0] });
    return result;
  }

  async Delete(id: string): Promise<number> {
    const logger = GetLogger();
    logger?.debug('RoleRepository.Delete - Executing query', { id });
    const deletedCount = await Role.destroy({
      where: { id },
    });
    logger?.info('RoleRepository.Delete - Query completed', { id, deletedCount });
    return deletedCount;
  }
}

