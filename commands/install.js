const { DIRS, getPackage, versionCompare, processVersion, findBestVersion } = require('../utils.js');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const https = require('https');
const http = require('http');
const path = require('path');

const {
	CACHE_DIR,
	MAIN_DIR,
	MANIFEST_FILE,
	BIN_DIR,
	NODE_DIR,
	PACKAGE_FILE
} = DIRS;

let chain = [];
let startTime;
let installList = [];

const cleanUp = () => {
	chain = [];
	startTime = null;
	installList = [];
}

const getTarball = (tarball, key) => {
	const pathToDownload = MAIN_DIR + "/" + key + ".tgz";
	return new Promise((resolve, reject) => {
		//console.log("request made", tarball);
		const handleDownload = (response) => {
	        var file = fs.createWriteStream(pathToDownload);
	         response.on('data', function(chunk){
				 //console.log(key, 'got data');
	             file.write(chunk);
	         }).on('end', function(){
	             file.end();
				 file.on('finish', () => {
		             //console.log(key, 'Download complete');
			 
					 const packageCacheDir = CACHE_DIR + "/" + key;
					 if (!fs.existsSync(packageCacheDir)) {
					 	fs.mkdirSync(packageCacheDir);
					 }
				 
					 if (!fs.existsSync(MAIN_DIR + "/" + key + ".tgz")) {
						 console.log('Tarball does not exist');
					 }
					 
					 // clear out package just in case
					 try {
						 execSync('rm -rf ' + MAIN_DIR + "/package/*");
						 execSync('rm -rf ' + MAIN_DIR + "/package");
					 } catch (err) {
				 		 console.log('got error', err);
						 throw err;
					 }
				 
					 // get existing list of items in main_dir for comparison
					 const previousFiles = fs.readdirSync(MAIN_DIR, 'utf8');
					 //console.log("previous", previousFiles);

					 const command = "tar -xvzf " + MAIN_DIR + "/" +  key + ".tgz -C " + MAIN_DIR;
					 exec(command, (err, stdout, stderr) => {
						 //console.log("Untarred file...", command, err, stdout, stderr);
					 
						 const currentFiles = fs.readdirSync(MAIN_DIR, 'utf8');
						 //console.log("current", currentFiles);
					 
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
							 reject();
						 }
						 //console.log(newFiles);
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
						 //console.log("rm " + MAIN_DIR + "/" + key + ".tgz");
						 exec("rm " + MAIN_DIR + "/" + key + ".tgz", () => {
							 //console.log("Extracted folder is", extractedFolder);
							 const version = json.version;
							 const versionCacheDir = packageCacheDir + "/" + version;
							 //console.log("mv " + MAIN_DIR + "/" + extractedFolder + " " + versionCacheDir);
							 exec("mv " + MAIN_DIR + "/" + extractedFolder + " " + versionCacheDir, () => {
								 // Cleanup just in case
								 //console.log("rm -rf " + MAIN_DIR + "/" + extractedFolder);
								 exec("rm -rf " + MAIN_DIR + "/" + extractedFolder, () => {
									 //console.log('dir after moving', fs.readdirSync(MAIN_DIR, 'utf8'));
								 	 install(versionCacheDir).then(() => {
									 	resolve(version)
									 });
								 });
							 });
						 });
					 });
				 });
	         });
		 };
		 
		 const handleError = (e) => {
			 console.log("Unable to fetch tarball", e);
			 reject();
		 }
		 
		 const arr = tarball.split(":");
		 const protocol = arr[0];
		 if (protocol === 'https') {
			 https.get(tarball, handleDownload).on('error', handleError);
		 } else if (protocol === 'http') {
		 	 http.get(tarball, handleDownload).on('error', handleError);
		 } else {
			 console.log("Unknown protocol:", protocol);
			 reject();
		 }
	 });
}

const getModuleFromNpm = (key, version) => {
	return Promise.resolve()
	.then(() => {
		return new Promise((resolve, reject) => {
			//console.log('https://registery.npmjs.org/' + key);
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
					//console.log("Got module data from npm");
					if (!response.versions) {
						console.error("No version data from npm!");
						resolve();
						return;
					}
					
					const usableVersion = findBestVersion(
						version,
						Object.keys(response.versions)
					);
					
					if (usableVersion) {
						const versionData = response.versions[usableVersion];
						//console.log('Found required version');
						if (versionData.dist) {
							const tarball = versionData.dist.tarball;
							//console.log('Downloading from', tarball);
							getTarball(tarball, key).then((actualVersion) => {
								//console.log(key, "Tarball fetch compelete");
								resolve(actualVersion);
							}).catch(reject);
						}
						return;
					}
					console.error("Unable to find version to match", version);
					console.error("Available Versions: ");
					const keys = Object.keys(response.versions);
					for (var i=0;i<keys.length;i++) {
						const availableVersion = keys[i];
						console.error(availableVersion);
					}
					reject(new Error("Could not find version"));
					//console.log(response);
				});
			});
			request.on('error', (e) => {
				console.error(e);
				reject(e);
			});
			request.end();
		});
	});
}

