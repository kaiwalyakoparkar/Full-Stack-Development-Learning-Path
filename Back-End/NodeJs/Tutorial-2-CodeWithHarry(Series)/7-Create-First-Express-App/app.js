//Essential things for running express
const express = require('express');
const app = express();

//Telling about port
const port = 3000;

//Telling the landing url
app.get('/', (req, res)=>{
    res.send('This is my first express app');
});

//Telling specific url
app.get('/about', (req, res)=>{
    res.send('This is about my first express app');
});

app.post('/about', (req, res)=>{
    res.send('This is post request about my first express app');
});

//Listening to the port and starting the server on it.
app.listen(port, () => {
    console.log(`The application started successfully on http://127.0.0.1:${port}`);
});