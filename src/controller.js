const uuid = require("uuid").v4
const path = require("path")

const formsdb = require("../../harvest-controller/src/mongodb")


const initMongoService = require("./utils/mongodb")
const initFirebaseService = require("./utils/fb")
const initGoogledriveService = require("./utils/drive3")

const piper = require("./utils/piper")

const { loadYaml } = require("./utils/file-system")
const spots = loadYaml(path.join(__dirname, "../.config/data/point-order.yml"))

const formsConfig = loadYaml(path.join(__dirname, "../.config/db/mongodb.conf.yml")).forms
console.log(formsConfig)


const formFields = require("./utils/form-fields")

let mongodbService 
let firebaseService 
let googledriveService

const { 
	extend, 
	differenceBy, 
	isUndefined, 
	isNull, 
	find, 
	flattenDeep, 
	first, 
	uniqBy, 
	keys, 
	maxBy, 
	template,
	templateSettings 
} = require("lodash")


let logger


const resolveTemplate = (_template, context) => {

    templateSettings.interpolate = /\$\{([\s\S]+?)\}/g;

    let result = template(_template)(context)

    templateSettings.interpolate = /<%=([\s\S]+?)%>/g;

    return result

}



const getNewExaminations = async () => {
	let mongoExams = await mongodbService.execute.aggregate("sparrow.examination")
  	let fbExams = await firebaseService.execute.getCollectionItems("examinations")
  	let res = differenceBy( fbExams,mongoExams, d => d.id)
  	return res
}


const getExaminationsInState = async (...state) => {
 
	let res = await mongodbService.execute.aggregate("sparrow.examination",
		[
			{
				$match: {
					state: 
						(!isUndefined(state)) 
							?  { $in: state }
							:  { $exists: false }
				}
			}				
			
		]
	)

	return res
} 


const expandExaminationsInMemory = async (...examinations) => {
	examinations = examinations || []
	for(let i=0; i < examinations.length; i++){
		
		let examination = examinations[i]
		examination.$extention = {}

		examination.$extention.users = mc.collection("users").values.filter(d => d.userId == examination.userId)
		if(examination.$extention.users[0]){
			examination.$extention.organizations = mc.collection("organizations").values.filter(d => d.id == examination.$extention.users[0].organization)
		}
		examination.$extention.forms = mc.collection("forms").values.filter(d => d.path[1] == examination.id)
		examination.$extention.recordPoints = mc.collection("recordPoints").values.filter(d => d.path[1] == examination.id)
		examination.$extention.records = mc.collection("records").values.filter(d => d.path[1] == examination.id)
		examination.$extention.assets = mc.collection("assets").values.filter(d => d.path[1] == examination.id)
	}

	return examinations	

}	


const expandExaminations = async (...examinations) => {
	
	const db = firebaseService.db
	const docMapper = doc => ({
	    id: doc.id,
	    ...doc.data()
	})
	
	examinations = examinations || []

	for(let i=0; i < examinations.length; i++){
		try {
			
			let examination = examinations[i]
			examination.$extention = {}
			
			if(examination.userId){
			
				let users = db.collection('users');
				examination.$extention.users = (await users.where("userId","==",examination.userId).get() ).docs.map(docMapper)
				if(examination.$extention.users[0]){
					let organizations = db.collection('organizations');
					examination.$extention.organizations = 
						[docMapper((await organizations.doc(examination.$extention.users[0].organization).get() ))]
				}
			
			}	
			
			let exams = db.collection('examinations');
	    	const docRef = exams.doc(examination.id)

			examination.$extention.forms = ( await docRef.collection('forms').get() ).docs.map(docMapper)
			examination.$extention.recordPoints = ( await docRef.collection('recordPoints').get() ).docs.map(docMapper)
			examination.$extention.records = ( await docRef.collection('records').get() ).docs.map(docMapper)
			examination.$extention.assets = ( await docRef.collection('assets').get() ).docs.map(docMapper)
			examination.$extention.assets = examination.$extention.assets.filter( a => !!a.links) 

		} catch (e) {
			logger.info("ERROR")
			logger.info(e.toString())
		}
	}

	return examinations

}


