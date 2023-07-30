const moment = require("moment")
const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull } = require("lodash")
const { loadYaml, pathExists } = require("../utils/file-system")
const uuid = require("uuid").v4


module.exports = async settings => {

    const logConfig = loadYaml(path.join(__dirname, `../../.config/log/log.conf.yml`))
    const logFile = path.join(__dirname, `${logConfig.sync.log.path}`)
    const backup = loadYaml(path.join(__dirname, `../../.config/data/backup.yml`))
    const labelsMetadata = loadYaml(path.join(__dirname, `../../.config/labeling/labels.yml`))

    const logger = require("../utils/logger")(logFile)

    logger.info(`Log file ${logFile}`)
    logger.info(`SYNC DATA STARTS (${JSON.stringify(settings, null, " ")})`)

    const controller = await require("../controller")({
        logger,
        firebaseService: {
            noprefetch: true
        }
    })

    const mongodb = controller.mongodbService
    const fb = controller.firebaseService

    let orgs = backup.organizations


    // orgs = orgs.filter(o =>
    //     pathExists(path.join(__dirname, `../../.config/data/${o}/assets-rules.yml`))
    // )

    orgs = (settings.organization) ? [settings.organization] : orgs


    for (let k = 0; k < orgs.length; k++) {

        let org = orgs[k]

        logger.info(`Organization: ${org}`)

        let submitedForms = await controller.getSubmitedForms(settings.noValidate)
        const patientRegExp = RegExp(settings.pattern || ".*")
        submitedForms = submitedForms.filter(f => patientRegExp.test(f.examination.patientId))


        logger.info(`\nStart validation stage for ${submitedForms.length} examinations:\n${submitedForms.map(f => "\t"+f.examination.patientId).join("\n")}`)
        let batch

        if (!settings.test) {
            batch = fb.db.batch()
        }

        //////////////////////////////////////////////////////////////////////////////////////////////////// 


        for (let i = 0; i < submitedForms.length; i++) {

            let submitedForm = submitedForms[i]
            
            submitedForm.examination = ( await controller.expandExaminations2(...[submitedForm.examination]) )[0]

            let insUser = extend({}, submitedForm.examination.$extention.users[0])
            let insOrganization = extend({}, submitedForm.examination.$extention.organizations[0])

            insUser.id = insUser.userId

            logger.info(`Insert user ${JSON.stringify(insUser, null, "")} into ${controller.mongodbService.config.db[org].userCollection}`)

            if (!settings.test) {

                await mongodb.execute.replaceOne(
                    mongodb.config.db[org].userCollection, { id: insUser.id },
                    insUser
                )

            }

            logger.info(`Insert organization ${JSON.stringify(insOrganization, null, "")} into ${mongodb.config.db[org].organizationCollection}`)

            if (!settings.test) {

                await mongodb.execute.replaceOne(
                    mongodb.config.db[org].organizationCollection, { id: insOrganization.id },
                    insOrganization
                )

            }

            // let inserted = extend({}, submitedForms.examination)
            // delete inserted.$extention

            // inserted.synchronizedAt = new Date()


            // inserted.actorId = inserted.userId

            // if (!settings.test) {

            //     await mongodb.execute.replaceOne(
            //         mongodb.config.db[org].examinationCollection, {
            //             id: inserted.id
            //         },
            //         inserted
            //     )
            // }



            ////////////////////////////////////////////////////////////////////////////////////////////////////
            //// debug forms
            // 
            // 
            if (!settings.test) {

                try {
                    let doc = fb.db.collection("examinations").doc(submitedForm.examination.id)
                    batch.update(doc, { state: settings.state || "inReview" })
                } catch (e) {
                    logger.info(e.toString())
                }
            }



        }

        if (!settings.test) {

            try {
                await controller.commitBatch(batch, "update examination state")
            } catch (e) {
                logger.info(e.toString())
            }
        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////




        logger.info(`Start Import Stage for ${submitedForms.length} examinations:\n${submitedForms.map(f => "\t"+f.examination.patientId).join("\n")}`)

        //////////////////////////////           Import Stage          //////////////////////////////////////////////////////////


        for (let i = 0; i < submitedForms.length; i++) {

            ////////////////////////////////////////////////////////////////////////////////////////////////////
            //// debug forms
            // 
            // 

            let batch

            if (!settings.test) {

                batch = fb.db.batch()

            }

            /////////////////////////////////////////////////////////////////////////////////////////////////////

            let examination = submitedForms[i].examination
            //!!!!!!!!!!!!!!
            examination.state = settings.state
            examination.org = org
            examination.synchronizedAt = new Date()
            examination.actorId = examination.userId
            logger.info(`Accept for review ${examination.patientId} in: ${mongodb.config.db[org].examinationCollection}`)

            let inserted = extend({}, examination)
            delete inserted.$extention

            inserted.form = {
                patient: submitedForms[i].patient,
                ekg: submitedForms[i].ekg,
                echo: submitedForms[i].echo,
                attachements: submitedForms[i].attachements,
                recordings: submitedForms[i].recordings,
                updatedAt: submitedForms[i].updatedAt,
                updatedBy: submitedForms[i].updatedBy,
                completeness: submitedForms[i].completeness    
            }

            if (!settings.test) {

                await mongodb.execute.replaceOne(
                    mongodb.config.db[org].examinationCollection, { id: inserted.id },
                    inserted
                )
            }

            logger.info(`Accept for review ${examination.patientId} (${examination.id}) in fb`)

            //!!!!!!!!!!!!!!



            ////////////////////////////////////////////////////////////////////////////////////////////////////
            //// debug forms
            // 
            // 
            // if (!settings.test) {

            //     try {
            //         let doc = fb.db.collection("examinations").doc(examination.id)
            //         batch.update(doc, { state: "inReview" })
            //         console.log("UPDATE STAGE FB", examination.id)
            //     } catch (e) {
            //         logger.info(e.toString())
            //     }
            // }

            // await controller.commitBatch(batch, "update fb stage inReview ")



            ////////////////////////////////////////////////////////////////////////////////////////////////////////


            let labelingRecords = controller.buildLabelingRecords1(examination, labelsMetadata)
            labelingRecords.labelRecords = await controller.checkPath(labelingRecords.labelRecords, fb)

            let labelOps = labelingRecords.labelRecords.map(l => ({
                replaceOne: {
                    "filter": { path: l.path },
                    "replacement": l,
                    "upsert": true
                }
            }))

            logger.info(`Insert into labeling: ${mongodb.config.db[org].labelingCollection} ${labelOps.length} items`)

            if (!settings.test) {

                await mongodb.execute.bulkWrite(
                    mongodb.config.db[org].labelingCollection,
                    labelOps
                )
            } else {
                console.log("labelOps", JSON.stringify(labelOps, null, " "))
            }

            let formOps = labelingRecords.formRecords.map(l => {
                
                l.patientId = examination.patientId

                return {
                    replaceOne: {
                        "filter": { id: l.id },
                        "replacement": l,
                        "upsert": true
                    }
                }
            })

            logger.info(`Insert into ${mongodb.config.db[org].formCollection} ${formOps.length} items`)

            if (!settings.test) {
                await mongodb.execute.bulkWrite(
                    mongodb.config.db[org].formCollection,
                    formOps
                )

                logger.info(`Finalize clinic forms`)
                await controller.finalizeForms(examination.patientId)
            } else {
                console.log("formOps", JSON.stringify(formOps, null, " "))   
            }

        }

    }

    logger.info("Data synchronization finalized")
    logger.info("")


    controller.close()
}