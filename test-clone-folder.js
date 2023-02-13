
// const run = async () => {
// 	const controller = (await require("./src/controller")({
// 		mongodbService: false,
// 		firebaseServise: false
// 	}))
	
// 	const drive = controller.googledriveService

// 	let source = drive.dirList("Ready for Review/POTASHEV/POT0002")[0]
// 	let target = drive.dirList("SPARROW")[0]
	
// 	console.log(source, target)
// 	await drive.cloneFolder(source, target)
	
// 	console.log("Done")
// }

// run()




let filelist = [                                                                                                                                                
  {                                                                                                                                              
    mimeType: 'application/vnd.google-apps.folder',                                                                                              
    id: '1',                                                                                                     
    name: 'SOURCE',
    path:"SOURCE",                                                                                                                              
    createdTime: '2023-02-10T15:35:42.439Z',                                                                                                     
    modifiedTime: '2023-02-10T15:35:42.439Z'                                                                                                     
  },                                                                                                                                             
  {                                                                                                                                              
    mimeType: 'application/vnd.google-apps.folder',                                                                                              
    parents: [ '1' ],                                                                                            
    id: '1.1',                                                                                                     
    name: 'EKUORE',
    path:"SOURCE/EKOORE",                                                                                                                              
    createdTime: '2023-02-10T15:35:42.433Z',                                                                                                     
    modifiedTime: '2023-02-10T15:35:42.433Z'                                                                                                     
  },                                                                                                                                             
  {                                                                                                                                              
    mimeType: 'application/vnd.google-apps.folder',                                                                                              
    parents: [ '1' ],                                                                                            
    id: '1.2',                                                                                                     
    name: 'ECG',
    path: 'SOURCE/ECG',                                                                                                                                 
    createdTime: '2023-02-10T15:35:42.432Z',                                                                                                     
    modifiedTime: '2023-02-10T15:35:42.432Z'                                                                                                     
  },
  {                                                                                                                                              
    md5Checksum: '1da19de6d53ffa97bc66110317625698',                                                                                             
    mimeType: 'audio/x-wav',                                                                                                                     
    parents: [ '1.1' ],                                                                                            
    size: '4074598',                                                                                                                             
    id: '1.1.1',                                                                                                     
    name: '2023_01_17-12_24_42.wav',
    path: "SOURCE/EKUORE/2023_01_17-12_24_42.wav",                                                                                                             
    createdTime: '2023-01-17T10:33:59.830Z',                                                                                                     
    modifiedTime: '2023-01-17T10:33:31.314Z'                                                                                                     
  },                                                                                                                                             
  {                                                                                                                                              
    md5Checksum: 'e408c1b3a9c5f15ec2490fcfdf4ac500',                                                                                             
    mimeType: 'audio/x-wav',                                                                                                                     
    parents: [ '1.1' ],                                                                                            
    size: '3964006',                                                                                                                             
    id: '1.1.2',                                                                                                     
    name: '2023_01_17-12_25_10.wav',            
    path: "SOURCE/EKUORE/2023_01_17-12_25_10.wav",                                                                                                 
    createdTime: '2023-01-17T10:33:55.021Z',                                                                                                     
    modifiedTime: '2023-01-17T10:33:31.285Z'                                                                                                     
  },

  {                                                                                                                                              
    md5Checksum: '1da19de6d53ffa97bc66110317625698',                                                                                             
    mimeType: 'audio/x-wav',                                                                                                                     
    parents: [ '1.2' ],                                                                                            
    size: '4074598',                                                                                                                             
    id: '1.2.1',                                                                                                     
    name: '2023_01_17-12_24_42.wav',
    path: "SOURCE/ECG/2023_01_17-12_24_42.wav",                                                                                                             
    createdTime: '2023-01-17T10:33:59.830Z',                                                                                                     
    modifiedTime: '2023-01-17T10:33:31.314Z'                                                                                                     
  },                                                                                                                                             
  {                                                                                                                                              
    md5Checksum: 'e408c1b3a9c5f15ec2490fcfdf4ac500',                                                                                             
    mimeType: 'audio/x-wav',                                                                                                                     
    parents: [ '1.1' ],                                                                                            
    size: '3964006',                                                                                                                             
    id: '1.1.2',                                                                                                     
    name: '2023_01_17-12_25_10.wav',            
    path: "SOURCE/ECG/2023_01_17-12_25_10.wav",                                                                                                 
    createdTime: '2023-01-17T10:33:55.021Z',                                                                                                     
    modifiedTime: '2023-01-17T10:33:31.285Z'                                                                                                     
  }                  
]                                              

const run = async () => {

// const Drive = require("./src/utils/drive")

// d = new Drive(filelist)

	const controller = (await require("./src/controller")({
		mongodbService: false,
		firebaseServise: false
	}))
	
	const drive = controller.googledriveService



	// console.log(drive.fileList("SOURCE/**/*"))

	// await drive.copy("COMPANY/POTASHEV/POT00002/**/*", "BACKUP")

	// console.log(drive.dirList("**/*"))
    await drive.copy("Ready for Review/POTASHEV/POT0007/**/*", "BACKUP")

}

run()