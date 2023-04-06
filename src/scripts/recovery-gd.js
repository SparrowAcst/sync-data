const run = async () => {
	
	
	const { find } = require("lodash")
	const path = require("path")
	const { loadYaml } = require("../utils/file-system")

	const trimPath = (path, prefix) => path.replace(prefix, "")

	const controller = await require("../controller")({
	    firebaseService:{
	      noprefetch: true
	    }  
	  })
  
  	const drive = controller.googledriveService
  
	const backupConfig = loadYaml(path.join(__dirname,`../../.config/data/backup.yml`))
  


  	const sourceRoot = process.argv[2] || "Ready for Review"
	const targetRoot = backupConfig.location 




	const getDiff = (source, target) => {
		target = `${target}/${source}`
		sourceList = drive.fileList(`${source}/**/*.*`)
		targetList = drive.fileList(`${target}/**/*.*`)
		let res = []
		// console.log(`${source}/**/*.*`, sourceList.length)
		// console.log(`${target}/**/*.*`, targetList.length)
		
		sourceList.forEach( s => {

			let t = find(targetList, t => trimPath(t.path, target) == trimPath(s.path, source))
			if( !t || (t.size != s.size)){
				res.push({
					source:{
						path: s.path,
						size: s.size
					},
					target:(t) 
						? {
							path: t.path,
							size: t.size
						}
						: null
				})
			}
		})
		return res		
	}

	
	console.log(`Recovery Google Drive Files: "${sourceRoot}" vs "${targetRoot}"`)
	
	
	let res = getDiff(sourceRoot, targetRoot)
	if(res.length > 0){
		console.log(`Recovery ${res.length} items`)
		
		for( let i=0; i< res.length; i++){
			let d = res[i]
			console.log(d.source.path, ">>")
			let result = await drive.copy(d.source.path, targetRoot)
			console.log("\n")
			// result = result.filter( r => r != true)
			// if( result.length> 0){
			// 	console.log("Failed:")
			// 	console.log(result)	
			// }
		}
	} else {
		console.log("No files for recovery")
	}	

	controller.close()
	console.log("Recovery Google Drive Files finished")
}

run()
