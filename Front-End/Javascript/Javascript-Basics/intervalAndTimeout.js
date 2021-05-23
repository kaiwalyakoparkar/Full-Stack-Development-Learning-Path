
//Set timeout: This will execute only once after a delay of specified time.
setTimeout(() => {
    document.getElementById("timeout").innerText = "Kaiwalya Koparkar";
},2000);

//Set Interval: This will replace the element by Other after every specific interval. (Like a loop)
let i = -1;
setInterval(() => {
    if(i == 5){
        i = -1;
    }
    document.getElementById("interval").innerText = ++i;
},1000);