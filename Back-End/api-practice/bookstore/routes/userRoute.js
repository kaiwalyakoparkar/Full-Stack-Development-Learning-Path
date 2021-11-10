//Eternal imports
const express = require('express');

//Variable delarations
const route = express.Router();

route.use(express.json());

const userController = require('../controllers/userController.js');

route.route('/').get(userController.getAllUsers);

module.exports = route;