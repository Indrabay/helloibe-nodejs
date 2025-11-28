'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'store_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    // Add index for store_id
    await queryInterface.addIndex('products', ['store_id'], {
      name: 'products_store_id_idx',
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex('products', 'products_store_id_idx');
    await queryInterface.removeColumn('products', 'store_id');
  }
};
