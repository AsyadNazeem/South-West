'use strict';

const { Op } = require('sequelize');
const { WebsiteTheme } = require('../models');
const registeredThemes = require('../config/websiteThemes');

exports.getActiveTheme = async (req, res) => {
    try {
        const registeredSlugs = registeredThemes.map(
            theme => theme.slug
        );

        const theme = await WebsiteTheme.findOne({
            where: {
                is_active: true,
                slug: { [Op.in]: registeredSlugs }
            },
            attributes: [
                'id',
                'name',
                'slug',
                'description',
                'config'
            ],
            order: [
                ['updated_at', 'DESC'],
                ['id', 'DESC']
            ]
        });

        res.set('Cache-Control', 'no-store');

        return res.status(200).json({
            message: 'Website theme retrieved successfully',
            data: theme || null
        });

    } catch (error) {
        console.error('Get active website theme error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve active website theme'
        });
    }
};
