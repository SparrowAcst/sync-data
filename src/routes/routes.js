const router = require('express').Router()
const { fork } = require("child_process")
const moment = require("moment")
const hub = require("./hub")
const uuid = require("uuid").v4
const {find, keys} = require("lodash")

const toHtml = (org, data, summary) => {

	const colors = {
		info:"#1565c0",
		success:"#2e7d32",
		error:"#ef5350",
		warning:"#ffb300"
	}

	
	const summaryMapper = d => {

		const colors = {
			total: "#eeeeee",
			rejected:"#ef5350",
			accepted:"#2e7d32",
			inReview:"#1565c0",
			pending:"#ffb300"
		}

		d = Object.keys(colors).map( key => {
			const f = d.filter( v => v.name == key)[0]
			return {
			  name: f.name,
				value: f.value,
				itemStyle:{
					color: colors[key]
				}
			}
		})

		

		return `

			<div id="main" style="width: 600px;height:200px;"></div>
			<script type="text/javascript">
			      // Initialize the echarts instance based on the prepared dom
			      let myChart = echarts.init(document.getElementById('main'));

			      // Specify the configuration items and data for the chart
			      let option = {
					  grid: {
					  	top:0,
   	 					bottom:0,
					    containLabel: true
					  },
					  xAxis: {
					    type: 'value',
					    show:false
					  },
					  yAxis: {
					    type: 'category',
					    axisLabel:{
					      show: true,
					      fontSize: "18px",
					      fontWeight: "bold"
					    },
					    axisLine:{
					      show:false
					    },
					    axisTick:{
					      show: false
					    },
					    data: ${JSON.stringify(d.map( v => v.name))}
					  },
					  series: [
					    {
					      type: 'bar',
					      label:{
					        show: true,
					        position:'right',
						      fontSize: "18px",
						      fontWeight: "bold"
					      },
					      data: ${JSON.stringify(d)}
					    }
					  ]
					}

			      // Display the chart using the configuration items and data just specified.
			      myChart.setOption(option);
			   </script>
		`
	}

	const getColor = d => {

		switch(d.reportComment){
			
			case "Read the warnings and correct the data":
				return colors.warning
			
			case "Data accepted. You can remove the data from the \"Ready for Review\" folder":
				return colors.success
				
			case "The status will be set to \"inReview\" after the data is synchronized":
				return colors.info
			
			case "Please wait while the data is reviewed":
				return colors.info
			
			case "Data rejected. You can remove the data from the \"Ready for Review\" folder":
				return colors.error
		}

	}

	const rowMapper = (d, color) => {
		return `
			<div style="padding: 5px; margin: 5px;">
				<div class="subtitle-1 mt-2" style="line-height: 1.2;">Examination <strong>${d.patientId}</strong> <a href="${d.webViewLink}" target="_blank">open folder</a>
					<br/> 
					State: <strong>${d.state}</strong> 
					<br/>
					 ${(d.synchronizedAt) ? "Synchronized at <strong>"+ moment(d.synchronizedAt).format("YYYY-MM-DD HH:mm:ss")+"</strong>" : "<strong>Data is out of sync</strong>"}
				</div>
				<div style=" border:1px solid ${color};">
					<div class="subtitle-1" style="background:${color}; color: white; padding:0 20px;">
						${d.reportComment || ""}
					</div>
					<div class="subtitle-2" style="padding: 10px 20px;">
						${(d.validation == true) ? "" : d.validation.replace(/\n/g,"<br/>") }
					</div>
				</div>
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
			  <script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.4.1/echarts.min.js" integrity="sha512-OTbGFYPLe3jhy4bUwbB8nls0TFgz10kn0TLkmyA+l3FyivDs31zsXCjOis7YGDtE2Jsy0+fzW+3/OVoPVujPmQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
			</head>

			<body>
				<div class="app">
					<div class="v-application v-application--is-ltr theme--light">
						<div class="v-application--wrap">
							
							<div class="mx-4">
								<div>
									<div class="display-1 mx-2">Data Validation Report</div>
									<div class="mx-3 title-2 ">Organization: "${org}" Date: ${moment(new Date()).format("YYYY-MM-DD HH:mm:ss")}</div>
								</div>
								<div class="ml-3 mt-3">
									<div class="headline mb-2">Summary</div>
									${summaryMapper(summary)}
								</div>	
								<div class="ml-3 mt-3">
									<div class="headline">Details</div>
									${data.map( d => rowMapper(d, getColor(d))).join("\n")}
								</div>
							</div>
						</div>
					</div>
				</div>		
			</body>
		</html>		 
	`	
}


const validate = (res, organization, patientPattern) => {

	if(organization){
	  const child = fork("./sync-data/src/childs/validate-data")
	  
	  child.on('message', result => {
	    
	    // if( type == "json" ){
	    // 	res.send(result.data)
	    // } else {
	    	let summary = [
	    		{ name: "pending", value: result.data.filter(d => d.state == "pending").length},
	    		{ name: "inReview", value: result.data.filter(d => d.state == "inReview").length},
	    		{ name: "accepted", value: result.data.filter(d => d.state == "accepted").length},
	    		{ name: "rejected", value: result.data.filter(d => d.state == "rejected").length},
	    		{ name: "total", value: result.data.length},
	    	]
	    	res.send(toHtml(organization, result.data, summary))
	    // }	
	  })
	  
	  child.on('error', error => {
	    console.log('Parent process received:', error);
	    res.status(503).send(error)
	  })
	  
	  child.on('close', code => {
	    // console.log(`child process exited with code ${code}`);
	  })
	  
	  child.send({ organization, patientPattern });
	
	} else {
		res.status(404).send("Organization data validation error: Organization undefined.")
	} 

}


router.get("/validate/:org/:patientPattern", (req, res) => {
	
	let organization = req.params.org
	let patientPattern = req.params.patientPattern || ".*"
	
	validate(res, organization, patientPattern)
 
})

router.get("/validate/:org", (req, res) => {
	
	let organization = req.params.org
	let patientPattern = ".*"
	
	validate(res, organization, patientPattern)
 
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


router.post("/examination/accept", async (req, res) => {
	

	const mongodb = await require("../utils/mongodb")()
	const fb = await require("../utils/fb")()
	
	let params = req.body
	
	let f = await mongodb.execute.aggregate(mongodb.config.db.examinationCollection, [{
		$match: {
			patientId: params["Examination ID"]
		}	 
	}])

	const examination = f[0]
	
	if(examination){
		
		examination.state = "accepted"
		examination.updatedAt = new Date()
		
		await mongodb.execute.updateOne(
			mongodb.config.db.examinationCollection,
			{id: examination.id},
			examination
		)

		await fb.db.collection("examinations").doc(examination.id).update({ state: "accepted" })

		res.send(examination)
	} else {
		res.status(404).send({message: `Examination ${params["Examination ID"]} not found.`})
	}

	mongodb.close() 
	
	
})

router.post("/examination/reject", async (req, res) => {
	
	const mongodb = await require("../utils/mongodb")()
	const fb = await require("../utils/fb")()
	
	let params = req.body
	
	let f = await mongodb.execute.aggregate(mongodb.config.db.examinationCollection, [{
		$match: {
			patientId: params["Examination ID"]
		}	 
	}])

	const examination = f[0]
	
	if(examination){
		examination.state = "rejected"
		examination._validation = params.validationSummary
		examination.updatedAt = new Date()

		await mongodb.execute.updateOne(
			mongodb.config.db.examinationCollection,
			{id: examination.id},
			examination
		)

		await fb.db.collection("examinations").doc(examination.id).update({ state: "rejected" })

		res.send(examination)
	} else {
		res.status(404).send({message: `Examination ${params["Examination ID"]} not found.`})
	}

	mongodb.close() 
	
	
})


module.exports = router;



