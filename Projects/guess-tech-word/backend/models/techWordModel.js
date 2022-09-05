const mongoose = require('mongoose');

const GuessTechWordSchema = new mongoose.Schema({
    question: {
        type: String,
        required: [true, 'Question not found, Please add question']
    },
    answer: {
        type: String,
        required: [true, 'Answer not found, Please add answer']
    }
},
{
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
});

const GuessTechWord = mongoose.model('GuessTechWord', GuessTechWordSchema);

model.exports = GuessTechWord;