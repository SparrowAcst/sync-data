
const { readFileSync } = require("fs")
const { extend, findIndex } = require("lodash")
const path = require("path")
const { lookup } = require("mime-types")
const nanomatch = require('nanomatch')

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

    S3Client

} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")

// TODO transfer into settings

const settings = require("../../.config/key/s3/s3.settings.json")
const bucket = settings.bucket.TEST


const client = new S3Client(settings.access)

const list = async path => {
    try {
        path = path || "**/*"
        let Prefix = path.split("/")
        Prefix = Prefix.slice(0, findIndex(Prefix, d => /\*/.test(d))).join("/")
        Prefix = (!Prefix) ? undefined : Prefix +"/"
        let { Contents} = await client.send(new ListObjectsCommand({
            Bucket: bucket,
            Prefix
        }))
        let items = Contents || []
        let names = items.map(d => d.Key)
        names = nanomatch(names, path)
        return items.filter( d => names.includes(d.Key))
    } catch (e) {
        console.error("s3-bucket.list:", e.toString(), e.stack)
        throw e
    }
}


const dir = async path => {
    try {
        let  { CommonPrefixes }  = await client.send(new ListObjectsCommand({
            Bucket: bucket,
            Delimiter: "/",
            Prefix: path
        }))
        if(!CommonPrefixes) return
        return CommonPrefixes.map( item => item.Prefix.replace(path, "").replace("/", ""))
    } catch (e) {
        console.error("s3-bucket.dir:", e.toString(), e.stack)
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
    let Keys = deletedItems.map( d => d.Key)
    
    if(Keys.length == 0) return 
    
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: Keys.map(Key => ({Key})),
        }
      })
    )
    await Promise.all( Keys.map( Key => waitUntilObjectNotExists(
        { client },
        { Bucket: bucket, Key },
      )))

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


module.exports = {
    dir,
    list,
    metadata,
    info: metadata,
    getStream,
    download,
    getPresignedUrl,
    uploadLt20M,
    uploadChunks,
    deleteFiles
}

