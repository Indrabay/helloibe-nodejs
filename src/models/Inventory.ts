import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import { Product } from './Product';
import { User } from './User';

export interface InventoryAttributes {
  id: string;
  product_id: string;
  quantity: number;
  location?: string | null;
  expiry_date?: Date | null;
  status: 'active' | 'near_expiry' | 'expired';
  created_at: Date;
  created_by?: string | null;
}

export interface InventoryCreationAttributes extends Optional<InventoryAttributes, 'id' | 'created_at' | 'location' | 'expiry_date' | 'status' | 'created_by'> {}

export class Inventory extends Model<InventoryAttributes, InventoryCreationAttributes> implements InventoryAttributes {
  public id!: string;
  public product_id!: string;
  public quantity!: number;
  public location!: string | null;
  public expiry_date!: Date | null;
  public status!: 'active' | 'near_expiry' | 'expired';
  public created_at!: Date;
  public created_by!: string | null;

  // Associations
  public readonly product?: Product;
  public readonly creator?: User;
}

export const InitInventory = (sequelize: Sequelize): typeof Inventory => {
  Inventory.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      product_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      quantity: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      expiry_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('active', 'near_expiry', 'expired'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
    },
    {
      sequelize,
      tableName: 'inventories',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      underscored: true,
    }
  );

  return Inventory;
};

