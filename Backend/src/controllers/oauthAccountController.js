'use strict';

const { OAuthAccount, User } = require('../models');

const getOAuthAccounts = async (req, res) => {
    try {
        const accounts = await OAuthAccount.findAll({
            attributes: {
                exclude: ['access_token', 'refresh_token']
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: [
                        'id',
                        'email',
                        'is_active'
                    ]
                }
            ],
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'OAuth accounts retrieved successfully',
            data: accounts
        });
    } catch (error) {
        console.error('Get OAuth accounts error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve OAuth accounts'
        });
    }
};


const getOAuthAccountById = async (req, res) => {
    try {
        const { id } = req.params;

        const account = await OAuthAccount.findByPk(id, {
            attributes: {
                exclude: ['access_token', 'refresh_token']
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: [
                        'id',
                        'email',
                        'is_active'
                    ]
                }
            ]
        });

        if (!account) {
            return res.status(404).json({
                message: 'OAuth account not found'
            });
        }

        return res.status(200).json({
            message: 'OAuth account retrieved successfully',
            data: account
        });
    } catch (error) {
        console.error('Get OAuth account error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve OAuth account'
        });
    }
};


const createOAuthAccount = async (req, res) => {
    try {
        const {
            user_id,
            provider,
            provider_user_id,
            access_token,
            refresh_token,
            expires_at
        } = req.body;

        if (!user_id) {
            return res.status(400).json({
                message: 'User ID is required'
            });
        }

        if (!provider) {
            return res.status(400).json({
                message: 'Provider is required'
            });
        }

        if (!provider_user_id) {
            return res.status(400).json({
                message: 'Provider user ID is required'
            });
        }

        if (!access_token) {
            return res.status(400).json({
                message: 'Access token is required'
            });
        }

        const user = await User.findByPk(user_id);

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        const existingAccount = await OAuthAccount.findOne({
            where: {
                provider,
                provider_user_id
            }
        });

        if (existingAccount) {
            return res.status(409).json({
                message: 'OAuth account already exists'
            });
        }

        const account = await OAuthAccount.create({
            user_id,
            provider,
            provider_user_id,
            access_token,
            refresh_token: refresh_token || null,
            expires_at: expires_at || null
        });

        const responseData = account.toJSON();

        delete responseData.access_token;
        delete responseData.refresh_token;

        return res.status(201).json({
            message: 'OAuth account created successfully',
            data: responseData
        });
    } catch (error) {
        console.error('Create OAuth account error:', error);

        return res.status(500).json({
            message: 'Failed to create OAuth account'
        });
    }
};


const updateOAuthAccount = async (req, res) => {
    try {
        const { id } = req.params;

        const account = await OAuthAccount.findByPk(id);

        if (!account) {
            return res.status(404).json({
                message: 'OAuth account not found'
            });
        }

        const {
            user_id,
            provider,
            provider_user_id,
            access_token,
            refresh_token,
            expires_at
        } = req.body;

        if (user_id !== undefined) {
            const user = await User.findByPk(user_id);

            if (!user) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }

            account.user_id = user_id;
        }

        if (provider !== undefined) {
            account.provider = provider;
        }

        if (provider_user_id !== undefined) {
            account.provider_user_id = provider_user_id;
        }

        if (access_token !== undefined) {
            account.access_token = access_token;
        }

        if (refresh_token !== undefined) {
            account.refresh_token = refresh_token;
        }

        if (expires_at !== undefined) {
            account.expires_at = expires_at;
        }

        await account.save();

        const responseData = account.toJSON();

        delete responseData.access_token;
        delete responseData.refresh_token;

        return res.status(200).json({
            message: 'OAuth account updated successfully',
            data: responseData
        });
    } catch (error) {
        console.error('Update OAuth account error:', error);

        return res.status(500).json({
            message: 'Failed to update OAuth account'
        });
    }
};


const deleteOAuthAccount = async (req, res) => {
    try {
        const { id } = req.params;

        const account = await OAuthAccount.findByPk(id);

        if (!account) {
            return res.status(404).json({
                message: 'OAuth account not found'
            });
        }

        await account.destroy();

        return res.status(200).json({
            message: 'OAuth account deleted successfully'
        });
    } catch (error) {
        console.error('Delete OAuth account error:', error);

        return res.status(500).json({
            message: 'Failed to delete OAuth account'
        });
    }
};


module.exports = {
    getOAuthAccounts,
    getOAuthAccountById,
    createOAuthAccount,
    updateOAuthAccount,
    deleteOAuthAccount
};
