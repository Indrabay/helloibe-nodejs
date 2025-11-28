import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import { Product } from './Product';

export interface OrderItemAttributes {
  id: number;
  order_id: number;
  product_id: string;
  quantity: number;
  total_price: number;
  created_at: Date;
}

export interface OrderItemCreationAttributes extends Optional<OrderItemAttributes, 'id' | 'created_at' | 'order_id'> {}

export class OrderItem extends Model<OrderItemAttributes, OrderItemCreationAttributes> implements OrderItemAttributes {
  public id!: number;
  public order_id!: number;
  public product_id!: string;
  public quantity!: number;
  public total_price!: number;
  public created_at!: Date;

  // Associations
  public readonly product?: Product;
  public readonly order?: any;
}

export const InitOrderItem = (sequelize: Sequelize): typeof OrderItem => {
  OrderItem.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      order_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      product_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      quantity: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      total_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'order_items',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      underscored: true,
    }
  );

  return OrderItem;
};

