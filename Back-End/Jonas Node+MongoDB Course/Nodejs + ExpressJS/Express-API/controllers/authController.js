const jwt = require('jsonwebtoken');

const User = require('../models/userModel.js');
const catchAsync = require('../utils/catchAsync.js');

exports.signup = catchAsync(async(req, res, next) => {
	//Adding a new user into database.
	const newUser = await User.create({
		name: req.body.name,
		email: req.body.email,
		password: req.body.password,
		passConfirm: req.body.passConfirm
	});

	
	//========== JWT signing =============
	//As the user is now saved to database correctly now we have to send a token to the user in return so that they can login/signin
	const secretKey = process.env.JWT_SECRET_KEY;
	const expiresIn = process.env.JWT_EXPIRES_IN;

	//constant = jwt.sign(payload, secretOrPrivateKey, [options, callback])
	const token = jwt.sign({id: newUser._id}, secretKey, {expiresIn});

	//======== Response sending ==============
	//Sending the response back to the user with jwt token
	res.status(201).json({
		status: 'success',
		token,
		data: {
			user: newUser
		}
	});
});