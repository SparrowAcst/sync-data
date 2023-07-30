
const run  = async () => {

	const { loadYaml, pathExists } = require("./src/utils/file-system")
	const path = require("path")
	const { find, findIndex } = require("lodash")
	const fs = require("fs")



	// const controller = await require("./src/controller")({
	//     console,
	//     firebaseService:{
	//       noprefetch: true
	//     }  
	//   })

	
  	let data = require("./data/form2-1.json")
  	let att = require("./updated-att.json")




  	for(let i=0; i < att.length; i++){
  		
  		let a = att[i]
  		a.data = a.data.map( (r, index) => {
  			r.publicName = r.publicName || `${r.type}-${index}`
  			return r
  		})

  		let idx = findIndex(data, dtd => dtd.id == a.id)

  		data[idx] = a
  		
    }	




  	fs.writeFileSync("./updated-form2.json", JSON.stringify(data, null, " "))

}

run()