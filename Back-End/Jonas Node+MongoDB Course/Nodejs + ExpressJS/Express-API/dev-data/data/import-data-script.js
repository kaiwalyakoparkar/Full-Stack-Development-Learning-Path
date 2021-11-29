const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv').config({ path: '../../.env' });
const fs = require('fs');
const Tour = require('../../models/tourModel');

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

const tours = JSON.parse(
  fs.readFileSync(path.join(__dirname, './tours-simple.json'), 'utf-8')
);

const importData = async () => {
  try {
    await Tour.create(tours);
    console.log('Data successfully imported');
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

const deleteData = async () => {
  try {
    await Tour.deleteMany();
    console.log('Data successfully deleted');
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

console.log(process.argv);

if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
}
