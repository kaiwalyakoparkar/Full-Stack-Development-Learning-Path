const express = require('express');

exports.getAllTrains = (req, res, next) => {
    console.log("Route initiated")
    res.status(200).json({
        "messsage": "works"
    });
}