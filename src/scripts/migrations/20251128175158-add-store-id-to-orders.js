'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'store_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    // Add index on store_id
    await queryInterface.addIndex('orders', ['store_id'], {
      name: 'orders_store_id_idx',
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'store_id');
  }
};
