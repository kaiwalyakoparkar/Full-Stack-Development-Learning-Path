//Eternal imports
const express = require('express');

//Variable delarations
const route = express.Router();

//File imports
const bookController = require('../controllers/booksController.js');

//Route operations
route.route('/').get(bookController.getAllBooks);

module.exports = route;