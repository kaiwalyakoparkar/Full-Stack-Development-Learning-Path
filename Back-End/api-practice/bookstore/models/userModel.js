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
	passwordChangedAt: Date,
	passwordResetToken: String,
	passwordResetExpires: Date,
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

userSchema.methods.correctPassword = async function (enteredPassword, databasePassword) {
	return await bcrypt.compare(enteredPassword, databasePassword);
}

userSchema.methods.passwordChangedAfter = function(tokenTimestamp) {
	if(this.passwordChangedAt) {

		const changedTimeStamp = parseInt(this.passwordChangedAt.getTime()/1000,10);
		
		console.log(tokenTimestamp, this.passwordChangedAt);
		return tokenTimestamp < changedTimeStamp;
	}

	return false;
}

userSchema.methods.createPasswordResetToken = function() {
	const resetToken = crypto.randomBytes(32).toString('hex');

	this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
	this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

	return resetToken;
}

userSchema.pre(/^find/, function(next) {
	this.find({active: {$ne: false}});
	next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
