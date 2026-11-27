'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const ExcelJS = require('exceljs');
const { Sequelize, DataTypes } = require('sequelize');
const proxyquire = require('proxyquire').noCallThru();

const socketPath = process.env.SALES_FIXTURE_SOCKET;

test('dashboard and online reports recognize discounted product revenue', { skip: !socketPath }, async t => {
    // A connection-local table disappears when the test closes its connection.
    const sequelize = new Sequelize('mysql', 'root', '', {
        dialect: 'mysql', dialectOptions: { socketPath }, timezone: '+05:30',
        pool: { max: 1 }, logging: false
    });
    t.after(() => sequelize.close());
    const Order = require('../models/Order')(sequelize, DataTypes);
    const reports = proxyquire('../services/reportService', { '../models': { Order } });
    await sequelize.query(`CREATE TEMPORARY TABLE orders (
        id INT PRIMARY KEY AUTO_INCREMENT, order_number VARCHAR(30), order_date DATETIME,
        status VARCHAR(30), payment_status VARCHAR(30), order_type VARCHAR(30) DEFAULT 'online',
        subtotal DECIMAL(15,2), discount_amount DECIMAL(15,2), tax_amount DECIMAL(15,2),
        shipping_amount DECIMAL(15,2), total_amount DECIMAL(15,2)
    )`);
    assert.equal(await reports.getDashboardSales(), 0);
    await sequelize.query(`INSERT INTO orders
        (order_number, order_date, status, payment_status, subtotal, discount_amount, tax_amount, shipping_amount, total_amount)
        VALUES
        ('A','2026-10-31 23:59:59','delivered','paid',10000,500,0,350,9850),
        ('B','2026-11-01','pending','unpaid',100.28,0.09,0,0,100.19),
        ('C','2026-11-01','confirmed','partially_refunded',20,0,1,5,26),
        ('D','2026-11-01','delivered','refunded',40,9.99,0,5,35.01),
        ('E','2026-11-01','cancelled','paid',120,10,0,30,140),
        ('F','2026-11-01','returned','refunded',50,0,0,5,55),
        ('G','2026-11-02','pending','partially_paid',10,0,0,1,11)`);
    assert.equal(await reports.getDashboardSales(), 9660.2);
    const range = { startDate: '2026-10-31', endDate: '2026-11-01' };
    const summary = await reports.getOnlineSalesSummary(range);
    assert.deepEqual(summary.rows.map(row => [row.totalAmount, row.totalSales]),
        [[9850, 9500], [100.19, 100.19], [26, 20], [35.01, 30.01]]);
    for (const service of [reports.getOnlineSalesSummary, reports.getDailyOnlineSales, reports.getMonthlyOnlineSales]) {
        const result = await service(range);
        assert.equal(result.totals.orderCount, 4);
        assert.equal(result.totals.totalSales, 9650.2);
        assert.equal(result.totals.shippingAmount, 360);
        const empty = await service({ startDate: '2026-12-01', endDate: '2026-12-01' });
        assert.deepEqual(empty.rows, []);
        assert.equal(empty.totals.totalSales, 0);
    }
    for (const [service, periods] of [
        [reports.getDailyOnlineSales, ['2026-10-31', '2026-11-01']],
        [reports.getMonthlyOnlineSales, ['2026-10', '2026-11']]
    ]) {
        const { rows } = await service(range);
        assert.deepEqual(rows.map(row => row.period), periods);
        assert.deepEqual(rows.map(row => row.totalSales), [9500, 150.2]);
    }

    const controller = proxyquire('../controllers/reportController', { '../services/reportService': reports });
    for (const exportReport of [controller.exportSalesSummary, controller.exportDailySales, controller.exportMonthlySales]) {
        const response = new PassThrough();
        response.setHeader = () => {};
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        await exportReport({ query: range }, response);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(Buffer.concat(chunks));
        const sheet = workbook.worksheets[0];
        assert.equal(sheet.getCell('G2').value, 9500);
        const totalRow = sheet.getColumn(1).values.indexOf('TOTAL');
        assert.equal(sheet.getCell(totalRow, 6).value, 360);
        assert.equal(sheet.getCell(totalRow, 7).value, 9650.2);
    }
});
