
const run = async () => {
	const controller = (await require("./src/controller")({mongodbService: false}))
	
	// let examination = await controller.firebaseService.execute.getCollectionItems(
	// 		"examinations",[
	// 		["patientId", ">=", "POT"],
	// 		["patientId", "<=", "POT" + '\uf8ff'],


	// 	]) 
 //    examination = await controller.expandExaminations(...examination)  
	// console.log(JSON.stringify(examination, null, " "))    

	const data = require("./POTXXXX.json")

	await controller.createTestExaminations(...data)



	// let res = await controller.firebaseService.execute.getCollectionItems("examinations")	
	
	// await controller.firebaseService.db.collection("examinations").doc(res[0].id).update({
	// 	warnings:"The new fields",
	// 	state: " rejected"
	// })

	// await controller.firebaseService.db.collection("examinations").doc(res[0].id).collection("assets").add({
	// 	state: "NEW"
	// })

	// await controller.firebaseService.db.collection(`examinations/${res[0].id}/assets`).add({
	// 	state: "SHORT"
	// })
	// console.log(res)
	
	
	// console.log(controller)

	// let fileData = await controller.googledriveService.downloadFile("11oahSjsodHLL6Gy1Ks_6rz0lCr0Fi-zx")
	// await controller.googledriveService.exportFile("11oahSjsodHLL6Gy1Ks_6rz0lCr0Fi-zx","./export/1.wav")
	
	// let asset = {
	//   "type": "recording",
	//   "device": "eKuore",
	//   "parentId": "aq48kRqtTBPX7rOJdLtU",
	//   "userId": "9ASbG0DQawa2ajr0APjbqhVz8pG2",
	//   "timestamp": "2023-02-02T16:44:09.000Z",
	//   "links": {
	//    "path": "9ASbG0DQawa2ajr0APjbqhVz8pG2/recordings/eKuore_aq48kRqtTBPX7rOJdLtU"
	//   },
	//   "file": {
	//    "md5Checksum": "d01eb05c1fa9af134bb6c47f9ed9fd3b",
	//    "mimeType": "audio/x-wav",
	//    "parents": [
	//     "1DV0EcWFBDBLpN3qMbjw2cmrH7BJ1o52S"
	//    ],
	//    "size": "3941478",
	//    "id": "12TUh72NRO6Mz3lM-KdT-1aEUV5MH8tPc",
	//    "name": "2022_12_29-15_00_26.wav",
	//    "createdTime": "2022-12-29T13:32:21.870Z",
	//    "modifiedTime": "2022-12-29T13:31:13.047Z",
	//    "path": "Ready for Review/POT0004/EKUORE/2022_12_29-15_00_26.wav"
	//   }
	//  }

	// asset = await controller.resolveAsset(asset)
	// console.log(asset)

	// let fStream = await controller.googledriveService.geFiletWriteStream(asset.file)
	// console.log("download")
	// let file = await controller.firebaseService.execute.saveFileFromStream(
	// 		asset.links.path,
	// 		asset.file,
	// 		fStream)
	
	// let file = await controller.firebaseService.execute.saveFile(
	// 	"9ASbG0DQawa2ajr0APjbqhVz8pG2/recordings/iOS_9FznT91xrsicJ1xWK7iu", 
	// 	fileData
	// )

	// let file = await controller.firebaseService.execute.uploadFile("./export/1.wav","9ASbG0DQawa2ajr0APjbqhVz8pG2/recordings/iOS_9FznT91xrsicJ1xWK7iu!!!!!")
	// let file = await controller.firebaseService.execute.saveFile("harvest2.labels.json", JSON.stringify({labels:"labels"}))
	
	// console.log(file)

	controller.close()
	console.log("Done")
}

run()