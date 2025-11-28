'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('stores', 'store_code', {
      type: Sequelize.STRING(20),
      allowNull: true,
      unique: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('stores', 'store_code');
  }
};
