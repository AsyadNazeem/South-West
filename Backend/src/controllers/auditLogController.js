'use strict';

const { Op } = require('sequelize');
const { AuditLog, User } = require('../models');

const getAuditLogs = async (req, res) => {
    try {
        const {
            page = '1',
            limit = '20',
            action,
            module,
            user_id,
            entity_type,
            from,
            to
        } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);

        if (
            !Number.isInteger(pageNumber) ||
            pageNumber < 1 ||
            !Number.isInteger(pageSize) ||
            pageSize < 1 ||
            pageSize > 100
        ) {
            return res.status(400).json({
                message: 'Page must be positive and limit must be between 1 and 100'
            });
        }

        const where = {};

        if (action) {
            where.action = action;
        }

        if (module) {
            where.module = module;
        }

        if (entity_type) {
            where.entity_type = entity_type;
        }

        if (user_id !== undefined) {
            if (!/^\d+$/.test(String(user_id))) {
                return res.status(400).json({
                    message: 'Invalid user_id'
                });
            }

            where.user_id = user_id;
        }

        if (from || to) {
            where.created_at = {};

            if (from) {
                const fromDate = new Date(from);

                if (Number.isNaN(fromDate.getTime())) {
                    return res.status(400).json({
                        message: 'Invalid from date'
                    });
                }

                where.created_at[Op.gte] = fromDate;
            }

            if (to) {
                const toDate = new Date(to);

                if (Number.isNaN(toDate.getTime())) {
                    return res.status(400).json({
                        message: 'Invalid to date'
                    });
                }

                where.created_at[Op.lte] = toDate;
            }

            if (
                from &&
                to &&
                new Date(from) > new Date(to)
            ) {
                return res.status(400).json({
                    message: 'from must be earlier than or equal to to'
                });
            }
        }

        const result = await AuditLog.findAndCountAll({
            where,
            attributes: [
                'id',
                'user_id',
                'action',
                'module',
                'entity_type',
                'entity_id',
                'description',
                'old_values',
                'new_values',
                'ip_address',
                'user_agent',
                'request_id',
                'created_at'
            ],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'email'],
                    required: false
                }
            ],
            order: [
                ['created_at', 'DESC'],
                ['id', 'DESC']
            ],
            limit: pageSize,
            offset: (pageNumber - 1) * pageSize,
            distinct: true
        });

        return res.status(200).json({
            message: 'Audit logs retrieved successfully',
            data: result.rows,
            pagination: {
                page: pageNumber,
                limit: pageSize,
                total: result.count,
                totalPages: Math.ceil(result.count / pageSize)
            }
        });
    } catch (error) {
        console.error('Get audit logs error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve audit logs'
        });
    }
};

module.exports = {
    getAuditLogs
};
