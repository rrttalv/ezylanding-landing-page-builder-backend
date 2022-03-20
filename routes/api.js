import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import Template from '../models/Template'
import path from 'path'
import { checkIfObjectExists, getAssetS3Url, getAssetStringFromS3, getTemplateAssetS3Url, getTemplateFromS3, saveAssetInS3, saveThumbnailInS3 } from '../utils/aws'
import multer from 'multer'
import Asset, { saveAsset } from '../models/Asset'
import { resizePreviewImage } from '../utils/helpers'
import fs from 'fs'

const upload = multer({ dest: './temp' })

const router = new express.Router()

router.get('/template', async (req, res, next) => {
  try{
    const { templateId } = req.query
    const template = await Template.findOne({ templateId })
    if(!template){
      return next('Template does not exist')
    }
    const templateJSON = await getTemplateFromS3(templateId)
    const { title, tags } = template
    const metadata = { title, tags }
    res.json({
      template: templateJSON,
      metadata
    })
  }catch(err){
    console.log(err)
    next(err)
  }
})

router.post('/template/thumbnail', upload.single('thumbnail'), async(req, res, next) => {
  try{
    const { _id } = req.user
    const { templateId } = req.query
    const { filename, originalname } = req.file
    const pathToFile = path.join(__dirname, `../temp/${filename}`)
    const nameArr = originalname.split('.')
    const extension = nameArr[nameArr.length - 1]
    const file = await fs.promises.readFile(pathToFile)
    const thumb = await resizePreviewImage(file)
    await saveThumbnailInS3(thumb, templateId, 'thumb', 'jpeg')
    await saveThumbnailInS3(file, templateId, 'preview', 'png')
    res.json({ status: true })
    await fs.promises.unlink(pathToFile)
  }catch(err){
    console.log(err)
  }
})

router.get('/templates', async(req, res, next) => {
  try{
    const { pageNo } = req.query
    const page = Number(pageNo)
    const skip = page * 10
    const found = await Template.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10).skip(skip).lean()
    const templates = await Promise.all(found.map(async template => {
      let thumbnail = null
      const { templateId } = template
      const thumbkey = `templates/${templateId}_thumb`
      try{
        const thumbExists = await checkIfObjectExists(thumbkey + '.jpeg', process.env.AWS_BUCKET)
        if(thumbExists){
          thumbnail = getTemplateAssetS3Url(thumbkey, 'jpeg')
        }
      }catch(err){
        console.log(err)
        thumbnail = null
      }
      return {
        ...template,
        thumbnail
      }
    }))
    const isMore = templates.length >= 10
    res.json({ templates, isMore })
  }catch(err){
    console.log(err)
    next(err)
  }
})

router.get('/assets', async (req, res, next) => {
  try{
    const { pageNo, keyword } = req.query
    const skip = Number(pageNo) * 15
    let userId = null
    if(req.user){
      //userId = req.user._id
    }
    const assets = await Asset.find({ user: userId, deleted: { $ne: true } }).sort({ createdAt: -1 }).limit(15).skip(skip)
    const isMore = assets.length === 15
    const assetList = await Promise.all(assets.map(async asset => {
      const { extension, name, _id, originalName } = asset
      const exists = await checkIfObjectExists(`media/${_id}.${extension}`, process.env.AWS_BUCKET)
      if(!exists){
        return null
      }
      const rawSVG = extension === 'svg'
      const parsed = {
        isUpload: true,
        extension,
        rawSVG,
        name,
        originalName,
        id: _id,
        url: getAssetS3Url(_id, extension)
      }
      if(rawSVG){
        parsed.svgString = await getAssetStringFromS3(_id, extension)
      }
      return parsed
    }))
    const loadedAssets = await assetList.filter(asset => asset)
    res.json({
      assets: loadedAssets,
      isMore
    })
  }catch(err){
    console.log(err)
    next(err)
  }
})

router.post('/assets', upload.single('file'), async (req, res, next) => {
  try{
    const uploadedAsset = req.file
    const { originalname, mimetype, filename } = uploadedAsset
    const pathToFile = path.join(__dirname, `../temp/${filename}`)
    const nameArr = originalname.split('.')
    const extension = nameArr[nameArr.length - 1]
    const asset = await saveAsset(req.user._id, filename, extension, originalname)
    await saveAssetInS3(pathToFile, asset._id, extension)
    const rawSVG = extension === 'svg'
    const parsed = {
      originalName: originalname,
      rawSVG,
      name: filename,
      isUpload: true,
      id: asset._id,
      url: getAssetS3Url(asset._id, extension)
    }
    if(rawSVG){
      parsed.svgString = await getAssetStringFromS3(asset._id, extension)
    }
    res.json({
      asset: parsed
    })
  }catch(err){
    console.log(err)
    next(err)
  }
})

export default router