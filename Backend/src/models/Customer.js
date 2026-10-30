
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Customer = sequelize.define(
        'Customer',
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },

            customer_code: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
            },

            first_name: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },

            last_name: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },

            email: {
                type: DataTypes.STRING(255),
                allowNull: true,
                validate: {
                    isEmail: true,
                },
            },

            phone: {
                type: DataTypes.STRING(30),
                allowNull: true,
            },

google_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
},

            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },

            // Customer authentication fields
            password_hash: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },

            email_verified_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },

            phone_verified_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'customers',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    Customer.associate = (models) => {
        Customer.hasMany(models.CustomerAddress, {
            foreignKey: 'customer_id',
            as: 'addresses',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        });

        Customer.hasMany(models.Order, {
            foreignKey: 'customer_id',
            as: 'orders',
        });

        Customer.hasMany(models.Invoice, {
            foreignKey: 'customer_id',
            as: 'invoices',
        });

        Customer.hasMany(models.Cart, {
            foreignKey: 'customer_id',
            as: 'carts',
        });

        Customer.hasMany(models.Wishlist, {
            foreignKey: 'customer_id',
            as: 'wishlists',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        });

        Customer.hasMany(models.ProductReview, {
            foreignKey: 'customer_id',
            as: 'productReviews',
        });

        Customer.hasMany(models.Notification, {
            foreignKey: 'customer_id',
            as: 'notifications',
        });

        Customer.hasOne(models.NotificationPreference, {
            foreignKey: 'customer_id',
            as: 'notificationPreferences',
        });

        Customer.hasMany(models.CustomerSession, {
            foreignKey: 'customer_id',
            as: 'sessions',
        });

        Customer.hasMany(models.CustomerEmailVerification, {
            foreignKey: 'customer_id',
            as: 'emailVerifications',
        });

        Customer.hasMany(models.CustomerPasswordSetupToken, {
            foreignKey: 'customer_id',
            as: 'passwordSetupTokens',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        });
    };

    return Customer;
};
