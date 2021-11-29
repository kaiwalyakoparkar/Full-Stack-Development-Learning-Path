console.log('This is intended to learn ins and outs of npm package manager');
/*
Setting up project with npm

1. Start the node project by typing `npm init`.
2. Now install the packages you need. eg: nodemon. by `npm install nodemon --save-dev`
So this will update pacakge.json file and will create pacakage-lock.json and node_modules folder.

In package.json 

"devDependencies": {
    "nodemon": "^2.0.9" ---> This installs exact version when npm install
    "nodemon": "~2.0.9" ---> This installs with latest changes in the patches (9 will change to something else in this case)
    "nodemon": ">2.0.9" ---> This installs the latest version of the package it can be 3.1.2 or anything totally different and recent.
}
*/