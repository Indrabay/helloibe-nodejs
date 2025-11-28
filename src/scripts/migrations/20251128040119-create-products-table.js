'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('products', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      sku: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      selling_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      purchase_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
      },
    });

    // Add indexes
    await queryInterface.addIndex('products', ['category_id'], {
      name: 'products_category_id_idx',
    });
    await queryInterface.addIndex('products', ['sku'], {
      name: 'products_sku_idx',
      unique: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('products');
  }
};
