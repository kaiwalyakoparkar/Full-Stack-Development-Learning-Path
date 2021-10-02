const jwt = require('jsonwebtoken');
const util = require('util');

const User = require('../models/userModel.js');
const catchAsync = require('../utils/catchAsync.js');
const AppError = require('../utils/appError.js');
const sendEmail = require('../utils/emailSender.js');

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
		passConfirm: req.body.passConfirm,
		role: req.body.role
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

	//If the token not found that means the user is not logged in
	if(!token) {
		return next(new AppError('It seems that you are not logged in. Please login to be able to perform this operation', 401));
	}

	//Check if the token is valid
	const decoded = await util.promisify(jwt.verify)(token, process.env.JWT_SECRET_KEY)
	console.log(decoded);//stopped on timestamp 3:18 mins

	//If the user exists
	const currentUser = await User.findById(decoded.id);
	if(!currentUser) {
		return next(new AppError('User to which this token was issued no more exists', 401));
	}

	//If password was not changed after the token was issued
	if(currentUser.passwordChangedAfter(decoded.iat)) {
		return next(new AppError('User has changed their password hence this token is no more valid', 401));
	};

	//If it reaches here means everything went correct and we can grant access to the protected route
	req.user = currentUser;
	next();
});

exports.restrictTo = function (...roles) {
	return (req, res, next) => {
		//roles ['admin', 'lead-guide'] :: role = 'user'
		if(!roles.includes(req.user.role)) {
			return next(new AppError('You do not have permission to perform this action', 403));
		}
		next();
	}
}

exports.forgotPassword = catchAsync( async (req, res, next) => {
	//1) Find the user with email
	const user = await User.findOne({email: req.body.email});

	if(!user) {
		return next(new AppError('There is no user with provided email address', 404));
	}

	//2) Generate the password reset token
	const resetToken = user.createPasswordResetToken();
	await user.save({validateBeforeSave: false});

	//3) Email it to the user
	const resetURL = `${req.protocol}://${host}/api/v1/users/resetPassword/${resetToken}`;
	const message = `Forgot password? Reset your password and confirm it from ${resetURL}. This link will be only valid for 10 mins. If you didn't want to reset the password then please ignore this email`;

	try {
		await sendEmail({
			email: user.email,
			subject: 'Your magical link to reset your password',
			message,
		});

		res.status(200).json({
			status: 'success',
			message: 'Password reset link sent successfully !'
		});
	} catch (err) {
		user.passwordResetToken = undefined;
		user.passwordResetExpires = undefined;
		await user.save({validateBeforeSave: false});

		return next(new AppError('There was some error while sending the reset link email', 500));
	}
	
});

exports.resetPassword = (req, res, next) => {

}