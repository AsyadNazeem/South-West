'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            await queryInterface.createTable(
                'campaign_frames',
                {
                    id: {
                        type: Sequelize.BIGINT.UNSIGNED,
                        primaryKey: true,
                        autoIncrement: true,
                        allowNull: false,
                    },
                    name: {
                        type: Sequelize.STRING(120),
                        allowNull: false,
                    },
                    image_path: {
                        type: Sequelize.STRING(255),
                        allowNull: false,
                    },
                    is_active: {
                        type: Sequelize.BOOLEAN,
                        allowNull: false,
                        defaultValue: true,
                    },
                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                    },
                },
                { transaction }
            );

            await queryInterface.addColumn(
                'discount_campaigns',
                'visual_frame_id',
                {
                    type: Sequelize.BIGINT.UNSIGNED,
                    allowNull: true,
                    references: {
                        model: 'campaign_frames',
                        key: 'id',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL',
                },
                { transaction }
            );

            const [campaigns] = await queryInterface.sequelize.query(
                `SELECT id, campaign_name, visual_frame_path
                 FROM discount_campaigns
                 WHERE visual_frame_path IS NOT NULL
                   AND visual_frame_path <> ''`,
                { transaction }
            );

            for (const campaign of campaigns) {
                const existing = await queryInterface.sequelize.query(
                    `SELECT id
                     FROM campaign_frames
                     WHERE image_path = :imagePath
                     LIMIT 1`,
                    {
                        replacements: { imagePath: campaign.visual_frame_path },
                        type: Sequelize.QueryTypes.SELECT,
                        transaction,
                    }
                );

                let frameId = existing[0]?.id;

                if (!frameId) {
                    await queryInterface.bulkInsert(
                        'campaign_frames',
                        [{
                            name: `${campaign.campaign_name} Frame`.slice(0, 120),
                            image_path: campaign.visual_frame_path,
                            is_active: true,
                            created_at: new Date(),
                            updated_at: new Date(),
                        }],
                        { transaction }
                    );

                    const [inserted] = await queryInterface.sequelize.query(
                        'SELECT LAST_INSERT_ID() AS id',
                        { transaction }
                    );

                    frameId = inserted[0].id;
                }

                await queryInterface.bulkUpdate(
                    'discount_campaigns',
                    { visual_frame_id: frameId },
                    { id: campaign.id },
                    { transaction }
                );
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn(
            'discount_campaigns',
            'visual_frame_id'
        );

        await queryInterface.dropTable('campaign_frames');
    },
};
