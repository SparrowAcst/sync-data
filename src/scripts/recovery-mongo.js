const action = require("../actions/recovery-mongo")
const run = async () => {
  const backupFile = process.argv[2] || ""

    await action(backupFile)
}
run()




// const StreamArray = require( 'stream-json/streamers/StreamArray');
// const {Writable} = require('stream');


// const fs = require('fs');
// const {parser} = require('stream-json/jsonl/Parser');


// let index = 0
// const { extend } = require("lodash")

// const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;


// const getMemoryUsage = () => {
// 	const memoryData = process.memoryUsage();

// 	const memoryUsage = {
// 	  rss: `${formatMemoryUsage(memoryData.rss)} -> Resident Set Size - total memory allocated for the process execution`,
// 	  heapTotal: `${formatMemoryUsage(memoryData.heapTotal)} -> total size of the allocated heap`,
// 	  heapUsed: `${formatMemoryUsage(memoryData.heapUsed)} -> actual memory used during the execution`,
// 	  external: `${formatMemoryUsage(memoryData.external)} -> V8 external memory`,
// 	};

// 	return memoryUsage
// }


// const asyncProcess = data => new Promise( (resolve, reject) => {
// 	console.log(JSON.stringify(data))
//     resolve()
// })


// const read = async () => new Promise( (resolve, reject) => {

// 	const fileStream = fs.createReadStream("./.data/sparrow.harvest1.json") //('./sparrow.harvest1.json');
// 	const jsonStream = parser()
// 	fileStream.pipe(jsonStream);
// 	jsonStream.on('data', async ({key, value}) => {
// 		await asyncProcess(value)
// 	});

// 	jsonStream.on('end', () => {
// 		resolve()
// 	});

// }) 

// const run = async () => {
// 	await read()
// }

// run()