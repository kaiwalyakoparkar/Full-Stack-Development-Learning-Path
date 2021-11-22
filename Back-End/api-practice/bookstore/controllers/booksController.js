//Module imports
const path = require('path');

//Data imports from files.
const Book = require('../models/booksModel.js');
const catchAsync = require('../util/catchAsync.js');
const AppError = require('../util/appError.js');

//Exporting functions.
exports.getAllBooks = catchAsync(async (req, res, next) => {
  
    const books = await Book.find();

    res.status(200).json({
      status: 'success',
      requestedAt: req.requestTime,
      result: books.length,
      data: {
        books
      }
    });
});

exports.addNewBook = catchAsync(async (req, res, next) => {
    const newBook = await Book.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        newBook
      }
    });
});

exports.getSingleBook = catchAsync(async (req, res, next) => {

    const book = await Book.findById(req.params.id);

    if(!book) {
      return next( new AppError('Book with the given id does not exist', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        book
      }
    });
});

exports.updateBook = catchAsync(async (req, res, next) => {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, {new: true});

    res.status(203).json({
      status: 'success',
      data: {
        book
      }
    });
});

exports.deleteBook = catchAsync(async (req, res, next) => {
    const book = await Book.findByIdAndDelete(req.params.id);

    res.status(204).json({
      status: 'success',
      data: {
        book
      }
    });
});
