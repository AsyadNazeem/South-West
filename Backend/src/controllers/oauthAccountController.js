'use strict';

const { OAuthAccount, User } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'OAUTH_ACCOUNT';

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? null;

const getAccountSnapshot = (account) => {
    if (!account) return null;

    return {
        id: account.id,
        user_id: account.user_id,
        provider: account.provider,
        provider_user_id: account.provider_user_id,
        expires_at: account.expires_at ?? null
    };
};

const getSafeAccountResponse = (account) => {
    const data = account.toJSON();

    delete data.access_token;
    delete data.refresh_token;

    return data;
};

const auditOAuthAccount = async (
    req,
    {
        action,
        entityId = null,
        description = null,
        oldValues = null,
        newValues = null
    }
) => {
    try {
        await recordAuditLog({
            userId: getActorId(req),
            action,
            module: AUDIT_MODULE,
            entityType: 'OAuthAccount',
            entityId: entityId != null ? String(entityId) : null,
            description,
            oldValues,
            newValues,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null
        });
    } catch (auditError) {
        console.error(
            'OAuth account audit logging failed:',
            auditError.message
        );
    }
};

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
                    attributes: ['id', 'email', 'is_active']
                }
            ],
            order: [['id', 'DESC']]
        });

        await auditOAuthAccount(req, {
            action: 'OAUTH_ACCOUNT_LIST_VIEWED',
            description: 'Retrieved OAuth account records'
        });

        return res.status(200).json({
            message: 'OAuth accounts retrieved successfully',
            data: accounts
        });
    } catch (error) {
        console.error('Get OAuth accounts error:', error);

        await auditOAuthAccount(req, {
            action: 'OAUTH_ACCOUNT_LIST_FAILED',
            description: 'Failed to retrieve OAuth account records'
        });

        return res.status(500).json({
            message: 'Failed to retrieve OAuth accounts'
        });
    }
};

const getOAuthAccountById = async (req, res) => {
    const { id } = req.params;

    try {
        const account = await OAuthAccount.findByPk(id, {
            attributes: {
                exclude: ['access_token', 'refresh_token']
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'email', 'is_active']
                }
            ]
        });

        if (!account) {
            await auditOAuthAccount(req, {
                action: 'OAUTH_ACCOUNT_NOT_FOUND',
                entityId: id,
                description: 'Requested OAuth account was not found'
            });

            return res.status(404).json({
                message: 'OAuth account not found'
            });
        }

        await auditOAuthAccount(req, {
            action: 'OAUTH_ACCOUNT_VIEWED',
            entityId: account.id,
            description: 'Retrieved an OAuth account'
        });

        return res.status(200).json({
            message: 'OAuth account retrieved successfully',
            data: account
        });
    } catch (error) {
        console.error('Get OAuth account error:', error);

        await auditOAuthAccount(req, {
            action: 'OAUTH_ACCOUNT_VIEW_FAILED',
            entityId: id,
            description: 'Failed to retrieve OAuth account'
        });

        return res.status(500).json({
            message: 'Failed to retrieve OAuth account'
        });
    }
};

