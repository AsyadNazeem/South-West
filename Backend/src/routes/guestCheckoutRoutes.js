'use strict';

const express = require('express');
const router = express.Router();

const {
    createSession,
    quoteGuestCheckout,
    checkoutGuest,
    getGuestCart,
    addGuestCartItem,
    updateGuestCartItem,
    removeGuestCartItem
} = require('../controllers/guestCheckoutController');

router.post('/session', createSession);
router.post('/quote', quoteGuestCheckout);
router.post('/', checkoutGuest);
router.get('/session', getGuestCart);
router.post('/session/items', addGuestCartItem);
router.patch('/session/items', updateGuestCartItem);
router.delete('/session/items', removeGuestCartItem);

module.exports = router;
