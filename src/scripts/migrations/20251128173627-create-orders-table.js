'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      invoice_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      customer_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      total_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
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


    // Add index on invoice_number
    await queryInterface.addIndex('orders', ['invoice_number'], {
      name: 'orders_invoice_number_idx',
      unique: true,
    });

    // Add index on created_at
    await queryInterface.addIndex('orders', ['created_at'], {
      name: 'orders_created_at_idx',
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('orders');
  }
};
