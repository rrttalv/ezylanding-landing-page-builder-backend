import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import Template from '../models/Template'
import path from 'path'
import { checkIfObjectExists, getAssetS3Url, getAssetStringFromS3, getTemplateAssetS3Url, getTemplateFromS3, saveAssetInS3, saveThumbnailInS3 } from '../utils/aws'
import multer from 'multer'
import Asset, { saveAsset } from '../models/Asset'
import { resizePreviewImage } from '../utils/helpers'
import { camelCase as dashToCamel } from 'lodash'
import stripeLib from 'stripe'
import fs from 'fs'
import StripeItem from '../models/StripeItem'
import dotenv from 'dotenv'
import User from '../models/User'
import Subscription, { initSubscription, completeSubscription, findActiveSubscription } from '../models/Subscription'
import PaymentMethod, { createPaymentMethod, changeDefaultMethod } from '../models/PaymentMethods'
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

router.get('/billing/subscription', async(req, res, next) => {
  try{
    if(!req.user){
      return next('No valid user')
    }
    const sub = await findActiveSubscription(req.user._id)
    const subscription = await stripe.subscriptions.retrieve(
      sub.subscriptionId
    )
    if(!sub || !subscription){
      return next('No active subscription')
    }
    const keys = ['created', 'current_period_end', 'current_period_start']
    const nestedKeys = ['unit_amount_decimal']
    let subscriptionDetails = {}
    keys.forEach(key => {
      //Handle the subscription timestamp conversion stuff automatically
      subscriptionDetails[dashToCamel(key)] = subscription[key] * 1000
    })
    const { items: { data } } = subscription
    const [firstItem] = data
    const { plan: { interval, amount_decimal, active } } = firstItem
    const amount = Number(amount_decimal)
    subscriptionDetails = {
      ...subscriptionDetails,
      interval,
      cancelled: sub.cancelled,
      amount: amount,
      amountConverted: amount / 100,
      active
    }
    res.json({ subscriptionDetails })
  }catch(err){
    console.log(err)
    return next(err)
  }
})

router.post('/billing/payment-intent', async(req, res, next) => {
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
    //Delete all old inactive subscription attempts
    await Subscription.deleteMany({ user: user._id, valid: { $eq: false }, confirmed: { $eq: false }, startDate: { $eq: null }, endDate: { $eq: null } })
    const stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        { price: item.stripeId }
      ],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    })
    const { 
      latest_invoice: { payment_intent: { id: paymentIntentId, client_secret: clientSecret } }, 
      id: subscriptionId 
    } = stripeSubscription
    await initSubscription(user._id, item.price, customerId, paymentIntentId, item.tag, subscriptionId)
    res.send({
      subscriptionId,
      paymentIntentId,
      clientSecret
    })
  }catch(err){
    console.log(err)
    next(err)
  }
})

router.put('/billing/discard-subscription', async(req, res, next) => {
  try{
    if(!req.user){
      return next('No valid user')
    }
    const { subscriptionId } = req.body
    const subscription = await Subscription.findOne({ subscriptionId, user: req.user._id, valid: { $ne: true } })
    if(!subscription){
      return next('Subscription is already active')
    }
    await Subscription.deleteOne({ _id: subscription._id })
    await stripe.subscriptions.del(
      subscriptionId
    )
    res.json({ status: true })
  }catch(err){
    console.log(err)
    next(err)
  }
})

router.post('/billing/create-method', async(req, res, next) => {
  if(!req.user){
    return next('No user')
  }
  try{
    const { paymentMethodId } = req.body
    const user = await User.findOne({ _id: req.user._id })
    const paymentMethod = await stripe.paymentMethods.attach(
      paymentMethodId,
      {customer: user.stripeCustomerId}
    )
    //brand, expiryMonth, expiryYear, lastDigits, stripePaymentMethodId, stripeCustomerId, user, setDefault = false
    if(paymentMethod){
      const { brand, exp_month, exp_year, last4, id: methodId, billing_details: { name } } = paymentMethod
      const method = await createPaymentMethod(brand, exp_month, exp_year, last4, methodId, user.stripeCustomerId, user._id, name)
      if(method.default){
        await stripe.customers.update(user.stripeCustomerId, { invoice_settings: { default_payment_method: methodId } })
      }
      return res.json({ status: true })
    }else{
      return res.status(400).json({ status: false, message: 'Failed to create payment method' })
    }
  }catch(err){
    console.log(err)
    next(err)
  }
})

