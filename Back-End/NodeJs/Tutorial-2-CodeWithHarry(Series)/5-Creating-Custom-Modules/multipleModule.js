console.log('This is multi export module by Kaiwalya');

//This function finds the average of the passed array
function average(arr){
    let sum = 0;

    arr.forEach(element => {
        sum += element;
    });

    return sum/arr.length;
}

//This function finds the total sum of the array
function totalSum(arr){
    let sum = 0;

    arr.forEach(element => {
        sum += element;
    });

    return sum;
}

//This function returns the length of the array
function length(arr){
    return arr.length;
}

module.exports = {
    avg: average,
    ts: totalSum,
    len: length
}