let data = require('./student.json');//Includes the Json file from the local environment

/*
We can use fetch here (which is used for api) but in Node js require is preferred and emphasised more. fetch is solely used for api integration.
*/

console.log('All students: ');

//Iterating over all the student names
for(let i = 0; i < 2; i++){
    console.log(data.students[i].name);
}