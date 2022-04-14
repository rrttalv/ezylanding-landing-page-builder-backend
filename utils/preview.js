import puppeteer from 'puppeteer'
import dotenv from 'dotenv'

let browser

const launchBrowser = async () => {
  try{
    browser = await puppeteer.launch()
  }catch(err){
    console.log(err)
  }
}

launchBrowser()

export const renderPreviewImage = async html => {
  if(!browser.isConnected()){
    browser = await puppeteer.launch()
  }
  const page = await browser.newPage()
  try{
    await page.setUserAgent(`Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36`)
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const elem = await page.$('#root')
    const { height, width } = await elem.boundingBox()
    await page.setViewport({
      width: 1600,
      height: 900,
      deviceScaleFactor: 1
    })
    await page.waitFor(500)
    const image = await page.screenshot({ fullPage: true, encoding: 'base64' })
    await page.close()
    return image
  }catch(err){
    console.log(err)
    await page.close()
  }
}