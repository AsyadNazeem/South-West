'use strict';

const { randomUUID } = require('crypto');

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDescription =
            await queryInterface.describeTable('customer_sessions');

        // Add the column if it doesn't already exist.
        if (!tableDescription.session_uuid) {
            await queryInterface.addColumn(
                'customer_sessions',
                'session_uuid',
                {
                    type: Sequelize.CHAR(36),
                    allowNull: true,
                }
            );
        }

        // Backfill existing sessions with unique UUIDs.
        const [sessions] = await queryInterface.sequelize.query(
            `SELECT id FROM customer_sessions WHERE session_uuid IS NULL`
        );

        for (const session of sessions) {
            await queryInterface.bulkUpdate(
                'customer_sessions',
                { session_uuid: randomUUID() },
                { id: session.id, session_uuid: null }
            );
        }

        // Enforce uniqueness and require a UUID for every session.
        const indexes = await queryInterface.showIndex(
            'customer_sessions'
        );

        const hasUniqueIndex = indexes.some(
            (index) =>
                index.unique &&
                index.fields.length === 1 &&
                index.fields[0].attribute === 'session_uuid'
        );

        if (!hasUniqueIndex) {
            await queryInterface.addIndex(
                'customer_sessions',
                ['session_uuid'],
                {
                    name: 'uq_customer_sessions_session_uuid',
                    unique: true,
                }
            );
        }

        await queryInterface.changeColumn(
            'customer_sessions',
            'session_uuid',
            {
                type: Sequelize.CHAR(36),
                allowNull: false,
            }
        );
    },

    async down(queryInterface) {
        const tableDescription =
            await queryInterface.describeTable('customer_sessions');

        if (!tableDescription.session_uuid) {
            return;
        }

        const indexes = await queryInterface.showIndex(
            'customer_sessions'
        );

        const index = indexes.find(
            (item) =>
                item.unique &&
                item.fields.length === 1 &&
                item.fields[0].attribute === 'session_uuid'
        );

        if (index) {
            await queryInterface.removeIndex(
                'customer_sessions',
                index.name
            );
        }

        await queryInterface.removeColumn(
            'customer_sessions',
            'session_uuid'
        );
    },
};
