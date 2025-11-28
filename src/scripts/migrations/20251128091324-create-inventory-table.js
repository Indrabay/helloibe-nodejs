'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('inventories', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      quantity: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      location: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      expiry_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('active', 'near_expiry', 'expired'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
      },
    });

    // Add indexes
    await queryInterface.addIndex('inventories', ['product_id'], {
      name: 'inventory_product_id_idx',
    });
    await queryInterface.addIndex('inventories', ['status'], {
      name: 'inventory_status_idx',
    });
    await queryInterface.addIndex('inventories', ['expiry_date'], {
      name: 'inventory_expiry_date_idx',
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('inventories');
  }
};
