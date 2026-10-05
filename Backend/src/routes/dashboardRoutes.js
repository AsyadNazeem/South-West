const express = require("express")

const router = express.Router()

const {
    getDashboard
} = require("../controllers/dashboardController")
const authenticate = require('../middleware/authMiddleware')
const requirePermission = require('../middleware/permissionMiddleware')

router.get("/", authenticate, requirePermission('dashboard.view'), getDashboard)

module.exports = router
