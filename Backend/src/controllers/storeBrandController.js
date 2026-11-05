const { Brand } = require('../models');
const { getResponsiveImageMetadata } = require('../utils/fileStorage');

const getStoreBrands = async (req, res) => {
    try {
        const brands = await Brand.findAll({
            where: {
                is_active: true
            },
            attributes: [
                'id',
                'name',
                'code',
                'image_url'
            ],
            order: [['name', 'ASC']]
        });

        const responsiveImageCache = new Map();
        const data = await Promise.all(brands.map(async (brand) => {
            const value = typeof brand.toJSON === 'function'
                ? brand.toJSON()
                : brand;
            return {
                ...value,
                responsive_images: await getResponsiveImageMetadata(
                    value.image_url,
                    'brands',
                    responsiveImageCache
                ),
            };
        }));

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Failed to load store brands:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load brands'
        });
    }
};

module.exports = {
    getStoreBrands
};
