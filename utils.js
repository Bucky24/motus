const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

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
const motusNodeDir = motusCacheDir + "/node_modules";
if (!fs.existsSync(motusNodeDir)) {
	fs.mkdirSync(motusNodeDir);
}

const motusBinDir = motusCacheDir + "/npmBin";
if (!fs.existsSync(motusBinDir)) {
	fs.mkdirSync(motusBinDir);
}

if (fs.existsSync(homeDir + "/node_modules")) {
	execSync("rm " + homeDir + "/node_modules");
}
execSync("ln -s " + motusNodeDir + "" + " " + homeDir + "/node_modules ");

if (!fs.existsSync(motusCacheDir + '/installed')) {
	execSync("touch " + motusCacheDir + '/installed');
}

module.exports = {
	DIRS: {
		MAIN_DIR: motusDir,
		CACHE_DIR: motusCacheDir,
		MANIFEST_FILE: motusCacheDir + "/manifest",
		BIN_DIR: motusBinDir,
		NODE_DIR: motusNodeDir,
		PACKAGE_FILE: motusCacheDir + '/installed'
	},
	getPackage: (cwd) => {
		const pathToPackage = cwd + "/package.json";

		if (!fs.existsSync(pathToPackage)) {
			console.error("No package.json file found in", pathToPackage);
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
						//console.log('require!');
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
						//console.log(pos1, pos2);
						const str = contents.substring(pos1+1, pos2);
						//console.log(str);
						const firstChar = str.charAt(0);
						if (firstChar === str.charAt(str.length-1) && (firstChar === '"' || firstChar === "'")) {
							console.log('got a string here');
						}
					}
				}
			}
		}
	},
	processVersion: (version) => {
		const getGit = (url) => {
			const split = version.split("#");
			if (split.length > 1) {
				return {
					branch: split[1],
					url: split[0]
				};
			} else {
				return {
					url: split[0]
				}
			}
		}
		
		let versionData = {};
		if (version.substring(0,4) === "http") {
			if (version.indexOf('https://github.com/') === 0) {
				type = 'git';
				versionData = {
					...versionData,
					...getGit(version),
					original: version
				};
			} else {
				type = 'url';
				versionData.url = version;
			}
		} else if (version.substring(0,3) === "git") {
			type = 'git';
			versionData = {
				...versionData,
				...getGit(version),
				original: version
			};
		} else {
			const normalVersion = /^([0-9]+\.){2}[0-9]+$/;
			const greaterVersion = /^\^([0-9]+\.){1,2}[0-9]+$/;
			const extra = /^([0-9]+\.){2}[0-9]+\-.*?$/;
			const approxVersion = /^\~([0-9]+\.){2}[0-9]+$/;
			const approxVersionExtra = /^\~([0-9]+\.){2}[0-9]+\-.*?$/;
			const greaterEqualVersion = /^\>\=[ ]*(([0-9]+\.){2}[0-9]+)$/;
			const singleNumberFormat = /^[0-9]+$/;
			const doubleNumberFormat = /^[0-9]+\.[0-9]+$/;
			const equalsFormat = /^\=[ ]*(([0-9]+\.){2}[0-9]+)$/;
			const orFormat = /^([0-9])[ ]*\|\|/;
			const dashFormat = /^([0-9.xX]+)[ ]*\-[ ]*([0-9.xX]+)$/;
			const inequalityFormat = /^([=<>]+)[ ]*([0-9.]+)[ ]([=<>]+)[ ]*([0-9.]+)$/;
			const xFormat = /^([0-9.]+)[.xX]+$/;
			const betaFormat = /^\^([0-9.xX]+)\-[beta|alpha].*$/;
			
			const padFormat = (initial) => {
				if (singleNumberFormat.test(initial)) {
					return initial + ".0.0";
				} else if (doubleNumberFormat.test(initial)) {
					return initial + ".0";
				} else {
					return initial;
				}
			}

			type = 'numeric';
			if (normalVersion.test(version) || extra.test(version)) {
				versionData.version = version;
			} else if (greaterVersion.test(version)) {
				//console.log("version is greater");
				versionData.version = padFormat(version.substring(1));
				versionData.allowGreater = true;
				//console.log(versionData.version);
			} else if (approxVersion.test(version) || approxVersionExtra.test(version)) {
				versionData.version = version.substring(1);
				versionData.approximate = true;
			} else if (greaterEqualVersion.test(version)) {
				const matches = version.match(greaterEqualVersion);
				versionData.version = matches[1];
				versionData.allowGreater = true;
			} else if (singleNumberFormat.test(version)) {
				versionData.version = version + ".0.0";
				versionData.allowGreater = true;
			} else if (doubleNumberFormat.test(version)) {
				versionData.version = version + ".0";
				versionData.allowGreater = true;
			} else if (equalsFormat.test(version)) {
				const matches = version.match(equalsFormat);
				versionData.version = matches[1];
			} else if (orFormat.test(version)) {
				const matches = version.match(orFormat);
				version = matches[1];
				if (singleNumberFormat.test(version)) {
					versionData.version = version + ".0.0";
					versionData.allowGreater = true;
				} else if (doubleNumberFormat.test(version)) {
					versionData.version = version + ".0";
					versionData.allowGreater = true;
				}
			} else if (dashFormat.test(version)) {
				const matches = version.match(dashFormat);
				const externalData = module.exports.processVersion(matches[1]);
				//console.log(externalData);
				versionData.version = externalData.versionData.version;
			} else if (inequalityFormat.test(version)) {
				const matches = version.match(inequalityFormat);
				const ineq1 = matches[1];
				const num1 = padFormat(matches[2]);
				const ineq2 = matches[3];
				const num2 = padFormat(matches[4]);
				// Right now ignore the second part, will be important later though
				if (ineq1 === ">=") {
					versionData.version = num1;
					versionData.allowGreater = true;
				} else {
					throw new Error("Unhandled inequality: " + version);
				}
			} else if (xFormat.test(version)) {
				const matches = version.match(xFormat);
				versionData.version = padFormat(matches[1]);
			} else if (version === "*") { 
				versionData.version = "0.0.0";
				versionData.allowGreater = true;
			} else if (betaFormat.test(version)) {
				const matches = version.match(betaFormat);
				versionData.version = padFormat(matches[1]);
				versionData.allowGreater = true;
			} else {
				throw new Error("Unknown version format " + version);
				return;
			}
		}
		
		return {
			type,
			versionData
		};
	},
	findBestVersion: (versionRules, versionList) => {
		const keys = Object.keys(versionList);
		for (var i=0;i<keys.length;i++) {
			const availableVersion = keys[i];
			//console.log(availableVersion, version);
			const comparator = module.exports.versionCompare(versionRules.version, availableVersion);
			//console.log(comparator);
			let valid = false;
			if (comparator === 0) {
				valid = true;
			} else if (comparator === -1 && versionRules.allowGreater) {
				valid = true;
			}
			if (valid) {
				return availableVersion;
			}
		}
		
		return null;
	}
};
