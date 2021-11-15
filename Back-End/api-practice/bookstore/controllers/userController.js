const User = require('../models/userModel.js');

exports.getAllUsers = async (req, res, next) => {
	try {
		const users = await User.find();

		res.status(200).json({
			status: 'success',
			requestedAt: req.requestTime,
			data: {
				users
			}
		});
	} catch (error) {
		res.status(400).json({
			status: 'fail',
			message: 'There was some error while performing the action. Please try again later :)',
			error
		});
	}
}

exports.signUp = async (req, res, next) => {
	try {
		const createdUser = await User.create(req.body);

		res.status(201).json({
			status: 'success',
			requestedAt: req.requestTime,
			data: {
				createdUser
			}
		});
	} catch (error) {
		res.status(400).json({
			status: 'fail',
			message: 'There was some error while performing the action. Please try again later :)',
			error
		});
	}
}