const User = require('../models/userModel.js');
const catchAsync = require('../util/catchAsync.js');
const AppError = require('../util/appError.js');

exports.getAllUsers = catchAsync(async (req, res, next) => {
	const users = await User.find();

	res.status(200).json({
		status: 'success',
    result: users.length,
		requestedAt: req.requestTime,
		data: {
			users
		}
	});
});

exports.getMe = (req, res, next) => {
	req.params.id = req.user.id;
	next();
}

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

exports.updateMe = (req, res, next) => {
  //1) Create error if the user updates the password data
  if (req.body.password || req.body.passConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updatePassword route',
        400
      )
    );
  }

  //3) Filetring out the body in the request with permitted fields
  const filteredBody = finterObj(req.body, 'name', 'email');

  //2) Update user document
  const updatedUser = User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
};

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, {active: false});

  res.status(204).json({
    status: 'success',
    data: null
  })
});

// exports.getSingleUser = catchAsync (async (req, res, next) => {
// 	const user = await User.findById(req.params.id);

// 	if(!user) {
// 		return next(new AppError('User with the given id was not found. Please recheck the user id', 404));
// 	}

// 	res.status(200).json({
// 		status: 'success',
// 		requestedAt: req.requestTime,
// 		data: {
// 			user
// 		}
// 	})
// });

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