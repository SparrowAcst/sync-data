
const { loadYaml, pathExists } = require("../utils/file-system")
const { find, sortBy, filter, extend, findIndex } = require("lodash")
const moment = require("moment")
const path = require("path")

module.exports = async organization => {
  
  const logger = require("../utils/logger")(path.resolve(`./.logs/validation-${organization}-${moment(new Date()).format("YYYY-MM-DD-HH-mm-ss")}.log`))
  
  logger.info(`DATA VALIDATION for "${organization}" STARTS`)
  
  
  const controller = await require("../controller")()
  
  let org =  organization //orgs[k]
  logger.info(`Organization: ${org}`)

  const validateRules = loadYaml(path.join(__dirname,`../../.config/data/${org}/validate-rules.yml`))
  
  let examsIds = controller.googledriveService.dirList(`Ready for Review/${org}/*`).map( d => d.name)
 
  let inReviewExams = await controller.firebaseService.execute.getCollectionItems(
     "examinations",
     [["state", "==", "pending"]]
  )
 
  examsIds = examsIds.filter( id => find(inReviewExams, exam => exam.patientId == id))   
 
  let syncExams = sortBy(
    inReviewExams.filter( exam => find(examsIds, id => exam.patientId == id))
    , d => d.patientId
  )  

  logger.info(`Validate:\n ${syncExams.map(exam => exam.patientId).join("\n")}`)

// /////////////////////////////////////////////////////////////////////////////////////////////////////////////
  let result = []
  result = await controller.mongodbService.execute.aggregate(
    controller.mongodbService.config.db.examinationCollection,
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

  // console.log(result)

  result = result
    .map( d => {
      d.organization = d.organization.name.toUpperCase()
      return d
    })
    .filter( d => d.organization == org)  
  


  // syncExams = await controller.expandExaminations(...syncExams)
  
  for( let i = 0; i < syncExams.length; i++){
    // logger.info(`${i}`)
    // logger.info(`${syncExams.length}`)
    
    let examination = syncExams[i]
    // console.log("!",i)
    examination = await controller.expandExaminations(...[examination])
    // console.log("!!",i)
    
    examination = controller.validateExamination(examination[0], validateRules)

    logger.info(`${examination.patientId} >>> ${examination._validation}`
    )

    let eIndex = findIndex( result, d => d.patientId == examination.patientId )
    let f = result[eIndex]

    f.validation = (examination._validation == true) ? "Verification was successful." : examination._validation  
    f.validatedAt = new Date()
    f.reportComment = ""


    if(examination._validation == true && f._validation != true){
      f.reportComment = `The status will be set to "inReview" after the data is synchronized.`
    }

    if(f.state == "accepted"){
      f.reportComment = `After setting the status to "accepted", you can remove the data from the "Ready for Review" folder.` 
    }

    if(f.state == "pending"){
      f.reportComment = `Read the warnings and correct the data.`
    }

    if(f.state == "rejected"){
      f.reportComment = ""
    }

    if(f.state == "inReview"){
      f.reportComment= ""
    }



    // result.push({
    //   organization: org,
    //   examination: examination.patientId,
    //   validation: examination._validation,
    //   validatedAt: new Date() 
    // })
  
  }
  controller.close() 
  return result
}


