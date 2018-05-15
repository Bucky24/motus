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
		if (v1 === v2) {
			return 0;
		}
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
			const tooManyDots = /^([0-9.]+)[.]{3}([0-9.]+)$/;
			const normalVersion = /^([0-9]+\.){2}[0-9]+$/;
			const greaterVersion = /^\^([0-9]+\.){1,2}[0-9]+$/;
			const extra = /^([0-9]+\.){2}[0-9]+\-.*?$/;
			const approxVersion = /^\~([0-9.xX]+)$/;
			const approxVersionExtra = /^\~([0-9]+\.){2}[0-9]+\-.*?$/;
			const greaterEqualVersion = /^\>\=[ ]*(([0-9]+\.){2}[0-9]+)$/;
			const singleNumberFormat = /^[0-9]+$/;
			const doubleNumberFormat = /^[0-9]+\.[0-9]+$/;
			const equalsFormat = /^\=[ ]*(([0-9]+\.){2}[0-9]+)$/;
			const orFormat = /^([0-9])[ ]*\|\|/;
			const dashFormat = /^([\^0-9.xX]+)[ ]*\-[ ]*([\^0-9.xX]+)$/;
			const inequalityFormat = /^([=<>]*)[ ]*([\^0-9.]+)[ ]([=<>]+)[ ]*([\^0-9.]+)$/;
			const xFormat = /^([0-9.]+?)[.xX]+$/;
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

			//console.log(version);
			type = 'numeric';
			// have to do this first because other regex catch it too
			if (tooManyDots.test(version)) {
				//console.log('matches');
				const matches = version.match(tooManyDots);
				//console.log(matches);
			} else if (normalVersion.test(version) || extra.test(version)) {
				//console.log('here now');
				versionData.exactVersion = version;
			} else if (greaterVersion.test(version)) {
				//console.log("version is greater");
				versionData.greaterVersion = padFormat(version.substring(1));
				//console.log(versionData.version);
			} else if (approxVersion.test(version) || approxVersionExtra.test(version)) {
				const externalData = module.exports.processVersion(version.substring(1));
				//console.log(externalData);
				const newVersion = externalData.versionData.useVersion;
				//console.log(externalData);
				const arr = newVersion.split('.');
				// so basically here if we get 4, then we want to get between
				// 4.0.0 and 5.0.0
				// if we get 4.3, we want to get between 4.3.0 and 4.4.0
				// so get the last bit, rejoin the version string, and increment
				// then append.
				let part = arr.pop();
				while (part === '0') {
					part = arr.pop();
				}
				const greater = [...arr, part];
				while (greater.length < 3) {
					greater.push('0');
				}
				const lesser = [...arr, (part + 1)];
				while (lesser.length < 3) {
					lesser.push('0');
				}
				versionData.greaterVersion = greater.join('.');
				versionData.smallerThanVersion = lesser.join('.');
			} else if (greaterEqualVersion.test(version)) {
				const matches = version.match(greaterEqualVersion);
				versionData.greaterVersion = matches[1];
			} else if (singleNumberFormat.test(version)) {
				version = parseInt(version, 10);
				versionData.greaterVersion = version + ".0.0";
				versionData.smallerThanVersion = (version + 1) + '.0.0';
				//console.log('here', version, versionData);
			} else if (doubleNumberFormat.test(version)) {
				// basically the same thing as approximate up there, with some tweaks
				const arr = version.split('.');
				const finalPart = parseInt(arr.pop(), 10);
				const greater = [...arr, finalPart, '0'];
				const lesser = [...arr, (finalPart + 1), '0'];
				versionData.greaterVersion = greater.join('.');
				versionData.smallerThanVersion = lesser.join('.');
			} else if (equalsFormat.test(version)) {
				const matches = version.match(equalsFormat);
				versionData.exactVersion = matches[1];
			} else if (orFormat.test(version)) {
				const matches = version.match(orFormat);
				const externalData = module.exports.processVersion(matches[1]);
				versionData = externalData.versionData;
			} else if (dashFormat.test(version)) {
				const matches = version.match(dashFormat);
				const externalData = module.exports.processVersion(matches[1]);
				versionData = externalData.versionData;
			} else if (inequalityFormat.test(version)) {
				// this is terribly wrong right now, but that's ok
				const matches = version.match(inequalityFormat);
				const ineq1 = matches[1];
				const num1 = module.exports.processVersion(matches[2])
					.versionData.useVersion;
				const ineq2 = matches[3];
				const num2 = module.exports.processVersion(matches[4])
					.versionData.useVersion;
				// Right now ignore the second part, will be important later though
				if (ineq1 === ">=") {
					versionData.greaterVersion = num1;
				} else {
					throw new Error("Unhandled inequality: " + version);
				}
			} else if (xFormat.test(version)) {
				const matches = version.match(xFormat);
				//console.log('xformat', matches[1]);
				versionData.exactVersion = padFormat(matches[1]);
			} else if (version === "*") { 
				versionData.greaterVersion = "0.0.0";
			} else if (betaFormat.test(version)) {
				const matches = version.match(betaFormat);
				versionData.greaterVersion = padFormat(matches[1]);
			} else if (version === 'latest') {
				// should find the very latest version
				versionData.greaterVerison = '0.0.0';
			} else {
				throw new Error("Unknown version format " + version);
				return;
			}
		}
		
		if (versionData.exactVersion) {
			versionData.useVersion = versionData.exactVersion;
		} else if (versionData.greaterVersion) {
			versionData.useVersion = versionData.greaterVersion;
		} else {
			versionData.useVersion = versionData.smallerThanVersion;
		}
		
		//console.log('result is', versionData);
		
		return {
			type,
			versionData
		};
	},
	findBestVersion: (versionRules, versionList) => {
		const versions = Object.keys(versionList)
			.sort(module.exports.versionCompare)
			.reverse();
			
		//console.log(versionRules);
		const versionsWithComparison = versions.map((availableVersion) => {
			let comparatorEqual = 0;
			let compGreater = -1;
			let compLesser = 1;
			
			if (versionRules.exactVersion) {
				comparatorEqual = module.exports.versionCompare(
					versionRules.exactVersion,
					availableVersion
				);
			}
			if (versionRules.greaterVersion) {
				compGreater = module.exports.versionCompare(
					versionRules.greaterVersion,
					availableVersion
				);
			}
			if (versionRules.smallerThanVersion) {
				compLesser = module.exports.versionCompare(
					versionRules.smallerThanVersion,
					availableVersion
				);
			}
			
			//console.log(versionRules, availableVersion, comparatorEqual);
			
			return {
				version: availableVersion,
				compEqual: comparatorEqual === 0,
				compGreater: compGreater === 0 || compGreater === -1,
				compLesser: compLesser === 1
			}
		});
		for (var i=versionsWithComparison.length-1;i>=0;i--) {
			const { version, compEqual, compGreater, compLesser } = versionsWithComparison[i];
			//console.log(availableVersion, version);
			//console.log(comparator);
			const valid = compEqual && compGreater && compLesser;
			if (valid) {
				return version;
			}
		}
		
		return null;
	},
	
};
