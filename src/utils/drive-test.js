
const { uniqBy } = require("lodash")

const mem = () => {
		const used = process.memoryUsage();
		for (let key in used) {
		  console.log(`Memory: ${key} ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
		}
	}	
	

const googleDriveService = require("./drive3")()

const run = async () => {
	mem()
	const drive = await googleDriveService.create(
	// {
	// 	owner: "kasperovychyulia@gmail.com"
	// 	// owner: "strazheskoclinic@gmail.com"
	// 	// owner: "harvest.potashev2022@gmail.com"
	// }
	{
		subject: "andrii.boldak@sparrowacoustics.com"
	}
	)
	
	// let f = await drive.getFolder("ADE BACKUP/Heart Harvest 2/Ready for Review/Denis/OCH0011/ECHO")///Heart Harvest 2/Ready for Review")
	// let f = await drive.getFolder("Ready for Review/Denis/OCH0035/ECHO", "kasperovychyulia@gmail.com")
	
	// console.log(f)


	await drive.load("ADE BACKUP/Heart Harvest 2/Ready for Review/Denis")
	// await drive.load("Ready for Review/Denis")

	// let data = uniqBy(drive.fileList().map( d => d.owners[0].emailAddress))
	// console.log(data)
	
	console.log(drive.fileList()
	// 		.filter(d => d.owners[0].emailAddress != "google-drive-service-account@dj-app-1295.iam.gserviceaccount.com")
	// 		.filter(d => d.owners[0].emailAddress != "ade-sync-data-google-drive@ade-sync-data.iam.gserviceaccount.com")


			.map( d => `${d.path} ${d.owners[0].emailAddress}`))
	
	// console.log(drive.fileList("ADE BACKUP/Heart Harvest 2/Ready for Review/Denis/*/ECHO/*.*").map( d => d.path))

	// let f = await drive.createFolder("Ready for Review/Denis/QWERTY")
	// console.log(f)

	// await drive.load("ADE TEST1")

	// let f = await drive.createFolder("ADE TEST1/New Folder 1/EKUORE")
	// console.log(f)

	mem()	
}


run()
