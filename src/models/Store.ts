import { DataTypes, Model, Optional } from 'sequelize';
import { Sequelize } from 'sequelize';

export interface StoreAttributes {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  created_at: Date;
  updated_at: Date;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface StoreCreationAttributes extends Optional<StoreAttributes, 'id' | 'created_at' | 'updated_at' | 'address' | 'phone' | 'created_by' | 'updated_by'> {}

export class Store extends Model<StoreAttributes, StoreCreationAttributes> implements StoreAttributes {
  public id!: string;
  public name!: string;
  public address!: string | null;
  public phone!: string | null;
  public created_at!: Date;
  public updated_at!: Date;
  public created_by!: string | null;
  public updated_by!: string | null;
}

export const InitStore = (sequelize: Sequelize): typeof Store => {
  Store.init(
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
      address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
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
      tableName: 'stores',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
    }
  );

  return Store;
};

