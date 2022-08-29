const express = require('express');

const app = express();

app.get('/hello', (req, res) => {
    console.log('Hello jello');
})

module.exports = app;