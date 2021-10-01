const express = require('express');
const tourController = require('../controllers/tourController.js');
const authController = require('../controllers/authController.js');

const route = express.Router();

route.use(express.json());

// route.param('id', tourController.checkId);//Deprecated while integrating database

//Using for all commands
// route.use(tourController.checkBody);

route
  .route('/') //Common route
  .get(authController.protect, tourController.getAllTours) //get operation on this route
  .post(authController.protect,tourController.addNewTour);
//Checks body while using JSON file for data
// .post(tourController.checkBody, tourController.addNewTour); //post operation on this route with chained middleware

route.route('/tours-stats').get(authController.protect,tourController.getToursStats);

route.route('/monthly-plan/:year').get(authController.protect,tourController.getMonthlyPlan);

route
  .route('/:id') //Common route
  .get(authController.protect,tourController.getSingleTour) //get operation on this route
  .patch(authController.protect,tourController.updateSingleTour) //patch operation on this route
  .delete(authController.protect, authController.restrictTo('admin','lead-guide') ,tourController.deleteSingleTour); //delte operation on this route

module.exports = route;
