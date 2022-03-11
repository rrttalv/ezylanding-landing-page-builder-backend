import aws from 'aws-sdk'
import dotenv, { config } from 'dotenv'
import fs from 'fs'
dotenv.config()

export const getS3Client = () => {
  dotenv.config()
  const {
    AWS_REGION,
    AWS_KEY,
    AWS_SECRET
  } = process.env
  return new aws.S3({
    accessKeyId: AWS_KEY,
    secretAccessKey: AWS_SECRET,
    region: AWS_REGION
  })
}

export const saveTemplateInS3 = async (templateId, contents) => {
  try{
    const { AWS_BUCKET: Bucket } = process.env
    const s3 = getS3Client()
    const Key = `templates/${templateId}.json`
    const params = {
      Bucket,
      Key,
      Body: Buffer.from(JSON.stringify(contents))
    }
    return await s3.upload(params).promise()
  }catch(err){
    console.log(err)
    return err
  }
}

export const getTemplateFromS3 = async (templateId) => {
  try{
    const { AWS_BUCKET: Bucket } = process.env
    const s3 = getS3Client()
    const Key = `templates/${templateId}.json`
    const params = {
      Bucket,
      Key
    }
    const data = await s3.getObject(params).promise()
    return JSON.parse(new Buffer(data.Body).toString("utf8"))
  }catch(err){
    console.log(err)
    return err
  }
}

//Used for SVG fetching
export const getAssetStringFromS3 = async (assetId, extension) => {
  try{
    const { AWS_BUCKET: Bucket } = process.env
    const s3 = getS3Client()
    const Key = `media/${assetId}.${extension}`
    const params = {
      Key,
      Bucket
    }
    const data = await s3.getObject(params).promise()
    return new Buffer(data.Body).toString("utf8")
  }catch(err){
    console.log(err)
    return err
  }
}

export const saveAssetInS3 = async (pathToFile, assetId, extension) => {
  try{
    const { AWS_BUCKET: Bucket } = process.env
    const s3 = getS3Client()
    const Key = `media/${assetId}.${extension}`
    const file = await fs.promises.readFile(pathToFile)
    const params = {
      ACL: 'public-read',
      Key,
      Bucket,
      Body: file
    }
    await s3.upload(params).promise()
    await fs.promises.unlink(pathToFile)
  }catch(err){
    console.log(err)
    return err
  }
}

export const checkIfObjectExists = async (Key, Bucket) => {
  try{
    const s3 = getS3Client()
    const params = {
      Key,
      Bucket
    }
    const head = await s3.headObject(params).promise()
    return true
  }catch(err){
    return false
  }
}

export const getAssetS3Url = (assetId, extension) => {
  return `https://ezylanding-user-assets.s3.amazonaws.com/media/${assetId}.${extension}`
}