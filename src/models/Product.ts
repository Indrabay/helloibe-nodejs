import { DataTypes, Model, Optional } from 'sequelize';
import { Sequelize } from 'sequelize';

export interface ProductAttributes {
  id: string;
  name: string;
  category_id: number;
  sku: string;
  selling_price: number;
  purchase_price: number;
  created_at: Date;
  updated_at: Date;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface ProductCreationAttributes extends Optional<ProductAttributes, 'id' | 'sku' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> {}

export class Product extends Model<ProductAttributes, ProductCreationAttributes> implements ProductAttributes {
  public id!: string;
  public name!: string;
  public category_id!: number;
  public sku!: string;
  public selling_price!: number;
  public purchase_price!: number;
  public created_at!: Date;
  public updated_at!: Date;
  public created_by!: string | null;
  public updated_by!: string | null;
}

export const InitProduct = (sequelize: Sequelize): typeof Product => {
  Product.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id',
        },
      },
      sku: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      selling_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      purchase_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
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
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
    },
    {
      sequelize,
      tableName: 'products',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
    }
  );

  return Product;
};

