const { DeliveryDistrict } = require('../models');

const getDistricts = async (req, res) => {
    try {
        const districts = await DeliveryDistrict.findAll({
            where: {
                status: 1
            },
            attributes: ['id', 'district_name'],
            order: [['district_name', 'ASC']]
        });

        return res.json({
            success: true,
            data: districts
        });

    } catch (error) {
        console.error('Get districts error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load delivery districts.'
        });
    }
};

module.exports = {
    getDistricts
};
