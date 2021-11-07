//Module imports
const path = require('path');

//Data imports from files.
const Book = require('../models/booksModel.js');

//Exporting functions.
exports.getAllBooks = async (req, res, next) => {
  try {
    const books = await Book.find();

    res.status(200).json({
      status: 'success',
      requestedAt: req.requestTime,
      result: books.length,
      data: {
        books
      }
    });

  } catch (err) {

    res.status(404).json({
      status: 'success',
      message: err
    });
  }
};

exports.addNewBook = async (req, res, next) => {
  try {
    const newBook = await Book.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        newBook
      }
    });
  } catch (err) {
    res.status(404).json({
      status: 'Error',
      message: err
    })
  }
}

// exports.getSingleBook = (req, res) => {

//   const id = req.params.id *1;

//   if(id >= books.length) {
//     res.status(400).json({
//       status: 'success', 
//       message: 'Books with given id does not exist'
//     })
//   }

//   const book = books.find(el => {
//     return el.id === id;
//   });

//   res.status(200).json({
//     status: 'success',
//     requestedAt: req.requestTime,
//     data: {
//       book
//     }
//   });
// };