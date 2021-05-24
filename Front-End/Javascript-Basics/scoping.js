/**
 * let is block scoped that means any let statment in {} cannot be accessed outside
 * 
 * var is a function scoped that means any var statement in function ex(){} cannot be used outside the funtion
 * 
 * const is same as let but its value cannot be changed.
*/

//--------------------- let ---------------------------

//====== NOT WORKING CODE =========
//any conditional or loop statement before {}
{
    let variable = 10;
}
// This will trow the error because it is inside a block
// console.log(variable);

//====== WORKING CODE =============
//any conditional or loop statement before {}
let variable1;
{
    variable1 = 10;
}
//executed successfully because let is outside of the {} block
// console.log(variable1);

//--------------------- var ---------------------------

//====== NOT WORKING CODE =========
function dream(){
    var iFirstWant = 'Burger';
}
// This will trow the error as iFirstWant is inside function
console.log(iFirstWant);

//========= WORKING CODE ============
//any conditional or loop statement before {}
{
    var iWant = 'Pizza';
}
//executed successfully because let is outside of the {} block
console.log(iWant);

//--------------------- const ---------------------------
//Now you cannot reassign the value to the myName if you try then it will throw error
const myName = 'Kaiwalya';
console.log(myName);