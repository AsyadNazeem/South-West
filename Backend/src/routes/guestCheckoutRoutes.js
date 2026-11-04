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
const {
    createGuestCheckoutSessionLimiter,
    guestCheckoutQuoteLimiter,
    guestCheckoutCartLimiter,
    guestCheckoutSubmitLimiter
} = require('../middleware/guestCheckoutRateLimit');

router.post('/session', createGuestCheckoutSessionLimiter, createSession);
router.post('/quote', guestCheckoutQuoteLimiter, quoteGuestCheckout);
router.post('/', guestCheckoutSubmitLimiter, checkoutGuest);
router.get('/session', guestCheckoutCartLimiter, getGuestCart);
router.post('/session/items', guestCheckoutCartLimiter, addGuestCartItem);
router.patch('/session/items', guestCheckoutCartLimiter, updateGuestCartItem);
router.delete('/session/items', guestCheckoutCartLimiter, removeGuestCartItem);

module.exports = router;
