let totalExpense = 0;

//Get the heading element
const headingEl = document.querySelector("#headingTotal");

//Get the reference
const inputDescEl = document.querySelector("#inputDesc");

//ref to input amount
const inputElement = document.querySelector("#inputAmount");

//getting the ref to the table
const expenseTableEl = document.querySelector("#expenseTable");

//Set the heading element to totalExpense
headingEl.textContent = totalExpense;

// All expenses at one place
const allExpenses = [];

function AddExpenseToTotal(){
    const expenseItem = {};

    //Listen in the input section
    const textAmount = inputElement.value;

    //Read the input from the desc
    const textDesc = inputDescEl.value;

    //Convert the string to int
    const expense = parseInt(textAmount,10);

    //put it in object
    expenseItem.desc = textDesc;
    expenseItem.amount = expense;
    expenseItem.moment = new Date();

    allExpenses.push(expenseItem);
    
    //add current expense to total expense
    totalExpense = totalExpense + expense; 

    //Set heading element to totalExpense
    const someText = `Total is: ${totalExpense}`;
    headingEl.textContent = someText;

    const allExpenseHTML= allExpenses.map((expense) => createListItem(expense));

    const joinedAllExpenseHTML = allExpenseHTML.join("");
    
    

    expenseTableEl.innerHTML = joinedAllExpenseHTML;

}

//Get the button element
const element = document.querySelector("#btnAddExpense");

//Listen to the button click
element.addEventListener("click", AddExpenseToTotal, false);

//Controller functions
function getDateString(momento) {
    return (momento.toLocaleDateString('en-US',{
        year:'numeric', 
        month:'long', 
        day:'numeric'
    }));
}

//Destructuring concept used
function createListItem({desc, amount, moment}){
    return `
        <li class="list-group-item d-flex justify-content-between">
                <div class="d-flex flex-column">
                    ${desc}
                    <small class="text-muted">${getDateString(moment)}</small>
                </div>
                <div>
                    <span class="px-5">
                        ${amount}
                    </span>
                    <button type="button" class="btn btn-outline-danger btn-sm">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </li>
    ` ;
}

