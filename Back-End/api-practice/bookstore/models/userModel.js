const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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

userSchema.pre('save', async function (next) {
	this.password = await bcrypt.hash(this.password, 1);
	this.passwordConfirm = undefined;
	next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
