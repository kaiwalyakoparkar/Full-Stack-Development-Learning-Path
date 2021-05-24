//Declaring a function

function myFunction(){
    console.log("Hello this is my function being called :)");
}

//Calling a funtion
myFunction();


//------------Function Parameters---------------

//Function Parameters (simple)
function simpleFunction(message){
    console.log(message);//prints simple message
}
simpleFunction("This is my message");


//Funtion Parameter (multiple)
function phoneDirectory(name, phno){
    console.log(name);//prints the name passed
    console.log(phno);//prints the phone no passed
}
phoneDirectory("Kaiwalya Koparkar",5674894383);

//Undefined Parmeter password
function missMatchDir(name, phno){
    console.log(name);//prints the name passed
    console.log(phno);//prints 'undefined' because it's not passed
}
missMatchDir("Kaiwalya");//Not passing the phone number although it is required by the function

//Default value if the parameter is not passed or if it is undefined
function defPara(userName="username: user1234"){
    console.log(userName);//if passed then prints the passed value (username: Kaiwalya) other vise prints the default value (username: user1234)
}
defPara("username: Kaiwalya");
defPara();