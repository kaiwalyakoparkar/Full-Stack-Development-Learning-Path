//For looping.

//Using let
for(let i = 0; i < 10; i++){
    console.log(i);
}

//Throws the error as i is let and let is block scoped
console.log(i);

//Using var
for(var i = 0; i < 10; i++){
    console.log(i);
}
//This will print 10 as var is only function scoped and can be used outside the block
console.log(i);