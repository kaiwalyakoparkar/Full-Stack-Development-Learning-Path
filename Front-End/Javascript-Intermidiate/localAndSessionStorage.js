let grocery = ['potato','coliflower','tomato','paneer'];

//Creating a local storage
localStorage.setItem('Name','Kaiwalya');
localStorage.setItem('Age',18);
    //converting the simple string to arraylike string
localStorage.setItem('Grocery', JSON.stringify(grocery));

//Deleting specific local storage
localStorage.removeItem('Age');

//Accessing the local storage
let myName = localStorage.getItem('Name');
console.log(myName);
let myAge = localStorage.getItem('Age');
console.log(myAge);//Will display null

    //Converting the array like string into the actual array
let myGroceryList = JSON.parse(localStorage.getItem('Grocery'));
console.log(myGroceryList);
    //Now I can traverse on all the objects and remove and add them as I want!
for(let i = 0; i < myGroceryList.length; i++){
    console.log(myGroceryList[i]);//Display the entire list
}

//Creating a session storage
sessionStorage.setItem('sessionName','ssKaiwalya');
sessionStorage.setItem('ssTime','0min Ago');

let ssName = sessionStorage.getItem('sessionName');
console.log(ssName);
let sessionTime = sessionStorage.getItem('ssTime');
console.log(sessionTime);

//Deleting entire local & session storage
localStorage.clear();
sessionStorage.clear();