const finalizeForms = async patientId => {
	await formsdb.updateOne({
		db: formsConfig.db,
		collection: `${formsConfig.db.name}.${formsConfig.collection.forms}`,
		filter:{"examination.patientId": patientId},
		data: {
			"examination.state": "finalized",
			"status": "finalized"
		}
	})
}	


const prepareForms = async patientId => {
	// console.log("prepareForms", patientId)
	let data = await formsdb.aggregate({
		db: formsConfig.db,
		collection: `${formsConfig.db.name}.${formsConfig.collection.forms}`,
		pipeline:  [
          {
            '$match': {
              'examination.patientId': patientId
            }
          },
          {
            '$project': {
              '_id': 0
            }
          }
        ] 
	})
	data = data[0] || {}
	return data
	// let res = []
	// if(data.patient){
	// 	res.push({
	// 		data:{
	// 			a:{
	// 				en: data.patient,
	// 				uk: data.patient
	// 			}
	// 		},
	// 		type: "patient",
	// 		examinationId: data.examination.id,
	// 		completeness: data.completeness["Patient Form"],
	// 		status: data.status

	// 	})
	// }	

	// if(data.ekg){
	// 	res.push({
	// 		data:{
	// 			a:{
	// 				en: data.ekg,
	// 				uk: data.ekg
	// 			}
	// 		},
	// 		type: "ekg",
	// 		examinationId: data.examination.id,
	// 		completeness: data.completeness["EKG Form"],
	// 		status: data.status
	// 	})
	// }	

	// if(data.echo){
	// 	res.push({
	// 		data:{
	// 			a:{
	// 				en: data.echo,
	// 				uk: data.echo
	// 			}
	// 		},
	// 		type: "echo",
	// 		examinationId: data.examination.id,
	// 		completeness: data.completeness["Echo Form"],
	// 		status: data.status
	// 	})
	// }	

	// return res

}


const expandExaminations1 = async (...examinations) => {
	
	const db = firebaseService.db
	const docMapper = doc => ({
	    id: doc.id,
	    ...doc.data()
	})
	
	examinations = examinations || []

	for(let i=0; i < examinations.length; i++){
		try {
			
			let examination = examinations[i]
			examination.$extention = {}
			
			if(examination.userId){
			
				let users = db.collection('users');
				examination.$extention.users = (await users.where("userId","==",examination.userId).get() ).docs.map(docMapper)
				if(examination.$extention.users[0]){
					let organizations = db.collection('organizations');
					examination.$extention.organizations = 
						[docMapper((await organizations.doc(examination.$extention.users[0].organization).get() ))]
				}
			
			}	
			
			let exams = db.collection('examinations');
	    	const docRef = exams.doc(examination.id)

			examination.$extention.forms = await prepareForms(examination.patientId) 

			// console.log(examination.$extention)

			// ( await docRef.collection('forms').get() ).docs.map(docMapper)
			
			examination.$extention.recordPoints = ( await docRef.collection('recordPoints').get() ).docs.map(docMapper)
			examination.$extention.records = ( await docRef.collection('records').get() ).docs.map(docMapper)
			examination.$extention.assets = ( await docRef.collection('assets').get() ).docs.map(docMapper)
			examination.$extention.assets = examination.$extention.assets.filter( a => !!a.links) 


			

		} catch (e) {
			logger.info("ERROR")
			logger.info(e.toString())
		}
	}

	return examinations

}



const delay = (ms, msg) => new Promise(resolve => {
	logger.info(`Wait ${ms} for ${msg} settings`)
	setTimeout(() => resolve(), ms)
})

const commitBatch = async (batch, msg) => {
	await delay(5, msg)
	try {
		await batch.commit()
	} catch (e) {
		logger.info("retry")
		commitBatch(batch, msg)
	}
} 


// DEV MODE  //////////////////////////////////////////////////////////////////////////

