
const { loadYaml, pathExists } = require("../utils/file-system")
const { find, sortBy, filter, extend } = require("lodash")
const moment = require("moment")
const path = require("path")

module.exports = async organization => {
  
  const logger = require("../utils/logger")(path.resolve(`./.logs/validation-${organization}-${moment(new Date()).format("YYYY-MM-DD-HH-mm-ss")}.log`))
  
  logger.info(`DATA VALIDATION for "${organization}" STARTS`)
  
  
  const controller = await require("../controller")({mongodbService:false})
  
  let org =  organization //orgs[k]
  logger.info(`Organization: ${org}`)

  const validateRules = loadYaml(path.join(__dirname,`../../.config/data/${org}/validate-rules.yml`))
  
  let examsIds = controller.googledriveService.dirList(`Ready for Review/${org}/*`).map( d => d.name)
 
  let inReviewExams = await controller.firebaseService.execute.getCollectionItems(
     "examinations",
     [["state", "==", "inReview"]]
  )
 
  examsIds = examsIds.filter( id => find(inReviewExams, exam => exam.patientId == id))   
 
  let syncExams = sortBy(
    inReviewExams.filter( exam => find(examsIds, id => exam.patientId == id))
    , d => d.patientId
  )  

  logger.info(`Validate:\n ${syncExams.map(exam => exam.patientId).join("\n")}`)

// /////////////////////////////////////////////////////////////////////////////////////////////////////////////
  let result = []
  for( let i = 0; i < syncExams.length; i++){
    
    let examination = syncExams[i]

    examination = await controller.expandExaminations(...[examination])
    examination = controller.validateExamination(examination[0], validateRules)

    logger.info(`
      ${examination.patientId} >>> 
      ${examination._validation}
      `
    )

    result.push({
      organization: org,
      examination: examination.patientId,
      validation: examination._validation,
      validatedAt: new Date() 
    })

  }

  controller.close() 
  return result
}


