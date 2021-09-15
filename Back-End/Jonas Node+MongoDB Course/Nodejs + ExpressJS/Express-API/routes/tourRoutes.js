const express = require('express');
const tourController = require('../controllers/tourController');

const route = express.Router();

route.use(express.json());

// route.param('id', tourController.checkId);//Deprecated while integrating database

//Using for all commands
// route.use(tourController.checkBody);

route
  .route('/') //Common route
  .get(tourController.getAllTours) //get operation on this route
  .post(tourController.addNewTour);
//Checks body while using JSON file for data
// .post(tourController.checkBody, tourController.addNewTour); //post operation on this route with chained middleware

route.route('/tours-stats').get(tourController.getToursStats);

route.route('/monthly-plan/:year').get(tourController.getMonthlyPlan);

route
  .route('/:id') //Common route
  .get(tourController.getSingleTour) //get operation on this route
  .patch(tourController.updateSingleTour) //patch operation on this route
  .delete(tourController.deleteSingleTour); //delte operation on this route

module.exports = route;
