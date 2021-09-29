const catchAsync = require('../utils/catchAsync.js');
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
