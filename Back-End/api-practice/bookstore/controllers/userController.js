const User = require('../models/userModel.js');
const catchAsync = require('../util/catchAsync.js');
const AppError = require('../util/appError.js');

exports.getAllUsers = catchAsync(async (req, res, next) => {
	const users = await User.find();

	res.status(200).json({
		status: 'success',
		requestedAt: req.requestTime,
		data: {
			users
		}
	});
});

exports.getSingleUser = catchAsync (async (req, res, next) => {
	const user = await User.findById(req.params.id);

	if(!user) {
		return next(new AppError('User with the given id was not found. Please recheck the user id', 404));
	}

	res.status(200).json({
		status: 'success',
		requestedAt: req.requestTime,
		data: {
			user
		}
	})
});

// exports.signUp = async (req, res, next) => {
// 	try {
// 		const createdUser = await User.create(req.body);

// 		res.status(201).json({
// 			status: 'success',
// 			requestedAt: req.requestTime,
// 			data: {
// 				createdUser
// 			}
// 		});
// 	} catch (error) {
// 		res.status(400).json({
// 			status: 'fail',
// 			message: 'There was some error while performing the action. Please try again later :)',
// 			error
// 		});
// 	}
// }