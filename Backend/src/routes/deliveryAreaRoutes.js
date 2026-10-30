const express = require("express")

const router = express.Router()

const {
    getDeliveryAreas,
    getAreasByDistrict,
    calculateDeliveryCharge
} = require("../controllers/deliveryAreaController")


// =====================================================
// GET ALL DELIVERY AREAS
// GET /delivery-areas
//
// Optional:
// GET /delivery-areas?district_id=1
// =====================================================

router.get("/", getDeliveryAreas)


// =====================================================
// GET AREAS BY DISTRICT
// GET /delivery-areas/by-district?district_id=1
// =====================================================

router.get("/by-district", getAreasByDistrict)


// =====================================================
// CALCULATE DELIVERY CHARGE
// POST /delivery-areas/calculate
// =====================================================

router.post("/calculate", calculateDeliveryCharge)


module.exports = router
