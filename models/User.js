import mongoose, { Schema } from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
dotenv.config()

const UserSchema = new Schema({
  email: {
    type: String
  },
  password: {
    type: String
  },
  twitterProfileId: {
    type: String
  },
  googleId: {
    type: String
  },
  githubId: {
    type: String
  },
  billingInfo: {
    firstName: {
      type: String
    },
    lastName: {
      type: String
    }
  },
  level: {
    type: Number,
    default: 1
  }
})


const User = mongoose.model('User', UserSchema)

export const createUser = async (email, rawPassword) => {
  const password = await bcrypt.hash(rawPassword, process.env.PASSWORD_SALT)
  return await User.create({
    email: email,
    password
  })
}

export const findOrCreateOauth = async (email, googleId = null, twitterId = null, githubId = null) => {
  let user = null
  if(googleId){
    user = await User.findOne({ googleId })
  }
  if(twitterId){
    user = await User.findOne({ twitterId })
  }
  if(githubId){
    user = await User.findOne({ githubId })
  }
  if(user){
    return user
  }else{
    return await User.create({
      email,
      googleId,
      twitterId,
      githubId
    })
  }
}

export default User