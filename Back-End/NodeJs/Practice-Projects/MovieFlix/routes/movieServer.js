//Importing modules
const express = require('express');
const path = require('path');

//Staring routes
const routes = express.Router();

//Importing the data file
const movies = require(path.join(__dirname, '../data/movieData'));

//Declaring the endpoints
routes.get('/', (req, res)=> {
    //Intial response
    // res.send('Hello / is hit');

    //Fetching all the data and printing as response
    // movies.forEach( e => {
    //     console.log(e.name);
    // });

    //Sending in file as a response
    // res.sendFile(path.join(__dirname, '../views/home.html'));

    //Rendering the info
    res.render('home', {movies});
});

routes.get('/watch/:slug', (req, res) => {
    myMovie = movies.filter( (e) => {
        return e.slug == req.params.slug;
    });

    res.render('movie', {
        name: myMovie[0].name,
        banner: myMovie[0].bannerImage,
        price: myMovie[0].price,
        type: myMovie[0].type,
        desc: myMovie[0].desc,
        cast: myMovie[0].cast,
    })
})

//Exporting the edpoints
module.exports = routes;