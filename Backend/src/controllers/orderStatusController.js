'use strict';

const crypto = require('crypto');

const {
    sequelize,
    Order,
    OrderAddress,
    Customer,
    Delivery,
    DeliveryStatusHistory,
    Notification
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');

const {
    sendDeliveryTrackingEmail,
    sendOrderStatusEmail
} = require('../services/emailService');

const STATUS_LABELS = {
    confirmed: 'Order Confirmed',
    processing: 'Order Ready to Deliver',
    shipped: 'Order Handed Over to Courier',
    delivered: 'Order Completed',
    returned: 'Order Returned',
    cancelled: 'Order Cancelled'
};

const ALLOWED_TRANSITIONS = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    partially_shipped: ['shipped', 'cancelled'],
    shipped: ['delivered', 'returned'],
    delivered: ['returned'],
    cancelled: [],
    returned: []
};

const MAX_REASON_LENGTH = 2000;

function validId(value) {
    return /^[1-9]\d*$/.test(String(value ?? ''));
}

function getActorId(req) {
    return req.user?.id ?? req.user?.user_id ?? null;
}

function customerName(customer) {
    return [customer?.first_name, customer?.last_name]
        .filter(Boolean)
        .join(' ');
}

function getStatusMessage(status, reason, delivery) {
    const messages = {
        confirmed: 'Your order has been confirmed.',
        processing: 'Your order is ready for delivery.',
        shipped: `Your order has been handed over to ${delivery.courier_name}. Tracking number: ${delivery.tracking_number}.`,
        delivered: 'Your order has been completed and delivered.',
        returned: 'Your order has been marked as returned.',
        cancelled: 'Your order has been cancelled.'
    };

    let message = messages[status];

    if (reason) {
        message += ` Reason: ${reason}`;
    }

    return message;
}

async function auditEmailFailure(order, status, error) {
    try {
        await recordAuditLog({
            action: 'ORDER_STATUS_EMAIL_FAILED',
            module: 'orders',
            entityType: 'order',
            entityId: order.id,
            description:
                `Order ${order.order_number}: email for ${status} failed`,
            newValues: {
                status,
                error: String(error.message || 'Email delivery failed')
                    .slice(0, 500)
            }
        });
    } catch (auditError) {
        console.error(
            'Failed to audit order email failure:',
            auditError.message
        );
    }
}

