const express = require('express');

const route = express.Router();

//================ Get all users =========================
const getAllUsers = (req, res) => {
  res.status(503).send({
    status: "error",
    message: "This route is not defined yet"
  });
}

//================ Add new users =========================
const addNewUser = (req, res) => {
  res.status(503).send({
    status: "error",
    message: "This route is not defined yet"
  });
}

//================ Get single users =========================
const getSingleUser = (req, res) => {
  res.status(503).send({
    status: "error",
    message: "This route is not defined yet"
  });
}

//================ Update single users =========================
const updateSingleUser = (req, res) => {
  res.status(503).send({
    status: "error",
    message: "This route is not defined yet"
  });
}

//================ Delete a users =========================
const deleteSingleUser = (req, res) => {
  res.status(503).send({
    status: "error",
    message: "This route is not defined yet"
  });
}


route
  .route('/')
  .get(getAllUsers)
  .post(addNewUser);

route
  .route('/:id')
  .get(getSingleUser)
  .patch(updateSingleUser)
  .delete(deleteSingleUser);

module.exports = route;