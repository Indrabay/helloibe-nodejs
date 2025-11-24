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
      ],
    });
    logger?.debug('UserRepository.FindAll - Query completed', { count: users.length });
    return users;
  }

  async FindById(id: string): Promise<User | null> {
    const logger = GetLogger();
    logger?.debug('UserRepository.FindById - Executing query', { id });
    const user = await User.findByPk(id, {
      include: [
        { association: 'role' },
        { association: 'store' },
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
    logger?.info('UserRepository.Create - Query completed', { id: user.id });
    return user;
  }

  async Update(id: string, data: Partial<UserAttributes>): Promise<[number, User[]]> {
    const logger = GetLogger();
    logger?.debug('UserRepository.Update - Executing query', { id });
    const result = await User.update(data, {
      where: { id },
      returning: true,
    });
    logger?.info('UserRepository.Update - Query completed', { id, affectedRows: result[0] });
    return result;
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