const createOAuthAccount = async (req, res) => {
    const {
        user_id,
        provider,
        provider_user_id,
        access_token,
        refresh_token,
        expires_at
    } = req.body;

    try {
        if (!user_id || !provider || !provider_user_id || !access_token) {
            await auditOAuthAccount(req, {
                action: 'OAUTH_ACCOUNT_CREATE_REJECTED',
                description: 'OAuth account creation rejected due to missing required fields',
                newValues: {
                    user_id: user_id ?? null,
                    provider: provider ?? null,
                    provider_user_id: provider_user_id ?? null
                }
            });

            return res.status(400).json({
                message: 'User ID, provider, provider user ID and access token are required'
            });
        }

        const user = await User.findByPk(user_id);

        if (!user) {
            await auditOAuthAccount(req, {
                action: 'OAUTH_ACCOUNT_CREATE_REJECTED',
                description: 'OAuth account creation rejected: user not found',
                newValues: {
                    user_id,
                    provider,
                    provider_user_id
                }
            });

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
            await auditOAuthAccount(req, {
                action: 'OAUTH_ACCOUNT_CREATE_REJECTED',
                entityId: existingAccount.id,
                description: 'OAuth account creation rejected: account already exists',
                newValues: {
                    user_id,
                    provider,
                    provider_user_id
                }
            });

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

        await auditOAuthAccount(req, {
            action: 'OAUTH_ACCOUNT_CREATED',
            entityId: account.id,
            description: 'Created an OAuth account',
            newValues: getAccountSnapshot(account)
        });

        return res.status(201).json({
            message: 'OAuth account created successfully',
            data: getSafeAccountResponse(account)
        });
    } catch (error) {
        console.error('Create OAuth account error:', error.message);

        await auditOAuthAccount(req, {
            action: 'OAUTH_ACCOUNT_CREATE_FAILED',
            description: 'Failed to create OAuth account',
            newValues: {
                user_id: user_id ?? null,
                provider: provider ?? null,
                provider_user_id: provider_user_id ?? null
            }
        });

        return res.status(500).json({
            message: 'Failed to create OAuth account'
        });
    }
};

const updateOAuthAccount = async (req, res) => {
    const { id } = req.params;

    try {
        const account = await OAuthAccount.findByPk(id);

        if (!account) {
            await auditOAuthAccount(req, {
                action: 'OAUTH_ACCOUNT_UPDATE_REJECTED',
                entityId: id,
                description: 'OAuth account update rejected: account not found'
            });

            return res.status(404).json({
                message: 'OAuth account not found'
            });
        }

        const oldValues = getAccountSnapshot(account);

        const {
            user_id,
            provider,
            provider_user_id,
            access_token,
            refresh_token,
            expires_at
        } = req.body;

        const updates = {};

        if (user_id !== undefined) {
            const user = await User.findByPk(user_id);

            if (!user) {
                await auditOAuthAccount(req, {
                    action: 'OAUTH_ACCOUNT_UPDATE_REJECTED',
                    entityId: account.id,
                    description: 'OAuth account update rejected: user not found',
                    oldValues,
                    newValues: { user_id }
                });

                return res.status(404).json({
                    message: 'User not found'
                });
            }

            updates.user_id = user_id;
        }

        if (provider !== undefined) {
            updates.provider = provider;
        }

        if (provider_user_id !== undefined) {
            updates.provider_user_id = provider_user_id;
        }

        if (access_token !== undefined) {
            updates.access_token = access_token;
        }

        if (refresh_token !== undefined) {
            updates.refresh_token = refresh_token;
        }

        if (expires_at !== undefined) {
            updates.expires_at = expires_at;
        }

        if (Object.keys(updates).length === 0) {
            await auditOAuthAccount(req, {
                action: 'OAUTH_ACCOUNT_UPDATE_REJECTED',
                entityId: account.id,
                description: 'OAuth account update rejected: no fields provided',
                oldValues
            });

            return res.status(400).json({
                message: 'No valid fields provided for update'
            });
        }

        // Validate the new provider identity against existing accounts.
        const nextProvider = updates.provider ?? account.provider;
        const nextProviderUserId =
            updates.provider_user_id ?? account.provider_user_id;

        const identityChanged =
            nextProvider !== account.provider ||
            nextProviderUserId !== account.provider_user_id;

        if (identityChanged) {
            const duplicate = await OAuthAccount.findOne({
                where: {
                    provider: nextProvider,
                    provider_user_id: nextProviderUserId
                }
            });

            if (duplicate && String(duplicate.id) !== String(account.id)) {
                await auditOAuthAccount(req, {
                    action: 'OAUTH_ACCOUNT_UPDATE_REJECTED',
                    entityId: account.id,
                    description: 'OAuth account update rejected: provider identity already exists',
                    oldValues,
                    newValues: {
                        provider: nextProvider,
                        provider_user_id: nextProviderUserId
                    }
                });

                return res.status(409).json({
                    message: 'OAuth account already exists'
                });
            }
        }

        await account.update(updates);

        await auditOAuthAccount(req, {
            action: 'OAUTH_ACCOUNT_UPDATED',
            entityId: account.id,
            description: 'Updated an OAuth account',
            oldValues,
            newValues: getAccountSnapshot(account)
        });

        return res.status(200).json({
            message: 'OAuth account updated successfully',
            data: getSafeAccountResponse(account)
        });
    } catch (error) {
        console.error('Update OAuth account error:', error.message);

        await auditOAuthAccount(req, {
            action: 'OAUTH_ACCOUNT_UPDATE_FAILED',
            entityId: id,
            description: 'Failed to update OAuth account'
        });

        return res.status(500).json({
            message: 'Failed to update OAuth account'
        });
    }
};

const deleteOAuthAccount = async (req, res) => {
    const { id } = req.params;

    try {
        const account = await OAuthAccount.findByPk(id);

        if (!account) {
            await auditOAuthAccount(req, {
                action: 'OAUTH_ACCOUNT_DELETE_REJECTED',
                entityId: id,
                description: 'OAuth account deletion rejected: account not found'
            });

            return res.status(404).json({
                message: 'OAuth account not found'
            });
        }

        const oldValues = getAccountSnapshot(account);

        await account.destroy();

        await auditOAuthAccount(req, {
            action: 'OAUTH_ACCOUNT_DELETED',
            entityId: id,
            description: 'Deleted an OAuth account',
            oldValues
        });

        return res.status(200).json({
            message: 'OAuth account deleted successfully'
        });
    } catch (error) {
        console.error('Delete OAuth account error:', error.message);

        await auditOAuthAccount(req, {
            action: 'OAUTH_ACCOUNT_DELETE_FAILED',
            entityId: id,
            description: 'Failed to delete OAuth account'
        });

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
