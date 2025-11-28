import { RoleRepository } from '../repository/RoleRepository';
import { Role, RoleCreationAttributes, RoleAttributes } from '../models/Role';
import { GetLogger } from '../utils/loggerContext';

export class RoleUseCase {
  private roleRepository: RoleRepository;

  constructor() {
    this.roleRepository = new RoleRepository();
  }

  async GetAllRoles(): Promise<Role[]> {
    const logger = GetLogger();
    logger?.debug('RoleUseCase.GetAllRoles - Starting');
    const roles = await this.roleRepository.FindAll();
    logger?.debug('RoleUseCase.GetAllRoles - Completed', { count: roles.length });
    return roles;
  }

  async GetAllRolesWithPagination(limit: number, offset: number): Promise<{ roles: Role[]; total: number }> {
    const logger = GetLogger();
    logger?.debug('RoleUseCase.GetAllRolesWithPagination - Starting', { limit, offset });
    const result = await this.roleRepository.FindAllWithPagination(limit, offset);
    logger?.debug('RoleUseCase.GetAllRolesWithPagination - Completed', { count: result.roles.length, total: result.total });
    return result;
  }

  async GetRoleById(id: string): Promise<Role | null> {
    const logger = GetLogger();
    logger?.debug('RoleUseCase.GetRoleById - Starting', { id });
    if (!id) {
      logger?.error('RoleUseCase.GetRoleById - Role ID is required');
      throw new Error('Role ID is required');
    }
    const role = await this.roleRepository.FindById(id);
    if (!role) {
      logger?.warn('RoleUseCase.GetRoleById - Role not found', { id });
      throw new Error('Role not found');
    }
    logger?.debug('RoleUseCase.GetRoleById - Completed', { id });
    return role;
  }

  async CreateRole(data: RoleCreationAttributes): Promise<Role> {
    const logger = GetLogger();
    logger?.debug('RoleUseCase.CreateRole - Starting', { name: data.name });
    if (!data.name) {
      logger?.error('RoleUseCase.CreateRole - Role name is required');
      throw new Error('Role name is required');
    }
    if (data.level === undefined || data.level === null) {
      logger?.error('RoleUseCase.CreateRole - Role level is required');
      throw new Error('Role level is required');
    }
    const role = await this.roleRepository.Create(data);
    logger?.info('RoleUseCase.CreateRole - Completed', { id: role.id, name: role.name });
    return role;
  }

  async UpdateRole(id: string, data: Partial<RoleAttributes>): Promise<Role> {
    const logger = GetLogger();
    logger?.debug('RoleUseCase.UpdateRole - Starting', { id });
    if (!id) {
      logger?.error('RoleUseCase.UpdateRole - Role ID is required');
      throw new Error('Role ID is required');
    }
    const [affectedCount, updatedRoles] = await this.roleRepository.Update(id, data);
    if (affectedCount === 0 || !updatedRoles[0]) {
      logger?.warn('RoleUseCase.UpdateRole - Role not found', { id });
      throw new Error('Role not found');
    }
    logger?.info('RoleUseCase.UpdateRole - Completed', { id });
    return updatedRoles[0];
  }

  async DeleteRole(id: string): Promise<void> {
    const logger = GetLogger();
    logger?.debug('RoleUseCase.DeleteRole - Starting', { id });
    if (!id) {
      logger?.error('RoleUseCase.DeleteRole - Role ID is required');
      throw new Error('Role ID is required');
    }
    const deletedCount = await this.roleRepository.Delete(id);
    if (deletedCount === 0) {
      logger?.warn('RoleUseCase.DeleteRole - Role not found', { id });
      throw new Error('Role not found');
    }
    logger?.info('RoleUseCase.DeleteRole - Completed', { id });
  }
}

