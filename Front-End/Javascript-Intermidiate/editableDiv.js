//Create a new element
let divElem = document.createElement('div');

//Add text to that created element
let val  = localStorage.getItem('text');
let text;
if(val==null){
    text = document.createTextNode('This is my div click to edit');
}else{
    text = document.createTextNode(val);
}
divElem.appendChild(text);

//Give element class, id and style
divElem.setAttribute('id','elem');
divElem.setAttribute('class','elem')
divElem.setAttribute('style','border:2px solid black; width:154px; margin: 34px, padding: 23px');

//Grab the man container
let container = document.querySelector('.main-container');
let first = document.querySelector('#firstEle');

//Insert the element before the classname single-click
container.insertBefore(divElem, firstEle);

//Add event listered to the divElem
divElem.addEventListener('click', function(){
    let noTextArea = document.getElementsByClassName('textarea').length;
    if(noTextArea == 0){
        let html = divElem.innerHTML;
        divElem.innerHTML = `<textarea class="textarea" id="textarea"> ${html}</textarea>`;
    }

    //Listen for the blulr event on textarea
    let textarea = document.getElementById('textarea');
    textarea.addEventListener('blur',function(){
        elem.innerHTML = textarea.value;
        localStorage.setItem('text',textarea.value);
    })
});

console.log(divElem, container, first);