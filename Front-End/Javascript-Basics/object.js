let person = {
    name : 'Kaiwalya',
    age : 18,
    like : 'pizza',
    favouriteProgrammingLanguage: 'HTML'
}

console.log(person.favouriteProgrammingLanguage);//will show HTML

person.favouriteProgrammingLanguage = 'Java'
console.log(person.like);//Will show Java

//Ways to access the elements in the object
//----------- Both are Okay ----------------
console.log(person.age);//Will print 18
console.log(person["age"]);//Will print 18

//Even if we do const person{} we will be able to access and modify this.