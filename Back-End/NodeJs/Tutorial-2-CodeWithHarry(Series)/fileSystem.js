const fs = require('fs');

let text = fs.readFileSync('sample.txt','utf-8');
console.log(text);

text = text.replace('contents','replace');
console.log(text);

text = fs.writeFileSync('new.txt',text);