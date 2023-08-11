const router = require('express').Router()
const { fork } = require("child_process")
const moment = require("moment")
const hub = require("./hub")
const uuid = require("uuid").v4
const {find, keys} = require("lodash")
const {	loadYaml, readFile, pathExists} = require("../utils/file-system")
const path = require("path")

const config  = loadYaml(path.join(__dirname,`../../.config/log/log.conf.yml`))



router.get("/validate/:org", (req, res) => {
	
	let organization = req.params.org
	if(organization){
		let reportPath = path.join(__dirname,`${config.validate.report.path}/${organization}`)
		if(pathExists(reportPath)){
			reportPath = path.join(reportPath, "./report.html")
			const result = readFile(reportPath).toString()
			res.send(result) 
		} else {
			res.status(404).send()
		} 	
	} else {
		res.status(404).send()
	}
	
})


router.get("/log/validate/:org", (req, res) => {
	let organization = req.params.org
	if(organization){
		let logPath = path.join(__dirname,`${config.validate.log.path}/${organization}`)
		if(pathExists(logPath)){
			logPath = path.join(logPath, "./validate.log")
			const result = readFile(logPath).toString()
			res.send(`<pre style="font-size: 14px; color: #333; padding: 20px;">${result}</pre>`) 
		} else {
			res.status(404).send()
		} 	
	} else {
		res.status(404).send()
	}
})

router.get("/log/sync", (req, res) => {
	let logPath = path.join(__dirname,`${config.sync.log.path}`)
	if(pathExists(logPath)){
		const result = readFile(logPath).toString()
		res.send(`<pre style="font-size: 14px; color: #333; padding: 20px;">${result}</pre>`) 
	} else {
		res.status(404).send()
	}  
})


router.post("/examination/accept", async (req, res) => {
	

	const mongodb = await require("../utils/mongodb")()
	const fb = await require("../utils/fb")()
	
	let params = req.body
	let collection = `sparrow.${params.db.examinationCollection}`

	let f = await mongodb.execute.aggregate(collection, [{
		$match: {
			patientId: params["Examination ID"]
		}	 
	}])

	const examination = f[0]
	
	if(examination){
		
		examination.state = "accepted"
		examination.updatedAt = new Date()
		
		await mongodb.execute.updateOne(
			collection,
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
	let collection = `sparrow.${params.db.examinationCollection}`

	let f = await mongodb.execute.aggregate(collection, [{
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
			collection,
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

















