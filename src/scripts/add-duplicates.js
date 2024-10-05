const path = require("path")
const { isUndefined, flatten } = require("lodash")

const run = async () => {

    // console.log("Check Sound Files in Dataset")
    const datasetName = "taged-records" //process.argv[2]
    const examPattern = "" //process.argv[3] || ""

    if (!datasetName) {
        console.log("Dataset name not specified.")
        return
    }
    console.log(`Dataset: "${datasetName}"`)


    const mongodb = await require("../utils/mongodb")()
    // const Storage = require("../utils/fb-storage")
    // const storage = new Storage(path.join(__dirname, `../../.config/key/fb/${datasetName}.fb.key.json`))


    // const delay = (ms, msg) => new Promise(resolve => {
    //     console.info(`Wait ${ms} for ${msg} settings`)
    //     setTimeout(() => resolve(), ms)
    // })

    // const mem = (msg) => {
    //     const used = process.memoryUsage();
    //     console.log(`${msg} :Memory usage: ${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`);
    //     return used.rss
    // }


    let data = require("./taged-records-doublicates.json")
        .filter(d => d.groupSize > 1)

    let ops = flatten(
        data.map(d => d.records.map(r => ({
            updateOne: {
                filter: { id: r.id },
                update: {
                    $set: {
                        doublicates: d.records.filter(db => db.id != r.id).map(db => db.id)
                    }
                },
                upsert: false
            }
        }))))

    
    await mongodb.execute.bulkWrite(`sparrow.${datasetName}`, ops)

    // console.log(JSON.stringify(ops, null, " "))

    // const resolveSoundFile = async buffer => {

    //     let ops = []

    //     for (let i = 0; i < buffer.length; i++) {
    //         let labeling = buffer[i]
    //         process.stdout.write(`Check: (${i} ${labeling["Examination ID"]}) ${labeling.path}           ${'\x1b[0G'}`)
    //         let metadata = await storage.getFileMetadata(`${labeling.path}`)

    //         // if (!seg) {
    //             labeling.fileMetadata = metadata
    //             ops.push({
    //                 replaceOne: {
    //                     "filter": { id: labeling.id },
    //                     "replacement": labeling,
    //                     "upsert": false
    //                 }
    //             })
    //         // }
    //     }
    //     // console.log()
    //     return ops
    // }    


    // console.log("Check sound files:")

    // const PAGE_SIZE = 50
    // let skip = 0
    // let buffer = []
    // bufferCount = 0

    // do {

    //     const pipeline = [
    //         {
    //             '$match': {
    //                 fileMetadata: {
    //                     $exists: false
    //                 }
    //             }
    //         },
    //         {
    //             '$sort': {
    //                 'Examination ID': 1
    //             }
    //         },
    //         // {
    //         //   $skip: skip 
    //         // },
    //         {
    //             '$limit': PAGE_SIZE
    //         }
    //     ]

    //     buffer = await mongodb.execute.aggregate(`sparrow.${datasetName}`, pipeline)
    //     if (buffer.length > 0) {
    //         console.log(`Buffer: ${bufferCount} starts at ${skip} (${buffer.length} items)`) // \n${buffer.map(d => d["Examination ID"]+":"+d.id+":"+d.path).join("\n")}`)
    //         let ops = await resolveSoundFile(buffer)

    //         if (ops.length > 0) {
    //             await mongodb.execute.bulkWrite(`sparrow.${datasetName}`, ops)
    //         }


    //         console.log(`Update ${ops.length} items`) //:\n${ops.map( d => d.replaceOne.replacement["Examination ID"]+":"+d.replaceOne.replacement.id).join("\n")}`)
    //         mem()
    //         await delay(2000, "wait for fetch next buffer")

    //     }

    //     skip += buffer.length
    //     bufferCount++

    // } while (buffer.length > 0)


    mongodb.close()

}

run()