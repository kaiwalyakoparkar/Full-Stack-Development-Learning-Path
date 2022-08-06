const express = require("express");

const app = express();
const port = 8080;

app.use('/', (req, res, next) => {
    res.status(200).json({
        "messsage": "works"
    });
})

app.listen(port, ()=> {
    console.log(`Server started on ${port}`)
})