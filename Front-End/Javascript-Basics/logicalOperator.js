//AND NOR NOT


// ================== AND ===================
let age = 18;

//Both the conditions should be true to get executed
if(age > 13 && age < 19){
    console.log("You are a teenager");
}else{
    console.log("You are not a teenager");
}

//=================== OR ===================
let myName = "Kaiwalya";

//Any one should be true 
if(myName =="kaiwalya" || myName === "Kaiwalya"){
    console.log("Name matched !!");
}else{
    console.log("No match found");
}

//=================== NOT ===================
//This is used to invert the given inputDescEl
let amIaTeenAger = true;

//This is equivalent to if(amIaTeenAger == false){}
if(!amIaTeenAger){
    console.log("You are not a teenager");
}else{
    console.log("You seem to be a teenager")
}

