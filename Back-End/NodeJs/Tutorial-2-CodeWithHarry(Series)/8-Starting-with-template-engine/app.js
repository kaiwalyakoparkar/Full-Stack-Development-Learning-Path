const express = require('express');
const path = require('path');
const app = express();

const port = 3000;

//Setting up template engine with pug
app.set('view engine', 'pug');

//Set the view directory
app.set('views', path.join(__dirname, 'views'));

//Using the template and serving it on the url
app.get('/hello', (req, res)=>{
    res.status(200).render('hello', { title: 'Hey Kaiwalya', message: 'This is templated using pug template engine' })
});

app.use('/static', express.static('static'));

app.get('/', (req, res)=>{
    res.send('Is this some kind of a joke?');
});

app.listen(port, ()=>{
    console.log(`Server is live at http://127.0.0.1:${port}`);
});