const { getPackage } = require('../utils.js');

module.exports = (cwd) => {
	return new Promise((resolve) => {
		const json = getPackage(cwd);
		
		if (!json.main) {
			console.error("No 'main' found in package.json, cannot continue");
			resolve();
			return;
		}
		
		const startingScript = json.main;
		
		resolve();
	})
};
