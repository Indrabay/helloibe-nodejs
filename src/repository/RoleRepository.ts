import { Role, RoleAttributes, RoleCreationAttributes } from '../models/Role';
import { GetLogger } from '../utils/loggerContext';

export class RoleRepository {
  async FindAll(): Promise<Role[]> {
    const logger = GetLogger();
    logger?.debug('RoleRepository.FindAll - Executing query');
    const roles = await Role.findAll({
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('RoleRepository.FindAll - Query completed', { count: roles.length });
    return roles;
  }

  async FindAllWithPagination(limit: number, offset: number): Promise<{ roles: Role[]; total: number }> {
    const logger = GetLogger();
    logger?.debug('RoleRepository.FindAllWithPagination - Executing query', { limit, offset });
    const { count, rows } = await Role.findAndCountAll({
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('RoleRepository.FindAllWithPagination - Query completed', { count, returned: rows.length });
    return { roles: rows, total: count };
  }

  async FindById(id: string): Promise<Role | null> {
    const logger = GetLogger();
    logger?.debug('RoleRepository.FindById - Executing query', { id });
    const role = await Role.findByPk(id, {
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('RoleRepository.FindById - Query completed', { id, found: !!role });
    return role;
  }

  async Create(data: RoleCreationAttributes): Promise<Role> {
    const logger = GetLogger();
    logger?.debug('RoleRepository.Create - Executing query', { name: data.name });
    const role = await Role.create(data);
    // Reload with associations
    await role.reload({
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.info('RoleRepository.Create - Query completed', { id: role.id });
    return role;
  }

  async Update(id: string, data: Partial<RoleAttributes>): Promise<[number, Role[]]> {
    const logger = GetLogger();
    logger?.debug('RoleRepository.Update - Executing query', { id });
    const affectedCount = await Role.update(data, {
      where: { id },
    });
    
    // Fetch the updated role after update (MySQL doesn't support returning)
    let updatedRole: Role | null = null;
    if (affectedCount[0] > 0) {
      updatedRole = await Role.findByPk(id, {
        include: [
          { association: 'creator', attributes: ['id', 'name', 'email'] },
          { association: 'updater', attributes: ['id', 'name', 'email'] },
        ],
      });
    }
    
    logger?.info('RoleRepository.Update - Query completed', { id, affectedRows: affectedCount[0] });
    return [affectedCount[0], updatedRole ? [updatedRole] : []];
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