router.get('/billing/payment-methods', async(req, res, next) => {
  try{
    if(!req.user){
      return next('No user found')
    }
    const methods = await PaymentMethod.find({ user: req.user._id })
    res.json({ methods })
  }catch(err){
    console.log(err)
    next(err)
  }
})

router.put('/billing/update-payment-method', async(req, res, next) => {
  try{
    const { methodId } = req.body
    if(!req.user || !methodId){
      return res.status(400).json({ status: false })
    }
    const user = await User.findOne({ _id: req.user._id })
    const method = await PaymentMethod.findOne({ _id: methodId })
    if(!method || !user){
      return next('No matching payment method or user found')
    }
    await stripe.customers.update(user.stripeCustomerId, { invoice_settings: { default_payment_method: method._id } })
    await changeDefaultMethod(user._id, method._id)
    const methods = await PaymentMethod.find({ user: user._id })
    res.json({ methods })
  }catch(err){
    console.log(err)
    next(err)
  }
})

router.get('/stripe/callback', async(req, res, next) => {
  try{
    const { intentId, subscriptionId } = req.query
    const { APP_URL: appUrl } = process.env
    if(!req.user){
      return res.redirect(appUrl + '/auth')
    }
    const user = await User.findOne({ _id: req.user._id })
    if(!user || !user.stripeCustomerId){
      return res.redirect(appUrl + '/profile?billing=true&billingError=noCustomer')
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(intentId)
    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    })
    const currentPaymentMethod = await stripe.paymentMethods.retrieve(
      paymentIntent.payment_method
    )
    const existingMethod = await PaymentMethod.findOne(({ stripePaymentMethodId: currentPaymentMethod.id, stripeCustomerId: user.stripeCustomerId }))
    if(!existingMethod){
      const { card: { brand, exp_month, exp_year, last4 }, id: methodId } = currentPaymentMethod
      const method = await createPaymentMethod(brand, exp_month, exp_year, last4, methodId, user.stripeCustomerId, user._id)
    }
    let activateSubscription = false
    let billingError = null
    switch(paymentIntent.status){
      case "succeeded":
        activateSubscription = true
        break
      case "processing":
        activateSubscription = false
        billingError = 'paymentProcessing'
        break
      case "payment_failed":
        activateSubscription = false
        billingError = 'paymentFailed'
        break
      default:
        break
    }
    const subscription = await Subscription.findOne({ stripeCustomerId: user.stripeCustomerId, subscriptionId, paymentIntentId: paymentIntent.id }).sort({ createdAt: -1 })
    if(!subscription){
      return res.redirect(appUrl + '/profile?activeView=billing&billingError=noSub')
    }
    if(activateSubscription){
      const item = await StripeItem.findOne({ tag: subscription.subscriptionTag })
      const stripeSubscription = await stripe.subscriptions.update(
        subscriptionId,
        { default_payment_method: paymentIntent.payment_method },
      )
      const completed = await completeSubscription(paymentIntent.id, stripeSubscription.id)
      if(!completed){
        return res.redirect(appUrl + '/profile?billing=true&billingError=failedSubUpdate')
      }else{
        return res.redirect(appUrl + '/profile?billing=true')
      }
    }else{
      return res.redirect(appUrl + `/profile?billing=true&billingError=${billingError}`)
    }
  }catch(err){
    console.log(err)
    return res.redirect(process.env.APP_URL + '/profile?billing=true&billingError=unknown')
  }
})

//NEED RAW BODY
router.post('/stripe/webhook', async(req, res, next) => {
  const sig = req.headers['stripe-signature']
  const secret = process.env.ENV === 'development' ? 'whsec_75024d912297a8aa4d34be5b515e101f2a702d234e6408f624bd98c488669706' : process.env.STRIPE_ENDPOINT_SECRET
  let event = null
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret)
  } catch (err) {
    console.log(err)
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