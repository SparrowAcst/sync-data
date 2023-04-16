const run = async () => {
	

	const mem = () => {
		const used = process.memoryUsage();
		console.log(`Memory usage: ${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`);
		return used.rss
	}	
	


	const { find } = require("lodash")
	const path = require("path")
	const { loadYaml } = require("../utils/file-system")
	const YAML = require("js-yaml")


	const trimPath = (path, prefix) => path.replace(prefix, "")
  	
  	const GoogleDriveService = require("../utils/drive3")()
  	
	const backupConfig = loadYaml(path.join(__dirname,`../../.config/data/backup.yml`))


	const organization = process.argv[2]

  	const sourceRoot = process.argv[3] || backupConfig.read[organization]
	const targetRoot = `${backupConfig.location}/${sourceRoot}`

	const pattern = process.argv[4] || "**/*.*"
	
	const sourceDrive = await GoogleDriveService.create({
		owner: backupConfig.owner[organization]
	})

	await sourceDrive.load(sourceRoot)

	const targetDrive = await GoogleDriveService.create({
		subject: backupConfig.subject
	})
	
	await targetDrive.load(targetRoot)



	const getDiff = pattern => {
		
		sourceList = sourceDrive.fileList(pattern)
		targetList = targetDrive.fileList(pattern)
		let res = []
		
		// console.log(trimPath(targetList[0].path, target))
		// console.log(trimPath(sourceList[0].path, source))
		console.log("Source list")
		console.log(sourceList.map( s => s.path))
		console.log("Target list")
		console.log(targetList.map( s => s.path))

		sourceList.forEach( s => {
			let t = find(targetList, t => trimPath(t.path, targetRoot) == trimPath(s.path, sourceRoot))
				res.push({
					source:{
						id: s.id,
						path: s.path,
						size: s.size
					},
					target:(t) 
						? {
							id: t.id,
							path: t.path,
							size: t.size
						}
						: null
				})
		})
		return res		
	}

	
	console.log(`Recovery Google Drive Files: "${sourceRoot}" vs "${targetRoot}"`)
	
	
	let res = getDiff(pattern)
	console.log("Difference:")
	console.log(YAML.dump(res))

	res = res.filter( d => !d.target || d.target.size != d.source.size)
	
	if(res.length > 0){
		console.log(`Recovery ${res.length} items`)
		
		for( let i=0; i< res.length; i++){
			let d = res[i]
			console.log(i+1)
			if( mem() > 110 * 1024 * 1024 ) {
				console.log("!!!EXIT")
				process.exit(0)
			}
			let result = await sourceDrive.copy(d.source.path, targetDrive, backupConfig.location)
		}
	} else {
		console.log("No files for recovery")
	}	


	console.log("Recovery Google Drive Files finished")
}

run()
