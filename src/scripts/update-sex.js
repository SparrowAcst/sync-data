const run = async () => {
	

	const controller = await require("../controller")({
	    firebaseService: false,
	    googledriveService: false  
	})

	let data = require("../../HH1-SEX.json")

	console.log(`Update ${data.length} items.`)
	
	let dataBuffer = [] 
 	let readCount = 0
	let writeCount = 0
 	
  	for(let i=0; i<data.length; i++){
  		
  		let d = data[i]
 		readCount++

  		dataBuffer.push({
			updateOne:{
				filter: { id: d.id }, 
				update: { $set: { sex_at_birth: d.sex_at_birth}}
			}
		})

		if( dataBuffer.length >= 100) {
			writeCount += dataBuffer.length		
			await controller.mongodbService.execute.bulkWrite("sparrow.harvest1", dataBuffer)
			dataBuffer = []
		}

  	    process.stdout.write(`UPDATE: read: ${readCount}. write: ${writeCount} ${'\x1b[0G'}`)

  	}

	writeCount += dataBuffer.length
	await controller.mongodbService.execute.bulkWrite("sparrow.harvest1", dataBuffer)
	dataBuffer = []
  	process.stdout.write(`UPDATE: read: ${readCount}. write: ${writeCount} ${'\x1b[0G'}`)
  	
	controller.close()
}

run()
