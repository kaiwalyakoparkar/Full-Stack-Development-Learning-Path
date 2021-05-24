//Returning the direct value.
function hello(){
    return 10;
}

let ret = hello();
console.log(ret+" is returned");

//Returning the function.
function hi(myName){
    return function(){
        console.log(myName+" Koparkar");
    }
}

let myFun = hi("Kaiwalya");
console.log(myFun());