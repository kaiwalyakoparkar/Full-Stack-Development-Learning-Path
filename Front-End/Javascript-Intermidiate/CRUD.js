//This is creating the element in js
let element = document.createElement('p');
element.className = 'custom-made';
element.id = 'custom-created';
element.innerText = 'This is not the random text. This is create by kaiwalya';

//This is appending/ adding it to the html
let container = document.querySelector('.container');//catching the parent class
container.appendChild(element);//Adding it

console.log(element);