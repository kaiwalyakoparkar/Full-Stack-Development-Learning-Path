exports.getAllBooks = (req, res) => {
	res.status(200).json({
		'status': 'success',
		'message': 'Everything is working correct'
	});
}