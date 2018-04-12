const { DIRS, getPackage, versionCompare } = require('../utils.js');
const fs = require('fs');
const { exec } = require('child_process');
const https = require('https');

const {
	CACHE_DIR,
	MAIN_DIR,
	MANIFEST_FILE,
	BIN_DIR
} = DIRS;

const getTarball = (tarball, key) => {
	const pathToDownload = MAIN_DIR + "/temp.tgz";
	return new Promise((resolve) => {
		https.get(tarball, (response) => {
	        var file = fs.createWriteStream(pathToDownload);
	         response.on('data', function(chunk){
	             file.write(chunk);
	         }).on('end', function(){
	             file.end();
	             console.log('Download complete');
			 
				 const packageCacheDir = CACHE_DIR + "/" + key;
				 if (!fs.existsSync(packageCacheDir)) {
				 	fs.mkdirSync(packageCacheDir);
				 }

				 exec("cd " + MAIN_DIR + " ; tar -xvzf temp.tgz", () => {
					 const json = getPackage(MAIN_DIR + "/package");
					 if (!json) {
						 console.log("No json in tarball!");
						 process.exit(1);
						 return;
					 }
					 exec("rm " + MAIN_DIR + "/temp.tgz", () => {
						 //console.log(json);
						 const version = json.version;
						 const versionCacheDir = packageCacheDir + "/" + version;
						 exec("mv " + MAIN_DIR + "/package " + versionCacheDir, () => {
						 	install(versionCacheDir).then(() => {
								resolve(version)
							});
						 });
					 });
				 });
	         });
		 });
	 });
}

const getModuleFromNpm = (key, version) => {
	return Promise.resolve()
	.then(() => {
		return new Promise((resolve) => {
			console.log('https://registery.npmjs.org/' + key);
			const request = https.request({
				hostname: 'registry.npmjs.org',
				path: '/' + key,
				method: 'GET',
				port: 443
			}, (res)  => {
				let body = '';
			    res.on('data', (d) => {
					body += d;
			    });
				res.on('end', () => {
					const response = JSON.parse(body);
					console.log("Got module data from npm");
					if (!response.versions) {
						console.error("No version data!");
						resolve();
						return;
					}
					
					const keys = Object.keys(response.versions);
					console.log(keys);
					for (var i=0;i<keys.length;i++) {
						const availableVersion = keys[i];
						console.log(availableVersion, version);
						const comparator = versionCompare(version, availableVersion);
						//console.log(comparator);
						if (comparator === 0) {
							const versionData = response.versions[availableVersion];
							console.log('Found required version');
							if (versionData.dist) {
								const tarball = versionData.dist.tarball;
								console.log('Downloading from', tarball);
				
								getTarball(tarball, key).then(resolve);
							}
							break;
						}
					}
					console.error("Unable to find version to match", version);
					resolve();
					//console.log(response);
				});
			});
			request.on('error', (e) => {
				console.error(e);
			});
			request.end();
		});
	});
}

