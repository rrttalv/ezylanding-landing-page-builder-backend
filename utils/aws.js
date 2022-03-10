import aws from 'aws-sdk'
import dotenv, { config } from 'dotenv'
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

export const saveTemplate = async (templateId, contents) => {
  const { AWS_BUCKET: Bucket } = process.env
  try{
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

export const getTemplate = async (templateId) => {
  try{
    const s3 = getS3Client()
    const Key = `templates/${templateId}.json`
    const params = {
      Bucket,
      Key
    }
    const data = await s3.getObject(params)
    return JSON.parse(new Buffer(data.Body).toString("utf8"))
  }catch(err){
    console.log(err)
    return err
  }
}