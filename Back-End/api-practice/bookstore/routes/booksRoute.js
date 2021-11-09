//Eternal imports
const express = require('express');

//Variable delarations
const route = express.Router();

route.use(express.json());

//File imports
const bookController = require('../controllers/booksController.js');

//Route operations
route.route('/').get(bookController.getAllBooks).post(bookController.addNewBook);

route.route('/:id').get(bookController.getSingleBook).patch(bookController.updateBook);

module.exports = route;