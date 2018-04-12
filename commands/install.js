const { DIRS, getPackage, versionCompare } = require('../utils.js');
const fs = require('fs');
const { exec } = require('child_process');
const https = require('https');

const {
	CACHE_DIR,
	MAIN_DIR
} = DIRS;

const getModule = (key, version) => {
	return Promise.resolve()
	.then(() => {
		return new Promise((resolve) => {
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
					Object.keys(response.versions).forEach((availableVersion) => {
						//console.log(availableVersion, version);
						const comparator = versionCompare(version, availableVersion);
						//console.log(comparator);
						if (comparator === 0) {
							const versionData = response.versions[availableVersion];
							console.log('Found required version');
							if (versionData.dist) {
								const tarball = versionData.dist.tarball;
								console.log('Downloading from', tarball);
				
								const pathToDownload = MAIN_DIR + "/" + key + ".tgz";
				
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
										 const versionCacheDir = packageCacheDir + "/" + version;
						 
										 exec("cd " + MAIN_DIR + " ; tar -xvzf " + key + ".tgz", () => {
											 exec("rm " + MAIN_DIR + "/" + key + ".tgz", () => {
												 exec("mv " + MAIN_DIR + "/package " + versionCacheDir, () => {
													 install(versionCacheDir).then(resolve);
												 });
											 });
										 });
					                 });
								 });
							}
						}
					});
					//console.log(response);
				})
			});
			request.on('error', (e) => {
				console.error(e);
			});
			request.end();
		});
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
					console.log("Handling dependency", key + "/" + version);
					if (version.charAt(0) === "^") {
						version = version.substring(1);
					}
				 	const packageCacheDir = CACHE_DIR + "/" + key;
				 	const versionCacheDir = packageCacheDir + "/" + version;
					if (fs.existsSync(versionCacheDir)) {
						console.log('Found existing installation');
						finishSync(versionCacheDir, key).then(installDependency);
					} else {
						console.log("Fetching module");
						getModule(key, version).then(() => {
							return finishSync(versionCacheDir, key);
						}).then(installDependency);
					}
				}
			
				installDependency();
			});
		});
	});
};

module.exports = install;
