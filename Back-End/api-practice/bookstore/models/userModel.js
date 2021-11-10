const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'User should have a name']
	},
	email: {
		type: String,
		required: [true, 'User should have an email'],
		unique: true,
		lowercase: true,
		validate: [validator.isEmail, 'Please provide a valid email']
	},
	role: {
		type: String,
		enum: ['reader', 'admin'],
		default: 'reader'
	},
	password: {
		type: String,
		required: [true, 'Please provide a password'],
		minlength: 8
	},
	passwordConfirm: {
		type: String,
		required: [true, 'Please confirm the password'],
		validate: {
			validator: function(passwordForConfirmation) {
				return passwordForConfirmation === this.password;
			},
			message: 'The password does not match please try again'
		}
	},
	active: {
		type: String,
		default: true
	}

});

const User = mongoose.model('User', userSchema);

module.exports = User;