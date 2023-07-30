
const run  = async () => {

	const { loadYaml, pathExists } = require("./src/utils/file-system")
	const path = require("path")
	const { find } = require("lodash")
	const fs = require("fs")



	const controller = await require("./src/controller")({
	    console,
	    firebaseService:{
	      noprefetch: true
	    }  
	  })

	
  	let data = require("./data/form2-1.json")
  	let att = data.filter(d => d.type == 'attachements' && find(data.filter(f => f.patientId), f => f.examinationId == d.examinationId ))


    att = data.filter(d => d.type == 'attachements' && d.examinationId == "bPNfyJ5ncfYRpLxunaPG")

    console.log(att.length)

  	for(let i=0; i < att.length; i++){
  		
  		let d = att[i]
  		delete d._id
  		d.data = []
  		
  		let patientId = find(data.filter(f => f.patientId), f => f.examinationId == d.examinationId )
  		patientId = (patientId) ? patientId.patientId : ""
  		
  		if(patientId ==""){
  			console.log("!!!!!!!!!!!!!!!!!!!!", d.id)
  		}	
		
  		d.patientId = patientId

		let examination = { 
			id: d.examinationId
		}

      	examination = await controller.expandExaminations1(...[examination])
      	examination = examination[0]
  		
  		let files = examination.$extention.assets.filter(a => a.type != "recording" )
  		console.log(`${i+1} from ${att.length}. ${patientId}: ${files.length} ${files.map(f => f.mimeType || f.type).join(', ')}`)
  		
  		d.data = files.map( r => ({
  			publicName: r.publicName,
        path: r.links.path,
  			url: (r.links) ? r.links.url : "",
  			mimeType: r.mimeType || r.type,                                                                                            
    		type: r.type,
    		timestamp : r.timestamp                                                                                                          
    	}))	
    }	



  	console.log(JSON.stringify(att, null, " "))

  	// fs.writeFileSync("./updated-att.json", JSON.stringify(att, null, " "))

}

run()