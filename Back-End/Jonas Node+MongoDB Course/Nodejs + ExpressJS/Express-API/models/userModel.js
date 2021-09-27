const mongoose = require('mongoose');
const validator = require('validator');

//name, email, photo, password, passConfirm
const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'User should have a name']
	},
	email: {
		type: String, 
		required: [true, 'User should hava a email'],
		unique: true,
		lowercase: true,
		validate: [validator.isEmail, 'Please provide a valid email']
	},
	photo: String,
	password : {
		type: String,
		required: [true, 'Please provide a password'],
		minlength: 8
	},
	passConfirm: {
		type: String,
		required: [true, 'Please confirm the password']
	}
});

const User = mongoose.model('User', userSchema);

module.exports = User;