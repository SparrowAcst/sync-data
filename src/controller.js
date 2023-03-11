const uuid = require("uuid").v4
const path = require("path")

const initMongoService = require("./utils/mongodb")
const initFirebaseService = require("./utils/fb")
const initGoogledriveService = require("./utils/drive")

const piper = require("./utils/piper")

const { loadYaml } = require("./utils/file-system")
const spots = loadYaml(path.join(__dirname, "../.config/data/point-order.yml"))
const formFields = require("./utils/form-fields")

let mongodbService 
let firebaseService 
let googledriveService

const { extend, differenceBy, isUndefined, isNull, find, flattenDeep, first, uniqBy, keys, maxBy } = require("lodash")

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
		
		} catch (e) {
			console.log("ERROR", e.toString())
		}
	}

	return examinations

}


const delay = (ms, msg) => new Promise(resolve => {
	console.log(`Wait ${ms} for ${msg} settings`)
	setTimeout(() => resolve(), ms)
})

const commitBatch = async (batch, msg) => {
	await delay(5, msg)
	try {
		await batch.commit()
	} catch (e) {
		console.log("retry")
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


const resolveAsset = async (examination, asset) => {
	
// START DEBUG COMMENT

	let doc 
        if(isUndefined(asset.id) || isNull(asset.id)){
        	doc = firebaseService.db.collection(`examinations/${examination.id}/assets`).doc()
        	asset.id = doc.id
        	asset.links.path = `${examination.userId}/recordings/eKuore_${asset.id}`

        	console.log("CREATE asset", asset.links.path)
        } else {
          console.log("UPDATE asset", asset.links.path)
        }


	
	let fStream = await googledriveService.geFiletWriteStream(asset.file)
	let file = await firebaseService.execute.saveFileFromStream(
			asset.links.path,
			asset.file,
			fStream)
	asset.links.url = file[0]
	delete asset.file

// END DEBUG COMMENT

	return asset

}


const validateExamination = ( examination, rules, org ) => {
	let ids = /([A-Z]{3})([0-9]{4})/.exec(examination.patientId)

    examination._validation = piper.validate({
        // context
        drive: googledriveService,
        org, //: examination.$extention.organizations[0].name.toUpperCase(),
        doctor: ids[1],
        patient: ids[2],
        examination,
        formFields
      }, rules)
    let webViewLink = googledriveService.dirList(`Ready for Review/${org}/${examination.patientId}`)[0].webViewLink
    examination.webViewLink = webViewLink
    return examination
}


const buildExternalAssets = ( examination, rules) => {
        
    return  piper.execute({ 
	        	drive: googledriveService,
	        	spots,
	        	examination
        	}, 
        		rules
    		)

}


const buildLabelingRecords = (examination, rules) => {

	let rows = examination.$extention.assets.map( a => {
	  
	  let record = find( examination.$extention.records, r => r.id == a.parentId)
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
	    form[type] = f.data[first(keys(f.data))]
	  })
	  
	  examination.$extention = extend(examination.$extention,{
	    record,
	    recordPoint,
	    form,
	    asset: a
	  })
	  
	  let res = {}
	  
	  rules = rules.filter(l => l.import)
	  rules.forEach( l => {
	    try {
	      res[l.name] = eval(l.import)(examination)
	    } catch(e) {
	      console.log(l.import)
	      console.log(e.toString())
	    }  
	  
	  })        

	  return {
	    labelRecords: res,
	    formRecords
	  }         

	})

	return {
	  labelRecords: flattenDeep(rows.map( r => r.labelRecords)),
	  formRecords: uniqBy(flattenDeep(rows.map( r => r.formRecords)), f => f.id)
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
	
	if(options.mongodbService && !mongodbService) mongodbService = await initMongoService()
	if(options.firebaseService && !firebaseService) firebaseService = await initFirebaseService() 
	if(options.googledriveService && !googledriveService) googledriveService = await initGoogledriveService()


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
		validateExamination,
		buildExternalAssets,
		resolveAsset,
		buildLabelingRecords,
		commitBatch,

// DEV MODE  //////////////////////////////////////////////////////////////////////////
		
		createTestExaminations, 

///////////////////////////////////////////////////////////////////////////////////////

		close: (mongodbService) ? mongodbService.close : (() => {})
	}

}



