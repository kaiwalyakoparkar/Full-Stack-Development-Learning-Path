//------ This is creating the element in js
let element = document.createElement('p');
element.className = 'custom-made';
element.id = 'custom-created';
element.innerText = 'This is not the random text. This is create by kaiwalya';

//------ This is appending/ adding it to the html

let container = document.querySelector('.container');//catching the parent class
container.appendChild(element);//Adding it
// console.log(element);

//------ This is replacing the element in the current html document

//create the element to be added first (line 16 - 21)
let elem2 = document.createElement('h3');
//This is the alternative for innerText or innerHtml
let text = document.createTextNode('Hello this is the text node representation');
elem2.appendChild(text);
elem2.className = 'custom-heading';
elem2.id = 'heading-three'
console.log(elem2);

//Replacing the custom created element
element.replaceWith(elem2);//replacing the contents on element position by elem2 (This doesn't change the attributes of the element anywhere)

//Replacing the element with id 'change-here'
let parent = document.querySelector('.container');//Selecting the parent class whose children needs to be replced
console.log(parent);
//Parent ----------> newContent, oldContent(selected by id)
parent.replaceChild(element, document.querySelector('#change-here'));
