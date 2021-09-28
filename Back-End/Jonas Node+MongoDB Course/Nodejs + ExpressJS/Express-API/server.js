const mongoose = require('mongoose');
const dotenv = require('dotenv').config();

const app = require('./index.js');
const port = process.env.PORT || 3000;

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

console.log('✅ Application started');
console.log(`✅ Running ${process.env.NODE_ENV} server`);

mongoose
  .connect(DB, {
    useNewUrlParser: true,             // After mongoose version 5.7.1 release
    useUnifiedTopology: true
  })
  // .then((con) => {//for seeing more info
  .then(() => {
    // console.log(con.connection);//to see more info about the connection
    console.log('✅ MongoDB connected successfully 👍🎉');
  });

// app.listen(port, () => {
//   console.log(`Server started on http://localhost:${port}`);
// });

const server = app.listen(port, () => {
  console.log(`✅ Server started on http://localhost:${port} 👈`);
});

process.on('unhandledRejection', err => {
  console.log(err.name, err.message);
  console.log('Unhandled Error Detected! 💥 Closing down the application...');

  server.close(() => {
    process.exit(1);
  })
});
