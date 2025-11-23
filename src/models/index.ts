import 'dotenv/config';
import { Sequelize } from 'sequelize';
import { InitStore, Store } from './Store';
import { InitRole, Role } from './Role';
import { InitUser, User } from './User';

// Initialize Sequelize connection
const sequelize = new Sequelize(
  process.env.DB_NAME || 'test_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  }
);

// Initialize models
const StoreModel = InitStore(sequelize);
const RoleModel = InitRole(sequelize);
const UserModel = InitUser(sequelize);

// Define associations
// User belongs to Role
UserModel.belongsTo(RoleModel, {
  foreignKey: 'role_id',
  as: 'role',
});

// User belongs to Store
UserModel.belongsTo(StoreModel, {
  foreignKey: 'store_id',
  as: 'store',
});

// Role has many Users
RoleModel.hasMany(UserModel, {
  foreignKey: 'role_id',
  as: 'users',
});

// Store has many Users
StoreModel.hasMany(UserModel, {
  foreignKey: 'store_id',
  as: 'users',
});

// Store created_by and updated_by associations with User
StoreModel.belongsTo(UserModel, {
  foreignKey: 'created_by',
  as: 'creator',
});
StoreModel.belongsTo(UserModel, {
  foreignKey: 'updated_by',
  as: 'updater',
});

// Role created_by and updated_by associations with User
RoleModel.belongsTo(UserModel, {
  foreignKey: 'created_by',
  as: 'creator',
});
RoleModel.belongsTo(UserModel, {
  foreignKey: 'updated_by',
  as: 'updater',
});

// User created_by and updated_by associations (self-reference)
UserModel.belongsTo(UserModel, {
  foreignKey: 'created_by',
  as: 'creator',
});
UserModel.belongsTo(UserModel, {
  foreignKey: 'updated_by',
  as: 'updater',
});

// User has many created records (for created_by)
UserModel.hasMany(StoreModel, {
  foreignKey: 'created_by',
  as: 'createdStores',
});
UserModel.hasMany(RoleModel, {
  foreignKey: 'created_by',
  as: 'createdRoles',
});
UserModel.hasMany(UserModel, {
  foreignKey: 'created_by',
  as: 'createdUsers',
});

// User has many updated records (for updated_by)
UserModel.hasMany(StoreModel, {
  foreignKey: 'updated_by',
  as: 'updatedStores',
});
UserModel.hasMany(RoleModel, {
  foreignKey: 'updated_by',
  as: 'updatedRoles',
});
UserModel.hasMany(UserModel, {
  foreignKey: 'updated_by',
  as: 'updatedUsers',
});

export {
  sequelize,
  Store,
  Role,
  User,
};

export default sequelize;

