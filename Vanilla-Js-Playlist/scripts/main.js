let totalExpense = 0;


function AddExpenseToTotal(){
    //Listen in the input section
    const inputElement = document.querySelector("#inputAmount");
    const textAmount = inputElement.value;

    //Convert the string to int
    const expense = parseInt(textAmount,10);

    totalExpense = totalExpense + expense; 
}

//Get the button element
const element = document.querySelector("#btnAddExpense");

//Listen to the button click
element.addEventListener("click", AddExpenseToTotal, false);

counterIncrement();
