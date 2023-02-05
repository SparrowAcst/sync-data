const uuid = require("uuid").v4
const path = require("path")

const initMongoService = require("./utils/mongodb")
const initFirebaseService = require("./utils/fb")
const initGoogledriveService = require("./utils/drive")

const piper = require("./utils/piper")

const { loadYaml } = require("./utils/file-system")
const spots = loadYaml(path.join(__dirname, "../.config/data/point-order.yml"))


let mongodbService 
let firebaseService 
let googledriveService

const { extend, differenceBy, isUndefined, find, flattenDeep, first, uniqBy, keys } = require("lodash")

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


const expandExaminations = async (...examinations) => {
	
	const db = firebaseService.db
	const docMapper = doc => ({
	    id: doc.id,
	    ...doc.data()
	})
	
	examinations = examinations || []

	for(let i=0; i < examinations.length; i++){
		
		let examination = examinations[i]
		examination.$extention = {}

		let users = db.collection('users');
		examination.$extention.users = (await users.where("userId","==",examination.userId).get() ).docs.map(docMapper)

		if(examination.$extention.users[0]){
			let organizations = db.collection('organizations');
			examination.$extention.organizations = 
				[docMapper((await organizations.doc(examination.$extention.users[0].organization).get() ))]
		}
				
		let exams = db.collection('examinations');
    	const docRef = exams.doc(examination.id)

		examination.$extention.forms = ( await docRef.collection('forms').get() ).docs.map(docMapper)
		examination.$extention.recordPoints = ( await docRef.collection('recordPoints').get() ).docs.map(docMapper)
		examination.$extention.records = ( await docRef.collection('records').get() ).docs.map(docMapper)
		examination.$extention.assets = ( await docRef.collection('assets').get() ).docs.map(docMapper)
		
	}

	return examinations

}


// DEV MODE  //////////////////////////////////////////////////////////////////////////

const createTestExaminations = async (...examinations) => {
	const db = firebaseService.db
	examinations = examinations || []

	for(let i=0; i < examinations.length; i++){
		let examination = examinations[i]
		let $extention = extend({}, examination.$extention)
		let id = examination.id 
		console.log(id, examination.patientId)
		delete examination.$extention
		delete examination.id
		const docRef = db.collection("examinations").doc(id)
		await docRef.set(examination)
		for( let j=0; j < $extention.forms.length; j++ ){
			const form = $extention.forms[j]
			let id = form.id 
			delete form.id
			await docRef.collection("forms").doc(id).set(form)
		}
		for( let j=0; j < $extention.records.length; j++ ){
			const record = $extention.records[j]
			let id = record.id 
			delete record.id
			await docRef.collection("records").doc(id).set(record)
		}
		for( let j=0; j < $extention.recordPoints.length; j++ ){
			const recordPoint = $extention.recordPoints[j]
			let id = recordPoint.id
			delete recordPoint.id
			await docRef.collection("recordPoints").doc(id).set(recordPoint)
		}
		for( let j=0; j < $extention.assets.length; j++ ){
			const asset = $extention.assets[j]
			let id = asset.id
			delete asset.id
			await docRef.collection("assets").doc(id).set(asset)
		}
		for( let j=0; j < $extention.organizations.length; j++ ){
			const organization = $extention.organizations[j]
			let id = organization.id
			delete organization.id
			await db.collection("organizations").doc(id).set(organization)
		}
		for( let j=0; j < $extention.users.length; j++ ){
			const user = $extention.users[j]
			let id = user.id
			delete user.id
			await db.collection("users").doc(id).set(user)
		}
	}
}

////////////////////////////////////////////////////////////////////////////////////


const resolveAsset = async asset => {
	
	console.log(`resolveAsset: Move "${asset.file.path}"" into "${asset.links.path}"`)
	let fStream = await googledriveService.geFiletWriteStream(asset.file)
	let file = await firebaseService.execute.saveFileFromStream(
			asset.links.path,
			asset.file,
			fStream)
	asset.links.url = file
	delete asset.file
	return asset

}


const validateExamination = ( examination, rules ) => {
	let ids = /([A-Z]{3})([0-9]{4})/.exec(examination.patientId)
    
    examination._validation = piper.validate({
        // context
        drive: googledriveService,
        org: examination.$extention.organizations[0].name.toUpperCase(),
        doctor: ids[1],
        patient: ids[2],
        examination
      }, rules)

    return examination
}


const buildExternalAssets = ( examination, rules) => {
        
    return  piper.execute( { 
        	drive: googledriveService,
        	spots,
        	examination
        } , rules
    )

}


const buildLabelingRecords = (examination, rules) => {

	let rows = examination.$extention.assets.map( a => {
	  
	  let record = find( examination.$extention.records, r => r.id == a.parentId)
	  let recordPoint = find( examination.$extention.recordPoints, r => r.id == record.parentId)

	  let formRecords = examination.$extention.forms.map( f => {
	    let res = extend({}, f)
	    res.examinationId = examination.id
	    res.data = res.data[first(keys(f.data))]
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
	    assets: a
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


module.exports = async options => {

	options = normalizeOptions(options)	
	
	if(options.mongodbService && !mongodbService) mongodbService = await initMongoService()
	if(options.firebaseService && !firebaseService) firebaseService = await initFirebaseService() 
	if(options.googledriveService && !googledriveService) googledriveService = await initGoogledriveService()

	return {
		
		mongodbService, 
		firebaseService, 
		googledriveService,

		getNewExaminations,
		getExaminationsInState,
		expandExaminations,
		validateExamination,
		buildExternalAssets,
		resolveAsset,
		buildLabelingRecords,

// DEV MODE  //////////////////////////////////////////////////////////////////////////
		
		createTestExaminations, 

///////////////////////////////////////////////////////////////////////////////////////

		close: (mongodbService) ? mongodbService.close : (() => {})
	}

}