const installModule = (key, version) => {
	//console.log("Attempting to install module",key,version);
	return Promise.resolve()
	.then(() => {
		return new Promise((resolve, reject) => {	
			let type;
			let versionData;
			try {
				//console.log('here');
				const result = processVersion(version);
				//console.log('here2', result);
				type = result.type;
				versionData = result.versionData;
				//console.log('all done');
			} catch (err) {
				reject(err);
				return;
			}
			const realVersion = versionData.useVersion;
			
			const packageCacheDir = CACHE_DIR + "/" + key;
			
			const listKey = `${key}<=>${realVersion}`;
			//console.log('checking', listKey, installList.length, versionData);
			if (installList.includes(listKey)) {
				// module already installed;
				//console.log('module ' + listKey + ' already installed');
				let versionCacheDir = packageCacheDir + "/" + versionData.useVersion;
				resolve([versionCacheDir, key]);
				return;
			}
			
			const handleExistingInstallation = (cwd) => {
				install(cwd).then(() => {
					resolve([cwd, key]);
				});
			};
			
			const checkManifest = (url, key) => {
				let handled = false;
				if (fs.existsSync(MANIFEST_FILE)) {
					//console.log("Searching manifest for existing entry...");
					let manifest = fs.readFileSync(MANIFEST_FILE, 'utf8');
					//console.log(manifest);
					manifest = manifest.split("\n");
					for (var i=0;i<manifest.length;i++) {
						const str = manifest[i].split("<=>");
						//console.log(str);
						if (str[0] === url && str[1] === key) {
							const version = str[2];
							//console.log("Found existing installation:", version);
					 		const versionCacheDir = packageCacheDir + "/" + version;
							handleExistingInstallation(versionCacheDir);
							handled = true;
							break;
						}
					}
				}
				return handled;
			}
			
			//console.log(versionData);
	
			if (type === "numeric") {
				//console.log("Handling dependency", key + " with version " + versionData.version);
			 	let versionCacheDir = packageCacheDir + "/" + versionData.useVersion;
				if (fs.existsSync(versionCacheDir)) {
					//console.log('Found existing installation');
					handleExistingInstallation(versionCacheDir);
				} else {
					//console.log("Fetching module");
					getModuleFromNpm(key, version).then((actualVersion) => {
						//console.log(key, 'Finished installing module from npm');
					 	versionCacheDir = packageCacheDir + "/" + actualVersion;
						resolve([versionCacheDir, key]);
					}).catch((e) => {
						//console.error(key, "Installing dependency failed");
						reject(e);
					});
				}
			} else if (type === 'url') {
				const url = versionData.url;
				//console.log("Handling dependency", key,"with url",url);
				const urlSplit = url.split(".");
				const ending = urlSplit[urlSplit.length-1];
		
				if (checkManifest(url, key)) {
					return;
				}
		
				if (ending === "tgz") {
					//console.log("Treating as a tarball");
					getTarball(version, key).then((version) => {
						//console.log(version);
				 		const versionCacheDir = packageCacheDir + "/" + version;
				
						// adding to manifest
						c//onsole.log("Adding to manifest");
						fs.appendFileSync(MANIFEST_FILE, url + "<=>" + key + "<=>" + version + "\n");
				
						resolve([versionCacheDir, key]);
					});
				} else {
					//console.log("Don't know how to handle this");
				}
			} else if (type === "git") {
				//console.log("Cloning from git repo " + versionData.url);
				let command = "git clone --depth 1 " + versionData.url + " " + MAIN_DIR + "/package";
				if (versionData.branch) {
					command += " -b " + versionData.branch;
				};
				
				const fullUrl = versionData.original;
				
				if (checkManifest(fullUrl, key)) {
					return;
				}
				
				//console.log(command);
				exec("rm -rf " + MAIN_DIR + "/package", () => {
					if (!fs.existsSync(packageCacheDir)) {
						execSync('mkdir ' + packageCacheDir);
					}
					exec(command, (err) => {
						const extractedFolder = "package";
						const json = getPackage(MAIN_DIR + "/" + extractedFolder);
						if (!json) {
							console.log("No json in git repo!");
							process.exit(1);
						}

						const version = json.version;
						const versionCacheDir = packageCacheDir + "/" + version;
						
						//console.log("mv " + MAIN_DIR + "/" + extractedFolder + " " + versionCacheDir);
						exec("mv " + MAIN_DIR + "/" + extractedFolder + " " + versionCacheDir, () => {
							//console.log('moving folder to ',versionCacheDir);
							//console.log("rm -rf " + MAIN_DIR + "/" + extractedFolder);
							exec("rm -rf " + MAIN_DIR + "/" + extractedFolder, () => {
								fs.appendFileSync(MANIFEST_FILE, fullUrl + "<=>" + key + "<=>" + version + "\n");
				
								resolve([versionCacheDir, key]);
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
		console.log(key + "-Unable to install module:", e);
		throw e;
	});
}

const install = (cwd, environment) => {
	return Promise.resolve()
	.then(() => {
		return new Promise((resolve, reject) => {
			const json = getPackage(cwd);
			
			const name = json.name || cwd;
			const parentVersion = json.version;
			const key = name + "<=>" + parentVersion;
			
			if (chain.includes(key)) {
				//console.log("Module " + name + " already found in chain, skipping");
				resolve();
				return;
			}
			chain.push(key);
			
			let tab = '';
			let tab2 = '';
			for (var i=1;i<chain.length;i++) {
				tab += '    ';
			}
			for (var i=0;i<chain.length;i++) {
				tab2 += '    ';
			}
			
			const top = chain.length <= 2;
			//console.log(chain.length +  "'" + tab + "'");
			
			//console.log("Chain is", chain);
			
			if (top) console.log(tab + "Installing module", name, parentVersion);
			
			let fullDeps = {
				...json.dependencies
			};
			if (environment === "development") {
				fullDeps = {
					...fullDeps,
					...json.devDependencies
				}
			}
			//console.log("Got dependencies", JSON.stringify(fullDeps, null, 4));
			//console.log(json);
			const nodeDir = cwd + "/node_modules";
			//console.log('rm -rf ' + nodeDir);
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
					if (top) {
						console.log(tab2 + name + " dependencies left: " + dependencyKeys.length);
					}
				
					const key = dependencyKeys.shift();
					let version = fullDeps[key];
					
					//console.log(dependencyKeys);
					if (dependencyKeys.length === 0) {
						// all done!
					 	if (top) {
							console.log(tab + 'Installation of ' + name + " complete!");
							// write to the installed packages file
							fs.appendFileSync(PACKAGE_FILE, name + "<=>" + parentVersion + "\n");
							installList.push(name + "<=>" + parentVersion);
						}
						resolve();
						return;
					}
					
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
						//console.log("Unable to install dependency");
						//exec("rm -rf " + cwd);
						reject('Unable to install dependency: ' + e.message);
					})
				}
			
				installDependency();
			});
		});
	}).then(() => {		
		//console.log('About to link binaries');
		return Promise.resolve()
		.then(() => {		
			// copy any bin folders
			const json = getPackage(cwd);
			const name = json.name || cwd;
			
			if (json.bin) {
				//console.log("Linking binaries for " + name);
				
				let objects = json.bin;
							
				if (typeof json.bin === "string") {
					const path = objects.split("/");
					const name = path[path.length-1];
					objects = {
						[name]: path
					};
				}
				
				//console.log(objects);
			
				return new Promise((resolve) => {
					const binKeys = Object.keys(objects);
				
					//console.log(binKeys);
				
					const copyBin = () => {
						if (binKeys.length === 0) {
							//console.log('Done');
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
		//console.log(cwd, MAIN_DIR, cwd.indexOf(MAIN_DIR));
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
			const version2 = realVersion.versionData.useVersion;
			const comparitor = versionCompare(highest, version2);
			
			//console.log(highest, version2, comparitor);
			
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
	install: (cwd, environment) => {
		startTime = Date.now();
		
		const end = () => {
			console.log('end!');
			const time = Date.now();
			const diff = time - startTime;
			console.log("Took", diff);

			cleanUp();
		}
		
		const installed = fs.readFileSync(PACKAGE_FILE, 'utf8');
		installList = installed.split("\n");
		
		
		return install(cwd, environment).then(end).catch(end);
	},
	installModule
};