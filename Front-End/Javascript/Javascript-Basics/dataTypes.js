//String datatype
let string = "Kaiwalya";

//Number datatype
let number = 7;

//Boolean datatype
let bool = true;

//Array data structure
let array = [1, 2, 3, 4, 5, "hi", "welcome"]

//Objecting the datatype
let object = {
    keyname:"This is object.keyname",
    "key-name":"This is obj[key-name (key-name in parenthesis)]"
};

//--------Accessing all the data------

//String number and boolean are accessed like this
console.log(string);
console.log(number);
console.log(bool);

//Arrays are accessed like this
console.log(array[2]);
console.log(array[6]);

//Object data is accessed like this

    //This is if the keyname is simple
console.log(object.keyname);
    //This is if the keyname has special chararcters like at this time it has " - "
console.log(object["key-name"]);