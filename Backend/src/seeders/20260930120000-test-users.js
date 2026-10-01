'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
    async up(queryInterface) {
        const now = new Date();

        const users = [
            {
                email: 'manager@southwest.lk',
                password: 'Manager@2026!',
                role: 'Manager'
            },
            {
                email: 'staff@southwest.lk',
                password: 'Staff@2026!',
                role: 'Staff'
            },
            {
                email: 'sales@southwest.lk',
                password: 'Sales@2026!',
                role: 'Sales'
            }
        ];

        for (const user of users) {
            const passwordHash = await bcrypt.hash(user.password, 12);

            await queryInterface.bulkInsert('users', [
                {
                    email: user.email,
                    password_hash: passwordHash,
                    email_verified_at: now,
                    is_active: true,
                    created_at: now,
                    updated_at: now
                }
            ]);

            const [createdUsers] = await queryInterface.sequelize.query(
                `SELECT id FROM users WHERE email = :email LIMIT 1`,
                {
                    replacements: {
                        email: user.email
                    }
                }
            );

            const [roles] = await queryInterface.sequelize.query(
                `SELECT id FROM roles WHERE name = :role LIMIT 1`,
                {
                    replacements: {
                        role: user.role
                    }
                }
            );

            if (!createdUsers.length) {
                throw new Error(`User was not created: ${user.email}`);
            }

            if (!roles.length) {
                throw new Error(`Role not found: ${user.role}`);
            }

            await queryInterface.bulkInsert('user_roles', [
                {
                    user_id: createdUsers[0].id,
                    role_id: roles[0].id,
                    created_at: now
                }
            ]);
        }
    },

    async down(queryInterface) {
        const emails = [
            'manager@southwest.lk',
            'staff@southwest.lk',
            'sales@southwest.lk'
        ];

        for (const email of emails) {
            const [users] = await queryInterface.sequelize.query(
                `SELECT id FROM users WHERE email = :email LIMIT 1`,
                {
                    replacements: { email }
                }
            );

            if (users.length) {
                await queryInterface.bulkDelete('user_roles', {
                    user_id: users[0].id
                });

                await queryInterface.bulkDelete('users', {
                    id: users[0].id
                });
            }
        }
    }
};
