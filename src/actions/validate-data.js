
const { loadYaml, pathExists } = require("../utils/file-system")
const { find, sortBy, filter, extend, findIndex } = require("lodash")
const moment = require("moment")
const path = require("path")

RegExp.escape = string => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')

const getReportComment = (f, e) => {
  e = e || f
  if(f.state == "accepted"){
    return `Data accepted. You can remove the data from the "Ready for Review" folder` 
  }

  if(f.state == "pending"){
    return (e._validation != true) 
                        ? `Read the warnings and correct the data`
                        : `The status will be set to "inReview" after the data is synchronized`
  }

  if(f.state == "rejected"){
    return`Data rejected. You can remove the data from the "Ready for Review" folder`
  }

  if(f.state == "inReview"){
    return "Please wait while the data is reviewed"
  }

}

module.exports = async (org, patientPattern) => {
  
  if(!pathExists(path.join(__dirname,`../../.config/data/${org}/validate-rules.yml`))) return []

  const patientRegExp = RegExp(patientPattern)
 
  const logConfig = loadYaml(path.join(__dirname,`../../.config/log/log.conf.yml`))
  const logFile = path.join(__dirname,`${logConfig.validate.log.path}/${org}/validate.log`)
  
  const logger = require("../utils/logger")(logFile)
  
  logger.info(`Log file ${logFile}`)
  logger.info(`DATA VALIDATION for "${org}" STARTS`)

  
  const controller = await require("../controller")({
    logger,
    firebaseService:{
      noprefetch: true
    }  
  })

  const mongodb = controller.mongodbService
  const fb = controller.firebaseService
  const gdrive = controller.googledriveService
    
  logger.info(`Organization: ${org}. Pattern: ${patientPattern}`)

  const validateRules = loadYaml(path.join(__dirname,`../../.config/data/${org}/validate-rules.yml`))
  
  let examsIds = gdrive.dirList(`Ready for Review/${org}/*`).map( d => d.name)
 
  let inReviewExams = await fb.execute.getCollectionItems(
     "examinations",
     [["state", "==", "pending"]]
  )
 
  examsIds = examsIds.filter( id => find(inReviewExams, exam => exam.patientId == id))   
 
  let syncExams = sortBy(
    inReviewExams
      .filter( exam => find(examsIds, id => exam.patientId == id))
      .filter( exam => patientRegExp.test(exam.patientId))
    , d => d.patientId
  )  
  
  logger.info(`Validate:\n ${syncExams.map(exam => exam.patientId).join("\n")}`)
  
  let result = []

  result = await mongodb.execute.aggregate(
    mongodb.config.db.examinationCollection,
    [
      {
        '$lookup': {
          'from': 'organization2', 
          'localField': 'organization', 
          'foreignField': 'id', 
          'as': 'orgs'
        }
      }, {
        '$project': {
          '_id': 0, 
          'patientId': '$patientId', 
          'validation': '$_validation', 
          'updatedAt': '$updatedAt',
          'webViewLink': '$webViewLink',
          'synchronizedAt': '$synchronizedAt',
          'state': '$state', 
          'organization': {
            '$arrayElemAt': [
              '$orgs', 0
            ]
          }
        }
      }
    ]  
  )

  result = result
    .map( d => {
      d.organization = d.organization.name.toUpperCase()
      return d
    })
    .filter( d => d.organization == org)
    .filter( d => patientRegExp.test(d.patientId))
      
  for( let i = 0; i < syncExams.length; i++){
    
    let examination = syncExams[i]
    examination = await controller.expandExaminations(...[examination])
    examination = controller.validateExamination(examination[0], validateRules, org)

    logger.info(`${examination.patientId} >>> ${examination._validation}`)

    let eIndex = findIndex( result, d => d.patientId == examination.patientId )
    let f = result[eIndex]
    if(!f){
      f = examination
      result.push(f)
    }

    f.validation = (examination._validation == true) ? "Verification was successful." : examination._validation  
    f.validatedAt = new Date()
    f.reportComment = getReportComment(f, examination)
  }

  result = result.map( r => {
    r.reportComment = r.reportComment || getReportComment(r)
    return r
  })

  controller.close() 
  logger.info("Data validation finalized")
  logger.info("")
  
  return result
}


