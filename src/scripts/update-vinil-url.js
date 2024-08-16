const path = require("path")
const { isUndefined } = require("lodash")
const uuid = require("uuid").v4
const URL = require('url')

const run = async () => {

    console.log("Update Public URL")

    const datasetName = "vinil" //process.argv[2]

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

    const resolvePath = data => {
        let url = URL.parse(data["Segmentation URL"], true)
        let query = url.query
        return query.record_v3
    }

    const updateRecords = async (records, n) => {

        let commands = []
        let i = 0
        for (r of records) {
            i++
            console.log(`${n}.${i}: ${r["Examination ID"]}: ${r.id} : ${r["Body Spot"]} : ${r.model} :`)
            r.path = resolvePath(r)
            r.Source = await resolvePublicURL(r)
            console.log(r.Source)
            if(r.Source){
                r.PUBLIC_URL_UPDATED = true
                commands.push({
                    replaceOne: {
                        "filter": { id: r.id },
                        "replacement": r,
                        "upsert": false
                    }
                })
            }    
        }

        return commands
    }


    const PAGE_SIZE = 50
    let buffer = []
    let bufferCount = 0

    do {

        bufferCount++

        const pipeline = [{
                '$match': {
                    PUBLIC_URL_UPDATED: {
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

run()