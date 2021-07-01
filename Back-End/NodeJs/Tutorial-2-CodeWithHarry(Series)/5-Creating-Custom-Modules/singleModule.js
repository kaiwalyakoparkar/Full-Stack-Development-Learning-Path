console.log('Hello this is single export module by Kaiwalya');

//This is going to be improted single function.
function findAverage(arr){
    let sum = 0;

    arr.forEach(element => {
        sum += element;
    });
    return sum/arr.length;
}

module.exports = findAverage;//Exporting a single class or element