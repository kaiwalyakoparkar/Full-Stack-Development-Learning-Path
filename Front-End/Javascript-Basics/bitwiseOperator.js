//These are not used generally in dev. but are sometimes used for bit masking

//& | ^ ~

let num1 = 6;
let num2 = 3;
/*
6 is ------> 1 1 0
3 is ------> 0 1 1
--------------------
AND -------> 0 1 0 = 2
OR  -------> 1 1 1 = 7
Ex-OR -----> 1 0 1 = 5
NOT (of 6)-> 0 0 1 = -7 (coz the binary string is much big)
NOT (of 3)-> 1 0 0 = -4 (coz the binary string is much big)
*/

console.log("AND is : ",num1 & num2);
console.log("OR is : ",num1 | num2);
console.log("Ex-OR is : ",num1 ^ num2);
console.log("Invert of num1 is (~)", (~num1));
console.log("Invert of num2 is (~)",(~num2));
