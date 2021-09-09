const Tour = require('../models/tourModel.js');

//=============== Class ================
class APIfeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'limit', 'sort', 'fields'];

    //Now we will loop over the excludedFields and remove the element from queryObject if it's present
    excludedFields.forEach(el => {
      delete queryObj[el];
    });

    //we get req.query as original and then we remove the fields added in excluded and get new object as queryObj which we use for quering
    console.log(this.queryString, queryObj); //Used for filetering in tours

    this.query = this.query.find(queryObj);

    return this;
  }

  sort() {
    if (this.queryString.sort) {
      this.query = this.query.sort(this.queryString.sort);
    } else {
      this.query = this.query.sort('-createdAt;');
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const field = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(field);
    } else {
      this.query = this.query.select('-__v');
    }

    return this;
  }

  pagination() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

//================ Get all tours =========================
exports.getAllTours = async (req, res) => {
  try {
    //BUILD QUERY (Shifted to the class)
    //we might have done queryObj = req.query but updating queryObj would have updated req.query as well so we made a new object
    // const queryObj = { ...req.query };
    // const excludedFields = ['page', 'limit', 'sort', 'fields'];

    // //Now we will loop over the excludedFields and remove the element from queryObject if it's present
    // excludedFields.forEach(el => {
    //   delete queryObj[el];
    // });

    // //we get req.query as original and then we remove the fields added in excluded and get new object as queryObj which we use for quering
    // console.log(req.query, queryObj); //Used for filetering in tours

    // // const tours = await Tour.find(req.query);//we used it when we wanted to filter with all the fields
    // let query = Tour.find(queryObj); //Now as we don't want to filter through all the query parameter we are using them

    //SORTING THE RESPONSE (Shifted to the class)
    //Sorting the response
    // if (req.query.sort) {
    //   query = query.sort(req.query.sort);
    // } else {
    //   query = query.sort('-createdAt;');
    // }

    //FILTERING ONLY REQUIRED FIELDS (Shifted to the class)
    //Getting only the required field in response
    //for http://localhost:300/api/v1/tours?fields=name,difficulty,duration we will make it 'name difficutly duration' for the query string
    // if (req.query.fields) {
    //   const field = req.query.fields.split(',').join(' ');
    //   query = query.select(field);
    // } else {
    //   query = query.select('-__v');
    // }

    //ADDING PAGINATION TO THE API (Shifted to the class)
    //Adding pagination to the api
    // const page = req.query.page * 1 || 1;
    // const limit = req.query.limit * 1 || 100;
    // const skip = (page - 1) * limit;
    // query = query.skip(skip).limit(limit);

    // if (req.query.page) {
    //   const numTour = await Tour.countDouments();
    //   if (skip >= numTour) {
    //     throw new Error('Page does not exist');
    //   }
    // }

    //EXECUTE QUERY
    const features = new APIfeatures(Tour.find(), req.query)
      .sort()
      .limitFields()
      .pagination();
    const tours = await features.query;
    // const tours = await query;

    //SEND RESPONSE
    res.json({
      status: 'success',
      results: tours.length,
      data: {
        tours
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err
    });
  }
};

//================ Get Single tour =========================
exports.getSingleTour = async (req, res) => {
  try {
    const tour = await Tour.findById(req.params.id);

    res.status(200).json({
      status: 'success',
      data: {
        tour
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      log: 'Id not found',
      message: err
    });
  }
};

//================ Add a new tour =========================
exports.addNewTour = async (req, res) => {
  try {
    const newTour = await Tour.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        tour: newTour
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err
    });
  }
};

