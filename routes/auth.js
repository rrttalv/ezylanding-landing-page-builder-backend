import express from 'express'
import User, { createUser } from '../models/User'
import passport from 'passport'
import dotenv from 'dotenv'
import { validateEmail } from '../utils/helpers'
dotenv.config()

const router = new express.Router()

router.get('/check', async(req, res, next) => {
  try{
    console.log(req.isAuthenticated())
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
    const { password, username } = req.body
    if(!password || !password.length || password.length < 8){
      return res.json({
        success: false,
        message: 'Password must be at least 8 characters long'
      })
    }
    const validEmail = validateEmail(username)
    if(!validEmail){
      return res.json({
        success: false,
        message: 'Invalid email address'
      })
    }
    const existing = await User.findOne({ email: validEmail })
    if(existing){
      return res.json({
        success: false,
        message: 'This email address is already in use'
      })
    }
    const user = await createUser(validEmail, password)
    req.login(user, err => {
      if(err){
        next(err)
      }else{
        res.json({
          success: true,
          redirect: '/dashboard',
          user: { email: user.email, id: user._id }
        })
      }
    })
  }catch(err){
    console.log(err)
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if(err){
      console.log(err)
      return res.json(info)
    }
    if(!user || !info.success){
      return res.json(info)
    }
    console.log(user)
    if(user){
      return res.json({...info, redirect: '/dashboard', user: { email: user.email, id: user._id }})
    }
  })(req, res)
})

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

router.get('/google/callback', passport.authenticate('google'), async (req, res, next) => {
  const { APP_URL } = process.env
  return res.redirect(APP_URL + '/dashboard')
})

export default router