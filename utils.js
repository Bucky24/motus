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

const motusBinDir = motusCacheDir + "/npmBin";
if (!fs.existsSync(motusBinDir)) {
	fs.mkdirSync(motusBinDir);
}

module.exports = {
	DIRS: {
		MAIN_DIR: motusDir,
		CACHE_DIR: motusCacheDir,
		MANIFEST_FILE: motusCacheDir + "/manifest",
		BIN_DIR: motusBinDir
	},
	getPackage: (cwd) => {
		const pathToPackage = cwd + "/package.json";

		if (!fs.existsSync(pathToPackage)) {
			console.error("No package.json file found in", cwd);
			return;
			//process.exit(1);
		}

		const packageJson = fs.readFileSync(pathToPackage, 'utf8');

		let json;
		try {
			json = JSON.parse(packageJson);
		} catch (e) {
			console.error("Package.json contains invalid JSON", e);
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
	},
	// Not working
	findAllLinkedFiles: (startingScript) => {
		contents = fs.readFileSync(cwd + "/" + startingScript, "utf8");
		
		let inQuotes = false;
		let escaped = false;
		for (var i=0;i<contents.length;i++) {
			const ch = contents.charAt(i);
			
			if (ch === inQuotes) {
				if (!escaped) {
					inQuotes = false;
				} else {
					escaped = false;
				}
			} else if (ch === '\\' && inQuotes && !escaped) {
				escaped = true;
			} else if (ch === '"' || ch === "'" && !inQuotes) {
				inQuotes = ch;
			} else {
				escaped = false;
				if (!inQuotes) {
					const forwardString = contents.substr(i, 7);
					if (forwardString === 'require') {
						console.log('require!');
						let pos1 = false;
						let pos2 = false;
						for (j=i;j<contents.length;j++) {
							const ch2 = contents.charAt(j);
							if (ch2 === "(") {
								pos1 = j;
							} else if (ch2 === ")") {
								pos2 = j;
								break;
							}
						}
						console.log(pos1, pos2);
						const str = contents.substring(pos1+1, pos2);
						console.log(str);
						const firstChar = str.charAt(0);
						if (firstChar === str.charAt(str.length-1) && (firstChar === '"' || firstChar === "'")) {
							console.log('got a string here');
						}
					}
				}
			}
		}
	}
};
