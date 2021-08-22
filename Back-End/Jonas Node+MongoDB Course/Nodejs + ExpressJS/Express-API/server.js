const mongoose = require('mongoose');
const dotenv = require('dotenv').config();

const app = require('./index.js');
const port = process.env.PORT || 3000;

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true
  })
  // .then((con) => {//for seeing more info
  .then(() => {
    // console.log(con.connection);//to see more info about the connection
    console.log('MongoDB connected successfully');
  });

app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});
