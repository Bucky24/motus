const { DIRS, getPackage, versionCompare, processVersion } = require('../utils.js');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const https = require('https');
const path = require('path');

const {
	CACHE_DIR,
	MAIN_DIR,
	MANIFEST_FILE,
	BIN_DIR,
	NODE_DIR
} = DIRS;

let chain = [];

const getTarball = (tarball, key) => {
	const pathToDownload = MAIN_DIR + "/" + key + ".tgz";
	return new Promise((resolve, reject) => {
		https.get(tarball, (response) => {
			//console.log("request made");
	        var file = fs.createWriteStream(pathToDownload);
	         response.on('data', function(chunk){
				 //console.log(key, 'got data');
	             file.write(chunk);
	         }).on('end', function(){
	             file.end();
				 file.on('finish', () => {
		             console.log(key, 'Download complete');
			 
					 const packageCacheDir = CACHE_DIR + "/" + key;
					 if (!fs.existsSync(packageCacheDir)) {
					 	fs.mkdirSync(packageCacheDir);
					 }
				 
					 if (!fs.existsSync(MAIN_DIR + "/" + key + ".tgz")) {
						 console.log('Tarball does not exist');
					 }
				 
					 // get existing list of items in main_dir for comparison
					 const previousFiles = fs.readdirSync(MAIN_DIR, 'utf8');
					 console.log(previousFiles);

					 exec("cd " + MAIN_DIR + " ; tar -xvzf " + key + ".tgz", () => {
						 console.log("Untarred file...");
					 
						 const currentFiles = fs.readdirSync(MAIN_DIR, 'utf8');
						 console.log(currentFiles);
					 
						 const newFiles = [];
						 currentFiles.forEach((file) => {
							 let found = false;
							 previousFiles.forEach((file2) => {
								 //console.log(file, file2);
								 if (file2 === file) {
									 found = true;
								 }
							 });
							 if (!found) {
								 newFiles.push(file);
							 }
						 });
						 if (newFiles.length === 0) {
							 console.log("Tarball did not extract or was empty");
							 process.exit(1);
						 }
						 const extractedFolder = newFiles[0];
						 /*if (fs.existsSync(MAIN_DIR + "/package")) {
							 console.log("directory exists");
						 }else if (!fs.existsSync(MAIN_DIR + "/package")) {
							 console.log("directory does not exist");
						 }*/
						 const json = getPackage(MAIN_DIR + "/" + extractedFolder);
						 if (!json) {
							 console.log("No json in tarball!");
							 process.exit(1);
						 }
						 //console.log("going to remove tarball");
						 exec("rm " + MAIN_DIR + "/" + key + ".tgz", () => {
							 //console.log("Extracted folder is", extractedFolder);
							 const version = json.version;
							 const versionCacheDir = packageCacheDir + "/" + version;
							 //console.log("mv " + MAIN_DIR + "/" + extractedFolder + " " + versionCacheDir);
							 exec("mv " + MAIN_DIR + "/" + extractedFolder + " " + versionCacheDir, () => {
								 // Cleanup just in case
								 exec("rm -rf " + MAIN_DIR + "/" + extractedFolder, () => {
									 console.log('dir after moving', fs.readdirSync(MAIN_DIR, 'utf8'));
								 	 install(versionCacheDir).then(() => {
									 	resolve(version)
									 });
								 });
							 });
						 });
					 });
				 });
	         });
		 }).on('error', (e) => {
			 console.log("Unable to fetch tarball", e);
			 reject();
		 });
	 });
}

