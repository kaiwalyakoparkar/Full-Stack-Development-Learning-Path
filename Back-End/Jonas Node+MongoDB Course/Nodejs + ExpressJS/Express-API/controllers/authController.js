const jwt = require('jsonwebtoken');

const User = require('../models/userModel.js');
const catchAsync = require('../utils/catchAsync.js');
const AppError = require('../utils/appError.js');

const signToken = (id) => {
	const secretKey = process.env.JWT_SECRET_KEY;
	const expiresIn = process.env.JWT_EXPIRES_IN;
	return jwt.sign({id}, secretKey, {expiresIn});
}

exports.signup = catchAsync(async(req, res, next) => {
	//Adding a new user into database.
	const newUser = await User.create({
		name: req.body.name,
		email: req.body.email,
		password: req.body.password,
		passConfirm: req.body.passConfirm
	});

	
	//========== JWT signing (Iteration 1)=============
	//As the user is now saved to database correctly now we have to send a token to the user in return so that they can login/signin
	// const secretKey = process.env.JWT_SECRET_KEY;
	// const expiresIn = process.env.JWT_EXPIRES_IN;

	//constant = jwt.sign(payload, secretOrPrivateKey, [options, callback])
	// const token = jwt.sign({id: newUser._id}, secretKey, {expiresIn});

	//========== JWT signing (Iteration 2)=============
	const token = signToken(newUser._id);

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

exports.login = catchAsync(async (req, res, next) => {
	const email = req.body.email;
	const password = req.body.password;

	//Check if email and passwords are provided as they both are required for auth
	if(!email || !password) {
		return next(new AppError('Email and password both are required in order to login', 400));
	}

	//Check if the email exits && the password is correct
	const user = await User.findOne({email}).select('+password');

	if(!user || !(await user.correctPassword(password, user.password))) {
		return next(new AppError(`Incorrect email or password`, 401));
	}

	//If all good sends the token back
	const token = signToken(user._id);
	res.status(200).json({
		status: "success",
		token
	})
});

exports.protect = catchAsync(async (req, res, next) => {

	let token;
	//Check if the token is provided by the user while requesting
	if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
		token = req.headers.authorization.split(' ')[1];
	};

	if(!token) {
		return next(new AppError('It seems that you are not logged in. Please login to be able to perform this operation', 401));
	}

	next();
});