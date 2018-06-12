const path = require('path');
const os = require('os');
const fs = require('fs');
const semver = require('semver');
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
		if (semver.gt(v1, v2)) {
			return 1;
		} else if (semver.lt(v1, v2)) {
			return -1;
		}
		
		return 0;
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
		
		let type;
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
			type = 'numeric';
			console.log('numeric for ', version);
			console.log(semver.coerce(version));
			versionData = {
				exactVersion: semver.coerce(version).version
			}
			//console.log(versionData);
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
	findBestVersion: (version, versionList) => {
		const validVersions = versionList.filter((availableVersion) => {
			return semver.satisfies(availableVersion, version);
		}).map((filteredVersion) => {
			return semver.coerce(filteredVersion);
		});
		
		validVersions.sort(module.exports.versionCompare).reverse();
		
		if (validVersions.length > 0) {
			return validVersions[0];
		}
		
		return null;
	},
	
};
