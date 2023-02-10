const router = require('express').Router()
const { fork } = require("child_process")
const moment = require("moment")
const hub = require("./hub")
const uuid = require("uuid").v4

const toHtml = (org, data) => {

	const rowMapper = d => {
		return `
			<div>
				<div class="title mt-2">Examination ${d.examination}</div>
				<div><pre class="subtitle-2">${d.validation}</pre></div>
			</div>
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
							
							<div class="mx-4">
								<div class="" style="
								    background: #6e91a4;
								    color: white;
								">
									<div class="headline mx-2">Data Validation Report</div>
									<div class="mx-3 subtitle-2 ">Organization: "${org}" Date: ${moment(new Date()).format("YYYY-MM-DD HH:mm:ss")}</div>
								</div>
								<div class="ml-3">
									${data.map( d => rowMapper(d)).join("\n")}
								</div>
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
	
	  const child = fork("./sync-data/src/childs/sync-data")
	  const stamp = moment(new Date()).format("YYYY-MM-DD-HH-mm-ss")
	  const logFile = `./.tmp/public/log/sync-data-${stamp}.log`
	  hub.clear()
	  child.on('error', error => {
	    // console.log('data sync external error:', error);
	  })
	  
	  child.on('close', code => {
	    // console.log(`data sync exited with code ${code}`);
	  })
	  
	  child.on('message', message => {
	    hub.emit(`[ ${moment(new Date(message.time)).format("YYYY-MM-DD HH:mm:ss")} ]: ${message.data}`)
	  })
	   
	  child.send({ logFile });
 
	  
	  res.send(`<a href="./log"> See log </a>`)
	  
})

router.get("/log", (req, res) => {
	res.redirect("../../log-listener.html")
})

router.get("/view-log/:id", (req, res) => {
			let sse = res.sse()
			let listenerId = req.params.id
			hub.on( listenerId, data => {
				if(listenerId == data.id){
					data.messages.forEach( m => {
						sse.send(m)	
					})
				}		
			})
})


module.exports = router;