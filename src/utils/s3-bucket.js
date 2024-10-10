const { readFileSync } = require("fs")
const { extend, findIndex, last, flatten, sortBy, first, find, keys, isFunction } = require("lodash")
const path = require("path")
const { lookup } = require("mime-types")
const nanomatch = require('nanomatch')
const fsp = require("fs").promises

///////////////////////////////////////////////////////////////////////////////

const Queue = require("queue-promise")
queue = new Queue({
    concurrent: 1,
    interval: 2
})

queue.on("start", () => { console.log("start") })
queue.on("stop", () => {})
queue.on("resolve", data => {})
queue.on("reject", error => { console.log(error) })
queue.start()

////////////////////////////////////////////////////////////////////////////////


const {

    ListObjectsCommand,
    HeadObjectCommand,

    GetObjectCommand,

    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand,
    PutObjectCommand,

    DeleteObjectsCommand,
    waitUntilObjectNotExists,

    CopyObjectCommand,
    ObjectNotInActiveTierError,
    waitUntilObjectExists,

    S3Client

} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")

// TODO transfer into settings

const settings = require("../../.config/key/s3/s3.settings.json")
let bucket = settings.bucket.default
console.log("S3 bucket:", bucket)

const client = new S3Client(settings.access)


const setBucket = bucketAlias => {
    bucket = settings.bucket[bucketAlias] || settings.bucket.default
}


const list = async path => {
    try {
        path = path || "**/*"
        let Prefix = path.split("/")
        Prefix = Prefix.slice(0, findIndex(Prefix, d => /\*/.test(d))).join("/")
        Prefix = (!Prefix) ? undefined : Prefix + "/"
        let { Contents } = await client.send(new ListObjectsCommand({
            Bucket: bucket,
            Prefix
        }))
        let items = Contents || []
        let names = items.map(d => d.Key)
        names = nanomatch(names, path)
        return items.filter(d => names.includes(d.Key))
    } catch (e) {
        console.error("s3-bucket.list:", e.toString(), e.stack)
        throw e
    }
}

const dir = async path => {
    try {
        path = path || "**/*"
        let Prefix = path.split("/").filter(d => d)
        if ((!/\*/.test(last(Prefix)))) {
            Prefix.push("*")
        }
        path = Prefix.join("/")
        Prefix = Prefix.slice(0, findIndex(Prefix, d => /\*/.test(d))).join("/")
        Prefix = (!Prefix) ? undefined : Prefix + "/"
        let { CommonPrefixes } = await client.send(new ListObjectsCommand({
            Bucket: bucket,
            Delimiter: "/",
            Prefix
        }))

        let items = CommonPrefixes || []
        let names = items.map(d => d.Prefix)
        names = nanomatch(names, path)
        return items
            .filter(d => names.includes(d.Prefix))
            .map(item => item.Prefix.replace(Prefix, "").replace("/", ""))
    } catch (e) {
        console.error("s3-bucket.dir:", e.toString(), e.stack)
        throw e
    }
}

const tree = async path => {
    try {
        path = path || "**/*"
        path = (/\*/.test(path)) ? path : (path.endsWith("/")) ? `${path}*` : `${path}/*`
        let Prefix = path.split("/").filter(d => d)
        if ((!/\*/.test(last(Prefix)))) {
            Prefix.push("*")
        }
        Prefix = Prefix.slice(0, findIndex(Prefix, d => /\*/.test(d))).join("/")
        Prefix = (!Prefix) ? undefined : Prefix + "/"
        let { CommonPrefixes } = await client.send(new ListObjectsCommand({
            Bucket: bucket,
            Delimiter: "/",
            Prefix
        }))

        let items = CommonPrefixes || []
        if (items.length == 0) {
            let files = await list(`${Prefix}*.*`)
            items = items.concat(files.map(d => ({ Prefix: d.Key })))
        }
        let names = items.map(d => d.Prefix)
        names = nanomatch(names, path)
        items = items.filter(d => names.includes(d.Prefix))

        for (let n of names) {
            let p = (Prefix) ? Prefix.split("/") : []
            p.push(last(n.split("/").filter(d => d)))
            p = p.filter(d => d).join("/")
            let childs = await tree(p)
            items = flatten(items.concat(childs))
        }

        return sortBy(items, d => d.prefix)
    } catch (e) {
        console.error("s3-bucket.tree:", e.toString(), e.stack)
        throw e
    }
}


