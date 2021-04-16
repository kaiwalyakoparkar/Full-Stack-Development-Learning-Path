//Get the button element
const element = document.querySelector("#btnCounter");

let counter = 0;
console.log(counter);


//Function to increment a number
function counterIncrement() {
    //Every click increment a number
    counter  = counter + 1;
    console.log(counter);
}

//Listen to the event
element.addEventListener("click", counterIncrement, false);

counterIncrement();
