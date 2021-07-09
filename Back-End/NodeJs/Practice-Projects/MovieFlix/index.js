//Importing the required modules
const express = require('express');
const path = require('path');
const exphbs  = require('express-handlebars');

//Creating a application using express
const app = express();

//Configuring the template engine and setting it up
app.engine('.hbs', exphbs({extname: '.hbs'}));
app.set('view engine', '.hbs');

//Specifing port to listen on
const port = 3000;

//Creating the endpoints
// app.get('/', (req, res) => {
//     console.log('Hey / endpoint is hit');
// });

//Using the endpoints from the routes
app.use('/', require(path.join(__dirname, './routes/movieServer.js')));

//Listening to specific port
app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
})