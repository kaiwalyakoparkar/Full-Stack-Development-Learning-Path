//Data we are going to use in common
let array = [1,2,3,4,5];

//Importing and using from a module which exports a single function.
const singleModuleAverage = require('./singleModule');
console.log(`The average for the array ${array} is ==> ${singleModuleAverage(array)}`);

//Importing and using from a module which exports multiple functions as json/object
const multiModule = require('./multipleModule');
console.log(`Average is ${multiModule.avg(array)}`);
console.log(`Total sum is ${multiModule.ts(array)}`);
console.log(`Array Length is ${multiModule.len(array)}`);
