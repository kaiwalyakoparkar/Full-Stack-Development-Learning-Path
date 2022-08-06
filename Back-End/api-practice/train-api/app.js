const express = require("express");

const app = express();

app.use('/', (req, res, next) => {
    console.log("Route initiated")
    res.status(200).json({
        "messsage": "works"
    });
})

module.exports = app;