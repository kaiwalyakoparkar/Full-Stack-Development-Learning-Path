const mongoose = require('mongoose');
const slugify = require('slugify');
const validator = require('validator');

//Created a tours schema
const tourSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tour should have a name'],
    unique: true,
    validate: [validator.isAlpha, 'The name for the tour should be Aplhabetical only']
  },
  slug: {
    type: String,
    require: [true, 'Tour must have a slug'],
    unique: true
  },
  slug: {
    type: String,
    require: [true, 'Tour must have a slug'],
    unique: true
  },
  duration: {
    type: Number,
    required: [true, 'A tour must have a duration']
  },
  maxGroupSize: {
    type: Number,
    required: [true, 'Tour must have a group size']
  },
  difficulty: {
    type: String,
    required: [true, 'Tour should have a difficulty']
  },
  ratingAverage: {
    type: Number,
    default: 4.5
  },
  ratingQuantity: {
    type: Number,
    default: 0
  },
  price: {
    type: Number,
    required: [true, 'Tour should have a price']
  },
  priceDiscount: {
    type: Number,
    //This is a custom validator 
    validate: {
      validator: function(val) {
        return val < this.price;
      },
      message: 'Discount price {{VALUE}} should be below regular price'
    }
  },
  summary: {
    type: String,
    required: [true, 'Tour should have a Summary'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  imageCover: {
    type: String,
    required: [true, 'A tour must have a cover image']
  },
  images: [String],
  createdAt: {
    type: Date,
    default: Date.now()
  },
  startDates: [Date],
  secretTour: {
    type: Boolean,
    default: false
  }
},
{
  toJSON: {virtuals: true},
  toObject: {virtuals: true}
});

//VIRTUAL PROPERTIES
tourSchema.virtual('durationWeeks').get(function() {
  return this.duration / 7;
})

//================== DOCUMENT MIDDLEWARE  ========================

//Pre-Save-hook / pre middleware runs before .save() and .create()
tourSchema.pre('save', function(next) {
  this.slug = slugify(this.name, { lower: true});
  next();
});

// tourSchema.pre('save', function(next) {
//   console.log('Saving the document... ⏱');
//   next();
// });

// tourSchema.post('save', function(doc, next) {
//   console.log(doc);
//   next();
// });

//=================== QUERY MIDDLEWARE  =====================

// tourSchema.pre('find', function(next) { //Will only run for .find()
tourSchema.pre(/^find/, function(next) { //Will run for .find() .findOne() .findById() etc (any query starting with find)
  this.find({secretTour: {$ne: true}});
  next();
});

//==================== AGGREGATION MIDDLEWARE ===============

tourSchema.pre('aggregate', function(next) {
  this.pipeline().unshift({$match: {secretTour: {$ne: true}}});
  next();
});

//Creating model out of the tours schema
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