const createTestExaminations = async (...examinations) => {

	const db = firebaseService.db
	
	examinations = examinations || []

	for(let i=0; i < examinations.length; i++){
		
		let batch = db.batch()


		let examination = examinations[i]
		let $extention = extend({}, examination.$extention)
		let id = examination.id 
		// console.log(id, examination.patientId)
		delete examination.$extention
		delete examination.id
		const docRef = db.collection("examinations").doc(id)
		console.log(examination)
		// batch.set(docRef, examination)
		await docRef.set(examination)

		for( let j=0; j < $extention.forms.length; j++ ){

			const form = $extention.forms[j]
			let id = form.id 
			delete form.id
			console.log(form)
			let doc = docRef.collection("forms").doc(id) 
			batch.set(doc, form)
			// await docRef.collection("forms").doc(id).set(form)
		}
		
		// await delay(500,`forms`)
		// await batch.commit()

		// batch = db.batch()

		for( let j=0; j < $extention.records.length; j++ ){
			const record = $extention.records[j]
			let id = record.id 
			delete record.id
			console.log(record)
			let doc = docRef.collection("records").doc(id) 
			batch.set(doc, record)

			// try {
			// 	await delay(100,`records ${j}`)
			// 	await docRef.collection("records").doc(id).set(record)
			// } catch (e) {
			// 	await delay(100,`retry records ${j}`)
			// 	await docRef.collection("records").doc(id).set(record)
			// }	
		}
		// await delay(500,`records`)
		// await batch.commit()


		for( let j=0; j < $extention.recordPoints.length; j++ ){
			const recordPoint = $extention.recordPoints[j]
			let id = recordPoint.id
			delete recordPoint.id
			console.log(recordPoint)
			let doc = docRef.collection("recordPoints").doc(id) 
			batch.set(doc, recordPoint)

			// try {	
			// 	await delay(100,`recordPoints ${j}`)
			// 	await docRef.collection("recordPoints").doc(id).set(recordPoint)
			// } catch (e) {
			// 	await delay(100,`retry recordPoints ${j}`)
			// 	await docRef.collection("recordPoints").doc(id).set(recordPoint)
			// }
		}
		
		// await delay(500,`records + recordPoints`)
		// await batch.commit()
		// batch = db.batch()

			await commitBatch(batch)

			batch = db.batch()
			
		for( let j=0; j < $extention.assets.length; j++ ){
			const asset = $extention.assets[j]
			let id = asset.id
			delete asset.id
			console.log(asset)
			let doc = docRef.collection("assets").doc(id) 
			batch.set(doc, asset)

			// try {
			// 	await delay(100,`assets ${j}`)
			// 	await docRef.collection("assets").doc(id).set(asset)
			// } catch (e) {
			// 	await delay(100,`retry assets ${j}`)
			// 	await docRef.collection("assets").doc(id).set(asset)
			// }	
		}

		// await delay(500,`assets`)
		// await batch.commit()
		// batch = db.batch()

		for( let j=0; j < $extention.organizations.length; j++ ){
			const organization = $extention.organizations[j]
			let id = organization.id
			delete organization.id
			console.log(organization)
			let doc = db.collection("organizations").doc(id) 
			batch.set(doc, organization)

			// try {			
			// 	await delay(100,`organizations ${j}`)
			// 	await db.collection("organizations").doc(id).set(organization)
			// } catch (e) {
			// 	await delay(100,`organizations ${j}`)
			// 	await db.collection("organizations").doc(id).set(organization)
			// }
		}

		for( let j=0; j < $extention.users.length; j++ ){
			const user = $extention.users[j]
			let id = user.id
			delete user.id
			console.log(user)
			let doc = db.collection("users").doc(id) 
			batch.set(doc, user)

			// try {
			// 	await db.collection("users").doc(id).set(user)
			// } catch (e) {
			// 	await db.collection("users").doc(id).set(user)
			// }	
		}

		// await delay(500,`organizations + users`)
		await commitBatch( batch, examination.patientId) 

	}
}

////////////////////////////////////////////////////////////////////////////////////

const checkNeedAssetRecovery = async (examination, asset) => {
	let metadata = await firebaseService.execute.getFileMetadata(resolveTemplate(asset.links.path, { context: {examination, asset}}))
	return isUndefined(metadata)
}


