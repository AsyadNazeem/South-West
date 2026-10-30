const express = require('express');
const router = express.Router();

const {
    getStoreBrands
} = require('../controllers/storeBrandController');

router.get('/', getStoreBrands);

module.exports = router;