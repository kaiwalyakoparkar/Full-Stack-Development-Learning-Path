//Eternal imports
const express = require('express');

//Variable delarations
const route = express.Router();

route.use(express.json());

const userController = require('../controllers/userController.js');
const authController = require('../controllers/authController');

route.post('/signup', authController.signup);
route.post('/login', authController.login);

route.route('/').get(authController.protect, authController.restrictTo('admin'), userController.getAllUsers);
route.route('/me').get(authController.protect, userController.getMe, userController.getSingleUser);
route.route('/updateMe').get(authController.protect, userController.updateMe);
route.route('/deleteMe').get(authController.protect, userController.deleteMe);

module.exports = route;