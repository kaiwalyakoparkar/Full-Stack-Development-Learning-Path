const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });

const app = require('./index.js');
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});
