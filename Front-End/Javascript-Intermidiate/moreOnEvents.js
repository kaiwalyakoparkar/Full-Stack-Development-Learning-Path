
//-------- Catches all the single clicks and performs action
let btn1 = document.querySelector('.single-click');

btn1.addEventListener('click',func1);

function func1(e){
    console.log('Clicked');
}

//------ Catches all the double clicks and performs actions
let btn2 = document.querySelector('.double-click');

btn2.addEventListener('dblclick',func2);

function func2(e){
    console.log('Double clicked');
}

//------ Catches all the mouse event like, wheel click, right button click etc
let btn3 = document.querySelector('.mouse-events');

btn3.addEventListener('mousedown',func3);

function func3(e){
    console.log('Mouse events occuring')
}

//------ this gets triggered when mouse enters the element area
let m1 = document.querySelector('#change-here');

m1.addEventListener('mouseenter',func4);

function func4(e){
    console.log('Mouse in the element area');
}

// ------ This gets triggerd when mouse leaves the element area
let m2 = document.querySelector('#change-here');

m2.addEventListener('mouseleave',func5);

function func5(e){
    console.log('Mouse left the element area');
}

//------ This gets triggered whenever the mouse moves (On the entire application window)
let m3 = document.querySelector('#change-here');

m3.addEventListener('mousemove',func6);

function func6(e){
    console.log('Mouse moving')
}