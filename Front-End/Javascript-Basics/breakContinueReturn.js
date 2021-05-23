//---------------- Break ---------------
//It will run the loop till break statement only and get out of entire loop

for(var i = 0; i < 10; i++){
    console.log(i);
    if(i == 5){
        break;
    }
}
console.log("Last value of i is : ",i);//Not print after 5

//---------------- Continue -------------------
//It will just skip the next code after the continue

for(var i = 0; i < 10; i++){
    console.log(i);
    if(i == 5){
        continue;//This is not show done for 5
    }
    console.log("Done");
}

//----------------- Return----------------------
//This work same as break but while in function
function myfunction(){
    
    for(var i = 0; i < 10; i++){
        console.log(i);
        if(i == 5){
            return;//Not print after 5
        }
    }
}

myfunction();