const getModuleFromNpm = (key, version) => {
	return Promise.resolve()
	.then(() => {
		return new Promise((resolve, reject) => {
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
					//console.log(keys);
					for (var i=0;i<keys.length;i++) {
						const availableVersion = keys[i];
						//console.log(availableVersion, version);
						const comparator = versionCompare(version.version, availableVersion);
						//console.log(comparator);
						let valid = false;
						if (comparator === 0) {
							valid = true;
						} else if (comparator === -1 && version.allowGreater) {
							valid = true;
						}
						if (valid) {
							const versionData = response.versions[availableVersion];
							console.log('Found required version');
							if (versionData.dist) {
								const tarball = versionData.dist.tarball;
								console.log('Downloading from', tarball);
								getTarball(tarball, key).then((actualVersion) => {
									console.log(key, "Tarball fetch compelete");
									resolve(actualVersion);
								});
							}
							return;
						}
					}
					console.error("Unable to find version to match", version);
					console.error("Available Versions: ");
					for (var i=0;i<keys.length;i++) {
						const availableVersion = keys[i];
						console.error(availableVersion);
					}
					reject();
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
	console.log("Attempting to install module",key,version);
	return Promise.resolve()
	.then(() => {
		return new Promise((resolve, reject) => {
			const {
				type,
				versionData
			} = processVersion(version);
			
			const handleExistingInstallation = (cwd) => {
				install(cwd).then(() => {
					resolve([cwd, key]);
				});
			};
			
			//console.log(versionData);
			
			const packageCacheDir = CACHE_DIR + "/" + key;
	
			if (type === "numeric") {
				console.log("Handling dependency", key + " with version " + versionData.version);
			 	let versionCacheDir = packageCacheDir + "/" + versionData.version;
				if (fs.existsSync(versionCacheDir)) {
					console.log('Found existing installation');
					handleExistingInstallation(versionCacheDir);
				} else {
					console.log("Fetching module");
					getModuleFromNpm(key, versionData).then((actualVersion) => {
						console.log(key, 'Finished installing module from npm');
					 	versionCacheDir = packageCacheDir + "/" + actualVersion;
						resolve([versionCacheDir, key]);
					}).catch((e) => {
						console.error(key, "Installing dependency failed");
						reject();
					});
				}
			} else if (type === 'url') {
				const url = versionData.url;
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
							handleExistingInstallation(versionCacheDir);
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
			} else if (type === "git") {
				//console.log(versionData);
				let command = "git clone --depth 1 " + versionData.url + " " + MAIN_DIR + "/package";
				if (versionData.branch) {
					command += " -b " + versionData.branch;
				};
				//console.log(command);
				exec("rm -rf " + MAIN_DIR + "/package", () => {
					exec(command, (err) => {
						console.log(err);
						const extractedFolder = "package";
						const json = getPackage(MAIN_DIR + "/" + extractedFolder);
						if (!json) {
							console.log("No json in git repo!");
							process.exit(1);
						}
						const version = json.version;
						const versionCacheDir = packageCacheDir + "/" + version;
						exec("mv " + MAIN_DIR + "/" + extractedFolder + " " + versionCacheDir, () => {
							exec("rm -rf " + MAIN_DIR + "/" + extractedFolder, () => {
							 	install(versionCacheDir).then(() => {
									resolve(version)
								});
							});
						});
					});
				});
			}
		});
	}).catch((e) => {
		console.log(key, "Unable to install module", e);
		throw e;
	});
}

const install = (cwd, environment) => {
	return Promise.resolve()
	.then(() => {
		return new Promise((resolve) => {
			const json = getPackage(cwd);
			
			const name = json.name || cwd;
			const version = json.version;
			chain.push(name + "<=>" + version);
			
			console.log("Chain is", chain);
			
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
						 //console.log("Linking!");
						 //console.log('ln -s ' + versionCacheDir + " " + nodeDir + "/" + key);
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
					}).then(installDependency)
					.catch((e) => {
						console.log("Unable to install dependency");
						exec("rm -rf " + cwd);
					})
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
							
				if (typeof json.bin === "string") {
					const path = objects.split("/");
					const name = path[path.length-1];
					objects = {
						[name]: path
					};
				}
				
				console.log(objects);
			
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
	}).then(() => {
		console.log(cwd, MAIN_DIR, cwd.indexOf(MAIN_DIR));
		if (cwd.indexOf(MAIN_DIR) !== 0) {
			return;
		}
		// determine if this module is the most advanced one we've installed,
		// and if so, symlink it to the modules directory
		const json = getPackage(cwd);

		const name = json.name || cwd;
		const version = json.version;
		
		const parentDir = path.resolve(cwd + "/..");
		const folders = fs.readdirSync(parentDir);
		
		//console.log(folders);
		let highest = null;
		
		for (var i=0;i<folders.length;i++) {
			const folder = folders[i];
			if (highest === null) {
				highest = folder;
				continue;
			}
			
			const versionPath = parentDir + "/" + folder;
			const realVersion = processVersion(folder);
			const version2 = realVersion.versionData.version;
			const comparitor = versionCompare(highest, version2);
			
			console.log(highest, version2, comparitor);
			
			if (comparitor === 1) {
				highest = version2;
			}
		}
		
		if (fs.existsSync(NODE_DIR + "/" + name)) {
			execSync("rm " + NODE_DIR + "/" + name);
		}
		const command = "ln -s " + parentDir + "/" + highest + " " + NODE_DIR + "/" + name;
		execSync(command);
	}).then(() => {
		chain.pop();
	});
};

module.exports = {
	install,
	installModule
};