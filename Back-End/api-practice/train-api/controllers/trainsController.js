const express = require('express');

const train = require('../dev-data/json/trains.json');

exports.getAllTrains = (req, res, next) => {
    console.log("Route initiated")
    res.status(200).json({
        "status": "success",
        "result": train.length,
        train
    });
}