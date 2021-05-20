let originalNumber = 100;
//It was 100 originally

        //101 + 101 (becomes 102 for next operation)
let manipulated1 = (++originalNumber) + (originalNumber++)
console.log(manipulated1);

        //102 (becomes 103 for next operation) + (103 + 1)
let manipulated2 = (originalNumber++) + (++originalNumber);
console.log(manipulated2);

//Now it is same for the decrement too

let manipulated3 = (--originalNumber) + (originalNumber--)
console.log(manipulated3);

let manipulated4 = (originalNumber--) + (--originalNumber);
console.log(manipulated4);