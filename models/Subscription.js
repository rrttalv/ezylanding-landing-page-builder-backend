import mongoose, { Schema } from 'mongoose'

const SubscriptionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user'
  },
  subscriptionId: {
    type: String
  },
  startDate: {
    type: Date
  },
  valid: {
    type: Boolean,
    default: false
  },
  endDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  confirmed: {
    type: Boolean,
    default: false
  },
  paymentIntentId: {
    type: String
  },
  //The stripe item tag
  subscriptionTag: {
    type: String
  },
  stripeCustomerId: {
    type: String
  },
  price: {
    type: Number
  },
  cancelled: {
    type: Boolean,
    default: false
  }
})


const Subscription = mongoose.model('Subscription', SubscriptionSchema)

export default Subscription

export const initSubscription = async (user, price, stripeCustomerId, paymentIntentId, subscriptionTag, subscriptionId) => {
  return await Subscription.create({
    user,
    price,
    stripeCustomerId,
    paymentIntentId,
    subscriptionTag,
    subscriptionId
  })
}

export const completeSubscription = async (paymentIntentId, subscriptionId) => {
  const subscription = await Subscription.findOne({ paymentIntentId })
  if(!subscription){
    return false
  }
  const startDate = new Date()
  const endDate = subscription.subscriptionTag === 'yearly' ? new Date().setFullYear(new Date().getFullYear() + 1) : new Date().setMonth(new Date().getMonth() + 1)
  await Subscription.updateOne({ _id: subscription._id }, { $set: { startDate, endDate, valid: true, confirmed: true, subscriptionId } })
  return true
}

export const setSubscriptionId = async (stripeCustomerId, id) => {
  const subscription = await Subscription.findOne({ stripeCustomerId })
}

export const findActiveSubscription = async user => {
  const selectString = 'subscriptionTag _id valid confirmed subscriptionId stripeCustomerId startDate cancelled endDate'
  return await Subscription.findOne({ user, endDate: { $gte: new Date() }, valid: { $eq: true } }).select(selectString)
}