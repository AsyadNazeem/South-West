'use strict';

const { Op } = require('sequelize');
const { WebsiteTheme } = require('../models');

exports.getActiveTheme = async (req, res) => {
    try {
        const now = new Date();

        const theme = await WebsiteTheme.findOne({
            where: {
                is_active: true,
                [Op.and]: [
                    {
                        [Op.or]: [
                            { starts_at: null },
                            { starts_at: { [Op.lte]: now } },
                        ],
                    },
                    {
                        [Op.or]: [
                            { ends_at: null },
                            { ends_at: { [Op.gte]: now } },
                        ],
                    },
                ],
            },
            attributes: [
                'id',
                'name',
                'slug',
                'description',
                'config',
                'starts_at',
                'ends_at',
            ],
            order: [
                ['updated_at', 'DESC'],
                ['id', 'DESC'],
            ],
        });

        return res.status(200).json({
            message: 'Website theme retrieved successfully',
            data: theme,
        });
    } catch (error) {
        console.error('Get active website theme error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve active website theme',
        });
    }
};
