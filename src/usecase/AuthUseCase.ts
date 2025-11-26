import { UserRepository } from '../repository/UserRepository';
import { User } from '../models/User';
import { GetLogger } from '../utils/loggerContext';
import { GenerateToken } from '../utils/jwt';
import bcrypt from 'bcrypt';

export class AuthUseCase {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async Login(usernameOrEmail: string, password: string): Promise<{ token: string; user: User }> {
    const logger = GetLogger();
    logger?.debug('AuthUseCase.Login - Starting', { usernameOrEmail });

    if (!usernameOrEmail || !password) {
      logger?.error('AuthUseCase.Login - Username/email and password are required');
      throw new Error('Username/email and password are required');
    }

    // Try to find user by username or email
    let user = await this.userRepository.FindByUsername(usernameOrEmail);
    if (!user) {
      user = await this.userRepository.FindByEmail(usernameOrEmail);
    }

    if (!user) {
      logger?.warn('AuthUseCase.Login - User not found', { usernameOrEmail });
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger?.warn('AuthUseCase.Login - Invalid password', { userId: user.id });
      throw new Error('Invalid credentials');
    }

    // Get user with role to include level
    const userWithRole = await this.userRepository.FindById(user.id);
    if (!userWithRole) {
      logger?.error('AuthUseCase.Login - User not found after authentication');
      throw new Error('User not found');
    }

    // Generate JWT token
    const role = (userWithRole as any).role;
    const token = GenerateToken({
      userId: userWithRole.id,
      username: userWithRole.username,
      email: userWithRole.email,
      roleId: userWithRole.role_id || null,
      level: role?.level || null,
    });

    logger?.info('AuthUseCase.Login - Login successful', { userId: userWithRole.id, username: userWithRole.username });
    return { token, user: userWithRole };
  }
}

