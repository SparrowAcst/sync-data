const moment = require("moment")
const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull } = require("lodash")
const { loadYaml, pathExists } = require("../utils/file-system")
const uuid = require("uuid").v4 

module.exports = async ( syncPatientPattern ) => {


///////////////////////////// Constants /////////////////////////////////////////////

const organizationMapper = {
  "Cardio Institute": "STRAZHESKO",
  "Denis": "Denis",
  "Potashev": "POTASHEV"
}

const assetsRules = {

    "POTASHEV": loadYaml(path.join(__dirname,`../../.config/data/POTASHEV/assets-rules.yml`)),
    "Denis": loadYaml(path.join(__dirname,`../../.config/data/Denis/assets-rules.yml`)),
    "STRAZHESKO": loadYaml(path.join(__dirname,`../../.config/data/STRAZHESKO/assets-rules.yml`))

}


//////////////////////////// Log file settings //////////////////////////////////////


  const logConfig = loadYaml(path.join(__dirname,`../../.config/log/log.conf.yml`))
  const logFile = path.join(__dirname,`${logConfig.recoveryFB.log.path}`)
  
  const logger = require("../utils/logger")(logFile)
  
  logger.info(`Log file ${logFile}`)
  logger.info(`RECOVERY FIREBASE DATA STARTS`)

//////////////////////////// Create controller //////////////////////////////////////
  
  const controller = await require("../controller")({
    logger,
    firebaseService:{
      noprefetch: true
    }  
  })
  
  const mongodb = controller.mongodbService
  const fb = controller.firebaseService
  const gdrive = controller.googledriveService
     
////////////////////////// Load Confs ////////////////////////////////////////////////////

  const labelsMetadata = loadYaml(path.join(__dirname,`../../.config/labeling/labels.yml`))
  const backup = loadYaml(path.join(__dirname,`../../.config/data/backup.yml`))

///////////////////////// Start Recovery /////////////////////////////////////////////////  

    /////////////////////////// Get Recovery Exams ////////////////////////////////////////////////////////
    const inReviewExams = await fb.execute.getCollectionItems("examinations",[["state", "==", "inReview"]])
    const acceptedExams = await fb.execute.getCollectionItems("examinations",[["state", "==", "accepted"]])
    const exams = inReviewExams.concat(acceptedExams)
    
    const patientRegExp = RegExp(syncPatientPattern || ".*")
    
    const recoveryExams = exams.filter( e => patientRegExp.test(e.patientId))

    
    // console.log(recoveryExams)

    let formOps = []
  
    //////////////////////////////// Start examination loop /////////////////////////////////////////////
    for ( let i = 0; i < recoveryExams.length; i++ ){
      
      /////////////////////////// Expand Examinations //////////////////////////////////////////////////////
      
      let examination = ( await controller.expandExaminations(...[recoveryExams[i]]))[0]
      
      if(!examination.$extention.organizations) {
        info.log(`Examination: "${examination.patientId}" - ignored.`)
        continue
      }   
      
      const currentOrganization = organizationMapper[examination.$extention.organizations[0].name]
      examination.org = currentOrganization
      logger.info(`Organization: "${currentOrganization}" Examination: "${examination.patientId}"`)

      ////////////////////////// Get Rules and Build Assets ////////////////////////////////////////////////

      let externalAssets = controller.buildExternalAssets(examination, assetsRules[currentOrganization])
      externalAssets = externalAssets.filter(d => d.type == "file")      

      const batch = fb.db.batch()

  
      ////////////////////////////// start asset loop /////////////////////////////////////////////////
        
        for (let j = 0; j < externalAssets.length; j++){
          
          let asset = externalAssets[j]
          
          const needRecovery = await controller.checkNeedAssetRecovery(examination, asset)
          
          if(needRecovery){
            
            const assetPath = controller.resolveTemplate(asset.links.path, { context:{ examination, asset }} )
            logger.info(`${assetPath}: Need Recovery`)
            
            asset = await controller.resolveAsset(examination, asset)
            
            if(asset.error){
            
             logger.info(`${assetPath}: Failed.\n${asset.error}`) 
            
            } else {
        
              let doc = fb.db.collection(`examinations/${examination.id}/assets`).doc(asset.id)
              delete asset.id
              batch.set(doc, asset)
              examination.$extention.assets.push(asset)
            
            }
            
          } else {
          
            logger.info(`${asset.links.path}: Ok`)
        
          }
        }

        await controller.commitBatch(batch, "add recovered assets")

      ////////////////////////////// end asset loop ///////////////////////////////////////////////////

      ////////////////////////////// add attachements form for examination ////////////////////////////

        const attachementForm = {
          "id":uuid(),
          "type":"attachements",
          "data": examination.$extention.assets
                    .filter( d => d.type != "recording")
                    .map( (d, index) => ({
                      index,
                      name: d.publicName || `${d.type}${index}`,
                      mimeType: d.mimeType || d.type,
                      url:  d.links.url
                    })),  
          examinationId: examination.id
        }

        formOps.push({
          replaceOne :
            {
               "filter" : {id: attachementForm.id},
               "replacement" : attachementForm,
               "upsert" : true
            }
        })

  

      /////////////////////////////////////////////////////////////////////////////////////////////////

    }
    //////////////////////////////// End examination loop ///////////////////////////////////////////////

    logger.info(`Insert into ${mongodb.config.db.formCollection} ${formOps.length} items`)
    
    if(formOps.length > 0){
      await mongodb.execute.bulkWrite(
          mongodb.config.db.formCollection,
          formOps
      )
    }  


///////////////////////////////////// Finalize  Recovery //////////////////////////////////////////
  logger.info("Data recovery finalized")
  logger.info("")

  controller.close() 
}


