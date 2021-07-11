const express = require('express');
const app = express();
const exphbs = require('express-handlebars');
const path = require('path');

const port = 3000;

app.use('/', require(path.join(__dirname, './routers/server')));
app.engine('.hbs', exphbs({ extname: '.hbs' }));
app.set('view engine', '.hbs');

app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});