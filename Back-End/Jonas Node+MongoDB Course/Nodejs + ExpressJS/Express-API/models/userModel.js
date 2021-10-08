const mongoose = require('mongoose');
const crypto = require('crypto');
const validator = require('validator');
const bcrypt = require('bcryptjs');

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
	role: {
		type: String,
		enum: ['user', 'guide', 'lead-guide', 'admin'],
		default: 'user'
	},
	password : {
		type: String,
		required: [true, 'Please provide a password'],
		minlength: 8,
		select: false
	},
	passConfirm: {
		type: String,
		required: [true, 'Please confirm the password'],
		//Check if the password matches
		validate: {
			//This only works for Save and Create and not for update
			validator: function(passwordForConfirmation) {
				return passwordForConfirmation === this.password;
			},
			message: 'Your passwords does not match'
		}
	},
	passwordChangedAt: Date,
	passwordResetToken: String,
	passwordResetExpires: Date,
	active: {
		type: Boolean,
		default: true,
		select: false
	}
});

//MIDDLEWARES
//Document middleware to hash the passwords before they are getting updated or saved
userSchema.pre('save', async function (next) {
	//If the password field was not updated then move to next middleware
	if(!this.isModified('password')) return next();

	//If the password field was updated then hash the password with intesity of 12.
	this.password = await bcrypt.hash(this.password, 12);
	this.passConfirm = undefined;
	
	next();
});

userSchema.pre('save', function(next) {
	//if the document was not mofied or it's new then just return we don't need to do the further functions
	if(!this.isModified() || this.isNew) return next();

	this.passwordChangedAt = Date.now() - 1000;
});

//GLOBAL METHODS
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

const User = mongoose.model('User', userSchema);

module.exports = User;