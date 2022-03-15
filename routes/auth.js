import express from 'express'
import User, { createUser } from '../models/User'
import passport from 'passport'
import dotenv from 'dotenv'
import { validateEmail } from '../utils/helpers'
dotenv.config()

const router = new express.Router()

router.get('/check', async(req, res, next) => {
  try{
    if(!req.user){
      return res.status(400).json({ user: null, message: 'No user session found' })
    }
    const user = await User.findOne({ _id: req.user._id }).select('email _id')
    if(user){
      return res.json({ user })
    }
  }catch(err){
    console.log(err)
    next(err)
  }
})

router.post('/register', async (req, res, next) => {
  try{
    const { password, email } = req.body
    if(!password || !password.length || password.length !== 8){
      return res.json({
        success: false,
        message: 'Password must be at least 8 characters long'
      })
    }
    const isValidEmail = validateEmail(email)
    if(!isValidEmail){
      return res.json({
        success: false,
        message: 'Invalid email address'
      })
    }
    const user = await createUser(email, password)
    req.login(user, err => {
      if(err){
        next(err)
      }else{
        res.json({
          success: true,
          redirect: '/dashboard'
        })
      }
    })
  }catch(err){
    console.log(err)
    next(err)
  }
})

router.post('/login', passport.authenticate('local'), async (req, res, next) => {
  return res.json({ success: true, redirect: '/dashboard' })
})

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

router.get('/google/callback', passport.authenticate('google'), async (req, res, next) => {
  const { APP_URL } = process.env
  return res.redirect(APP_URL + '/dashboard')
})

export default router