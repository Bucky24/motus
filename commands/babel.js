const fs = require('fs');
const { exec } = require('child_process');
const { installModule } = require('./install.js');
const { DIRS } = require('../utils.js');

const { BIN_DIR, CACHE_DIR } = DIRS;

module.exports = (cwd) => {
	return new Promise((resolve) => {
		installModule('babel-cli', '6.23.0').then(() => {
			return installModule('babel-plugin-transform-object-rest-spread', '6.26.0');
		}).then(() => {
			return installModule('babel-preset-env', "1.6.1");
		}).then(() => {
			exec("find " + cwd + " -name '*.js'", (err, result) => {
				const paths = result.split("\n").map((path) => {
					return path.replace(cwd, ".");
				}).filter((path) => {
					if (path.indexOf("./build") === 0) {
						return false;
					}
					return path != "";
				});
				const pathString = paths.join(" ");
				//console.log(pathString);
			
				const plugins = ['transform-object-rest-spread'];
				const presets = ['env'];
				
				let command = BIN_DIR + "/babel ";
			
				if (plugins.length > 0) {
					command += "--plugins=" + plugins.join(",") + " ";
				}
				if (presets.length > 0) {
					command += "--presets=" + presets.join(",") + " ";
				}
			
				command += pathString + " --out-dir build";
				exec(command, () => {
					console.log("Babel complete!");
					resolve();
				})
			});
		});
	})
};
