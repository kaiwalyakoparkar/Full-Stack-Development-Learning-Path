//Importing modules
const express = require('express');//imported 1st
const path = require('path');//imported 1st
const router = express.Router();//imported 1st

//Importing the data 2nd step
const items = require('../data/shopingData');

//Responding to the request on / endpoing
router.get('/', (req, res)=>{
    //This is for initial testing of the block
    // res.send('Everthing is working fine in router');

    //Sending html file as respons
    // res.sendFile(path.join(__dirname, '../views/home.html'));

    //Using templates as a response
    res.render('home');
});

router.get('/shop', (req, res)=>{
    //Thi is initial testing
    // res.send('I am shopping now');

    //Printing every item after receiving data
    // items.forEach(element => {
    //     console.log(element.itemName);
    // });

    //Sending the file as response
    // res.sendFile(path.join(__dirname, '../views/shop.html'));

    //Using templates to render the shoping list
    res.render('shopList', {items});
});

router.get('/shopItem/:slug', (req, res) => {
    //Finding the object from the array which matches the request.
    myItem = items.filter((e) => {
        return e.slug == req.params.slug;
    });

    //Checking the object
    console.log(myItem);

    //Rendering the item details
    res.render('shopItem',{
        itemName: myItem[0].itemName,
        price: myItem[0].price,
        desc: myItem[0].desc
    });
});

//Exporting router module.
module.exports = router;