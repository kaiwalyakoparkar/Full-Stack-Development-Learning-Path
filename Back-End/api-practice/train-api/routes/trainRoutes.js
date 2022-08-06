const express = require('express');

const route = express.Router();

route.get('/trains', (req, res, next) => {
    console.log("Route initiated")
    res.status(200).json({
        "messsage": "works"
    });
})

module.exports = route