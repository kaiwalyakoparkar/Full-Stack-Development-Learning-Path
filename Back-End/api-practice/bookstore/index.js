const express = require('express');
const app = express();

console.log('✅ App Started');

const port = process.env.PORT || 3000;

app.get('/api/v1/books', (req, res) => {
	res.status(200).json({
		'status': 'success',
		'message': 'Everything is working correct'
	});
});

app.listen(port, () => {
	console.log(`✅ Server started at http://localhost:${port}`);
});