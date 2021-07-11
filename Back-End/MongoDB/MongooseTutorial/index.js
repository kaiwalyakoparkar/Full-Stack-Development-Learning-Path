//Import mongoose
const mongoose = require('mongoose');

//Connect mongoose
//Connecting command('access url/ DBname'),{avoid deprecation warnings}
mongoose.connect('mongodb://localhost:27017/kaiwalyaKart', {useNewUrlParser: true, useUnifiedTopology: true});

//Check if the there was any error while connecting
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('We are connected!!');
});

//Creating schema - It is like a structure in which we will add document
const studentSchema = new mongoose.Schema({
    name: String,
    age: Number,
});

//Passed a method to use later
studentSchema.methods.isAdded = function(){
    const greeting = 'Student '+this.name+' of age '+this.age+' has been added sucessfully';
    console.log(greeting);
}

//Compile entire schema into a single constant.
//Access name = method to access (collection name: schema to be compiled)
const student = mongoose.model('studentCollection', studentSchema);

//Creating new object of the comilled object.
const student1 = new student({
    name: "Kaiwalya Koparkar",
    age: 18
});

const student2 = new student({
    name: "Ketan Koparkar",
    age: 16
});

//Access the data provided with a new student locally
// console.log(student1.name);
// console.log(student1.age);
// student1.isAdded();

//---------------------------- Adding to DB (Create)---------------------------

//Saving the created document into the collection of DB.
student1.save(function(err, studentAdded){
    if(err) return console.error(err);
    studentAdded.isAdded();
});

student2.save(function(err, studentAdded){
    if(err) return console.error(err);
    studentAdded.isAdded();
});

//---------------------------- Finding in DB (Read) ---------------------------

student.find(function(err, studentInDB){
    if(err) return console.error(err);
    console.log(studentInDB);
});

student.find({name: "Ketan Koparkar"}, function(err, studentInDB){
    if(err) return console.error(err);
    console.log(studentInDB)
});