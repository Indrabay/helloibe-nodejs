import { User, UserAttributes, UserCreationAttributes } from '../models/User';
import { GetLogger } from '../utils/loggerContext';

export class UserRepository {
  async FindAll(): Promise<User[]> {
    const logger = GetLogger();
    logger?.debug('UserRepository.FindAll - Executing query');
    const users = await User.findAll({
      include: [
        { association: 'role' },
        { association: 'store' },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('UserRepository.FindAll - Query completed', { count: users.length });
    return users;
  }

  async FindAllWithPagination(limit: number, offset: number): Promise<{ users: User[]; total: number }> {
    const logger = GetLogger();
    logger?.debug('UserRepository.FindAllWithPagination - Executing query', { limit, offset });
    const { count, rows } = await User.findAndCountAll({
      limit,
      offset,
      include: [
        { association: 'role' },
        { association: 'store' },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
      order: [['created_at', 'DESC']],
    });
    logger?.debug('UserRepository.FindAllWithPagination - Query completed', { count, returned: rows.length });
    return { users: rows, total: count };
  }

  async FindById(id: string): Promise<User | null> {
    const logger = GetLogger();
    logger?.debug('UserRepository.FindById - Executing query', { id });
    const user = await User.findByPk(id, {
      include: [
        { association: 'role' },
        { association: 'store' },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.debug('UserRepository.FindById - Query completed', { id, found: !!user });
    return user;
  }

  async FindByEmail(email: string): Promise<User | null> {
    const logger = GetLogger();
    logger?.debug('UserRepository.FindByEmail - Executing query', { email });
    const user = await User.findOne({
      where: { email },
      include: [
        { association: 'role' },
        { association: 'store' },
      ],
    });
    logger?.debug('UserRepository.FindByEmail - Query completed', { email, found: !!user });
    return user;
  }

  async FindByUsername(username: string): Promise<User | null> {
    const logger = GetLogger();
    logger?.debug('UserRepository.FindByUsername - Executing query', { username });
    const user = await User.findOne({
      where: { username },
      include: [
        { association: 'role' },
        { association: 'store' },
      ],
    });
    logger?.debug('UserRepository.FindByUsername - Query completed', { username, found: !!user });
    return user;
  }

  async Create(data: UserCreationAttributes): Promise<User> {
    const logger = GetLogger();
    logger?.debug('UserRepository.Create - Executing query', { username: data.username, email: data.email });
    const user = await User.create(data);
    // Reload with associations
    await user.reload({
      include: [
        { association: 'role' },
        { association: 'store' },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'updater', attributes: ['id', 'name', 'email'] },
      ],
    });
    logger?.info('UserRepository.Create - Query completed', { id: user.id });
    return user;
  }

  async Update(id: string, data: Partial<UserAttributes>): Promise<[number, User[]]> {
    const logger = GetLogger();
    logger?.debug('UserRepository.Update - Executing query', { id });
    const affectedCount = await User.update(data, {
      where: { id },
    });
    
    // Fetch the updated user after update (MySQL doesn't support returning)
    let updatedUser: User | null = null;
    if (affectedCount[0] > 0) {
      updatedUser = await User.findByPk(id, {
        include: [
          { association: 'role' },
          { association: 'store' },
          { association: 'creator', attributes: ['id', 'name', 'email'] },
          { association: 'updater', attributes: ['id', 'name', 'email'] },
        ],
      });
    }
    
    logger?.info('UserRepository.Update - Query completed', { id, affectedRows: affectedCount[0] });
    return [affectedCount[0], updatedUser ? [updatedUser] : []];
  }

  async Delete(id: string): Promise<number> {
    const logger = GetLogger();
    logger?.debug('UserRepository.Delete - Executing query', { id });
    const deletedCount = await User.destroy({
      where: { id },
    });
    logger?.info('UserRepository.Delete - Query completed', { id, deletedCount });
    return deletedCount;
  }
}

