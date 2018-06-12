const fs = require('fs');

module.exports = (cwd) => {
	return Promise.resolve()
	.then(() => {
		const packageFile = `${cwd}/package.json`;
		if (fs.existsSync(packageFile)) {
			console.log('Package file found!');
			return;
		}
	
		const pathArr = cwd.split('/');
		const folderName = pathArr[pathArr.length-1];
	
		const initObject = {
			name: folderName,
			version: '0.1'
		};
	
		fs.writeFileSync(packageFile, JSON.stringify(initObject, null, 4));
	});
};