const installModule = (key, version) => {
	return new Promise((resolve) => {
		let type;
	
		const numreg = new RegExp('^[0-9^<>=.]', 'i');
		const urlreg = new RegExp('^http', 'i');
		if (numreg.test(version)) {
			type = 'numeric';
			let string = '';
			for (var i=0;i<version.length;i++) {
				const ch = version.charCodeAt(i);
				if ((ch >= 48 && ch <= 57) || ch === 46) {
					string += version.charAt(i);
					break;
				}
			}
			const nums = string.split(".");
			if (nums.length === 1) {
				string = nums[0] + ".0.0";
			} else if (nums.length === 2) {
				string = nums[0] + "." + nums[1] + ".0";
			}
			version = string;
		} else if (urlreg) { 
			type = 'url';
		} else {
			console.log('Unknown dependency value for ' + key + " :", version,"skipping");
			resolve();
			return;
		}
		const packageCacheDir = CACHE_DIR + "/" + key;
	
		if (type === "numeric") {
			console.log("Handling dependency", key + " with version " + version);
		 	const versionCacheDir = packageCacheDir + "/" + version;
			if (fs.existsSync(versionCacheDir)) {
				console.log('Found existing installation');
				resolve([versionCacheDir, key]);
			} else {
				console.log("Fetching module");
				getModuleFromNpm(key, version).then(() => {
					console.log('got module form npm');
					resolve([versionCacheDir, key]);
				});
			}
		} else if (type === 'url') {
			const url = version;
			console.log("Handling dependency", key,"with url",url);
			const urlSplit = url.split(".");
			const ending = urlSplit[urlSplit.length-1];

			let handled = false;
			if (fs.existsSync(MANIFEST_FILE)) {
				console.log("Searching manifest for existing entry...");
				let manifest = fs.readFileSync(MANIFEST_FILE, 'utf8');
				//console.log(manifest);
				manifest = manifest.split("\n");
				for (var i=0;i<manifest.length;i++) {
					const str = manifest[i].split("<=>");
					//console.log(str);
					if (str[0] === url && str[1] === key) {
						const version = str[2];
						console.log("Found existing installation:", version);
				 		const versionCacheDir = packageCacheDir + "/" + version;
						resolve([versionCacheDir, key]);
						handled = true;
						break;
					}
				}
			}
		
			if (handled) {
				return;
			}
		
			if (ending === "tgz") {
				console.log("Treating as a tarball");
				getTarball(version, key).then((version) => {
					//console.log(version);
			 		const versionCacheDir = packageCacheDir + "/" + version;
				
					// adding to manifest
					console.log("Adding to manifest");
					fs.appendFileSync(MANIFEST_FILE, url + "<=>" + key + "<=>" + version + "\n");
				
					resolve([versionCacheDir, key]);
				});
			} else {
				console.log("Don't know how to handle this");
			}
		}
	});
}

const install = (cwd, environment) => {
	return Promise.resolve()
	.then(() => {
		return new Promise((resolve) => {
			const json = getPackage(cwd);
			
			const name = json.name || cwd;
			
			console.log("Installing module", name);
			
			let fullDeps = {
				...json.dependencies
			};
			if (environment === "development") {
				fullDeps = {
					...fullDeps,
					...json.devDependencies
				}
			}
			console.log("Got dependencies", JSON.stringify(fullDeps, null, 4));
			//console.log(json);
			const nodeDir = cwd + "/node_modules";
			exec("rm -rf " + nodeDir, () => {
				if (!fs.existsSync(nodeDir)) {
					fs.mkdirSync(nodeDir);
				}
			
				const dependencyKeys = Object.keys(fullDeps);
			
				 const finishSync = (versionCacheDir, key) => {
					 return new Promise((resolve) => {
						 console.log('ln -s ' + versionCacheDir + " " + nodeDir + "/" + key);
						 exec('ln -s ' + versionCacheDir + " " + nodeDir + "/" + key, () => {
							 resolve();
						 });
					 });
				 };
			
				const installDependency = () => {
					//console.log(dependencyKeys);
					if (dependencyKeys.length === 0) {
						// all done!
					 	console.log('Installation of ' + name + " complete!");
						resolve();
						return;
					}
				
					const key = dependencyKeys.shift();
					let version = fullDeps[key];
					
					installModule(key, version).then((result) => {
						if (!result) {
							return;
						}
						const dir = result[0];
						const key = result[1];
						//console.log('got',dir,key);
						return finishSync(dir, key);
					}).then(installDependency);
				}
			
				installDependency();
			});
		});
	}).then(() => {		
		console.log('About to link binaries');
		return Promise.resolve()
		.then(() => {		
			// copy any bin folders
			const json = getPackage(cwd);
			const name = json.name || cwd;
			
			if (json.bin) {
				console.log("Linking binaries for " + name);
				
				let objects = json.bin;
				
				console.log(json.bin, typeof json.bin);
				
				if (typeof json.bin === "string") {
					const path = objects.split("/");
					const name = path[path.length-1];
					objects = {
						[name]: path
					};
				}
			
				return new Promise((resolve) => {
					const binKeys = Object.keys(objects);
				
					//console.log(binKeys);
				
					const copyBin = () => {
						if (binKeys.length === 0) {
							console.log('Done');
							resolve();
							return;
						}
						const key = binKeys.shift();
						const scriptPath = cwd + "/" + objects[key];
					
						//console.log(key, scriptPath);
					
						exec('ln -s ' + scriptPath + ' ' + BIN_DIR + '/' + key, () => {
							exec('chmod +x ' + BIN_DIR + "/" + key, () => {
								copyBin();
							});
						});
					}
				
					copyBin();
				});
			}
		});
	});
};

module.exports = {
	install,
	installModule
};