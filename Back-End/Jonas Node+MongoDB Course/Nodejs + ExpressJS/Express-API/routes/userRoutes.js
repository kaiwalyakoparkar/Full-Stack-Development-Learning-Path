const express = require('express');
const multer = require('multer');

const route = express.Router();
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const upload = multer({dest: 'public/img/users'});

route.post('/signup', authController.signup);
route.post('/login', authController.login);

route.post('/forgotPassword', authController.forgotPassword);
route.patch('/resetPassword/:token', authController.resetPassword);

route.patch('/updatePassword', authController.protect,authController.updatePassword);
route.patch('/updateMe', authController.protect, upload.single('photo'), userController.updateMe);
route.delete('/deleteMe', authController.protect,userController.deleteMe);

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