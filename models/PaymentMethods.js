import mongoose, { Schema } from 'mongoose'

const PaymentMethodSchema = new Schema({
  brand: {
    type: String
  },
  nameOnCard: {
    type: String
  },
  default: {
    type: Boolean,
    default: false
  },
  expiryMonth: {
    type: Number
  },
  expiryYear: {
    type: Number
  },
  lastDigits: {
    type: String
  },
  stripePaymentMethodId: {
    type: String
  },
  stripeCustomerId: {
    type: String
  },
  expired: {
    type: Boolean,
    default: false
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user'
  }
})

const PaymentMethod = mongoose.model('PaymentMethod', PaymentMethodSchema)

export default PaymentMethod

export const createPaymentMethod = async (brand, expiryMonth, expiryYear, lastDigits, stripePaymentMethodId, stripeCustomerId, user, setDefault = false) => {
  const method = {
    brand,
    expiryMonth,
    expiryYear,
    lastDigits,
    stripePaymentMethodId,
    stripeCustomerId,
    user
  }
  return await PaymentMethod.create(method)
}

export const changeDefaultMethod = async (methodId, user) => {
  await PaymentMethod.updateOne({ user: user, default: { $eq: true } }, { $set: { default: false } })
  await PaymentMethod.updateOne({ user: user, _id: methodId }, { $set: { default: true } })
}