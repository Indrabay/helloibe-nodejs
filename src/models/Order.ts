import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import { User } from './User';
import { Store } from './Store';

export interface OrderAttributes {
  id: number;
  invoice_number: string;
  customer_name?: string | null;
  total_price: number;
  store_id?: string | null;
  created_at: Date;
  created_by?: string | null;
}

export interface OrderCreationAttributes extends Optional<OrderAttributes, 'id' | 'created_at' | 'customer_name' | 'store_id' | 'created_by'> {}

export class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  public id!: number;
  public invoice_number!: string;
  public customer_name!: string | null;
  public total_price!: number;
  public store_id!: string | null;
  public created_at!: Date;
  public created_by!: string | null;

  // Associations
  public readonly creator?: User;
  public readonly store?: Store;
  public readonly orderItems?: any[];
}

export const InitOrder = (sequelize: Sequelize): typeof Order => {
  Order.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      invoice_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      customer_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      total_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      store_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'stores',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
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
      tableName: 'orders',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      underscored: true,
    }
  );

  return Order;
};

