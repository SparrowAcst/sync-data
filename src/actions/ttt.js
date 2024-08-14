const moment = require("moment")
const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull } = require("lodash")
const { loadYaml, pathExists } = require("../utils/file-system")
const uuid = require("uuid").v4
const axios = require("axios")

const backup = loadYaml(path.join(__dirname, `../../.config/data/backup.yml`))
const AI_SEGMENTATION_API = "https://eu5zfsjntmqmf7o6ycrcxyry4a0rikmc.lambda-url.us-east-1.on.aws/"


const getAISegmentation = async settings => {


    const controller = await require("../controller")({
        console,
        firebaseService: {
            noprefetch: true
        },
        mongodbService: {}
    })

    const mongodb = controller.mongodbService
    const fb = controller.firebaseService

    if (!settings.patientId) throw new Error("AI segmentation error: patientId not defined")

    let pipeline = [
			{
				$match: {
					"Examination ID": settings.patientId 
				}
			},
			{
				$project:{
					path: 1
				}
			}	
	]	


    let records = await mongodb.execute.aggregate("dj-storage.TEST1", pipeline)	
	
    let i = 0

	for(let r of records){
		i++
		let metadata = await fb.execute.getFileMetadata(r.path)
		let query = {
			url: `https://firebasestorage.googleapis.com/v0/b/stethophonedata.appspot.com/o/${encodeURIComponent(r.path)}?alt=media&token=${metadata.metadata.firebaseStorageDownloadTokens}`,
			mimeType: (metadata.contentType == "audio/x-wav") ? "audio/x-wav" : "application/x-zip"
		}
		console.log(`${i} from ${records.length}:`,query)
		let segmentation = await axios({
			method: "POST",
			url: AI_SEGMENTATION_API,
			data: query
		})
		segmentation = segmentation.data
		console.log(segmentation)
	}

    mongodb.close()

    return
}




module.exports = getAISegmentation


const run = async () => {
	await getAISegmentation({
		patientId: "PYB0208"
	})
}



run()



// const run = async () => {
	
// 	const controller = await require("../controller")({
// 	    console,
// 	    firebaseService: {
// 	        noprefetch: true
// 	    },
// 	    mongodbService: {}
// 	})

// 	const fb = controller.firebaseService

// 	const path = "2mFSG5fhw3fvQ6DGXBX6an3Ninb2/recordings/Android_0I0UuN7B3uomMdTTrCE8"

// 	let metadata = await fb.execute.getFileMetadata(path)

// 	console.log(metadata)

// } 


// run()