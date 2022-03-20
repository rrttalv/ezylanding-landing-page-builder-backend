import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import Template from '../models/Template'
import path from 'path'
import { checkIfObjectExists, getAssetS3Url, getAssetStringFromS3, getTemplateFromS3, saveAssetInS3 } from '../utils/aws'
import multer from 'multer'
import Asset, { saveAsset } from '../models/Asset'

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

router.get('/templates', async(req, res, next) => {
  try{
    const { pageNo } = req.query
    const page = Number(pageNo)
    const skip = page * 10
    const templates = await Template.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10).skip(skip)
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
      //userId = req.user.id
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
    const asset = await saveAsset(null, filename, extension, originalname)
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