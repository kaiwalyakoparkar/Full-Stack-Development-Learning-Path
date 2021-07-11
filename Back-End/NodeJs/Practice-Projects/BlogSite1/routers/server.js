const express = require('express');
const router = express.Router();
const data = require('../data/blogdb');

const home = require('../views/home.hbs');

router.get('/', (req, res) => {
    res.render('home');
});

router.get('/kaiwalyakoparkar', (req, res) => {
    res.send('Hey I am Kaiwalya');
});

module.exports = router;