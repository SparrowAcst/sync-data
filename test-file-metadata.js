const Storage = require("./src/utils/fb-storage")
const path = require("path")

const run  = async () => {

	  const storage = new Storage(path.join(__dirname, `./.config/key/fb/fb.key.json`))	
	  

	  let metadata = await storage.getFileMetadata("L16Y6v4cWBULzANufG7XoGhAuPh1/recordings/Android_04KDCbuieaogrNJuiJX8.json")

	  console.log("metadata: ", metadata)

	  metadata = await storage.getFileMetadata("L16Y6v4cWBULzANufG7XoGhAuPh1/recordings/Android_04KDCbuieaogrNJuiJX8.js")

	  console.log("metadata: ", metadata)

	  let data = await storage.fetchFileData("L16Y6v4cWBULzANufG7XoGhAuPh1/recordings/Android_04KDCbuieaogrNJuiJX8.json")
	  data = data.toString()
	  console.log(JSON.parse(data))

	  data = await storage.fetchFileData("L16Y6v4cWBULzANufG7XoGhAuPh1/recording/Android_04KDCbuieaogrNJuiJX8.json")
	  console.log(data)


}

run()