const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'Book should have a name']
	},
	price: {
		type: Number,
		required: [true, 'Book should have a price']
	},
	pages: {
		type: Number,
		required: [true, 'Book should have no of pages']
	},
	languages: [String],
	publisher: String,
	publicationDate: Date,
	weight: Number,
	dimensions: String,
	author: {
		type: String,
		required: [true, 'Book should have a author']
	},
	genre: [String],
	inStock: {
		type: Boolean,
		required: [true, 'Book should have information about stock availability'],
		default: true
	},
	rating: {
		type: Number,
		default: 0
	},
	description: {
		type: String,
		trim: true
	},
},
{
  toJSON: {virtuals: true},
  toObject: {virtuals: true}
});

const Book = mongoose.model('Book', bookSchema);

module.exports = Book;