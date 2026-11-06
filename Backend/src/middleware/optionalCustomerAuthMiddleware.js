'use strict';

const customerAuth = require('./customerAuthMiddleware');

// Authenticate when a customer token is supplied, but allow requests without one.
function optionalCustomerAuthMiddleware(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return next();
    }

    return customerAuth(req, res, next);
}

module.exports = optionalCustomerAuthMiddleware;
