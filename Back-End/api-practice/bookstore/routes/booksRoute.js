//Eternal imports
const express = require('express');

//Variable delarations
const route = express.Router();

route.use(express.json());

//File imports
const bookController = require('../controllers/booksController.js');
const authController = require('../controllers/authController.js');

//Route operations
route.route('/').get(bookController.getAllBooks).post(authController.protect, authController.restrictTo('admin'), bookController.addNewBook);

route.route('/:id').get(bookController.getSingleBook).patch(authController.protect, authController.restrictTo('admin'), bookController.updateBook).delete(authController.protect, authController.restrictTo('admin'), bookController.deleteBook);

module.exports = route;