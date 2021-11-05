//External library imports
const express = require('express');
const chalk = require('chalk');

//File imports
const booksRoute = require('./routes/booksRoute.js');

//Variable assignments
const app = express();
const log = console.log;

//App operations
log(chalk.cyan('✅ App Started'));

const port = process.env.PORT || 3000;

app.use('/api/v1/books', booksRoute);

app.listen(port, () => {
	log(chalk.cyan(`✅ Server started at http://localhost:${port}`));
});