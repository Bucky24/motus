const fs = require('fs');
const path = require('path');

const { DIRS, getPackage } = require('./utils.js');

const { install } = require('./commands/install.js');
const babel = require('./commands/babel.js');

const cwd = path.resolve("./");

const params = [];

for (var i=2;i<process.argv.length;i++) {
	params.push(process.argv[i]);
}

let environment = process.ENV ? process.ENV.toLowerCase() : 'development';

const command = params.shift();
//console.log(command, params);

let promise;
switch(command) {
	case "install":
		promise = install(cwd, environment);
		break;
	case "babel":
		promise = babel(cwd);
		break;
	default:
		console.error("Unknown command", command);
		promise = Promise.resolve();
		break;
}
	
promise.then(() => {
	console.log('Finished!');
});