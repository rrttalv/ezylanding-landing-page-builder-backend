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
  paymentIntentId: {
    type: String
  },
  subscriptionTag: {
    type: String
  },
  stripeCustomerId: {
    type: String
  },
  price: {
    type: Number
  }
})


const Subscription = mongoose.model('Subscription', SubscriptionSchema)

export default Subscription

export const initSubscription = async (user, price, stripeCustomerId, paymentIntentId, subscriptionTag) => {
  return await Subscription.create({
    user,
    price,
    stripeCustomerId,
    paymentIntentId,
    subscriptionTag
  })
}

export const completeSubscription = async (paymentIntentId) => {
  const subscription = await Subscription.findOne({ paymentIntentId })
  if(!subscription){
    return false
  }
  const startDate = new Date()
  let endDate = new Date().setMonth(new Date().getMonth() + 1)
  if(subscription.tag === 'yearly'){
    endDate = new Date().setFullYear(new Date().getFullYear() + 1)
  }
  await Subscription.updateOne({ _id: subscription._id }, { $set: { startDate, endDate, valid: true } })
  return true
}

export const setSubscriptionId = async (stripeCustomerId, id) => {
  const subscription = await Subscription.findOne({ stripeCustomerId })
}