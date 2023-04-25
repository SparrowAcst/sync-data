const path = require("path")

const run = async () => {

    console.log("ADD SEGMENTATION into DATASET")
    const datasetName = process.argv[2]
    const examPattern = process.argv[3] || ""

    if (!datasetName) {
        console.log("Dataset name not specified.")
        return
    }
    console.log(`DATASET: "${datasetName}" (pattern: ${examPattern})`)


    const mongodb = await require("../utils/mongodb")()
    const Storage = require("../utils/fb-storage")
    const storage = new Storage(path.join(__dirname, `../../.config/key/fb/${datasetName}.fb.key.json`))


    const delay = (ms, msg) => new Promise(resolve => {
		console.info(`Wait ${ms} for ${msg} settings`)
		setTimeout(() => resolve(), ms)
	})


    const resolveSegmentation = async buffer => {

        let ops = []

        for (let i = 0; i < buffer.length; i++) {
            let labeling = buffer[i]
            let seg = await storage.fetchFileData(`${labeling.path}.json`)
            if (seg) {
            	labeling.segmentation = JSON.parse(seg.toString())
                ops.push({
                    replaceOne: {
                        "filter": { id: labeling.id },
                        "replacement": labeling,
                        "upsert": false
                    }
                })
        	}
    	}

    	return ops 
	}


	console.log("Add segmentation into finalized labeling if exists:")

	const PAGE_SIZE = 50
	let skip = 0
	let buffer = []
	bufferCount = 0

	do {

	    const pipeline = [{
	        '$match': {
	            'FINALIZED': true,
	            'Examination ID': {
				    $regex: examPattern
				 },
	            'segmentation': {
	                '$exists': false
	            }
	        }
	    }, {
	        '$sort': {
	            'id': 1
	        }
	    }, {
	        '$skip': skip
	    }, {
	        '$limit': PAGE_SIZE
	    }]

	    buffer = await mongodb.execute.aggregate(`sparrow.${datasetName}`, pipeline)
	    if (buffer.length > 0) {
	        console.log(`Buffer: ${bufferCount} starts at ${skip} (${buffer.length} items)`) // \n${buffer.map(d => d["Examination ID"]+":"+d.id+":"+d.path).join("\n")}`)
	    	let ops = await resolveSegmentation(buffer)
		    
		    if(ops.length > 0){
		    	await mongodb.execute.bulkWrite(`sparrow.${datasetName}`, ops)	
		    }
		    

		    console.log(`Update ${ops.length} items`) //:\n${ops.map( d => d.replaceOne.replacement["Examination ID"]+":"+d.replaceOne.replacement.id).join("\n")}`)

		    await delay(2000, "wait for fetch next buffer")

	    }
	    
	    skip += buffer.length
	    bufferCount++

	} while (buffer.length > 0)


	mongodb.close()

}

run()