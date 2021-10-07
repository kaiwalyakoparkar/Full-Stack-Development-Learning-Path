const catchAsync = require('../utils/catchAsync.js');
const AppError = require('../utils/appError.js');
const users = require('../models/userModel.js');

//================ Get all users =========================
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const user = await users.find();
  res.status(200).json({
    status: "Success",
    length: user.length,
    data: {
      user
    }
  });
});

exports.updateMe = (req, res, next) => {
  //1) Create error if the user updates the password data
  if(req.body.password || req.body.passConfirm) {
    return next(new AppError('This route is not for password updates. Please use /updatePassword route', 400));
  }

  //2) Update user document
  res.status(200).json({
    status: "success"
  });
}

//================ Add new users =========================
exports.addNewUser = (req, res) => {
  res.status(503).send({
    status: "error",
    message: "This route is not defined yet"
  });
}

//================ Get single users =========================
exports.getSingleUser = (req, res) => {
  res.status(503).send({
    status: "error",
    message: "This route is not defined yet"
  });
}

//================ Update single users =========================
exports.updateSingleUser = (req, res) => {
  res.status(503).send({
    status: "error",
    message: "This route is not defined yet"
  });
}

//================ Delete a users =========================
exports.deleteSingleUser = (req, res) => {
  res.status(503).send({
    status: "error",
    message: "This route is not defined yet"
  });
}
