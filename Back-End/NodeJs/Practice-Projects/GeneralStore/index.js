//Import modules
const express = require('express'); //imported 1st
const path = require('path');//imported 1st
const exphbs  = require('express-handlebars');//impoted for templating (2nd)

//Initialize express app
const app = express();

//specify the port
const port = 3000;

//Using the serving file in the router folder
app.use('/', require(path.join(__dirname, './routes/routingShop')));

//Setting up templating engine with .hbs file extension that handlebars
app.engine('.hbs', exphbs({extname: '.hbs'}));
app.set('view engine', '.hbs');

//Listening to the ports.
app.listen(port, ()=> {
    console.log(`Server started at http://localhost:${port}`);
})

/*
How did I build it
first I create a simple app listing to '/' and printing hello
then I shifted the hello listerning function to routes and made it work there
then I created the data file and imported it into routingShop file
then I listened to '/' and traversed the data and printed it.
then I created templates in view folder
after that I rendered the file by passing the required parameters from data file
And done :)
*/