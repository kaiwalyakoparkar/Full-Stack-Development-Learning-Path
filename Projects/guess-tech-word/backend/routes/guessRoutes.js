//Packages and file imports
const express = require('express');
const guessController = require('../controllers/guessController');

//Variable declarations
const route = express.Router();

//Middlewares
route.get('/guess', guessController.getRandomTechWord)

//Exports
module.exports = route;