//================ Update a tour =========================
exports.updateSingleTour = async (req, res) => {
  try {
    const updatedTour = await Tour.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(201).send({
      status: 'success',
      data: {
        updatedTour
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err
    });
  }
};

//================ Delete a tour =========================
exports.deleteSingleTour = async (req, res) => {
  try {
    await Tour.findByIdAndDelete(req.params.id);

    res.status(204).send({
      status: 'success',
      data: null
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err
    });
  }
};

//========================= Importing data from JSON file==========================

// const fs = require('fs');
// const path = require('path');
// const tours = require(path.join(
//   __dirname,
//   '../dev-data/data/tours-simple.json'
// ));

// exports.checkBody = (req, res, next) => {
//   console.log('Checking if the name and price is defined correctly');

//   if (!req.body.name || !req.body.price) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'name or price cannot be undefined'
//     });
//   }

//   next();
// };

// exports.checkId = (req, res, next, val) => {
//   console.log(`Id requested is ${req.params.id}`);
//   if (req.params.id >= tours.length) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'Invalid ID'
//     });
//   }
//   next();
// };

// //================ Get all tours =========================
// exports.getAllTours = (req, res) => {
//   res.json({
//     status: 'success',
//     requestedAt: req.requestTime,
//     result: tours.length,
//     data: {
//       tours
//     }
//   });
// };

// //================ Get Single tour =========================
// exports.getSingleTour = (req, res) => {
//   // console.log(req.params);

//   const id = req.params.id * 1;

//   //tours.find will return an object so we can access value using eg (tour.id)
//   const tour = tours.find(ele => {
//     return ele.id === id;
//   });

//   //tours.filter will return an array of oject (Although only one) so we can access value using eg (tour[0].id)
//   // const tour = tours.filter(ele => {
//   //  return ele.id === id;
//   // });

//   // if(id > tours.length){ //This is also one of the way to check invalid url
//   // if (!tour) {
//   //   res.status(404).send({
//   //     status: 'fail',
//   //     message: 'Invalid ID'
//   //   });
//   //   return;
//   // }

//   res.status(200).send({
//     status: 'success',
//     data: {
//       tour
//     }
//   });
// };

// //================ Add a new tour =========================
// exports.addNewTour = (req, res) => {
//   // console.log(req.body);

//   const newId = tours[tours.length - 1].id + 1;

//   const newTour = Object.assign({ id: newId }, req.body);

//   tours.push(newTour);

//   fs.writeFile(
//     path.join(__dirname, '../dev-data/data/tours-simple.json'),
//     JSON.stringify(tours),
//     err => {
//       res.status(201).json({
//         status: 'success',
//         data: {
//           tour: newTour
//         }
//       });
//     }
//   );

//   // res.send('Done'); //We cannout send the reponse twice.
// };

// //================ Update a tour =========================
// exports.updateSingleTour = (req, res) => {
//   // res.status(201).send('Dummy Updated success');
//   const id = req.params.id * 1; //get the id from request

//   const tour = tours.find(ele => {
//     //Find the tour from the tours array
//     return ele.id === id;
//   });

//   //404 Error handler
//   // if (!tours) {
//   //   res.status(404).send({
//   //     status: 'fail',
//   //     message: 'Invalid ID'
//   //   });
//   // }

//   //201 Respose handler
//   const updatedTour = Object.assign(tour, req.body); //Update the tour

//   //Write the file with the update tour and send back the updated tour
//   fs.writeFile(
//     path.join(__dirname, './dev-data/data/tours-simple.json'),
//     JSON.stringify(tours),
//     err => {
//       res.status(201).send({
//         status: 'success',
//         data: {
//           updatedTour
//         }
//       });
//     }
//   );
// };

// //================ Delete a tour =========================
// exports.deleteSingleTour = (req, res) => {
//   const id = req.params.id * 1; //Took the id from request

//   const tour = tours.find(ele => {
//     //Finding the tour from the all the of tours
//     return ele.id === id;
//   });

//   //Handling 404 error (If no tour found with the id)
//   // if (!tour) {
//   //   res.status(404).send({
//   //     status: 'fail',
//   //     message: 'Invalid ID'
//   //   });
//   // }

//   //204 Status handler
//   //I will take all the tours which don't match the 'tour.id' in a single array and then overwrite the json file with this new array.

//   //Create a new array of tours excluding the tour which has to be deleted
//   const toursAfterDeletion = tours.filter(ele => {
//     return ele.id !== tour.id;
//   });

//   //Rewritting the file with the new tours array.
//   fs.writeFile(
//     path.join(__dirname, '../dev-data/data/tours-simple.json'),
//     JSON.stringify(toursAfterDeletion),
//     err => {
//       res.status(204).send({
//         status: 'success',
//         data: null
//       });
//     }
//   );
// };
