const router = require('express').Router()
const { fork } = require("child_process")
const moment = require("moment")

const toHtml = (org, data) => {

	const rowMapper = d => {
		return `
			<div><strong>${d.examination}</strong><div>
			<div><pre>${d.validation}</pre></div>
		`
	}

	return `
		<h1> DATA VALIDATION REPORT </h1>
		<h2> Company: "${org}" Date:${moment(new Date()).format("YYYY-MM-DD HH:mm:ss")}</h2>
		${data.map( d => rowMapper(d))} 
	`	
}


router.get("/validate/:org/:type", (req, res) => {
	
	console.log("/validate/:org/:type", req.params)

	let organization = req.params.org
	let type = req.params.type || "html"
	type = (type != "html") ? "json" : "html"
	
	if(organization){
	  const child = fork("./sync-data/src/childs/validate-data")
	  
	  child.on('message', result => {
	    console.log('Parent process received:', result.data);
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