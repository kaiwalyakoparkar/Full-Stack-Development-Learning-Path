/*

Following https://youtu.be/d56mG7DezGs youtube video :)

*/

// console.log("Hello world");

// let age : number = 20;

// if (age > 18) {
//     console.log("You are a major");
//     age += 11;
// }

//======== tuple ==========
// let arr: [number, string] = [1, "Kaiwalya"];

//======== array ========
// let arr1: number[] = [1, 2, 3];

//======== enums ========
// const enum size {small = 1, medium, large}
/*
1. small is defined as 1 so medium becomes 2, and large becomes three automatically

2. adding const will generate more optimized code in the nodejs
*/
// let mySize: size = size.medium;
// console.log(mySize);

//======== functions ========
// function calc(income:number) {
//     // let x; will thow error because not used in code
//     return income*0.3;
// }

// console.log(calc(100));

//======== objects ========
// let employee: {
//     readonly id: number,
//     name: string,
//     retireFunc: (date: Date) => void
// } = {
//     id : 1, 
//     name: "Kaiwalya",
//     retireFunc: (date: Date) => {
//         console.log(date);
//     }
// }
//This is not editable/immutable (following will generate error)
// employee.id = 3;

//This is editable/mutable
// employee.name =  "Kai";


//========= Type alias ==========
type Employee = {
    readonly id: number,
    name: string,
    retireFunc: (date: Date) => void
}

let employee: Employee = {
    id : 1, 
    name: "Kaiwalya",
    retireFunc: (date: Date) => {
        console.log(date);
    }
}