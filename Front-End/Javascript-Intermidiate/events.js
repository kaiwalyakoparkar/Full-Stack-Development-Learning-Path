let element = document.querySelector('#topic');
/*
click
mousemove
mouseover
mouseout
resize
*/
element.addEventListener('click',function(e){
    let variable;
    variable = e.target;//shows the html code of element with id topic
    variable = e.target.id;//Shows the id of element
    variable = e.target.className;//Shows the class Names of element
    variable = Array.from(e.target.classList);//Shows the list of all the classes to the element in an array
    variable = e.offsetX;//Shows the X axis location of the click with context to just the element selected
    variable = e.offsetY;//Shows the Y axis location of the click with context to just the element selected
    variable = e.clientX;//Shows the X axis location of the click with context to the entire brower window
    variable = e.clientY;//Shows the Y axis location of the click with context to the entire brower window
    console.log(variable);
})