/////////////////////////////////////////////////////////////////////////////////////
const resolveAsset = async (examination, asset, drive) => {
	// console.log("resolve", asset)	
// START DEBUG COMMENT
	if( !asset.file ) return null

	let doc 
        if(isUndefined(asset.id) || isNull(asset.id)){
        	doc = firebaseService.db.collection(`examinations/${examination.id}/assets`).doc()
        	asset.id = doc.id
        	asset.links.path = resolveTemplate(asset.links.path, { context: {examination, asset}})

        	logger.info(`CREATE asset ${asset.links.path}`)
        } else {
          logger.info(`UPDATE asset ${asset.links.path}`)
        }


	
	let fStream = await drive.geFiletWriteStream(asset.file)

	let size = 0
	let rawSize = 0
	let oldSize = 0
	
	fStream.on("data", chunk => {
		rawSize += chunk.length
		size += chunk.length / 1024 / 1024 
		if( (size - oldSize) > 0.1 ){
			process.stdout.write(`Received: ${size.toFixed(1)} Mb ${'\x1b[0G'}`)
			// console.log(`\rReceived ${size} bytes`)
			oldSize = size	
		}
	})

	fStream.on("error", error => {
		logger.info(error.toString())
		asset.error = error.toString()
	})

	fStream.on("end", () => {
		let diff = asset.file.size - rawSize
		if(diff != 0) {
			asset.error = `Difference size: ${diff}. Source: ${asset.file.size}. Target: ${rawSize}`
		}
	})

	let file = await firebaseService.execute.saveFileFromStream(
			asset.links.path,
			asset.file,
			fStream)
	asset.links.url = file[0]
	
	if(!asset.error) {
		delete asset.file
	}	

// END DEBUG COMMENT

	return asset

}


const validateExamination = ( examination, rules, org, drive ) => {
	let ids = /([A-Z]{3})([0-9]{4})/.exec(examination.patientId)

    examination._validation = piper.validate({
        // context
        drive,
        org, //: examination.$extention.organizations[0].name.toUpperCase(),
        doctor: ids[1],
        patient: ids[2],
        examination,
        formFields
      }, rules)
    let webViewLink = drive.dirList(`Ready for Review/${org}/${examination.patientId}`)[0].webViewLink
    examination.webViewLink = webViewLink
    return examination
}


const buildExternalAssets = ( examination, rules, drive) => {
        
    return  piper.execute({ 
	        	drive,
	        	spots,
	        	examination
        	}, 
        		rules
    		)

}


const checkPath = async (records, fb) => {
	let res = []
	for( let i = 0; i < records.length; i++){
		let record = records[i]
		console.log("check ", record.path)
		let r = await fb.execute.getFileMetadata(record.path)
		res.push(record)
	}
	return res.filter(d => d)
}


const buildLabelingRecords = (examination, rules, fb) => {

	let rows = examination.$extention.assets.map( a => {
	  let record = find( examination.$extention.records, r => r.id == a.parentId)
	  if(!record) return null

/////////////////////////////////////



//////////////////////////////////////

	  let recordPoint = find( examination.$extention.recordPoints, r => r.id == record.parentId)

	  let formRecords = examination.$extention.forms.map( f => {
	    let res = extend({}, f)
	    res.examinationId = examination.id
	    let key = maxBy(keys(f.data))
	    res.data = res.data[key]
	    return res 
	  })


	  let form = {}
	  let ftypes = ["patient", "ekg", "echo"]

	  ftypes.forEach( type => {
	    let f = find(examination.$extention.forms, d => d.type == type)
	    form[type] = (f) ? f.data[first(keys(f.data))]: {}
	  })
	  
	  examination.$extention = extend(examination.$extention,{
	    record,
	    recordPoint,
	    form,
	    asset: a
	  })
	  
	  let res = {}
	  
	  rules = rules.filter(l => l.import)
	  rules.forEach( (l, li) => {
	    try {
	      res[l.name] = eval(l.import)(examination, li)
	    } catch(e) {
	      logger.info(l.import)
	      logger.info(e.toString())
	    }  
	  
	  })        

	  return {
	    labelRecords: res,
	    formRecords
	  }         

	})

	return {
	  labelRecords: flattenDeep(rows.filter(r => r).map( r => r.labelRecords)),
	  formRecords: uniqBy(flattenDeep(rows.filter(r =>r).map( r => r.formRecords)), f => f.id)
	}

}


