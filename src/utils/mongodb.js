const mongo = require('mongodb').MongoClient
const { loadYaml } = require("./file-system")
const path = require("path")

const config = loadYaml(path.join(__dirname,"../../.config/db/mongodb.conf.yml"))
// console.log(config)

let client, db

const init = async () => {
	client = await mongo.connect(config.db.url, {
	    useNewUrlParser: true,
	    useUnifiedTopology: true
	})

	db = client.db(config.db.name)
}


const normalize = str => {
	str = str.split(".")
	return {
		dbName: str[0],
		collectionName: str[1]
	}
}	

const aggregate = async (collectionName, pipeline) => {
	let conf = normalize(collectionName)
	let db = client.db(conf.dbName)
    let collection = db.collection(conf.collectionName)
    pipeline = pipeline || []
    let res = await collection.aggregate(pipeline.concat([{$project:{_id:0}}])).toArray()
    return res
}

const getAggregateCursor =  (collectionName, pipeline) => {
	let conf = normalize(collectionName)
	let db = client.db(conf.dbName)
    let collection = db.collection(conf.collectionName)
    pipeline = pipeline || []
    let res = collection.aggregate(pipeline.concat([{$project:{_id:0}}]))
    return res
}

const removeAll = async (collectionName) => {
	let conf = normalize(collectionName)
	let db = client.db(conf.dbName)
    let collection = db.collection(conf.collectionName)
    await collection.deleteMany({})
} 

const insertAll = async (collectionName, data) => {
	let conf = normalize(collectionName)
	let db = client.db(conf.dbName)
    let collection = db.collection(conf.collectionName)
    // for( let i = 0; i< data.length; i++){
    // 	await collection.insert(data[i])	
    // }

	await collection.insertMany(data)
}

const bulkWrite = async (collectionName, commands) => {
	let conf = normalize(collectionName)
	let db = client.db(conf.dbName)
    let collection = db.collection(conf.collectionName)
	await collection.bulkWrite(commands)
}

const replaceOne = async (collectionName, filter, data) => {
	let conf = normalize(collectionName)
	let db = client.db(conf.dbName)
    let collection = db.collection(conf.collectionName)
    await collection.replaceOne(filter, data, {upsert: true})
}

const updateOne = async (collectionName, filter, data) => {
	let conf = normalize(collectionName)
	let db = client.db(conf.dbName)
    let collection = db.collection(conf.collectionName)
    await collection.updateOne(filter, { $set:data }, { upsert: true })
}

const listCollections = async dbSchema => {
		
	let conf = normalize(dbSchema)
	const res =  await client
					.db(conf.dbName)
    				.listCollections()
    				.toArray()
	return res
	
}



module.exports =  async () => {
	await init()
	return {
		client,
		db,
		config,

		close: () => {
			if(client){
				client.close()
			}
		},
		
		execute:{
			aggregate,
			removeAll,
			insertAll,
			replaceOne,
			updateOne,
			bulkWrite,
			listCollections,
			getAggregateCursor	
		}
		
	}
}