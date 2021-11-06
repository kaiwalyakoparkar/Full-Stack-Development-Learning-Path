//Module imports
const path = require('path');
const fs = require('fs');

//Data imports from files.
const books = require(path.join(__dirname,'../dev-data/data/books.json'));

//Exporting functions.
exports.getAllBooks = (req, res) => {
  res.status(200).json({
    status: 'success',
    requestedAt: req.requestTime,
    result: books.length,
    data: {
      books
    }
  });
};

exports.getSingleBook = (req, res) => {

  const id = req.params.id *1;

  if(id >= books.length) {
    res.status(400).json({
      status: 'success', 
      message: 'Books with given id does not exist'
    })
  }

  const book = books.find(el => {
    return el.id === id;
  });

  res.status(200).json({
    status: 'success',
    requestedAt: req.requestTime,
    data: {
      book
    }
  });
};