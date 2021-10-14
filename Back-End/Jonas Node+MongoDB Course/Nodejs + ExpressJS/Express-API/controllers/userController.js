const catchAsync = require('../utils/catchAsync.js');
const AppError = require('../utils/appError.js');
const User = require('../models/userModel.js');

const multer = require('multer');

//Stating the storage factors for the file being uploaded
const multerStorage = multer.diskStorage({
  destination: (req, file, callBack) => {
    callBack(null, 'public/img/users');
    
  },
  filename: (req, file, callBack) => {
    const ext = file.mimetype.split('/')[1];
    callBack(null, `user-${req.user.id}-${Date.now()}.${ext}`);
  }
});

//Creating a filter to allow certain files to be uploaded
const multerFilter = (req, file, callBack) => {
  if(file.mimetype.startsWith('image')) {
    callBack(null, true);
  } else {
    callBack(new AppError('Please upload an image', 400), false);
  }
}

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter
});

exports.uploadUserPhoto = upload.single('photo');

//================ Get all users =========================
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const user = await User.find();
  res.status(200).json({
    status: 'success',
    length: user.length,
    data: {
      user
    }
  });
});

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
}

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
  if(req.file) filteredBody.photo = req.file.filename;

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

//================ Add new users =========================
exports.addNewUser = (req, res) => {
  res.status(503).send({
    status: 'error',
    message: 'This route is not defined yet'
  });
};

//================ Get single users =========================
exports.getSingleUser = (req, res) => {
  res.status(503).send({
    status: 'error',
    message: 'This route is not defined yet'
  });
};

//================ Update single users =========================
exports.updateSingleUser = (req, res) => {
  res.status(503).send({
    status: 'error',
    message: 'This route is not defined yet'
  });
};

//================ Delete a users =========================
exports.deleteSingleUser = (req, res) => {
  res.status(503).send({
    status: 'error',
    message: 'This route is not defined yet'
  });
};
