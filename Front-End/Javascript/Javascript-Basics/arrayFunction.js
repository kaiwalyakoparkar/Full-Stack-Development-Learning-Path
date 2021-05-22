//Array.map() function for traversing the array and perform certain tasks
let arrayMap1 = [1,2,3,4,5];
let arrayMap2 = arrayMap1.map((element)=>{
    return element*2;
});
//Will print [ 2, 4, 6, 8, 10 ]
console.log(arrayMap2);

//Array.filter() function returns the element only if the condition is true
let arrayFilter1 = [1,2,3,4,5];
let arrayFilter2 = arrayFilter1.filter((element) => {
    if(element > 2){
        return true;
    }
    return false;
});
//Will print only [3,4,5] coz 1 & 2 are lesser than 2;
console.log(arrayFilter2);

//Array.forEach() function does not need to return anything. It is used like loops only. The major difference between .map() fucntion and .forEach() function is in .map() function you need second array to store all your values whereas .forEach() just traverses it
let arrayForEach = ["kaiwalya",18,"koparkar","javascript"]
//Will print 
/*
kaiwalya
18
koparkar
javascript

**Notice there are no [] around the result**
*/
arrayForEach.forEach((element)=>{
    console.log(element);//only tranversing purpose
});

