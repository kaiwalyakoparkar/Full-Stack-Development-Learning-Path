const app = require('./app.js');
const mongoose = require('mongoose');
require('dotenv').config();

const DB = process.env.DB_URI.replace('<PASSWORD>', process.env.DB_PASS);

mongoose.connect(DB, {
    useNewUrlParser: true,             // After mongoose version 5.7.1 release
    useUnifiedTopology: true
}).then(() => {
    console.log("Database Connected Successfully");
})

app.listen(process.env.PORT, ()=> {
    console.log(`Server started on https://localhost:${process.env.PORT}/`)
})