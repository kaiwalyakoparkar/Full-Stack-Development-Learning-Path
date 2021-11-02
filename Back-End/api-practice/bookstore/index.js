//External library imports
const express = require('express');
const chalk = require('chalk');

//Variable assignments
const app = express();
const log = console.log;

//App operations
log(chalk.cyan('✅ App Started'));

const port = process.env.PORT || 3000;

app.get('/api/v1/books', (req, res) => {
	res.status(200).json({
		'status': 'success',
		'message': 'Everything is working correct'
	});
});

app.listen(port, () => {
	log(chalk.cyan(`✅ Server started at http://localhost:${port}`));
});