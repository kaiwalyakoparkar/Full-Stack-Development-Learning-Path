//This are the imports
const express = require('express');
const path = require('path');
const exphbs  = require('express-handlebars');

//This is essential for express app
const app = express();


//Setting up templating engine
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

//Initialization
const port = 3000;

//Middlewares to be needed where the information resides
app.use(express.static(path.join(__dirname, 'static')));
app.use('/', require(path.join(__dirname, 'routes/blogServer.js')));

//This will listen to the server
app.listen(port, ()=>{
    console.log(`Server started on http://localhost:${port}`);
});


//Workflow of the app
/*
This index.js is just a entry point when the app starts.
We make it familiar with static folder and it's files.
    Static folder has the files which needs to be served.

After the we create routes folder and add a js file to it which liks the index.js and the static/index.html.
    In routes folder we just give the endpoints and export it. which is catched by the index.js (the entry point) and served accordingly.

So now it goes like Index.js (entry point) --> routes/blog.js --> serves static.html
*/