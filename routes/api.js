import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import Template from '../models/Template'
import path from 'path'
import { checkIfObjectExists, getAssetS3Url, getAssetStringFromS3, getTemplateAssetS3Url, getTemplateFromS3, saveAssetInS3, saveThumbnailInS3 } from '../utils/aws'
import multer from 'multer'
import Asset, { saveAsset } from '../models/Asset'
import { resizePreviewImage } from '../utils/helpers'
import stripeLib from 'stripe'
import fs from 'fs'
import StripeItem from '../models/StripeItem'
import dotenv from 'dotenv'
import User from '../models/User'
import Subscription, { initSubscription } from '../models/Subscription'
dotenv.config()

const stripe = stripeLib(process.env.STRIPE_SECRET)

const upload = multer({ dest: './temp' })

const router = new express.Router()

router.get('/template', async (req, res, next) => {
  try{
    const { copy, templateId } = req.query
    if(!req.user){
      return next('No user')
    }
    const template = await Template.findOne({ templateId })
    if(!template){
      return next('Template does not exist')
    }
    if(!copy && String(template.user) !== String(req.user._id)){
      return next('You do not have access to this template')
    }
    if(copy && !template.publicTemplate){
      return next('You do not have access to this template')
    }
    const templateJSON = await getTemplateFromS3(templateId)
    const { title, tags } = template
    const metadata = { title, tags }
    const editorInfo = {
      publicTemplate: copy ? false : template.publicTemplate
    }
    res.json({
      template: templateJSON,
      metadata,
      editorInfo
    })
  }catch(err){
    console.log(err)
    next(err)
  }
})

router.post('/payment-intent', async(req, res, next) => {
  try{
    const { tag } = req.body
    const item = await StripeItem.findOne({ tag })
    if(!req.user){
      return next('No valid user')
    }
    const user = await User.findOne({ _id: req.user._id })
    if(!user){
      return next('No user found')
    }
    let customerId = user.stripeCustomerId
    if(!user.stripeCustomerId){
      const customer = await stripe.customers.create({
        email: user.email
      });
      customerId = customer.id
      await User.updateOne({ _id: user._id }, { $set: { stripeCustomerId: customer.id } })
    }
    if(!item){
      return next('No valid item')
    }
    const existingSubscription = await Subscription.findOne({ user: user._id, valid: { $eq: true } })
    if(existingSubscription){
      return next('You are already a subscriber')
    }
    const intent = await stripe.paymentIntents.create({
      amount: item.price * 100,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: {
        enabled: true
      }
    })
    await initSubscription(user._id, item.price, customerId, intent.id, item.tag)
    res.send({
      clientSecret: intent.client_secret
    })
  }catch(err){
    console.log(err)
    next(err)
  }
})

router.get('/stripe/callback', async(req, res, next) => {

})

router.post('/stripe/webhook', async(req, res, next) => {
  const sig = req.headers['stripe-signature']
  const { STRIPE_ENDPOINT_SECRET } = process.env
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_ENDPOINT_SECRET)
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }
  switch(event.type){
    case 'payment_intent.succeeded':
      //do smth
      break
    case 'payment_intent.payment_failed':
      //do smth
      break
    default: 
      break
  }
  res.send('')
})

router.post('/template/thumbnail', upload.single('thumbnail'), async(req, res, next) => {
  try{
    const { _id } = req.user
    const { templateId } = req.query
    const template = await Template.findOne({ templateId })
    if(!template || !req.user){
      return res.json({ status: true })
    }
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
    /*
    await StripeItem.create({ name: 'Single template', stripeId: 'price_1KfND8DNHncdiETbB857zYIi', tag: 'single', price: 9 })
    await StripeItem.create({ name: 'Monthly plan', stripeId: 'price_1Kg4HeDNHncdiETbfO2Ti3nv', tag: 'monthly', price: 20 })
    await StripeItem.create({ name: 'Yearly plan', stripeId: 'price_1Kg4HeDNHncdiETbYdOsQcqD', tag: 'yearly', price: 200 })
    */
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
      userId = req.user._id
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