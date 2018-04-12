const path = require('path');
const os = require('os');
const fs = require('fs');

const cwd = path.resolve("./");

const homeDir = os.homedir();
const motusDir = homeDir + "/.motus";

if (!fs.existsSync(motusDir)) {
	fs.mkdirSync(motusDir);
}

const motusCacheDir = motusDir + "/cache";
if (!fs.existsSync(motusCacheDir)) {
	fs.mkdirSync(motusCacheDir);
}

module.exports = {
	DIRS: {
		MAIN_DIR: motusDir,
		CACHE_DIR: motusCacheDir
	},
	getPackage: (cwd) => {
		const pathToPackage = cwd + "/package.json";

		if (!fs.existsSync(pathToPackage)) {
			console.error("No package.json file found");
			process.exit(1);
		}

		const packageJson = fs.readFileSync(pathToPackage, 'utf8');

		let json;
		try {
			json = JSON.parse(packageJson);
		} catch (e) {
			console.error("Package.json contains invalid JSON");
			process.exit(1);
		}
		return json;
	},
	versionCompare: (v1, v2) => {
		const v1Split = v1.split(".");
		const v2Split = v2.split(".");
	
		for (var i=0;i<v1Split.length;i++) {
			const v1Num = parseInt(v1Split[i], 10);
			const v2Num = parseInt(v2Split[i], 10);
		
			if (v1Num > v2Num) {
				return 1;
			} else if (v1Num < v2Num) {
				return -1;
			}
		}
	
		return 0;
	}
};
