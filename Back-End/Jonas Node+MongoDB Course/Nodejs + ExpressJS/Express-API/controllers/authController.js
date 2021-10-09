const jwt = require('jsonwebtoken');
const util = require('util');
const crypto = require('crypto');

const User = require('../models/userModel.js');
const catchAsync = require('../utils/catchAsync.js');
const AppError = require('../utils/appError.js');
const sendEmail = require('../utils/emailSender.js');

const signToken = (id) => {
	const secretKey = process.env.JWT_SECRET_KEY;
	const expiresIn = process.env.JWT_EXPIRES_IN;
	return jwt.sign({id}, secretKey, {expiresIn});
}

const createAndSendToken = (user, statusCode, res) => {

	//Creating a jwt token
	const token = signToken(user._id);

	//Creating a cookie
	const cookieOptions = {
		expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
		// secure: true, //commented it becuase else we won't be able to test it in devlopment
		httpOnly: true
	}

	if(process.env.NODE_ENV === 'production') cookieOptions.secure = true;

	res.cookie('jwt_cookie', token, cookieOptions);

	//Sending the token with the response
	res.status(statusCode).json({
		status: 'success',
		token,
		data: {
			user
		}
	});
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
	// const token = signToken(newUser._id);

	//======== Response sending ==============
	//Sending the response back to the user with jwt token
	// res.status(201).json({
	// 	status: 'success',
	// 	token,
	// 	data: {
	// 		user: newUser
	// 	}
	// });

	//========== JWT signing & sending response (Iteration 3)
	createAndSendToken(newUser, 201, res);
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
	// const token = signToken(user._id);
	// res.status(200).json({
	// 	status: "success",
	// 	token
	// });

	createAndSendToken(user, 200, res);
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
	const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
	const message = `Forgot password? Reset your password and confirm it from ${resetURL}. This link will be only valid for 10 mins. If you didn't want to reset the password then please ignore this email`;

	try {
		await sendEmail({
			email: user.email,
			subject: 'Your magical link to reset your password',
			message
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

exports.resetPassword = catchAsync(async (req, res, next) => {
	//1) Get user based on the token
	const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

	const user = await User.findOne({passwordResetToken: hashedToken, passwordResetExpires: {$gte: Date.now()}});

	//2) If the token wasn't expired && user still exists then set the new password
	if(!user) {
		return next(new AppError('Token is invalid or expired',404));
	}

	user.password = req.body.password;
	user.passConfirm = req.body.passConfirm;
	user.passwordResetToken = undefined;
	user.passwordResetExpires = undefined;
	await user.save();

	//3) Update the passwordChangedAt property for that user

	//4) Login the user and send the JWT token
	// const token = signToken(user._id);
	// res.status(200).json({
	// 	status: "success",
	// 	token
	// });
	createAndSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
	//1) Get the user from the collection
	const user = await User.findById(req.user.id).select('+password');

	//2) Check if the posted password is correct
	// if(!user.correctPassword(req.body.passwordCurrent,user.password)) {
	// 	return next(new AppError('The password is incorrect', 401));
	// }
	if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    	return next(new AppError('Password is incorrect.', 401));
  	}


	//3) If so update the password
	user.password = req.body.password;
	user.passConfirm = req.body.passConfirm;
	await user.save();

	//4) Log the user in, and send the JWT
	createAndSendToken(user, 200, res);
});