const yargs = require("yargs")
const path = require("path")
const fse = require('fs-extra')
const fsp = require('fs').promises

const { findIndex } = require("lodash")
const uuid = require("uuid").v4

const s3bucket = require("./src/utils/s3-bucket")
const { splitFile, getChunkStream, fileSplitter } = require("./src/utils/split-file")

const { loadYaml, pathExists } = require("./src/utils/file-system")
const backupConfig = loadYaml(path.join(__dirname, `./.config/data/backup.yml`))


const TEMP_DIR = "../.sync-data-tmp"
const CHUNK_SIZE = 25 * 1024 * 1024


const settings = yargs.argv;


const run = async () => {

    if (!fse.pathExistsSync(TEMP_DIR)) {
        await fse.mkdirs(path.resolve(TEMP_DIR))
    }

    let source = settings.s
    let dest = settings.d
    console.log("\n\nCOPY DATA FROM GOOGLE DRIVE:", source)
    console.log("COPY DATA TO S3 BUCKET:", dest)


    let homedir = source.split("/")
    homedir = homedir.slice(0, findIndex(homedir, d => /\*/.test(d))).join("/")
    homedir = (!homedir) ? undefined : homedir



    const googleDrive = await require("./src/utils/drive3")()

    let drive = await googleDrive.create({
        subject: backupConfig.subject
    })
    await drive.load(homedir)

    let operations = drive.fileList(source).map(d => ({
        id: uuid(),
        source: d,
        dest: {
            type: "S3 bucket",
            file: `${dest}${d.path.replace(homedir, "").substring(1)}`
        }
    }))

    console.log(`\n\nFOUND ${operations.length} ITEMS`)
    let i = 0
    for (const operation of operations) {
        i++
        console.log(`\n\n${i} form ${operations.length}\ngd:${operation.source.path} > s3:${operation.dest.file}\n`)
        
        let exists = await s3bucket.list(operation.dest.file)
        if(exists.length > 0){
          console.log(`SKIP OPERATION. DESTINATION ${operation.dest.file} EXISTS`)
          continue
        }
        await drive.downloadFile(operation.source, TEMP_DIR)
        
        let splitter = fileSplitter()
        await s3bucket.uploadFromSplitter({
            splitter,
            source: `${TEMP_DIR}/${operation.source.name}`, 
            dest: path.resolve(TEMP_DIR),
            chunkSize: CHUNK_SIZE,
            target: operation.dest.file,
            size: operation.source.size,
            callback: status => {
                process.stdout.write(`UPLOAD: ${status.uploadedBytes} bytes                                      ${'\x1b[0G'}`)
            }
        })
 
    }

}

run()