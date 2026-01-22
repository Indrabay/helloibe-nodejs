'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add purchase_price to inventories table
    await queryInterface.addColumn('inventories', 'purchase_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true, // Allow null initially for existing records
      after: 'quantity',
    });

    // Update existing records: set purchase_price from product's purchase_price
    await queryInterface.sequelize.query(`
      UPDATE inventories i
      INNER JOIN products p ON i.product_id = p.id
      SET i.purchase_price = p.purchase_price
      WHERE i.purchase_price IS NULL
    `);

    // Now make purchase_price NOT NULL
    await queryInterface.changeColumn('inventories', 'purchase_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    });

    // Add purchase_price and profit to order_items table
    await queryInterface.addColumn('order_items', 'purchase_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true, // Allow null initially for existing records
      after: 'total_price',
    });

    await queryInterface.addColumn('order_items', 'profit', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true, // Allow null initially for existing records
      after: 'purchase_price',
    });

    // Update existing order_items: calculate purchase_price and profit from product
    await queryInterface.sequelize.query(`
      UPDATE order_items oi
      INNER JOIN products p ON oi.product_id = p.id
      SET 
        oi.purchase_price = p.purchase_price * oi.quantity,
        oi.profit = oi.total_price - (p.purchase_price * oi.quantity)
      WHERE oi.purchase_price IS NULL OR oi.profit IS NULL
    `);

    // Now make purchase_price and profit NOT NULL
    await queryInterface.changeColumn('order_items', 'purchase_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    });

    await queryInterface.changeColumn('order_items', 'profit', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove columns in reverse order
    await queryInterface.removeColumn('order_items', 'profit');
    await queryInterface.removeColumn('order_items', 'purchase_price');
    await queryInterface.removeColumn('inventories', 'purchase_price');
  }
};

