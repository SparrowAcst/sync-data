const { loadYaml, pathExists, makeDir, rmDir, zip, createWriteStream } = require("../utils/file-system")
const path = require("path")
const fsp = require("fs").promises

const backupConfig = loadYaml(path.join(__dirname, `../../.config/data/backup.yml`))



const HOMEDIR = "ADE BACKUP/Heart Harvest 2 from FB/Ready for Review"


const run = async () => {

	const controller = await require("../controller")({
		console,
		firebaseService: {
		    noprefetch: true
		}
	})

	const fb = controller.firebaseService
	const gdrive = await controller.googledriveService.create({
        subject: backupConfig.subject
    })
	await gdrive.load(HOMEDIR)


	if(!pathExists("./.migrate")) {
		await makeDir("./.migrate")
	}

	const downloadFB = async (src, dest) => {
		dest = path.resolve(dest)
		try {
			let metadata = await fb.execute.getFileMetadata(src)
			await fb.execute.downloadFile(src, dest)
		} catch (e) {
			console.log(e.toString())
		} finally {
			return dest
		}		
	}
	
	const uploadGD = async (src, gdPath) => {

		// await gdrive.createFolderbyPath(HOMEDIR, gdPath) 

		await gdrive.uploadFile(src, `${HOMEDIR}/${gdPath}`)

        // controller.close()
        let result = gdrive.fileList(`${HOMEDIR}/${gdPath}/${path.basename(src)}`)[0]
        
        // if(!result){
        //     console.log(`REPEAT for  -- ${HOMEDIR}/${gdPath}/${path.basename(src)}`)
        // }
	}


	const copyFile = async data => {
		console.log(`Copy from FB: ${data.fbPath} to GD: ${HOMEDIR}/${data.gdPath}`)
		let file = await downloadFB(data.fbPath, `./.migrate/${data.filename}`)
		console.log(`download ${file}`)
		await uploadGD(file, data.gdPath)
		console.log(`upload ${file}`)
		await fsp.unlink(file)
		console.log(`remove ${file}`)
	}	

	let data = require("./migrate.json")
	let filelist = gdrive.list()


	// data = data.slice(0,3)
	// let i = 1
	// let n = data.length
	// for( const d of data ){
	// 	console.log(`-------------- ${i} from ${n} ----------------`)
		
	// 	if( gdrive.list(`${HOMEDIR}/${d.gdPath}/${d.filename}`)[0] ){
	// 		console.log(`SKIP ${d.filename}` )
	// 	} else {
	// 		await copyFile(d)
	// 	}
			
	// 	i++	
	// }
	
	console.log(JSON.stringify(filelist, null, " "))
}


run()	