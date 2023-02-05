const router = require('express').Router()
const { fork } = require("child_process")
const moment = require("moment")

const toHtml = (org, data) => {

	const rowMapper = d => {
		return `
			<div class="title">${d.examination}</div>
			<div><pre class="subtitle-2">${d.validation}</pre></div>
		`
	}


	return `
		<html>
			<head>
			  <meta charset="utf-8">
			  <meta http-equiv="x-ua-compatible" content="ie=edge">
			  <meta name="description" content="">
			  <meta name="viewport" content="width=device-width, initial-scale=1">
			  <link rel="stylesheet" href="../../../../vuetify.min.css" />
			</head>

			<body>
				<div class="app">
					<div class="v-application v-application--is-ltr theme--light">
						<div class="v-application--wrap">
							
							<div class="ma-4">
								<div class="d-flex align-center pb-5">
									<div class="display-1">DATA VALIDATION REPORT</div>
									<div class="spacer"></div>
									<div class="pa-5 ma-3 subtitle-2  font-weight-bold" style="border:1px solid;">Company: "${org}"<br/>Date: ${moment(new Date()).format("YYYY-MM-DD HH:mm:ss")}</div>
								</div>
								${data.map( d => rowMapper(d))}
							</div>
						</div>
					</div>
				</div>		
			</body>
		</html>		 
	`	
}


const validate = (res, organization, type) => {

	if(organization){
	  const child = fork("./sync-data/src/childs/validate-data")
	  
	  child.on('message', result => {
	    // console.log('Parent process received:', result.data);
	    if( type == "json" ){
	    	res.send(result.data)
	    } else {
	    	res.send(toHtml(organization, result.data))
	    }	
	  })
	  
	  child.on('error', error => {
	    console.log('Parent process received:', error);
	    res.status(503).send(error)
	  })
	  
	  child.on('close', code => {
	    console.log(`child process exited with code ${code}`);
	  })
	  
	  child.send({ organization });
	
	} else {
		res.status(404).send("Organization data validation error: Organization undefined.")
	} 

}


router.get("/validate/:org/:type", (req, res) => {
	
	let organization = req.params.org
	let type = req.params.type || "html"
	type = (type != "html") ? "json" : "html"
	
	validate(res, organization, type)
 
})

router.get("/validate/:org", (req, res) => {
	
	let organization = req.params.org
	let type = "html"
	
	validate(res, organization, type)
 
})

router.get("/sync", (req, res) => {
	
	  const child = fork("./src/childs/sync-data")
	  const logFile = ""

	  child.on('error', error => {
	    console.log('data sync external error:', error);
	  })
	  
	  child.on('close', code => {
	    console.log(`data sync exited with code ${code}`);
	  })
	  
	  child.send({ logFile });
	
	  res.send({
	  	logUrl: ""
	  })
})

console.log("Activate sync data router")

module.exports = router;