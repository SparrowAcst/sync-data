
const run  = async () => {

	const { loadYaml, pathExists } = require("./src/utils/file-system")
	const path = require("path")
	
	const controller = await require("./src/controller")({
	    console,
	    firebaseService:{
	      noprefetch: true
	    }  
	  })

	// const org = "POTASHEV"
	// const prefix = ["POT"]
	// const ECHO_DIR = "EchoCG"

	// const org = "Denis"
	// const prefix = ["OCH","VON","IBO"]
	// const ECHO_DIR = "ECHO"

	const org = "STRAZHESKO"
	const prefix = ["YAL","SMA","OLS"]
	const ECHO_DIR = "ECHO"


	const backup = loadYaml(path.join(__dirname,`./.config/data/backup.yml`))
  


	const drive = await controller.googledriveService.create({
      subject: backup.subject
    })

    await drive.load(`ADE BACKUP/Heart Harvest 2/Ready for Review/${org}`)
  	//console.log(drive.$filelist)

  	// let data = require("./data/TEMP-FORM2-P-E-E.json")
    let data = require("./F2-DEN.json")
    
  	// console.log(data.length)

  	for(let i=0; i < data.length; i++){
  		let d = data[i]
  		delete d._id

  		if( d.type == "echo" && prefix.includes(d.patientId.substr(0,3))){
  			let file = drive.fileList(`ADE BACKUP/Heart Harvest 2/Ready for Review/${org}/${d.patientId}/${ECHO_DIR}/*.*`)[0]
  			url = file.webViewLink  //`./api/controller/file/gd?id=${url.id}`
  			d.data.en.dataUrl = url
  			d.data.uk.dataUrl = url
  			
  			// console.log(file)
  			// console.log(`${i+1}. ADE BACKUP/Heart Harvest 2/Ready for Review/${org}/${d.patientId}/${ECHO_DIR}/*.*`, url)
  		}
  	
  	}

  	console.log(JSON.stringify(data, null, " "))



}

run()