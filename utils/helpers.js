export const compileTemplate = (templateId, pages, cssFiles, palette, framework, templateMeta) => {
  return {
    pages,
    templateId,
    cssFiles,
    palette,
    framework,
    templateMeta
  }
}

export const validateEmail = email => {
  if(!email || !email.length){
    return false
  }
  const addr = email.trim().toLowerCase()
  const isMatch = addr.match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)
  return isMatch ? addr : false
}