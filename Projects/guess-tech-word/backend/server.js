//Package imports
const express = require('express');
const app = require('./app');

//Variable declarations
// const app = express();
const HOST = 'http://localhost';
const PORT = 8080;

//Application methods

//Application starting
app.listen(8080, () => {
    console.log(`Application started at ${HOST}:${PORT}`);
})