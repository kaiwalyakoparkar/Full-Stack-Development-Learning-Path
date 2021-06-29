let sample = {
    name: "Kaiwalya",
    score: 11.75,
    isAdmin: true,
    programmingLanguages:["java","javascript","c++", {
        typescript: true,
        ruby: false
    }],
    myObj:{
        name:"nested",
        marks: 52
    }
}

console.log(sample.programmingLanguages[3].typescript);