'use strict';

const { Op } = require('sequelize');
const { WebsiteTheme, sequelize } = require('../models');
const registeredThemes = require('../config/websiteThemes');

async function syncWebsiteThemes() {
    const slugs = registeredThemes.map(theme => theme.slug);

    if (new Set(slugs).size !== slugs.length) {
        throw new Error('Duplicate slugs in website theme registry.');
    }

    const result = {
        created: 0,
        updated: 0,
        unchanged: 0,
        disabled: 0
    };

    await sequelize.transaction(async transaction => {
        for (const definition of registeredThemes) {
            const values = {
                name: definition.name,
                description: definition.description || null,
                config: definition.config,
                starts_at: null,
                ends_at: null
            };

            const [theme, created] = await WebsiteTheme.findOrCreate({
                where: { slug: definition.slug },
                defaults: {
                    ...values,
                    is_active: false
                },
                transaction
            });

            if (created) {
                result.created++;
                continue;
            }

            const changed =
                theme.name !== values.name ||
                theme.description !== values.description ||
                JSON.stringify(theme.config) !==
                    JSON.stringify(values.config) ||
                theme.starts_at !== null ||
                theme.ends_at !== null;

            if (changed) {
                await theme.update(values, { transaction });
                result.updated++;
            } else {
                result.unchanged++;
            }
        }

        const [disabled] = await WebsiteTheme.update(
            { is_active: false },
            {
                where: {
                    slug: { [Op.notIn]: slugs },
                    is_active: true
                },
                transaction
            }
        );

        result.disabled = disabled;
    });

    return result;
}

module.exports = {
    syncWebsiteThemes
};
