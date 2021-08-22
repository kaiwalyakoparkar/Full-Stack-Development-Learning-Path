const mongoose = require('mongoose');

//Created a tours schema
const tourSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tour should have a name'],
    unique: true
  },
  rating: {
    type: Number,
    default: 4.5
  },
  price: {
    type: Number,
    required: [true, 'Tour should have a price']
  }
});

//Creating model out of the tours schema
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
