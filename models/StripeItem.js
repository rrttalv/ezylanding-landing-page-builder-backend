import mongoose, { Schema } from 'mongoose'

const ItemSchema = new Schema({
  name: {
    type: String
  },
  stripeId: {
    type: String
  },
  tag: {
    type: String
  },
  price: {
    type: Number
  }
})

const StripeItem = mongoose.model('StripeItem', ItemSchema)

export default StripeItem