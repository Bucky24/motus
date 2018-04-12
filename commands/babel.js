const fs = require('fs');
const { exec } = require('child_process');
const { installModule } = require('./install.js');
const { DIRS } = require('../utils.js');

const { BIN_DIR } = DIRS;

const babelVersion = "6.23.0";

module.exports = (cwd) => {
	return new Promise((resolve) => {
		installModule('babel-cli', '6.23.0').then(() => {
			exec("find " + cwd + " -name '*.js'", (err, result) => {
				const paths = result.split("\n").map((path) => {
					return path.replace(cwd, ".");
				}).filter((path) => {
					return path != "";
				});
				const pathString = paths.join(" ");
				console.log(pathString);
			
				const plugins = ['transform-object-rest-spread'];
				
				let command = BIN_DIR + "/babel ";
			
				if (plugins.length > 0) {
					command += "--plugins=" + plugins.join(",") + " ";
				}
			
				command += pathString + " --out-dir build";
				console.log(command);
				resolve();
			});
		});
	})
};
