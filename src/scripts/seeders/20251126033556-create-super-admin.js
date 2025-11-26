'use strict';

const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Find or create role with level 99
    const [roles] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE level = 99 LIMIT 1"
    );

    let roleId;
    if (roles.length > 0) {
      roleId = roles[0].id;
    } else {
      // Create role with level 99
      const roleUuid = randomUUID();
      await queryInterface.bulkInsert('roles', [{
        id: roleUuid,
        name: 'Super Admin',
        level: 99,
        created_at: new Date(),
        updated_at: new Date(),
      }]);
      roleId = roleUuid;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('superadmin', 10);

    // Check if super_admin user already exists
    const [existingUsers] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE username = 'super_admin' LIMIT 1"
    );

    if (existingUsers.length === 0) {
      // Create super_admin user
      const userId = randomUUID();
      await queryInterface.bulkInsert('users', [{
        id: userId,
        username: 'super_admin',
        email: 'super_admin@example.com',
        name: 'Super Admin',
        password: hashedPassword,
        role_id: roleId,
        created_at: new Date(),
        updated_at: new Date(),
      }]);
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', {
      username: 'super_admin'
    }, {});
  }
};
