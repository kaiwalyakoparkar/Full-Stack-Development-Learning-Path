const mongoose = require('mongoose');
const chalk = require('chalk');
const app = require('./index.js');
require('dotenv').config();

const port = process.env.PORT || 3000;
const log = console.log;

//App operations
log(chalk.cyan('✅ App Started'));

const DB = process.env.DATABASE_STRING.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

mongoose.connect(DB, {
    useNewUrlParser: true,             // After mongoose version 5.7.1 release
    useUnifiedTopology: true
}).then(() => {
	log(chalk.cyan(`✅ MongoDB connected successfully`));
})

app.listen(port, () => {
	log(chalk.cyan(`✅ Server started at http://localhost:${port}`));
});