document.addEventListener('DOMContentLoaded',function(){
    document.querySelector('form').onsubmit= function(){
        let currency = document.querySelector('#currency').value;
        //Fetches the data from the api
        fetch('https://api.exchangeratesapi.io/v1/latest?access_key=678f3ff1f6636858c45f550e387554e7&format=1')
        //Converts that to JSON model
        .then(response => response.json())
        //Performs operation on that JSON model
        .then(data => {
            const current = data.rates[currency];
            if(current != undefined){
                document.querySelector('#result').innerHTML=`1 EUR is equal to ${current} ${currency}`
            }else{
                document.querySelector('#result').innerHTML=`Invalid currency input`
            }
            
        })
        return false;
    }
})