const buildLabelingRecords1 = (examination, rules, fb) => {

/////////////////////////////////////////////////////////////////////////////////////////////////////

    let formRecords = []
	let data = examination.$extention.forms

	if(data.patient){
		formRecords.push({
			id: uuid(),
			data:{
					en: data.patient,
					uk: data.patient
			},
			type: "patient",
			examinationId: data.examination.id,
		})
	}	

	if(data.ekg){
		formRecords.push({
			id: uuid(),
			data:{
					en: data.ekg,
					uk: data.ekg
			},
			type: "ekg",
			examinationId: data.examination.id,
		})
	}	

	if(data.echo){
		formRecords.push({
			id: uuid(),
			data:{
					en: data.echo,
					uk: data.echo
			},
			type: "echo",
			examinationId: data.examination.id,
		})
	}

	let form = {
		patient:{
			en: data.patient
		},
		ekg:{
			en: data.ekg
		},
		echo:{
			en: data.echo
		},

	}	

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


	let rows = examination.$extention.assets.map( a => {
	  let record = find( examination.$extention.records, r => r.id == a.parentId)
	  if(!record) return null

/////////////////////////////////////



//////////////////////////////////////

	  let recordPoint = find( examination.$extention.recordPoints, r => r.id == record.parentId)
	  
	  examination.$extention = extend(examination.$extention,{
	    record,
	    recordPoint,
	    form,
	    asset: a
	  })
//////////////////////////////////////////////////////////////////////////////////////////////

	  
	  let res = {}
	  
	  rules = rules.filter(l => l.import)
	  rules.forEach( (l, li) => {
	    try {
	      res[l.name] = eval(l.import)(examination, li)
	    } catch(e) {
	      logger.info(l.import)
	      logger.info(e.toString())
	    }  
	  
	  })        

	  return {
	    labelRecords: res
	  }         

	})

	return {
	  labelRecords: flattenDeep(rows.filter(r => r).map( r => r.labelRecords)),
	  formRecords
	}

}




const normalizeOptions = options => {
	options = options || {
		mongodbService: true, 
		firebaseService: true, 
		googledriveService: true,
	}

	options.mongodbService = (isUndefined(options.mongodbService)) ? true : options.mongodbService
	options.firebaseService = (isUndefined(options.firebaseService)) ? true : options.firebaseService
	options.googledriveService = (isUndefined(options.googledriveService)) ? true : options.googledriveService


	return options	
}


const mc = require("./utils/in-memory-collections")()


module.exports = async options => {

	options = normalizeOptions(options)	
	logger = options.logger || console

	if(options.mongodbService && !mongodbService) mongodbService = await initMongoService(
		extend({}, options.mongodbService, {logger})
	)
	
	if(options.firebaseService && !firebaseService) firebaseService = await initFirebaseService(
		extend({}, options.firebaseService, {logger})
	) 
	
	if(options.googledriveService && !googledriveService) googledriveService = await initGoogledriveService(
		extend({}, options.googledriveService, {logger})
	)


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	if(options.firebaseService && !options.firebaseService.noprefetch){
		let buf = await firebaseService.execute.getCollectionItems("forms")  
		mc.addCollection("forms", buf)
		buf = await firebaseService.execute.getCollectionItems("assets")  
		mc.addCollection("assets", buf)
		buf = await firebaseService.execute.getCollectionItems("records")  
		mc.addCollection("records", buf)
		buf = await firebaseService.execute.getCollectionItems("recordPoints")  
		mc.addCollection("recordPoints", buf)
		buf = await firebaseService.execute.getCollectionItems("organizations")  
		mc.addCollection("organizations", buf)
		buf = await firebaseService.execute.getCollectionItems("users")  
		mc.addCollection("users", buf)
	}	
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////










	return {
		
		mongodbService, 
		firebaseService, 
		googledriveService,

		getNewExaminations,
		getExaminationsInState,
		// expandExaminations: expandExaminationsInMemory,
		expandExaminations: expandExaminations,
		expandExaminations1,
		
		finalizeForms,

		validateExamination,
		buildExternalAssets,
		resolveAsset,
		buildLabelingRecords,
		buildLabelingRecords1,
		
		commitBatch,
		checkNeedAssetRecovery,
		resolveTemplate,
		checkPath,
// DEV MODE  //////////////////////////////////////////////////////////////////////////
		
		createTestExaminations, 


///////////////////////////////////////////////////////////////////////////////////////

		close: (mongodbService) ? mongodbService.close : (() => {})
	}

}



