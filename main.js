const fs = require('fs');
const path = require('path');

const { DIRS, getPackage } = require('./utils.js');

const install = require('./commands/install.js');
const babel = require('./commands/babel.js');

const cwd = path.resolve("./");

const commands = [];

for (var i=2;i<process.argv.length;i++) {
	commands.push(process.argv[i]);
}

let environment = 'production';

const runCommand = () => {
	if (commands.length === 0) {
		return;
	}
	const fullCommand = commands.shift();
	
	// process command
	let command = '';
	const params = [];
	let sawColon = false;
	let tempString = '';
	for (var i=0;i<fullCommand.length;i++) {
		const ch = fullCommand.charAt(i);
		
		//console.log(ch);
		if (ch === ':') {
			if (!sawColon) {
				command = tempString;
				tempString = '';
				sawColon = true;
			} else {
				tempString += ch;
			}
		} else if (ch === ',') {
			if (sawColon) {
				params.push(tempString);
				tempString = '';
			} else {
				tempString += ch;
			}
		} else {
			tempString += ch;
		}
	}
	
	if (tempString.length > 0) {
		if (!sawColon) {
			command = tempString;
		} else {
			params.push(tempString);
		}
	}
	
	//console.log(command, params);
	
	let promise;
	switch(command) {
		case "install":
			promise = install(cwd, environment);
			break;
		case "env":
			const newEnv = params[0];
			environment = newEnv;
			console.log("Set environment to", environment);
			promise = Promise.resolve();
			break;
		case "babel":
			promise = babel(cwd);
			break;
		default:
			console.error("Unknown command", command);
			promise = Promise.resolve();
			break;
	}
	
	promise.then((runCommand));
}

runCommand();