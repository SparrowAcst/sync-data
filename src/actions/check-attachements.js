const moment = require("moment")
const path = require("path")
const { find, sortBy, filter, extend, isUndefined, isNull } = require("lodash")
const { loadYaml, pathExists } = require("../utils/file-system")
const uuid = require("uuid").v4


const check = async settings => {

    const logConfig = loadYaml(path.join(__dirname, `../../.config/log/log.conf.yml`))
    const logFile = path.join(__dirname, `${logConfig.sync.log.path}`)
    const backup = loadYaml(path.join(__dirname, `../../.config/data/backup.yml`))
    const labelsMetadata = loadYaml(path.join(__dirname, `../../.config/labeling/labels.yml`))

    const logger = require("../utils/logger")(logFile)

    logger.info(`Log file ${logFile}`)
    logger.info(`CHECK ATTACHEMENTS (${JSON.stringify(settings, null, " ")})`)

    const controller = await require("../controller")({
        logger,
        firebaseService: {
            noprefetch: true
        }
    })

    const mongodb = controller.mongodbService
    const gd = controller.googledriveService
    
    let drive = await gd.create({
        subject: backup.subject
    })

    await drive.load(settings.path)
    let filelist = drive.fileList()

    let attachements = filelist.map( f => ({
      "id": f.id,
      "name": f.name,
      "publicName": f.name,
      "mimeType": f.mimeType,
      "size": f.size,
      "updatedAt": f.modifiedTime,
      "source": "SYNC DATA UTILS",
      "url": `./api/controller/file/gd?id=${f.id}`,
      "md5": f.md5Checksum,
      "valid": true
    }))

    return attachements

}    




const run = async () => {
    let patientId = process.argv[2]
    let folder = process.argv[3]
    let attachements = await check({path: `ADE BACKUP/Heart Harvest 2/Ready for Review/STRAZHESKO/${patientId}/${folder}`})
    console.log(JSON.stringify(attachements, null, " "))
}

run()