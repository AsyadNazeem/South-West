
const express = require('express');
const { getStoreCategories } = require('../controllers/storeCategoryController');

const router = express.Router();

router.get('/', getStoreCategories);

module.exports = router;
