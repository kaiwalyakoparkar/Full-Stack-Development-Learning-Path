const fs = require('fs');

/*
Theory: 
if you execture the function with Sync at the end then nodejs will stop until the function is completely executed. If Sync is not used then the next commands and operations will take place before the function.
*/
fs.readFile('fileSystemReadFile.txt', 'utf8', (error, data) => {
    console.log(error, data);
});//This will read the given file.

console.log('Successfully Read file with fs.readfile()');//This appears before the content of the fs.readfile() function. because the function takes time to execute

const syncFile = fs.readFileSync('fileSystemReadFile.txt');
console.log(syncFile.toString());//This will convert the buffer string to readable string
console.log('Successfully Read file with fs.readfileSync()');//Now this will be executed after the readFileSync function only as the node js stops till the exectution of the function is done and is ready to proceed ahead.

fs.writeFile('fileSystemWriteHere.txt','Did this got written', ()=>{
    console.log("Successfully wrote it!!");
});


const b = fs.writeFileSync('fileSystemWriteHere.txt', 'Did this got written with sync as well?');//This will overwritte everything present in the file.
console.log('Successfully wrote it!!');