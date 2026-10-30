
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // Main discount campaign table
            await queryInterface.createTable(
                'discount_campaigns',
                {
                    id: {
                        type: Sequelize.BIGINT.UNSIGNED,
                        primaryKey: true,
                        autoIncrement: true,
                        allowNull: false,
                    },
                    campaign_name: {
                        type: Sequelize.STRING(150),
                        allowNull: false,
                    },
                    description: {
                        type: Sequelize.TEXT,
                        allowNull: true,
                    },
                    discount_reason: {
                        type: Sequelize.STRING(80),
                        allowNull: false,
                        defaultValue: 'custom',
                    },
                    custom_reason: {
                        type: Sequelize.STRING(150),
                        allowNull: true,
                    },
                    target_type: {
                        type: Sequelize.ENUM(
                            'all_products',
                            'selected_products',
                            'category',
                            'brand'
                        ),
                        allowNull: false,
                    },
                    discount_type: {
                        type: Sequelize.ENUM(
                            'percentage',
                            'fixed_amount'
                        ),
                        allowNull: false,
                    },
                    discount_value: {
                        type: Sequelize.DECIMAL(15, 2),
                        allowNull: false,
                    },
                    allow_promo_code: {
                        type: Sequelize.BOOLEAN,
                        allowNull: false,
                        defaultValue: false,
                    },
                    start_date: {
                        type: Sequelize.DATE,
                        allowNull: false,
                    },
                    end_date: {
                        type: Sequelize.DATE,
                        allowNull: false,
                    },
                    status: {
                        type: Sequelize.ENUM(
                            'draft',
                            'scheduled',
                            'active',
                            'paused',
                            'expired',
                            'cancelled'
                        ),
                        allowNull: false,
                        defaultValue: 'draft',
                    },
                    created_by: {
                        type: Sequelize.BIGINT.UNSIGNED,
                        allowNull: true,
                        references: {
                            model: 'users',
                            key: 'id',
                        },
                        onUpdate: 'CASCADE',
                        onDelete: 'SET NULL',
                    },
                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal(
                            'CURRENT_TIMESTAMP'
                        ),
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal(
                            'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
                        ),
                    },
                },
                { transaction }
            );

            // Products included in a campaign
            await queryInterface.createTable(
                'discount_campaign_items',
                {
                    id: {
                        type: Sequelize.BIGINT.UNSIGNED,
                        primaryKey: true,
                        autoIncrement: true,
                        allowNull: false,
                    },
                    campaign_id: {
                        type: Sequelize.BIGINT.UNSIGNED,
                        allowNull: false,
                        references: {
                            model: 'discount_campaigns',
                            key: 'id',
                        },
                        onUpdate: 'CASCADE',
                        onDelete: 'CASCADE',
                    },
                    item_id: {
                        type: Sequelize.BIGINT.UNSIGNED,
                        allowNull: false,
                        references: {
                            model: 'items',
                            key: 'id',
                        },
                        onUpdate: 'CASCADE',
                        onDelete: 'CASCADE',
                    },
                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal(
                            'CURRENT_TIMESTAMP'
                        ),
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal(
                            'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
                        ),
                    },
                },
                { transaction }
            );

            await queryInterface.addConstraint(
                'discount_campaign_items',
                {
                    fields: ['campaign_id', 'item_id'],
                    type: 'unique',
                    name: 'uq_discount_campaign_item',
                    transaction,
                }
            );

            // Categories included in a campaign
            await queryInterface.createTable(
                'discount_campaign_categories',
                {
                    id: {
                        type: Sequelize.BIGINT.UNSIGNED,
                        primaryKey: true,
                        autoIncrement: true,
                        allowNull: false,
                    },
                    campaign_id: {
                        type: Sequelize.BIGINT.UNSIGNED,
                        allowNull: false,
                        references: {
                            model: 'discount_campaigns',
                            key: 'id',
                        },
                        onUpdate: 'CASCADE',
                        onDelete: 'CASCADE',
                    },
                    category_id: {
                        type: Sequelize.BIGINT.UNSIGNED,
                        allowNull: false,
                        references: {
                            model: 'categories',
                            key: 'id',
                        },
                        onUpdate: 'CASCADE',
                        onDelete: 'CASCADE',
                    },
                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal(
                            'CURRENT_TIMESTAMP'
                        ),
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal(
                            'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
                        ),
                    },
                },
                { transaction }
            );

            await queryInterface.addConstraint(
                'discount_campaign_categories',
                {
                    fields: ['campaign_id', 'category_id'],
                    type: 'unique',
                    name: 'uq_discount_campaign_category',
                    transaction,
                }
            );

            // Brands included in a campaign
            await queryInterface.createTable(
                'discount_campaign_brands',
                {
                    id: {
                        type: Sequelize.BIGINT.UNSIGNED,
                        primaryKey: true,
                        autoIncrement: true,
                        allowNull: false,
                    },
                    campaign_id: {
                        type: Sequelize.BIGINT.UNSIGNED,
                        allowNull: false,
                        references: {
                            model: 'discount_campaigns',
                            key: 'id',
                        },
                        onUpdate: 'CASCADE',
                        onDelete: 'CASCADE',
                    },
                    brand_id: {
                        type: Sequelize.BIGINT.UNSIGNED,
                        allowNull: false,
                        references: {
                            model: 'discount_campaigns',
                            key: 'id',
                        },
                        onUpdate: 'CASCADE',
                        onDelete: 'CASCADE',
                    },
                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal(
                            'CURRENT_TIMESTAMP'
                        ),
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal(
                            'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
                        ),
                    },
                },
                { transaction }
            );

            await queryInterface.addConstraint(
                'discount_campaign_brands',
                {
                    fields: ['campaign_id', 'brand_id'],
                    type: 'unique',
                    name: 'uq_discount_campaign_brand',
                    transaction,
                }
            );

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    async down(queryInterface) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            await queryInterface.dropTable(
                'discount_campaign_brands',
                { transaction }
            );
            await queryInterface.dropTable(
                'discount_campaign_categories',
                { transaction }
            );
            await queryInterface.dropTable(
                'discount_campaign_items',
                { transaction }
            );
            await queryInterface.dropTable(
                'discount_campaigns',
                { transaction }
            );

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },
};
