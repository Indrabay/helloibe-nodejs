import { DataTypes, Model, Optional } from 'sequelize';
import { Sequelize } from 'sequelize';

export interface CategoryAttributes {
  id: number;
  name: string;
  category_code: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface CategoryCreationAttributes extends Optional<CategoryAttributes, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> {}

export class Category extends Model<CategoryAttributes, CategoryCreationAttributes> implements CategoryAttributes {
  public id!: number;
  public name!: string;
  public category_code!: string;
  public created_at!: Date;
  public updated_at!: Date;
  public created_by!: string | null;
  public updated_by!: string | null;
}

export const InitCategory = (sequelize: Sequelize): typeof Category => {
  Category.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      category_code: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
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
      tableName: 'categories',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
    }
  );

  return Category;
};

