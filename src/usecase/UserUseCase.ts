import { UserRepository } from '../repository/UserRepository';
import { User, UserCreationAttributes, UserAttributes } from '../models/User';
import { GetLogger } from '../utils/loggerContext';

export class UserUseCase {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async GetAllUsers(): Promise<User[]> {
    const logger = GetLogger();
    logger?.debug('UserUseCase.GetAllUsers - Starting');
    const users = await this.userRepository.FindAll();
    logger?.debug('UserUseCase.GetAllUsers - Completed', { count: users.length });
    return users;
  }

  async GetUserById(id: string): Promise<User | null> {
    const logger = GetLogger();
    logger?.debug('UserUseCase.GetUserById - Starting', { id });
    if (!id) {
      logger?.error('UserUseCase.GetUserById - User ID is required');
      throw new Error('User ID is required');
    }
    const user = await this.userRepository.FindById(id);
    if (!user) {
      logger?.warn('UserUseCase.GetUserById - User not found', { id });
      throw new Error('User not found');
    }
    logger?.debug('UserUseCase.GetUserById - Completed', { id });
    return user;
  }

  async CreateUser(data: UserCreationAttributes): Promise<User> {
    const logger = GetLogger();
    logger?.debug('UserUseCase.CreateUser - Starting', { username: data.username, email: data.email });
    if (!data.username) {
      logger?.error('UserUseCase.CreateUser - Username is required');
      throw new Error('Username is required');
    }
    if (!data.email) {
      logger?.error('UserUseCase.CreateUser - Email is required');
      throw new Error('Email is required');
    }
    if (!data.name) {
      logger?.error('UserUseCase.CreateUser - Name is required');
      throw new Error('Name is required');
    }
    if (!data.password) {
      logger?.error('UserUseCase.CreateUser - Password is required');
      throw new Error('Password is required');
    }

    // Check if username already exists
    const existingUserByUsername = await this.userRepository.FindByUsername(data.username);
    if (existingUserByUsername) {
      logger?.warn('UserUseCase.CreateUser - Username already exists', { username: data.username });
      throw new Error('Username already exists');
    }

    // Check if email already exists
    const existingUserByEmail = await this.userRepository.FindByEmail(data.email);
    if (existingUserByEmail) {
      logger?.warn('UserUseCase.CreateUser - Email already exists', { email: data.email });
      throw new Error('Email already exists');
    }

    const user = await this.userRepository.Create(data);
    logger?.info('UserUseCase.CreateUser - Completed', { id: user.id, username: user.username });
    return user;
  }

  async UpdateUser(id: string, data: Partial<UserAttributes>): Promise<User> {
    const logger = GetLogger();
    logger?.debug('UserUseCase.UpdateUser - Starting', { id });
    if (!id) {
      logger?.error('UserUseCase.UpdateUser - User ID is required');
      throw new Error('User ID is required');
    }

    // Check if email is being updated and if it already exists
    if (data.email) {
      const existingUser = await this.userRepository.FindByEmail(data.email);
      if (existingUser && existingUser.id !== id) {
        logger?.warn('UserUseCase.UpdateUser - Email already exists', { email: data.email });
        throw new Error('Email already exists');
      }
    }

    // Check if username is being updated and if it already exists
    if (data.username) {
      const existingUser = await this.userRepository.FindByUsername(data.username);
      if (existingUser && existingUser.id !== id) {
        logger?.warn('UserUseCase.UpdateUser - Username already exists', { username: data.username });
        throw new Error('Username already exists');
      }
    }

    const [affectedCount, updatedUsers] = await this.userRepository.Update(id, data);
    if (affectedCount === 0 || !updatedUsers[0]) {
      logger?.warn('UserUseCase.UpdateUser - User not found', { id });
      throw new Error('User not found');
    }
    logger?.info('UserUseCase.UpdateUser - Completed', { id });
    return updatedUsers[0];
  }

  async DeleteUser(id: string): Promise<void> {
    const logger = GetLogger();
    logger?.debug('UserUseCase.DeleteUser - Starting', { id });
    if (!id) {
      logger?.error('UserUseCase.DeleteUser - User ID is required');
      throw new Error('User ID is required');
    }
    const deletedCount = await this.userRepository.Delete(id);
    if (deletedCount === 0) {
      logger?.warn('UserUseCase.DeleteUser - User not found', { id });
      throw new Error('User not found');
    }
    logger?.info('UserUseCase.DeleteUser - Completed', { id });
  }
}

