const run = async () => {
	
	
	const { find } = require("lodash")
	const path = require("path")
	const { loadYaml } = require("../utils/file-system")
	const YAML = require("js-yaml")


	const trimPath = (path, prefix) => path.replace(prefix, "")
  	
  	const GoogleDriveService = require("../utils/drive1")()
  	
	const backupConfig = loadYaml(path.join(__dirname,`../../.config/data/backup.yml`))


  	const sourceRoot = process.argv[2] || "Ready for Review"
	const targetRoot = backupConfig.location 

	const sourceDrive = await GoogleDriveService.create()

	const targetDrive = await GoogleDriveService.create({
		subject: backupConfig.subject
	})



	const getDiff = (source, target) => {
		target = `${target}/${source}`
		sourceList = sourceDrive.fileList(`${source}/**/*.*`)
		targetList = targetDrive.fileList(`${target}/**/*.*`)
		let res = []
		
		console.log(trimPath(targetList[0].path, target))
		console.log(trimPath(sourceList[0].path, source))
		
		sourceList.forEach( s => {

			let t = find(targetList, t => trimPath(t.path, target) == trimPath(s.path, source))
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
	
	
	let res = getDiff(sourceRoot, targetRoot)
	console.log("Difference:")
	console.log(YAML.dump(res))

	res = res.filter( d => !d.target || d.target.size != d.source.size)
	
	if(res.length > 0){
		console.log(`Recovery ${res.length} items`)
		
		for( let i=0; i< res.length; i++){
			let d = res[i]
			console.log(i+1)
			let result = await sourceDrive.copy(d.source.path, targetDrive, targetRoot)
		}
	} else {
		console.log("No files for recovery")
	}	


	// controller.close()
	console.log("Recovery Google Drive Files finished")
}

run()
