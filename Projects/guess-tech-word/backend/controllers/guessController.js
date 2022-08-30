//Packages and file imports
const express = require('express');

//Variable declarations
const techWordsList = ["Docker", "Kubernetes", "Javascript", "Angular", "C", "C++"];

//Controllers with exports
exports.getRandomTechWord = (req, res, next) => {

    const currentWord = techWordsList[Math.floor(Math.random()*techWordsList.length)];

    res.status(200).json({
        "status": "success",
        "guessWord": currentWord,
        "length": currentWord.length
    });
}