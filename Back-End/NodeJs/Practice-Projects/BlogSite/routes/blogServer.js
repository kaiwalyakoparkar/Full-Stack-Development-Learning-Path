//This are the imports
const e = require('express');
const express = require('express');
const path = require('path');
const blogs = require('../data/blogsData');
const router = express.Router();

//This is creating the responses and the endpoints
router.get('/', (req, res)=>{
    // res.sendFile(path.join(__dirname, '../static/index.html'));
    res.render('home');
});

router.get('/blogs', (req, res)=>{
    // res.sendFile(path.join(__dirname, '../static/blogHome.html'));
    res.render('blogHome', {
        blogs: blogs
    });
});

router.get('/blogpost/:slug', (req, res)=>{
    myBlog = blogs.filter((e) => {
        return e.slug == req.params.slug;
    })
    // console.log(myBlog);//Returns a specific object from the data array.
    // res.sendFile(path.join(__dirname, '../views/blogPage.html'));
    res.render('blogPost', {
        title: myBlog[0].title,
        content: myBlog[0].content
    })
});

module.exports = router;