//Module imports
const path = require('path');
const fs = require('fs');

//Data imports from files.
const books = require(path.join(__dirname,'../dev-data/data/books.json'));

//Exporting functions.
exports.getAllBooks = (req, res) => {
  res.json({
    status: 'success',
    requestedAt: req.requestTime,
    result: books.length,
    data: {
      books
    }
  });
};