exports.updateOrderStatus = async (req, res) => {
    let transaction;
    let committed = false;
    let emailPayload = null;
    let trackingEmail = false;
    let orderSnapshot = null;
    let notificationId = null;

    try {
        const { id } = req.params;
        const body = req.body;

        if (!validId(id)) {
            return res.status(400).json({
                message: 'Invalid order ID.'
            });
        }

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return res.status(400).json({
                message: 'Request body must be an object.'
            });
        }

        const allowedFields = [
            'status',
            'reason',
            'courier_name',
            'tracking_number',
            'expected_delivery_date'
        ];

        const unsupportedFields = Object.keys(body).filter(
            field => !allowedFields.includes(field)
        );

        if (unsupportedFields.length) {
            return res.status(400).json({
                message: `Unsupported fields: ${unsupportedFields.join(', ')}`
            });
        }

        const nextStatus = body.status;

        if (
            typeof nextStatus !== 'string' ||
            !Object.prototype.hasOwnProperty.call(STATUS_LABELS, nextStatus)
        ) {
            return res.status(400).json({
                message: 'Invalid order status.'
            });
        }

        let reason = null;

        if (['cancelled', 'returned'].includes(nextStatus)) {
            if (
                typeof body.reason !== 'string' ||
                !body.reason.trim()
            ) {
                return res.status(400).json({
                    message: 'A reason is required for cancellation or return.'
                });
            }

            reason = body.reason.trim();

            if (reason.length > MAX_REASON_LENGTH) {
                return res.status(400).json({
                    message: `Reason must not exceed ${MAX_REASON_LENGTH} characters.`
                });
            }
        } else if (body.reason !== undefined) {
            if (typeof body.reason !== 'string') {
                return res.status(400).json({
                    message: 'Reason must be a string.'
                });
            }

            reason = body.reason.trim() || null;
        }

        if (nextStatus === 'shipped') {
            if (
                typeof body.courier_name !== 'string' ||
                !body.courier_name.trim() ||
                typeof body.tracking_number !== 'string' ||
                !body.tracking_number.trim()
            ) {
                return res.status(400).json({
                    message: 'Courier name and tracking number are required for handover.'
                });
            }

            if (
                body.courier_name.trim().length > 150 ||
                body.tracking_number.trim().length > 150
            ) {
                return res.status(400).json({
                    message: 'Courier name and tracking number must not exceed 150 characters.'
                });
            }
        }

        transaction = await sequelize.transaction();

        const order = await Order.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!order) {
            await transaction.rollback();
            transaction = null;

            return res.status(404).json({
                message: 'Order not found.'
            });
        }

        const previousStatus = order.status;

        if (previousStatus === nextStatus) {
            await transaction.rollback();
            transaction = null;

            return res.status(200).json({
                message: 'Order status is unchanged.',
                data: {
                    id: order.id,
                    order_number: order.order_number,
                    status: order.status,
                    payment_status: order.payment_status
                }
            });
        }

        const allowedNextStatuses =
            ALLOWED_TRANSITIONS[previousStatus] || [];

        if (!allowedNextStatuses.includes(nextStatus)) {
            await transaction.rollback();
            transaction = null;

            return res.status(409).json({
                message:
                    `Cannot change order status from ${previousStatus} to ${nextStatus}.`,
                current_status: previousStatus,
                allowed_statuses: allowedNextStatuses
            });
        }

        const customer = order.customer_id
            ? await Customer.findByPk(order.customer_id, {
                attributes: ['id', 'first_name', 'last_name', 'email'],
                transaction
            })
            : null;

        const deliveries = await Delivery.findAll({
            where: { order_id: order.id },
            order: [['id', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (nextStatus === 'shipped') {
            if (deliveries.length > 1) {
                await transaction.rollback();
                transaction = null;

                return res.status(409).json({
                    message:
                        'Courier handover cannot continue because multiple delivery records are associated with this order.',
                    delivery_count: deliveries.length
                });
            }

            if (body.expected_delivery_date !== undefined) {
                if (
                    typeof body.expected_delivery_date !== 'string' ||
                    !body.expected_delivery_date.trim() ||
                    Number.isNaN(Date.parse(body.expected_delivery_date))
                ) {
                    await transaction.rollback();
                    transaction = null;

                    return res.status(400).json({
                        message: 'Expected delivery date must be a valid date.'
                    });
                }
            }

            const courierName = body.courier_name.trim();
            const trackingNumber = body.tracking_number.trim();
            let delivery = deliveries[0];

            if (!delivery) {
                const shippingAddress = await OrderAddress.findOne({
                    where: {
                        order_id: order.id,
                        address_type: 'shipping'
                    },
                    transaction,
                    lock: transaction.LOCK.UPDATE
                });

                if (!shippingAddress) {
                    await transaction.rollback();
                    transaction = null;

                    return res.status(409).json({
                        message:
                            'Courier handover cannot continue because the order has no saved shipping address.'
                    });
                }

                delivery = await Delivery.create({
                    delivery_reference:
                        `SWD-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`,
                    order_id: order.id,
                    delivery_method: 'standard',
                    delivery_status: 'dispatched',
                    recipient_name: shippingAddress.recipient_name,
                    recipient_phone: shippingAddress.phone,
                    address_line_1: shippingAddress.address_line_1,
                    address_line_2: shippingAddress.address_line_2,
                    city: shippingAddress.city,
                    state: shippingAddress.state,
                    postal_code: shippingAddress.postal_code,
                    country: shippingAddress.country,
                    delivery_charge: order.shipping_amount ?? 0,
                    courier_name: courierName,
                    tracking_number: trackingNumber,
                    dispatched_at: new Date(),
                    expected_delivery_date:
                        body.expected_delivery_date !== undefined
                            ? new Date(body.expected_delivery_date)
                            : null
                }, { transaction });

                deliveries.push(delivery);
            } else {
                if (
                    !['pending', 'processing', 'ready_for_dispatch']
                        .includes(delivery.delivery_status)
                ) {
                    await transaction.rollback();
                    transaction = null;

                    return res.status(409).json({
                        message:
                            `This delivery cannot be dispatched from ${delivery.delivery_status}.`
                    });
                }

                delivery.delivery_status = 'dispatched';
                delivery.courier_name = courierName;
                delivery.tracking_number = trackingNumber;

                if (!delivery.dispatched_at) {
                    delivery.dispatched_at = new Date();
                }

                if (body.expected_delivery_date !== undefined) {
                    delivery.expected_delivery_date =
                        new Date(body.expected_delivery_date);
                }

                await delivery.save({ transaction });
            }

            await DeliveryStatusHistory.create({
                delivery_id: delivery.id,
                status: 'dispatched',
                notes: `Order handed over to courier. Tracking number: ${trackingNumber}`,
                changed_by: getActorId(req)
            }, { transaction });

            trackingEmail = true;
        }

        if (nextStatus === 'delivered') {
            if (order.payment_status !== 'paid') {
                await transaction.rollback();
                transaction = null;

                return res.status(409).json({
                    message:
                        'The order cannot be completed until payment has been fully received.',
                    payment_status: order.payment_status,
                    total_amount: order.total_amount
                });
            }

            if (deliveries.length === 0) {
                await transaction.rollback();
                transaction = null;

                return res.status(409).json({
                    message:
                        'The order cannot be completed because it has no associated delivery.'
                });
            }

            const unfinished = deliveries.filter(
                delivery => delivery.delivery_status !== 'delivered'
            );

            if (unfinished.length > 0) {
                await transaction.rollback();
                transaction = null;

                return res.status(409).json({
                    message:
                        'The order cannot be completed until every associated delivery is marked delivered.',
                    unfinished_delivery_ids: unfinished.map(
                        delivery => delivery.id
                    )
                });
            }
        }

        if (nextStatus === 'cancelled' || nextStatus === 'returned') {
            const targetDeliveryStatus =
                nextStatus === 'cancelled' ? 'cancelled' : 'returned';

            for (const delivery of deliveries) {
                if (delivery.delivery_status === 'delivered') {
                    if (nextStatus === 'cancelled') {
                        await transaction.rollback();
                        transaction = null;

                        return res.status(409).json({
                            message:
                                'A delivered order cannot be cancelled. Use the return workflow instead.'
                        });
                    }
                }

                if (
                    ['cancelled', 'returned'].includes(delivery.delivery_status) &&
                    delivery.delivery_status !== targetDeliveryStatus
                ) {
                    await transaction.rollback();
                    transaction = null;

                    return res.status(409).json({
                        message:
                            'The order delivery already has a different terminal status.'
                    });
                }

                if (delivery.delivery_status !== targetDeliveryStatus) {
                    delivery.delivery_status = targetDeliveryStatus;

                    if (nextStatus === 'returned') {
                        delivery.notes = [
                            delivery.notes,
                            `Return reason: ${reason}`
                        ].filter(Boolean).join('\n');
                    }

                    await delivery.save({ transaction });

                    await DeliveryStatusHistory.create({
                        delivery_id: delivery.id,
                        status: targetDeliveryStatus,
                        notes: reason,
                        changed_by: getActorId(req)
                    }, { transaction });
                }
            }
        }

        await order.update(
            { status: nextStatus },
            { transaction, fields: ['status'] }
        );

        // Walk-in orders may not have a linked customer account.
        // Only create an in-app notification for a valid customer.
        if (customer) {
            await Notification.create({
                customer_id: customer.id,
                type: 'order_status',
                title: STATUS_LABELS[nextStatus],
                message: getStatusMessage(
                    nextStatus,
                    reason,
                    deliveries[0] || {}
                ),
                reference_type: 'order',
                reference_id: order.id,
                is_read: false,
                read_at: null
            }, { transaction });
        }

        await recordAuditLog({
            userId: getActorId(req),
            action: 'ORDER_STATUS_UPDATED',
            module: 'orders',
            entityType: 'order',
            entityId: order.id,
            description:
                `Order ${order.order_number} status changed from ${previousStatus} to ${nextStatus}`,
            oldValues: { status: previousStatus },
            newValues: {
                status: nextStatus,
                reason,
                delivery_ids: deliveries.map(delivery => delivery.id)
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || req.requestId || null,
            transaction
        });

        orderSnapshot = {
            id: order.id,
            order_number: order.order_number,
            customerName: customerName(customer),
            email: customer?.email || null,
            status: nextStatus,
            previousStatus,
            reason,
            courierName: deliveries[0]?.courier_name || null,
            trackingNumber: deliveries[0]?.tracking_number || null,
            expectedDeliveryDate:
                deliveries[0]?.expected_delivery_date || null
        };

        await transaction.commit();
        transaction = null;
        committed = true;

        let emailStatus = 'skipped_missing_customer_email';

        if (orderSnapshot.email) {
            try {
                if (trackingEmail) {
                    await sendDeliveryTrackingEmail({
                        email: orderSnapshot.email,
                        customerName: orderSnapshot.customerName,
                        orderNumber: orderSnapshot.order_number,
                        trackingNumber: orderSnapshot.trackingNumber,
                        courierName: orderSnapshot.courierName,
                        expectedDeliveryDate:
                            orderSnapshot.expectedDeliveryDate
                    });
                } else {
                    await sendOrderStatusEmail({
                        email: orderSnapshot.email,
                        customerName: orderSnapshot.customerName,
                        orderNumber: orderSnapshot.order_number,
                        statusLabel: STATUS_LABELS[nextStatus],
                        reason: orderSnapshot.reason
                    });
                }

                emailStatus = 'sent';
            } catch (emailError) {
                emailStatus = 'failed';

                console.error(
                    `Order status email failed for ${orderSnapshot.order_number}:`,
                    emailError.message
                );

                await auditEmailFailure(order, nextStatus, emailError);
            }
        }

        return res.status(200).json({
            message: emailStatus === 'failed'
                ? 'Order status updated, but the customer email could not be sent.'
                : 'Order status updated successfully.',
            data: {
                id: orderSnapshot.id,
                order_number: orderSnapshot.order_number,
                status: orderSnapshot.status,
                payment_status: order.payment_status
            },
            email_status: emailStatus
        });
    } catch (error) {
        if (transaction && !committed && !transaction.finished) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(
                    'Order status rollback failed:',
                    rollbackError.message
                );
            }
        }

        console.error('Update order status error:', error);

        return res.status(500).json({
            message: 'Failed to update order status.'
        });
    }
};
