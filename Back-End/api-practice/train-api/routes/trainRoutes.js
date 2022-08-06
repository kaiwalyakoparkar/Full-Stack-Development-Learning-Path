const express = require('express');
const trainsController = require('../controllers/trainsController')

const route = express.Router();

route.get('/', trainsController.getAllTrains);

module.exports = route