const metadata = async target => {
    try {
        let {
            AcceptRanges,
            LastModified,
            ContentLength,
            ETag,
            VersionId,
            ContentType,
            ServerSideEncryption,
            Metadata
        } = await client.send(new HeadObjectCommand({
            Bucket: bucket,
            Key: target
        }))

        return {
            Key: target,
            AcceptRanges,
            LastModified,
            ContentLength,
            ETag,
            VersionId,
            ContentType,
            ServerSideEncryption,
            Metadata
        }
    } catch (e) {
        console.error("s3-bucket.metadata:", e.toString(), e.stack)
        throw e
    }
}


const deleteFiles = async path => {

    let deletedItems = await list(path)
    let Keys = deletedItems.map(d => d.Key)

    if (Keys.length == 0) return

    await client.send(
        new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
                Objects: Keys.map(Key => ({ Key })),
            }
        })
    )
    await Promise.all(Keys.map(Key => waitUntilObjectNotExists({ client }, { Bucket: bucket, Key }, )))

}


const getStream = async source => {
    try {
        let res = await client.send(
            new GetObjectCommand({
                Bucket: bucket,
                Key: source
            })
        )
        return res
    } catch (e) {
        console.error("s3-bucket.getStream:", e.toString(), e.stack)
        throw e
    }
}


const download = async ({ source, target }) => new Promise(async (resolve, reject) => {
    try {
        let file = await getStream(source)
        let writeStream = createWriteStream(target)
        writeStream
            .on('end', resolve)
            .on('error', reject)
        let content = await file.Body.transformToByteArray()
        writeStream.write(content);
    } catch (e) {
        console.error("s3-bucket.download:", e.toString(), e.stack)
        reject(e)
    }
})


const getPresignedUrl = async source => {
    try {
        const command = new GetObjectCommand({ Bucket: bucket, Key: source })
        let res = await getSignedUrl(client, command, { expiresIn: 3600 })
        return res
    } catch (e) {
        console.error("s3-bucket.getPresignedUrl:", e.toString(), e.stack)
        reject(e)
    }
}


// upload file with size <= 20Mb

const uploadLt20M = async ({ source, target }) => {
    try {
        const fileContent = readFileSync(source)
        const ContentType = lookup(path.extname(`./${target}`))
        await client.send(
            new PutObjectCommand({
                Bucket: bucket,
                Body: fileContent,
                Key: target,
                ContentType
            })
        )
    } catch (e) {
        console.error("s3-bucket.uploadLt20M:", e.toString(), e.stack)
        throw e
    }
}


// multypart upload,  chunk size must be >= 6Mb

const uploadChunks = async ({ chunks, target, size, callback = (() => {}) }) => {

    let uploadId

    try {
        const ContentType = lookup(path.extname(`./${target}`))

        let options = {
            Bucket: bucket,
            Key: target
        }

        uploadId = (await client.send(new CreateMultipartUploadCommand(extend({}, options, { ContentType })))).UploadId
        let uploadedBytes = 0

        const uploadResults = await Promise.all(chunks.map((chunk, i) => {
            let buffer = readFileSync(chunk)
            return client
                .send(
                    new UploadPartCommand(
                        extend({}, options, {
                            UploadId: uploadId,
                            Body: buffer,
                            PartNumber: i + 1
                        }))
                )
                .then((d) => {
                    uploadedBytes += buffer.length
                    callback({
                        target,
                        uploadedBytes,
                        percents: (size) ? Number.parseFloat((uploadedBytes / size).toFixed(3)) : 0,
                        status: "processed"
                    })
                    return d;
                })
        }))

        await client.send(new CompleteMultipartUploadCommand(
            extend({}, options, {
                UploadId: uploadId,
                MultipartUpload: {
                    Parts: uploadResults.map(({ ETag }, i) => ({
                        ETag,
                        PartNumber: i + 1,
                    }))
                }
            })))

        callback({
            target,
            uploadedBytes: size,
            percents: 1,
            status: "done"
        })


    } catch (e) {

        console.error("s3-bucket.uploadChunks:", e.toString(), e.stack)

        if (uploadId) {
            const abortCommand = new AbortMultipartUploadCommand(
                extend({}, options, { UploadId: uploadId })
            )
            await client.send(abortCommand);
        }
    }
}


