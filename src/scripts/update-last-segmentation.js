const path = require("path")
const { isUndefined } = require("lodash")
const uuid = require("uuid").v4
var md5 = require('js-md5')


const run = async (datasetName) => {

    console.log("Update LAST SEGMENTATION")

    // const datasetName = process.argv[2]

    // const examPattern = process.argv[3] || ""

    if (!datasetName) {
        console.log("Dataset name not specified.")
        return
    }
    console.log(`Dataset: "${datasetName}"`)


    const mongodb = await require("../utils/mongodb")()
    const Storage = require("../utils/fb-storage")
    const storage = new Storage(path.join(__dirname, `../../.config/key/fb/harvest1.fb.key.json`))


    const mem = (msg) => {
        const used = process.memoryUsage();
        console.log(`${msg} :Memory usage: ${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`);
        return used.rss
    }


    const resolvePublicURL = async data => {

        console.log(data.path)

        let metadata = await storage.getFileMetadata(data.path)
        if (metadata) {
            metadata.metadata = {
                firebaseStorageDownloadTokens: uuid()
            }

            metadata = await storage.setFileMetadata(data.path, metadata)

            return {
                url: `https://firebasestorage.googleapis.com/v0/b/stethophonedata.appspot.com/o/${encodeURIComponent(metadata.name)}?alt=media&token=${metadata.metadata.firebaseStorageDownloadTokens}`,
            }
        } else {
            console.log("ERROR:", data.path)
        }

    }


    const resolveSegmentation = async data => {


        console.log(data.path)
        if (!data.segmentation) {
            console.log("IGNORE")
            return
        }
        let fbSeg = await storage.fetchFileData(`${data.path}.json`)
        fbSeg = JSON.parse(fbSeg.toString())

        if (md5(JSON.stringify(fbSeg)) === md5(JSON.stringify(data.segmentation))) {
            console.log("SKIP")
            return
        }
        console.log(fbSeg)
        return fbSeg
    }

    const updateRecords = async (records, n) => {

        let commands = []
        let i = 0
        for (r of records) {
            i++
            console.log(`${n}.${i}: ${r["Examination ID"]}: ${r.id} : ${r["Body Spot"]} : ${r.model} :`)
            let s = await resolveSegmentation(r)
            if (s) {
                r.segmentation = s
            }
            r.UPDATE_FB_SEG = true
            commands.push({
                replaceOne: {
                    "filter": { id: r.id },
                    "replacement": r,
                    "upsert": false
                }
            })
        }

        return commands
    }


    const PAGE_SIZE = 50
    let buffer = []
    let bufferCount = 0

    do {

        bufferCount++

        const pipeline = [

            {
                '$match': {

                    UPDATE_FB_SEG: {
                        $exists: false
                    }
                }
            },
            {
                '$sort': {
                    'Examination ID': 1
                }
            },
            {
                '$limit': PAGE_SIZE
            }
        ]

        buffer = await mongodb.execute.aggregate(`sparrow.${datasetName}`, pipeline)

        if (buffer.length > 0) {
            console.log(`Buffer: ${bufferCount}: (${buffer.length} items)`) // \n${buffer.map(d => d["Examination ID"]+":"+d.id+":"+d.path).join("\n")}`)
            let ops = await updateRecords(buffer, bufferCount)

            if (ops.length > 0) {
                // console.log(ops[0])
                await mongodb.execute.bulkWrite(`sparrow.${datasetName}`, ops)
            }

            console.log(`Update ${ops.length} items`) //:\n${ops.map( d => d.replaceOne.replacement["Examination ID"]+":"+d.replaceOne.replacement.id).join("\n")}`)
            mem()

        }

    } while (buffer.length > 0)

    mongodb.close()

}

module.exports = run

// run()