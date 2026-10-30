const express = require("express");
const router = express.Router();

const { DeliveryDistrict } = require("../models");

router.get("/", async (req, res) => {
    try {
        const districts = await DeliveryDistrict.findAll({
            order: [["district_name", "ASC"]]
        });

        res.json({
            success: true,
            data: districts
        });

    } catch (error) {
        console.error("Failed to load delivery districts:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load delivery districts."
        });
    }
});

module.exports = router;
