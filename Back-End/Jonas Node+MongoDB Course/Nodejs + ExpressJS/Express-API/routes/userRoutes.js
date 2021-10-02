const express = require('express');
const route = express.Router();
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

route.post('/signup', authController.signup);
route.post('/login', authController.login);

route.post('/forgotPassword', authController.forgotPassword);
route.patch('/resetPassword:token', authController.resetPassword);

route
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.addNewUser);

route
  .route('/:id')
  .get(userController.getSingleUser)
  .patch(userController.updateSingleUser)
  .delete(userController.deleteSingleUser);

module.exports = route;