const uploadFromSplitter = async ({ splitter, source, dest, chunkSize, target, size, callback = (() => {}) }) => {

    let uploadId

    try {

        const ContentType = lookup(path.extname(`./${target}`))

        let options = {
            Bucket: bucket,
            Key: target
        }

        let uploadedBytes = 0
        let uploadResults = []

        splitter.on("start", async () => {
            // console.log("start", source, chunkSize, dest)
            uploadId = (await client.send(new CreateMultipartUploadCommand(extend({}, options, { ContentType })))).UploadId
        })

        splitter.on("chunk", async (chunk) => {
            // console.log("chunk", source, chunkSize, dest, chunk)
            let buffer = readFileSync(chunk.file)
            let d = await client
                .send(
                    new UploadPartCommand(
                        extend({}, options, {
                            UploadId: uploadId,
                            Body: buffer,
                            PartNumber: chunk.partNumber
                        }))
                )
            uploadedBytes += buffer.length
            callback({
                target,
                uploadedBytes,
                percents: (size) ? Number.parseFloat((uploadedBytes / size).toFixed(3)) : 0,
                status: "processed"
            })
            uploadResults.push(d)
            await fsp.unlink(chunk.file)
        })

        splitter.on("finish", async () => {
            // console.log("finish", source, chunkSize, dest)
            await client.send(new CompleteMultipartUploadCommand(
                extend({}, options, {
                    UploadId: uploadId,
                    MultipartUpload: {
                        Parts: uploadResults.map(({ ETag }, i) => ({
                            ETag,
                            PartNumber: i + 1,
                        }))
                    }
                })))

            callback({
                target,
                uploadedBytes: size,
                percents: 1,
                status: "done"
            })

            await fsp.unlink(source)

        })

        await splitter.run(source, chunkSize, dest)

    } catch (e) {

        console.error("s3-bucket.uploadChunks:", e.toString(), e.stack)

        if (uploadId) {
            const abortCommand = new AbortMultipartUploadCommand(
                extend({}, options, { UploadId: uploadId })
            )
            await client.send(abortCommand);
        }
    }
}


const copyObject = async ({
    sourceBucket,
    sourceKey,
    destinationBucket,
    destinationKey,
}) => {

    try {
        await client.send(
            new CopyObjectCommand({
                CopySource: `${sourceBucket}/${sourceKey}`,
                Bucket: destinationBucket,
                Key: destinationKey,
            }),
        );
        await waitUntilObjectExists({ client }, { Bucket: destinationBucket, Key: destinationKey }, );
        // console.log(
        //     `Successfully copied ${sourceBucket}/${sourceKey} to ${destinationBucket}/${destinationKey}`,
        // );
    } catch (caught) {
        if (caught instanceof ObjectNotInActiveTierError) {
            console.error(
                `Could not copy ${sourceKey} from ${sourceBucket}. Object is not in the active tier.`,
            );
        } else {
            throw caught;
        }
    }
}

const copy = async ({ source, target, callback }) => {
    
    callback = (callback && isFunction(callback)) ? callback : (() => {})

    let defaultAlias = find(keys(settings.bucket), key => settings.bucket[key] == bucket) || "default"
    
    let sourceBucketAlias = (/\:/.test(source)) ? first(source.split(":")).trim() || defaultAlias : defaultAlias
    let targetBucketAlias = (/\:/.test(target)) ? first(target.split(":")).trim() || defaultAlias : defaultAlias

    let sourceBucket = settings.bucket[sourceBucketAlias]
    let sourcePath = (/\:/.test(source)) ? last(source.split(":")).trim() : source

    let targetBucket = settings.bucket[targetBucketAlias]
    let targetPath = (/\:/.test(target)) ? last(target.split(":")).trim() : target
    targetPath = (targetPath.endsWith("/")) ? targetPath : `${targetPath}/`

    let homedir = sourcePath.split("/")
    homedir = homedir.slice(0, findIndex(homedir, d => /\*/.test(d))).join("/")
    homedir = (!homedir) ? undefined : homedir

    let fileList = await list(sourcePath)

    let operations = fileList.map( f => ({
        sourceBucketAlias,
        sourceBucket,
        sourceKey: f.Key,
        destinationBucketAlias: targetBucketAlias,
        destinationBucket: targetBucket,
        destinationKey: `${targetPath}${f.Key.replace(homedir, "").substring(1)}`
    }))

    for(let operation of operations){
        await copyObject(operation)
        callback(operation)
    }

}


module.exports = {
    setBucket,
    dir,
    copy,
    copyObject,
    tree,
    list,
    metadata,
    info: metadata,
    getStream,
    download,
    getPresignedUrl,
    uploadLt20M,
    uploadChunks,
    deleteFiles,
    uploadFromSplitter
}