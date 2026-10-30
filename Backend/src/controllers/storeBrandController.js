const { Brand } = require('../models');

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

        return res.status(200).json({
            success: true,
            data: brands
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